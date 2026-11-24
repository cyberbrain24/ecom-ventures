package store_mgmt

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"regexp"
	"strings"
	"time"

	"ecom-ventures/backend/internal/platform/audit"
	"ecom-ventures/backend/internal/platform/models"
	"ecom-ventures/backend/internal/platform/validation"
	"ecom-ventures/backend/pkg/hasher"
	"ecom-ventures/backend/pkg/response"

	"github.com/go-chi/chi/v5"
)

var (
	currencyRegex     = regexp.MustCompile(`^[A-Z]{3}$`)
	timezoneRegex     = regexp.MustCompile(`^(UTC|[A-Za-z]+(/[A-Za-z0-9_+-]+){1,2})$`)
	phoneRegex        = regexp.MustCompile(`^\+?[0-9][0-9 ()-]{3,48}$`)
	domainFormatRegex = regexp.MustCompile(`^([a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$`)
)

// normalizeUpdateStore trims and validates the editable fields of req in place.
// It returns a *validation.Error naming every failing field, or nil.
func normalizeUpdateStore(req *UpdateStoreRequest) error {
	var c validation.Collector
	editable := false

	if req.Name != nil {
		editable = true
		v := strings.TrimSpace(*req.Name)
		if v == "" || len(v) > 100 {
			c.Add("name", "name is required and must be at most 100 characters")
		}
		req.Name = &v
	}
	if req.Description != nil {
		editable = true
		v := strings.TrimSpace(*req.Description)
		if len(v) > 1000 {
			c.Add("description", "description must be at most 1000 characters")
		}
		req.Description = &v
	}
	if req.ContactEmail != nil {
		editable = true
		if v, ok := validation.Email(*req.ContactEmail); ok {
			req.ContactEmail = &v
		} else {
			c.Add("contact_email", "contact_email must be a valid email address of at most 255 characters")
		}
	}
	if req.ContactPhone != nil {
		editable = true
		v := strings.TrimSpace(*req.ContactPhone)
		if v != "" && !phoneRegex.MatchString(v) {
			c.Add("contact_phone", "contact_phone must contain 5 to 50 digits, spaces, hyphens or parentheses, with an optional leading +")
		}
		req.ContactPhone = &v
	}
	if req.Currency != nil {
		editable = true
		v := strings.ToUpper(strings.TrimSpace(*req.Currency))
		if !currencyRegex.MatchString(v) {
			c.Add("currency", "currency must be a 3-letter ISO 4217 code such as BDT")
		}
		req.Currency = &v
	}
	if req.Timezone != nil {
		editable = true
		v := strings.TrimSpace(*req.Timezone)
		if len(v) > 50 || !timezoneRegex.MatchString(v) {
			c.Add("timezone", "timezone must be an IANA zone name such as Asia/Dhaka")
		}
		req.Timezone = &v
	}
	if req.OwnerEmail != nil {
		editable = true
		if v, ok := validation.Email(*req.OwnerEmail); ok {
			req.OwnerEmail = &v
		} else {
			c.Add("owner_email", "owner_email must be a valid email address of at most 255 characters")
		}
	}
	if req.OwnerPassword != nil {
		editable = true
		v := *req.OwnerPassword
		if v != "" && len(v) < 8 {
			c.Add("owner_password", "owner_password must be at least 8 characters")
		}
	}
	if req.OwnerFirstName != nil {
		editable = true
		v := strings.TrimSpace(*req.OwnerFirstName)
		req.OwnerFirstName = &v
	}
	if req.OwnerLastName != nil {
		editable = true
		v := strings.TrimSpace(*req.OwnerLastName)
		req.OwnerLastName = &v
	}
	if req.PrimaryDomain != nil {
		editable = true
		v := strings.ToLower(strings.TrimSpace(*req.PrimaryDomain))
		if v == "" || len(v) > 255 || (!domainFormatRegex.MatchString(v) && !strings.HasSuffix(v, ".localhost")) {
			c.Add("primary_domain", "primary_domain must be a valid domain such as mior.dropiobd.com")
		}
		req.PrimaryDomain = &v
	}
	if req.ActiveTheme != nil {
		editable = true
		v := strings.TrimSpace(*req.ActiveTheme)
		if v == "" || len(v) > 100 {
			c.Add("active_theme", "active_theme is required and must be at most 100 characters")
		}
		req.ActiveTheme = &v
	}
	if !editable {
		c.Add("body", "at least one editable field is required: name, description, contact_email, contact_phone, currency, timezone, primary_domain, active_theme, owner_email, owner_password, owner_first_name or owner_last_name")
	}
	return c.Err()
}

