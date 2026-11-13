// Package domains manages custom domain registrations, DNS TXT verification,
// and SSL certificate provisioning across the Ecom Ventures platform.
package domains

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"regexp"
	"strings"
	"time"

	"ecom-ventures/backend/internal/platform/models"
	"ecom-ventures/backend/internal/store/resolver"
)

var (
	ErrDomainNotFound      = errors.New("domains: domain record not found")
	ErrDomainConflict      = errors.New("domains: domain is already registered to another store")
	ErrInvalidDomainFormat = errors.New("domains: invalid domain name format")
	ErrVerificationFailed  = errors.New("domains: DNS TXT verification failed, token not found")
	ErrCannotDeletePrimary = errors.New("domains: cannot remove the store's primary active domain")
)

var domainFormatRegex = regexp.MustCompile(`^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$`)

// DomainDetail represents a domain record with store association and DNS setup data.
type DomainDetail struct {
	models.Domain
	StoreName string `json:"store_name"`
	StoreSlug string `json:"store_slug"`
}

// AddDomainRequest holds payload for registering a domain to a store.
type AddDomainRequest struct {
	StoreID   string `json:"store_id"`
	Domain    string `json:"domain"`
	IsCustom  bool   `json:"is_custom"`
	IsPrimary bool   `json:"is_primary"`
}

// Service manages domain registrations, DNS verifications, and edge SSL provisioning.
type Service struct {
	db          *sql.DB
	dnsVerifier DNSVerifier
	cfClient    CloudflareClient
	resolver    *resolver.StoreResolver
}

// NewService instantiates the domain management service.
func NewService(
	db *sql.DB,
	dnsVerifier DNSVerifier,
	cfClient CloudflareClient,
	resolver *resolver.StoreResolver,
) *Service {
	return &Service{
		db:          db,
		dnsVerifier: dnsVerifier,
		cfClient:    cfClient,
		resolver:    resolver,
	}
}

// AddDomain registers a new domain for a store and generates verification tokens.
func (s *Service) AddDomain(ctx context.Context, req AddDomainRequest) (*models.Domain, error) {
	cleanDomain := strings.ToLower(strings.TrimSpace(req.Domain))
	if !domainFormatRegex.MatchString(cleanDomain) && !strings.HasSuffix(cleanDomain, ".localhost") {
		return nil, ErrInvalidDomainFormat
	}

	if s.db == nil {
		return nil, fmt.Errorf("domains: database connection is nil")
	}

	// Verify store exists
	var storeSlug string
	err := s.db.QueryRowContext(ctx, "SELECT slug FROM stores WHERE id = $1;", req.StoreID).Scan(&storeSlug)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("store ID %s does not exist", req.StoreID)
	} else if err != nil {
		return nil, fmt.Errorf("failed to verify store existence: %w", err)
	}

	// Check domain conflict across platform
	var exists bool
	_ = s.db.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM domains WHERE domain = $1);", cleanDomain).Scan(&exists)
	if exists {
		return nil, ErrDomainConflict
	}

	verificationToken := ""
	if s.dnsVerifier != nil {
		verificationToken = s.dnsVerifier.GenerateVerificationToken()
	} else {
		verificationToken = fmt.Sprintf("ecom-verify-%d", time.Now().UnixNano())
	}
	sslStatus := models.SSLStatusPending

	// If localhost subdomain, auto-verify immediately for development
	var verifiedAt *time.Time
	if strings.HasSuffix(cleanDomain, ".localhost") {
		sslStatus = models.SSLStatusActive
		now := time.Now().UTC()
		verifiedAt = &now
	}

	query := `
		INSERT INTO domains (store_id, domain, is_primary, is_custom, ssl_status, verification_token, verified_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		RETURNING id, created_at, updated_at;`

	var d models.Domain
	d.StoreID = req.StoreID
	d.Domain = cleanDomain
	d.IsPrimary = req.IsPrimary
	d.IsCustom = req.IsCustom
	d.SSLStatus = sslStatus
	d.VerificationToken = verificationToken
	d.VerifiedAt = verifiedAt

	err = s.db.QueryRowContext(ctx, query,
		d.StoreID, d.Domain, d.IsPrimary, d.IsCustom, d.SSLStatus, d.VerificationToken, d.VerifiedAt,
	).Scan(&d.ID, &d.CreatedAt, &d.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to insert domain record: %w", err)
	}

	// If set to primary, demote any other existing primary domains for this store
	if d.IsPrimary {
		_, _ = s.db.ExecContext(ctx, `
			UPDATE domains SET is_primary = FALSE WHERE store_id = $1 AND id <> $2;`,
			d.StoreID, d.ID)
	}

	// Invalidate routing cache
	if s.resolver != nil {
		s.resolver.InvalidateCache(ctx, cleanDomain, storeSlug)
	}

	return &d, nil
}

