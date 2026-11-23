package domains

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"ecom-ventures/backend/internal/platform/audit"
	"ecom-ventures/backend/internal/platform/models"
	"ecom-ventures/backend/internal/platform/validation"
	"ecom-ventures/backend/pkg/response"

	"github.com/go-chi/chi/v5"
	"github.com/lib/pq"
)

var (
	// ErrCannotDemotePrimary is returned when an edit would leave a store without a primary domain.
	ErrCannotDemotePrimary = errors.New("domains: a store's primary domain cannot be demoted; promote another verified domain instead")
	// ErrDomainNotVerified is returned when an edit would make an unverified domain the primary route.
	ErrDomainNotVerified = errors.New("domains: only a verified domain can be the primary route")
	// ErrPrimaryDomainConflict is returned when a concurrent change to the store's primary domain
	// (a deadlock or the one-primary-per-store index) made this write fail. The caller may retry.
	ErrPrimaryDomainConflict = errors.New("domains: the store's primary domain was changed concurrently; retry")
)

// primaryDomainIndex is the unique index that allows one primary domain per store.
const primaryDomainIndex = "idx_unique_primary_domain_per_store"

// classifyDomainWriteError maps a Postgres error from a domain write to a service error.
// A deadlock (40P01), a serialization failure (40001) or a violation of the one-primary-per-store
// index becomes ErrPrimaryDomainConflict; any other unique violation becomes ErrDomainConflict.
// It returns nil for every other error so the caller can wrap it with context.
func classifyDomainWriteError(err error) error {
	var pqErr *pq.Error
	if !errors.As(err, &pqErr) {
		return nil
	}
	switch {
	case pqErr.Code == "40P01" || pqErr.Code == "40001":
		return ErrPrimaryDomainConflict
	case pqErr.Code == "23505" && pqErr.Constraint == primaryDomainIndex:
		return ErrPrimaryDomainConflict
	case pqErr.Code == "23505":
		return ErrDomainConflict
	}
	return nil
}

// lockStoreRow takes the store row lock that serializes every primary-domain change of one store.
// It must be the first lock a domain transaction takes, so two of them cannot deadlock.
func lockStoreRow(ctx context.Context, tx *sql.Tx, storeID string) error {
	var id string
	if err := tx.QueryRowContext(ctx, `SELECT id FROM stores WHERE id = $1 FOR UPDATE;`, storeID).Scan(&id); err != nil {
		if mapped := classifyDomainWriteError(err); mapped != nil {
			return mapped
		}
		return fmt.Errorf("locking store %s: %w", storeID, err)
	}
	return nil
}

// UpdateDomainRequest is the body of PATCH /platform/domains/{id}. Every field is optional and
// an absent field is left unchanged. SSLStatus is accepted only so the edit form can echo the
// row it loaded: it is set by verification and a different value is rejected with 422.
type UpdateDomainRequest struct {
	Domain    *string `json:"domain"`
	IsPrimary *bool   `json:"is_primary"`
	IsCustom  *bool   `json:"is_custom"`
	SSLStatus *string `json:"ssl_status"`
}

// domainRow is a domain record joined with its store, as read under lock for an edit.
type domainRow struct {
	ID                 string
	StoreID            string
	StoreName          string
	StoreSlug          string
	Domain             string
	IsPrimary          bool
	IsCustom           bool
	SSLStatus          models.DomainSSLStatus
	VerificationToken  string
	ProviderHostnameID string
	VerifiedAt         *time.Time
	CreatedAt          time.Time
	UpdatedAt          time.Time
}

// domainPlan is the outcome of applying an edit to a domainRow.
type domainPlan struct {
	Domain    string
	IsPrimary bool
	IsCustom  bool
	// Renamed is true when the host name changes; the new name must be re-verified.
	Renamed bool
	// Promote is true when the domain becomes the store's primary route.
	Promote   bool
	SSLStatus models.DomainSSLStatus
	// Verified is true when the new name is verified immediately (development .localhost hosts only).
	Verified bool
}

// normalizeUpdateDomain trims and validates the request in place.
func normalizeUpdateDomain(req *UpdateDomainRequest) error {
	var c validation.Collector
	editable := false
	if req.Domain != nil {
		editable = true
		d := strings.ToLower(strings.TrimSpace(*req.Domain))
		if len(d) > 255 || !domainFormatRegex.MatchString(d) {
			c.Add("domain", "domain must be a valid host name such as shop.example.com")
		}
		req.Domain = &d
	}
	if req.IsPrimary != nil || req.IsCustom != nil {
		editable = true
	}
	if !editable {
		c.Add("body", "at least one editable field is required: domain, is_primary or is_custom")
	}
	return c.Err()
}