// storeEditSnapshot holds the stored values that an edit compares against.
type storeEditSnapshot struct {
	Slug          string
	Name          string
	Description   string
	ContactEmail  string
	ContactPhone  string
	Currency      string
	Timezone      string
	Status        string
	PrimaryDomain string
	ActiveTheme   string
	CreatedAt     time.Time
}

// checkImmutableStoreFields rejects an edit that tries to change a field this route does not own.
func checkImmutableStoreFields(req *UpdateStoreRequest, cur *storeEditSnapshot) error {
	var c validation.Collector
	if req.Slug != nil && strings.TrimSpace(*req.Slug) != cur.Slug {
		c.Add("slug", "slug cannot be changed")
	}
	if req.Status != nil && !strings.EqualFold(strings.TrimSpace(*req.Status), cur.Status) {
		c.Add("status", "status cannot be changed here; use PATCH /platform/stores/{id}/status")
	}
	return c.Err()
}

// applyStoreEdit returns cur with every field present in req replaced.
func applyStoreEdit(cur storeEditSnapshot, req *UpdateStoreRequest) storeEditSnapshot {
	if req.Name != nil {
		cur.Name = *req.Name
	}
	if req.Description != nil {
		cur.Description = *req.Description
	}
	if req.ContactEmail != nil {
		cur.ContactEmail = *req.ContactEmail
	}
	if req.ContactPhone != nil {
		cur.ContactPhone = *req.ContactPhone
	}
	if req.Currency != nil {
		cur.Currency = *req.Currency
	}
	if req.Timezone != nil {
		cur.Timezone = *req.Timezone
	}
	if req.PrimaryDomain != nil {
		cur.PrimaryDomain = *req.PrimaryDomain
	}
	if req.ActiveTheme != nil {
		cur.ActiveTheme = *req.ActiveTheme
	}
	return cur
}

// editableStoreFields is the audit payload for the fields this route can change.
func editableStoreFields(v *storeEditSnapshot) map[string]string {
	return map[string]string{
		"name": v.Name, "description": v.Description, "contact_email": v.ContactEmail,
		"contact_phone": v.ContactPhone, "currency": v.Currency, "timezone": v.Timezone,
		"primary_domain": v.PrimaryDomain, "active_theme": v.ActiveTheme,
	}
}