// VerifyDomain checks DNS TXT records and provisions edge SSL certificate upon success.
func (s *Service) VerifyDomain(ctx context.Context, domainID string) (*models.Domain, error) {
	if s.db == nil {
		return nil, fmt.Errorf("domains: database connection is nil")
	}

	query := `
		SELECT d.id, d.store_id, d.domain, d.is_primary, d.is_custom, d.ssl_status,
		       COALESCE(d.verification_token, ''), d.verified_at, d.created_at, d.updated_at, s.slug
		FROM domains d
		JOIN stores s ON s.id = d.store_id
		WHERE d.id = $1;`

	var d models.Domain
	var storeSlug string
	err := s.db.QueryRowContext(ctx, query, domainID).Scan(
		&d.ID, &d.StoreID, &d.Domain, &d.IsPrimary, &d.IsCustom, &d.SSLStatus,
		&d.VerificationToken, &d.VerifiedAt, &d.CreatedAt, &d.UpdatedAt, &storeSlug,
	)
	if err == sql.ErrNoRows {
		return nil, ErrDomainNotFound
	} else if err != nil {
		return nil, fmt.Errorf("failed to query domain: %w", err)
	}

	// Skip DNS lookup for local subdomains
	if strings.HasSuffix(d.Domain, ".localhost") {
		return &d, nil
	}

	// Perform live DNS TXT lookup
	if s.dnsVerifier != nil {
		matched, err := s.dnsVerifier.VerifyTXTRecord(ctx, d.Domain, d.VerificationToken)
		if err != nil || !matched {
			_, _ = s.db.ExecContext(ctx, "UPDATE domains SET ssl_status = 'FAILED' WHERE id = $1;", d.ID)
			return nil, ErrVerificationFailed
		}
	}

	// Request Edge Custom Hostname & SSL via Cloudflare
	sslStatus := models.SSLStatusActive
	if s.cfClient != nil {
		cfResp, err := s.cfClient.CreateCustomHostname(ctx, d.Domain)
		if err != nil {
			_, _ = s.db.ExecContext(ctx, "UPDATE domains SET ssl_status = 'FAILED' WHERE id = $1;", d.ID)
			return nil, fmt.Errorf("edge SSL provisioning failure: %w", err)
		}
		if cfResp != nil && cfResp.SSLStatus != "" {
			sslStatus = models.DomainSSLStatus(cfResp.SSLStatus)
		}
	}

	now := time.Now().UTC()
	updateSQL := `
		UPDATE domains
		SET ssl_status = $1, verified_at = $2, updated_at = CURRENT_TIMESTAMP
		WHERE id = $3
		RETURNING updated_at;`

	_ = s.db.QueryRowContext(ctx, updateSQL, sslStatus, now, d.ID).Scan(&d.UpdatedAt)
	d.SSLStatus = sslStatus
	d.VerifiedAt = &now

	// Prime Redis routing cache immediately
	if s.resolver != nil {
		s.resolver.InvalidateCache(ctx, d.Domain, storeSlug)
	}

	return &d, nil
}