// planDomainUpdate applies req to cur and decides what must change. It performs no I/O.
//   - ssl_status may not differ from the stored value.
//   - A new host name resets the verified state to PENDING with a fresh token (development
//     .localhost hosts are verified at once, as at creation).
//   - Demoting the current primary is refused so each store keeps one primary domain.
//   - Promoting requires the resulting domain to be ACTIVE.
func (s *Service) planDomainUpdate(cur *domainRow, req *UpdateDomainRequest) (domainPlan, error) {
	p := domainPlan{Domain: cur.Domain, IsPrimary: cur.IsPrimary, IsCustom: cur.IsCustom, SSLStatus: cur.SSLStatus}

	if req.SSLStatus != nil && !strings.EqualFold(strings.TrimSpace(*req.SSLStatus), string(cur.SSLStatus)) {
		var c validation.Collector
		c.Add("ssl_status", "ssl_status cannot be edited; it is set by domain verification")
		return p, c.Err()
	}

	if req.Domain != nil && *req.Domain != cur.Domain {
		p.Renamed = true
		p.Domain = *req.Domain
		if s.isLocalDevDomain(p.Domain) {
			p.SSLStatus = models.SSLStatusActive
			p.Verified = true
		} else {
			p.SSLStatus = models.SSLStatusPending
		}
	}
	if req.IsCustom != nil {
		p.IsCustom = *req.IsCustom
	}
	if req.IsPrimary != nil {
		switch {
		case *req.IsPrimary && !cur.IsPrimary:
			if p.SSLStatus != models.SSLStatusActive {
				return p, ErrDomainNotVerified
			}
			p.IsPrimary = true
			p.Promote = true
		case !*req.IsPrimary && cur.IsPrimary:
			return p, ErrCannotDemotePrimary
		}
	}
	return p, nil
}