// UpdateStore edits the registry fields of a store (name, description, contact details,
// currency, timezone). Slug, database coordinates and status are never modified. The row is
// locked, updated and audited in one transaction, and the routing cache for the slug and all
// of the store's domains is purged after commit.
// It returns ErrStoreNotFound for an unknown store and a *validation.Error for bad input.
func (s *Service) UpdateStore(ctx context.Context, storeID string, req UpdateStoreRequest, actor audit.Actor) (*StoreSummaryResponse, error) {
	if err := normalizeUpdateStore(&req); err != nil {
		return nil, err
	}
	if !audit.IsUUID(storeID) {
		return nil, ErrStoreNotFound
	}
	if s.platformDB == nil {
		return nil, fmt.Errorf("store_mgmt: platform database connection handle is nil")
	}

	tx, err := s.platformDB.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("beginning store update transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	var cur storeEditSnapshot
	err = tx.QueryRowContext(ctx, `
		SELECT s.slug, s.name, COALESCE(s.description, ''), s.contact_email, COALESCE(s.contact_phone, ''),
		       s.currency, s.timezone, s.status::text, COALESCE(d.domain, ''), COALESCE(t.name, ''), s.created_at
		FROM stores s
		LEFT JOIN domains d ON d.store_id = s.id AND d.is_primary = TRUE
		LEFT JOIN store_themes st ON st.store_id = s.id AND st.is_active = TRUE
		LEFT JOIN themes t ON t.id = st.theme_id
		WHERE s.id = $1
		FOR UPDATE OF s;`, storeID,
	).Scan(&cur.Slug, &cur.Name, &cur.Description, &cur.ContactEmail, &cur.ContactPhone,
		&cur.Currency, &cur.Timezone, &cur.Status, &cur.PrimaryDomain, &cur.ActiveTheme, &cur.CreatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrStoreNotFound
	} else if err != nil {
		return nil, fmt.Errorf("reading store %s for update: %w", storeID, err)
	}

	if err := checkImmutableStoreFields(&req, &cur); err != nil {
		return nil, err
	}
	next := applyStoreEdit(cur, &req)

	// Process primary domain modification inside transaction
	if req.PrimaryDomain != nil && *req.PrimaryDomain != cur.PrimaryDomain {
		var conflictStoreID string
		err = tx.QueryRowContext(ctx, "SELECT store_id FROM domains WHERE domain = $1 AND store_id <> $2;", *req.PrimaryDomain, storeID).Scan(&conflictStoreID)
		if err == nil {
			return nil, ErrDomainConflict
		} else if !errors.Is(err, sql.ErrNoRows) {
			return nil, fmt.Errorf("checking domain conflict: %w", err)
		}

		if _, err := tx.ExecContext(ctx, "UPDATE domains SET is_primary = FALSE WHERE store_id = $1;", storeID); err != nil {
			return nil, fmt.Errorf("demoting previous primary domains: %w", err)
		}

		res, err := tx.ExecContext(ctx, "UPDATE domains SET is_primary = TRUE WHERE store_id = $1 AND domain = $2;", storeID, *req.PrimaryDomain)
		if err != nil {
			return nil, fmt.Errorf("promoting domain: %w", err)
		}
		ra, _ := res.RowsAffected()
		if ra == 0 {
			sslStatus := models.SSLStatusActive
			now := time.Now().UTC()
			_, err = tx.ExecContext(ctx, `
				INSERT INTO domains (store_id, domain, is_primary, is_custom, ssl_status, verified_at)
				VALUES ($1, $2, TRUE, TRUE, $3, $4);`,
				storeID, *req.PrimaryDomain, sslStatus, &now)
			if err != nil {
				return nil, fmt.Errorf("inserting new primary domain: %w", err)
			}
		}
		next.PrimaryDomain = *req.PrimaryDomain
	}

	// Process active theme modification inside transaction
	if req.ActiveTheme != nil && *req.ActiveTheme != cur.ActiveTheme {
		var themeID, themeName string
		err = tx.QueryRowContext(ctx, `
			SELECT id, name FROM themes 
			WHERE (slug = $1 OR name = $1 OR id::text = $1) AND is_active = TRUE 
			LIMIT 1;`, *req.ActiveTheme).Scan(&themeID, &themeName)
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrThemeNotFound
		} else if err != nil {
			return nil, fmt.Errorf("finding theme %s: %w", *req.ActiveTheme, err)
		}

		if _, err := tx.ExecContext(ctx, "UPDATE store_themes SET is_active = FALSE WHERE store_id = $1;", storeID); err != nil {
			return nil, fmt.Errorf("demoting current store themes: %w", err)
		}

		_, err = tx.ExecContext(ctx, `
			INSERT INTO store_themes (store_id, theme_id, custom_config, is_active, activated_at)
			VALUES ($1, $2, '{}'::jsonb, TRUE, CURRENT_TIMESTAMP);`, storeID, themeID)
		if err != nil {
			return nil, fmt.Errorf("binding active theme: %w", err)
		}
		next.ActiveTheme = themeName
	}

	var updatedAt time.Time
	err = tx.QueryRowContext(ctx, `
		UPDATE stores
		SET name = $1, description = $2, contact_email = $3, contact_phone = NULLIF($4, ''),
		    currency = $5, timezone = $6, updated_at = CURRENT_TIMESTAMP
		WHERE id = $7
		RETURNING updated_at;`,
		next.Name, next.Description, next.ContactEmail, next.ContactPhone, next.Currency, next.Timezone, storeID,
	).Scan(&updatedAt)
	if err != nil {
		return nil, fmt.Errorf("updating store %s: %w", storeID, err)
	}

	if err := audit.Record(ctx, tx, actor, "STORE_UPDATED", "stores", storeID, storeID,
		editableStoreFields(&cur), editableStoreFields(&next)); err != nil {
		return nil, fmt.Errorf("auditing store update: %w", err)
	}

	routes, err := txStoreDomains(ctx, tx, storeID)
	if err != nil {
		return nil, err
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("committing store update: %w", err)
	}

	// Update tenant store_settings, metadata, and store_staff if owner or brand details were changed
	if s.resolver != nil {
		if stCtx, rErr := s.resolver.ResolveBySlug(ctx, cur.Slug); rErr == nil && stCtx != nil && stCtx.TenantDB != nil {
			if req.Name != nil {
				_, _ = stCtx.TenantDB.ExecContext(ctx, `UPDATE store_settings SET store_name = $1 WHERE 1=1;`, *req.Name)
			}
			if req.ContactEmail != nil {
				_, _ = stCtx.TenantDB.ExecContext(ctx, `UPDATE store_settings SET support_email = $1 WHERE 1=1;`, *req.ContactEmail)
			}
			if req.PrimaryDomain != nil {
				_, _ = stCtx.TenantDB.ExecContext(ctx, `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS primary_domain VARCHAR(255) NOT NULL DEFAULT '';`)
				_, _ = stCtx.TenantDB.ExecContext(ctx, `UPDATE store_settings SET primary_domain = $1 WHERE 1=1;`, *req.PrimaryDomain)
				_, _ = stCtx.TenantDB.ExecContext(ctx, `INSERT INTO store_metadata (key, value, updated_at) VALUES ('primary_domain', $1, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;`, *req.PrimaryDomain)
			}
			if req.ActiveTheme != nil {
				_, _ = stCtx.TenantDB.ExecContext(ctx, `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS active_theme VARCHAR(100) NOT NULL DEFAULT '';`)
				_, _ = stCtx.TenantDB.ExecContext(ctx, `UPDATE store_settings SET active_theme = $1 WHERE 1=1;`, next.ActiveTheme)
				_, _ = stCtx.TenantDB.ExecContext(ctx, `INSERT INTO store_metadata (key, value, updated_at) VALUES ('active_theme', $1, CURRENT_TIMESTAMP) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP;`, next.ActiveTheme)
			}
			if req.OwnerEmail != nil {
				_, _ = stCtx.TenantDB.ExecContext(ctx, `UPDATE store_staff SET email = $1, updated_at = CURRENT_TIMESTAMP WHERE role = 'STORE_OWNER';`, *req.OwnerEmail)
			}
			if req.OwnerFirstName != nil {
				_, _ = stCtx.TenantDB.ExecContext(ctx, `UPDATE store_staff SET first_name = $1, updated_at = CURRENT_TIMESTAMP WHERE role = 'STORE_OWNER';`, *req.OwnerFirstName)
			}
			if req.OwnerLastName != nil {
				_, _ = stCtx.TenantDB.ExecContext(ctx, `UPDATE store_staff SET last_name = $1, updated_at = CURRENT_TIMESTAMP WHERE role = 'STORE_OWNER';`, *req.OwnerLastName)
			}
			if req.OwnerPassword != nil && *req.OwnerPassword != "" {
				if hash, hErr := hasher.HashPassword(*req.OwnerPassword); hErr == nil {
					_, _ = stCtx.TenantDB.ExecContext(ctx, `UPDATE store_staff SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE role = 'STORE_OWNER';`, hash)
				}
			}
		}
	}

	if s.resolver != nil {
		s.resolver.InvalidateCache(ctx, "", cur.Slug)
		for _, d := range routes {
			s.resolver.InvalidateCache(ctx, d, cur.Slug)
		}
		if req.PrimaryDomain != nil {
			s.resolver.InvalidateCache(ctx, *req.PrimaryDomain, cur.Slug)
		}
		allRoutes := append(routes, next.PrimaryDomain)
		_, _ = s.resolver.PurgeStoreCache(ctx, storeID, cur.Slug, allRoutes)
	}

	return &StoreSummaryResponse{
		ID:            storeID,
		Name:          next.Name,
		Slug:          next.Slug,
		Status:        models.StoreStatus(next.Status),
		PrimaryDomain: next.PrimaryDomain,
		ActiveTheme:   next.ActiveTheme,
		ContactEmail:  next.ContactEmail,
		Currency:      next.Currency,
		CreatedAt:     next.CreatedAt,
		UpdatedAt:     updatedAt,
	}, nil
}

