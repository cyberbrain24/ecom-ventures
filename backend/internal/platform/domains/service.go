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

// localhostSuffix marks local development hostnames. It is honoured only in development mode.
const localhostSuffix = ".localhost"

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
	db            *sql.DB
	dnsVerifier   DNSVerifier
	cfClient      CloudflareClient
	resolver      *resolver.StoreResolver
	isDevelopment bool
}

// NewService instantiates the domain management service.
// isDevelopment must be true only when APP_ENV is "development"; it gates the
// .localhost auto-verification shortcut. In every other environment .localhost
// domains go through the same DNS and Cloudflare checks as any other domain.
func NewService(
	db *sql.DB,
	dnsVerifier DNSVerifier,
	cfClient CloudflareClient,
	resolver *resolver.StoreResolver,
	isDevelopment bool,
) *Service {
	return &Service{
		db:            db,
		dnsVerifier:   dnsVerifier,
		cfClient:      cfClient,
		resolver:      resolver,
		isDevelopment: isDevelopment,
	}
}

// isLocalDevDomain reports whether the domain gets the development-only localhost shortcut.
func (s *Service) isLocalDevDomain(domain string) bool {
	return s.isDevelopment && strings.HasSuffix(domain, localhostSuffix)
}

// AddDomain registers a new domain for a store and generates verification tokens.
func (s *Service) AddDomain(ctx context.Context, req AddDomainRequest) (*models.Domain, error) {
	cleanDomain := strings.ToLower(strings.TrimSpace(req.Domain))
	if !domainFormatRegex.MatchString(cleanDomain) {
		return nil, ErrInvalidDomainFormat
	}

	if s.db == nil {
		return nil, fmt.Errorf("domains: database connection is nil")
	}
	if s.dnsVerifier == nil {
		return nil, fmt.Errorf("domains: DNS verifier is not configured; cannot issue a verification token")
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
	if err := s.db.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM domains WHERE domain = $1);", cleanDomain).Scan(&exists); err != nil {
		return nil, fmt.Errorf("failed to check domain conflicts: %w", err)
	}
	if exists {
		return nil, ErrDomainConflict
	}

	verificationToken, err := s.dnsVerifier.GenerateVerificationToken()
	if err != nil {
		return nil, fmt.Errorf("domains: issuing verification token: %w", err)
	}

	sslStatus := models.SSLStatusPending

	// Development-only shortcut: localhost subdomains are verified immediately when APP_ENV=development.
	var verifiedAt *time.Time
	if s.isLocalDevDomain(cleanDomain) {
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
		if _, err := s.db.ExecContext(ctx, `
			UPDATE domains SET is_primary = FALSE WHERE store_id = $1 AND id <> $2;`,
			d.StoreID, d.ID); err != nil {
			return nil, fmt.Errorf("failed to demote previous primary domains: %w", err)
		}
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
		       COALESCE(d.verification_token, ''), COALESCE(d.provider_hostname_id, ''),
		       d.verified_at, d.created_at, d.updated_at, s.slug
		FROM domains d
		JOIN stores s ON s.id = d.store_id
		WHERE d.id = $1;`

	var d models.Domain
	var storeSlug string
	err := s.db.QueryRowContext(ctx, query, domainID).Scan(
		&d.ID, &d.StoreID, &d.Domain, &d.IsPrimary, &d.IsCustom, &d.SSLStatus,
		&d.VerificationToken, &d.ProviderHostnameID, &d.VerifiedAt, &d.CreatedAt, &d.UpdatedAt, &storeSlug,
	)
	if err == sql.ErrNoRows {
		return nil, ErrDomainNotFound
	} else if err != nil {
		return nil, fmt.Errorf("failed to query domain: %w", err)
	}

	// Development-only: skip the DNS lookup for local subdomains.
	if s.isLocalDevDomain(d.Domain) {
		return &d, nil
	}

	// Perform live DNS TXT lookup
	if s.dnsVerifier == nil {
		return nil, fmt.Errorf("domain DNS verifier is unavailable")
	}
	matched, err := s.dnsVerifier.VerifyTXTRecord(ctx, d.Domain, d.VerificationToken)
	if err != nil {
		return nil, fmt.Errorf("verify domain DNS record: %w", err)
	}
	if !matched {
		return nil, ErrVerificationFailed
	}

	if s.cfClient == nil {
		return nil, fmt.Errorf("Cloudflare custom hostname client is unavailable")
	}
	sslStatus := models.SSLStatusPending
	if d.ProviderHostnameID != "" {
		providerStatus, err := s.cfClient.GetCustomHostnameStatus(ctx, d.ProviderHostnameID)
		if err != nil {
			return nil, fmt.Errorf("query Cloudflare hostname status: %w", err)
		}
		sslStatus = mapCloudflareSSLStatus(providerStatus)
	} else {
		cfResp, err := s.cfClient.CreateCustomHostname(ctx, d.Domain)
		if err != nil {
			return nil, fmt.Errorf("provision Cloudflare hostname: %w", err)
		}
		if cfResp == nil || cfResp.ID == "" {
			return nil, fmt.Errorf("Cloudflare response did not include a hostname ID")
		}
		d.ProviderHostnameID = cfResp.ID
		sslStatus = mapCloudflareSSLStatus(cfResp.SSLStatus)
	}

	// A domain counts as verified only once DNS and the edge hostname status both confirm it.
	var verifiedAt *time.Time
	if sslStatus == models.SSLStatusActive {
		now := time.Now().UTC()
		verifiedAt = &now
	}

	updateSQL := `
		UPDATE domains
		SET provider_hostname_id = $1, ssl_status = $2, verified_at = $3, updated_at = CURRENT_TIMESTAMP
		WHERE id = $4
		RETURNING updated_at;`

	if err := s.db.QueryRowContext(ctx, updateSQL, d.ProviderHostnameID, sslStatus, verifiedAt, d.ID).Scan(&d.UpdatedAt); err != nil {
		return nil, fmt.Errorf("save Cloudflare hostname status: %w", err)
	}
	d.SSLStatus = sslStatus
	d.VerifiedAt = verifiedAt

	// Prime Redis routing cache immediately
	if s.resolver != nil {
		s.resolver.InvalidateCache(ctx, d.Domain, storeSlug)
	}

	return &d, nil
}

func mapCloudflareSSLStatus(status string) models.DomainSSLStatus {
	switch strings.ToUpper(strings.TrimSpace(status)) {
	case "ACTIVE":
		return models.SSLStatusActive
	case "FAILED":
		return models.SSLStatusFailed
	case "REVOKED":
		return models.SSLStatusRevoked
	default:
		return models.SSLStatusPending
	}
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
		return fmt.Errorf("begin primary domain transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	// Lock order: store row first, then the domain rows.
	if err := lockStoreRow(ctx, tx, storeID); err != nil {
		return err
	}

	// Demote existing primary domains for this store
	if _, err := tx.ExecContext(ctx, "UPDATE domains SET is_primary = FALSE WHERE store_id = $1;", storeID); err != nil {
		if mapped := classifyDomainWriteError(err); mapped != nil {
			return mapped
		}
		return fmt.Errorf("demote primary domains: %w", err)
	}

	// Promote target domain
	if _, err := tx.ExecContext(ctx, "UPDATE domains SET is_primary = TRUE WHERE id = $1;", domainID); err != nil {
		if mapped := classifyDomainWriteError(err); mapped != nil {
			return mapped
		}
		return fmt.Errorf("promote primary domain: %w", err)
	}

	if err := tx.Commit(); err != nil {
		if mapped := classifyDomainWriteError(err); mapped != nil {
			return mapped
		}
		return fmt.Errorf("commit primary domain change: %w", err)
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

	var storeID, domain, slug, providerHostnameID string
	var isPrimary bool
	query := `
		SELECT d.store_id, d.domain, d.is_primary, s.slug, COALESCE(d.provider_hostname_id, '')
		FROM domains d
		JOIN stores s ON s.id = d.store_id
		WHERE d.id = $1;`

	err := s.db.QueryRowContext(ctx, query, domainID).Scan(&storeID, &domain, &isPrimary, &slug, &providerHostnameID)
	if err == sql.ErrNoRows {
		return ErrDomainNotFound
	} else if err != nil {
		return fmt.Errorf("failed to query domain for deletion: %w", err)
	}

	if isPrimary {
		return ErrCannotDeletePrimary
	}

	if !s.isLocalDevDomain(domain) {
		if providerHostnameID == "" {
			return fmt.Errorf("domain %q has no stored Cloudflare hostname ID; refusing to remove its registry record", domain)
		}
		if s.cfClient == nil {
			return fmt.Errorf("Cloudflare custom hostname client is unavailable")
		}
		if err := s.cfClient.DeleteCustomHostname(ctx, providerHostnameID); err != nil {
			return fmt.Errorf("delete Cloudflare hostname: %w", err)
		}
	}

	// Delete from platform database
	if _, err := s.db.ExecContext(ctx, "DELETE FROM domains WHERE id = $1;", domainID); err != nil {
		return fmt.Errorf("failed to delete domain record: %w", err)
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
			&item.ID, &item.StoreID, &item.Domain.Domain, &item.IsPrimary, &item.IsCustom, &item.SSLStatus,
			&item.VerificationToken, &item.VerifiedAt, &item.CreatedAt, &item.UpdatedAt,
			&item.StoreName, &item.StoreSlug,
		); err != nil {
			return nil, fmt.Errorf("failed to scan domain row: %w", err)
		}
		results = append(results, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate domain rows: %w", err)
	}
	return results, nil
}