// UpdateDomain edits a domain route: host name, custom flag and primary flag.
//
// Renaming resets verification (PENDING, no verified_at, a new TXT token) and removes the old
// Cloudflare custom hostname when one exists. Promoting to primary demotes the store's other
// domains in the same transaction. The change is audited in that transaction and the Redis
// resolver cache is purged for the old and the new host name after commit.
// It returns ErrDomainNotFound, ErrDomainConflict, ErrCannotDemotePrimary, ErrDomainNotVerified
// or a *validation.Error.
func (s *Service) UpdateDomain(ctx context.Context, domainID string, req UpdateDomainRequest, actor audit.Actor) (*DomainDetail, error) {
	if err := normalizeUpdateDomain(&req); err != nil {
		return nil, err
	}
	if !audit.IsUUID(domainID) {
		return nil, ErrDomainNotFound
	}
	if s.db == nil {
		return nil, fmt.Errorf("domains: database connection is nil")
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("beginning domain update transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	// Lock order: store row first, then the domain rows.
	var lockStoreID string
	err = tx.QueryRowContext(ctx, `SELECT store_id FROM domains WHERE id = $1;`, domainID).Scan(&lockStoreID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrDomainNotFound
	} else if err != nil {
		return nil, fmt.Errorf("reading store of domain %s: %w", domainID, err)
	}
	if err := lockStoreRow(ctx, tx, lockStoreID); err != nil {
		return nil, err
	}

	var cur domainRow
	err = tx.QueryRowContext(ctx, `
		SELECT d.id, d.store_id, s.name, s.slug, d.domain, d.is_primary, d.is_custom, d.ssl_status::text,
		       COALESCE(d.verification_token, ''), COALESCE(d.provider_hostname_id, ''),
		       d.verified_at, d.created_at, d.updated_at
		FROM domains d
		JOIN stores s ON s.id = d.store_id
		WHERE d.id = $1
		FOR UPDATE OF d;`, domainID,
	).Scan(&cur.ID, &cur.StoreID, &cur.StoreName, &cur.StoreSlug, &cur.Domain, &cur.IsPrimary, &cur.IsCustom, &cur.SSLStatus,
		&cur.VerificationToken, &cur.ProviderHostnameID, &cur.VerifiedAt, &cur.CreatedAt, &cur.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrDomainNotFound
	} else if err != nil {
		return nil, fmt.Errorf("reading domain %s for update: %w", domainID, err)
	}

	plan, err := s.planDomainUpdate(&cur, &req)
	if err != nil {
		return nil, err
	}

	next := cur
	next.Domain, next.IsPrimary, next.IsCustom, next.SSLStatus = plan.Domain, plan.IsPrimary, plan.IsCustom, plan.SSLStatus

	oldHostnameID := ""
	if plan.Renamed {
		var taken bool
		if err := tx.QueryRowContext(ctx, `SELECT EXISTS(SELECT 1 FROM domains WHERE domain = $1 AND id <> $2);`, plan.Domain, domainID).Scan(&taken); err != nil {
			return nil, fmt.Errorf("checking domain name uniqueness: %w", err)
		}
		if taken {
			return nil, ErrDomainConflict
		}
		if s.dnsVerifier == nil {
			return nil, fmt.Errorf("domains: DNS verifier is not configured; cannot issue a verification token")
		}
		token, err := s.dnsVerifier.GenerateVerificationToken()
		if err != nil {
			return nil, fmt.Errorf("domains: issuing verification token: %w", err)
		}
		next.VerificationToken = token
		next.VerifiedAt = nil
		if plan.Verified {
			now := time.Now().UTC()
			next.VerifiedAt = &now
		}
		oldHostnameID = cur.ProviderHostnameID
		next.ProviderHostnameID = ""
		if oldHostnameID != "" && s.cfClient == nil {
			return nil, fmt.Errorf("domains: Cloudflare custom hostname client is unavailable; cannot release hostname %q", cur.Domain)
		}
	}

	if plan.Promote {
		if _, err := tx.ExecContext(ctx, `UPDATE domains SET is_primary = FALSE WHERE store_id = $1 AND id <> $2 AND is_primary = TRUE;`, cur.StoreID, domainID); err != nil {
			if mapped := classifyDomainWriteError(err); mapped != nil {
				return nil, mapped
			}
			return nil, fmt.Errorf("demoting previous primary domain: %w", err)
		}
	}

	err = tx.QueryRowContext(ctx, `
		UPDATE domains
		SET domain = $1, is_primary = $2, is_custom = $3, ssl_status = $4::domain_ssl_status,
		    verification_token = $5, provider_hostname_id = NULLIF($6, ''), verified_at = $7,
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $8
		RETURNING updated_at;`,
		next.Domain, next.IsPrimary, next.IsCustom, string(next.SSLStatus),
		next.VerificationToken, next.ProviderHostnameID, next.VerifiedAt, domainID,
	).Scan(&next.UpdatedAt)
	if err != nil {
		if mapped := classifyDomainWriteError(err); mapped != nil {
			return nil, mapped
		}
		return nil, fmt.Errorf("updating domain %s: %w", domainID, err)
	}

	if err := audit.Record(ctx, tx, actor, "DOMAIN_UPDATED", "domains", domainID, cur.StoreID, domainAuditView(&cur), domainAuditView(&next)); err != nil {
		return nil, fmt.Errorf("auditing domain update: %w", err)
	}

	if oldHostnameID != "" {
		if err := s.cfClient.DeleteCustomHostname(ctx, oldHostnameID); err != nil {
			return nil, fmt.Errorf("releasing Cloudflare hostname for %q: %w", cur.Domain, err)
		}
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("committing domain update: %w", err)
	}

	if s.resolver != nil {
		s.resolver.InvalidateCache(ctx, cur.Domain, cur.StoreSlug)
		if plan.Renamed {
			s.resolver.InvalidateCache(ctx, next.Domain, cur.StoreSlug)
		}
	}

	return &DomainDetail{
		Domain: models.Domain{
			ID: next.ID, StoreID: next.StoreID, Domain: next.Domain, IsPrimary: next.IsPrimary, IsCustom: next.IsCustom,
			SSLStatus: next.SSLStatus, VerificationToken: next.VerificationToken, VerifiedAt: next.VerifiedAt,
			CreatedAt: next.CreatedAt, UpdatedAt: next.UpdatedAt,
		},
		StoreName: next.StoreName,
		StoreSlug: next.StoreSlug,
	}, nil
}

func domainAuditView(d *domainRow) map[string]any {
	return map[string]any{
		"domain": d.Domain, "is_primary": d.IsPrimary, "is_custom": d.IsCustom,
		"ssl_status": d.SSLStatus, "verified": d.VerifiedAt != nil,
	}
}

// Update handles PATCH /api/v1/platform/domains/{id}.
// Unknown domain: 404. Name already used: 409. Demoting the primary: 409. Promoting an
// unverified domain or invalid input: 422.
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	domainID := chi.URLParam(r, "id")
	if domainID == "" {
		response.BadRequest(w, r, "Domain ID parameter is required.")
		return
	}

	var req UpdateDomainRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request JSON payload.")
		return
	}

	updated, err := h.service.UpdateDomain(r.Context(), domainID, req, audit.ActorFromRequest(r))
	if err != nil {
		if validation.Write(w, r, err) {
			return
		}
		switch {
		case errors.Is(err, ErrDomainNotFound):
			response.NotFound(w, r, "Domain record not found.")
		case errors.Is(err, ErrDomainConflict):
			response.Problem(w, r, http.StatusConflict, "DOMAIN_CONFLICT", "Conflict", "Domain is already mapped to a store.")
		case errors.Is(err, ErrPrimaryDomainConflict):
			response.Problem(w, r, http.StatusConflict, "PRIMARY_DOMAIN_CONFLICT", "Conflict", "The store's primary domain was changed by another request at the same time. Reload and try again.")
		case errors.Is(err, ErrCannotDemotePrimary):
			response.Problem(w, r, http.StatusConflict, "CANNOT_DEMOTE_PRIMARY", "Cannot Demote Primary", "Promote another verified domain to primary instead of demoting this one.")
		case errors.Is(err, ErrDomainNotVerified):
			response.Problem(w, r, http.StatusUnprocessableEntity, "DOMAIN_NOT_VERIFIED", "Domain Not Verified", "Only a verified domain can be made the primary route.")
		default:
			slog.ErrorContext(r.Context(), "domains: updating domain failed", slog.String("domain_id", domainID), slog.String("error", err.Error()))
			response.InternalServerError(w, r)
		}
		return
	}

	response.JSON(w, http.StatusOK, updated)
}