// txStoreDomains lists every domain mapped to a store inside the given transaction.
func txStoreDomains(ctx context.Context, tx *sql.Tx, storeID string) ([]string, error) {
	rows, err := tx.QueryContext(ctx, "SELECT domain FROM domains WHERE store_id = $1;", storeID)
	if err != nil {
		return nil, fmt.Errorf("listing domains of store %s: %w", storeID, err)
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var d string
		if err := rows.Scan(&d); err != nil {
			return nil, fmt.Errorf("scanning domain of store %s: %w", storeID, err)
		}
		out = append(out, d)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating domains of store %s: %w", storeID, err)
	}
	return out, nil
}

// Update handles PATCH /api/v1/platform/stores/{id}.
// It edits the store's registry fields (name, description, contact details, currency,
// timezone). Slug, status and database coordinates cannot be changed through this route.
// Unknown store: 404. Invalid or immutable-field input: 422.
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	storeID := chi.URLParam(r, "id")
	if storeID == "" {
		response.BadRequest(w, r, "Missing store ID parameter.")
		return
	}

	var req UpdateStoreRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid JSON payload.")
		return
	}

	updated, err := h.service.UpdateStore(r.Context(), storeID, req, audit.ActorFromRequest(r))
	if err != nil {
		if validation.Write(w, r, err) {
			return
		}
		if errors.Is(err, ErrStoreNotFound) {
			response.NotFound(w, r, "Store not found.")
			return
		}
		slog.ErrorContext(r.Context(), "store_mgmt: updating store failed", slog.String("store_id", storeID), slog.String("error", err.Error()))
		response.InternalServerError(w, r)
		return
	}

	response.JSON(w, http.StatusOK, updated)
}