// SetPrimaryDomain designates a domain as the primary storefront URL for a brand.
func (s *Service) SetPrimaryDomain(ctx context.Context, domainID string) error {
	if s.db == nil {
		return fmt.Errorf("domains: database connection is nil")
	}

	var storeID, domain, slug string
	var sslStatus models.DomainSSLStatus
	query := `
		SELECT d.store_id, d.domain, d.ssl_status, s.slug
		FROM domains d
		JOIN stores s ON s.id = d.store_id
		WHERE d.id = $1;`

	err := s.db.QueryRowContext(ctx, query, domainID).Scan(&storeID, &domain, &sslStatus, &slug)
	if err == sql.ErrNoRows {
		return ErrDomainNotFound
	} else if err != nil {
		return fmt.Errorf("failed to query domain for primary promotion: %w", err)
	}

	if sslStatus != models.SSLStatusActive {
		return fmt.Errorf("cannot designate unverified or failed domain as primary")
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}

	// Demote existing primary domains for this store
	if _, err := tx.ExecContext(ctx, "UPDATE domains SET is_primary = FALSE WHERE store_id = $1;", storeID); err != nil {
		_ = tx.Rollback()
		return err
	}

	// Promote target domain
	if _, err := tx.ExecContext(ctx, "UPDATE domains SET is_primary = TRUE WHERE id = $1;", domainID); err != nil {
		_ = tx.Rollback()
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	if s.resolver != nil {
		s.resolver.InvalidateCache(ctx, domain, slug)
	}
	return nil
}

// DeleteDomain removes a domain mapping, tears down edge hostnames, and invalidates cache.
func (s *Service) DeleteDomain(ctx context.Context, domainID string) error {
	if s.db == nil {
		return fmt.Errorf("domains: database connection is nil")
	}

	var storeID, domain, slug string
	var isPrimary bool
	query := `
		SELECT d.store_id, d.domain, d.is_primary, s.slug
		FROM domains d
		JOIN stores s ON s.id = d.store_id
		WHERE d.id = $1;`

	err := s.db.QueryRowContext(ctx, query, domainID).Scan(&storeID, &domain, &isPrimary, &slug)
	if err == sql.ErrNoRows {
		return ErrDomainNotFound
	} else if err != nil {
		return fmt.Errorf("failed to query domain for deletion: %w", err)
	}

	if isPrimary {
		return ErrCannotDeletePrimary
	}

	// Delete from platform database
	if _, err := s.db.ExecContext(ctx, "DELETE FROM domains WHERE id = $1;", domainID); err != nil {
		return fmt.Errorf("failed to delete domain record: %w", err)
	}

	// Teardown edge route
	if s.cfClient != nil {
		_ = s.cfClient.DeleteCustomHostname(ctx, fmt.Sprintf("cf-%s", domain))
	}

	// Invalidate routing cache
	if s.resolver != nil {
		s.resolver.InvalidateCache(ctx, domain, slug)
	}

	return nil
}

// ListAllDomains returns all registered domains across the entire brand portfolio.
func (s *Service) ListAllDomains(ctx context.Context) ([]DomainDetail, error) {
	if s.db == nil {
		return nil, fmt.Errorf("domains: database connection is nil")
	}

	query := `
		SELECT d.id, d.store_id, d.domain, d.is_primary, d.is_custom, d.ssl_status,
		       COALESCE(d.verification_token, ''), d.verified_at, d.created_at, d.updated_at,
		       s.name, s.slug
		FROM domains d
		JOIN stores s ON s.id = d.store_id
		ORDER BY d.created_at DESC;`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query domain list: %w", err)
	}
	defer rows.Close()

	var results []DomainDetail
	for rows.Next() {
		var item DomainDetail
		if err := rows.Scan(
			&item.ID, &item.StoreID, &item.Domain, &item.IsPrimary, &item.IsCustom, &item.SSLStatus,
			&item.VerificationToken, &item.VerifiedAt, &item.CreatedAt, &item.UpdatedAt,
			&item.StoreName, &item.StoreSlug,
		); err == nil {
			results = append(results, item)
		}
	}
	return results, nil
}
