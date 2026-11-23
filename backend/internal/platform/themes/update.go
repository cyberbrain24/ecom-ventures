package themes

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"reflect"
	"regexp"
	"strings"

	"ecom-ventures/backend/internal/platform/audit"
	"ecom-ventures/backend/internal/platform/validation"
	"ecom-ventures/backend/pkg/response"

	"github.com/go-chi/chi/v5"
)

// maxConfigSchemaBytes bounds the size of a stored theme configuration document.
const maxConfigSchemaBytes = 64 * 1024

var themeVersionRegex = regexp.MustCompile(`^[0-9A-Za-z][0-9A-Za-z.+-]{0,19}$`)

// normalizeUpdateTheme trims and validates the fields of req in place. The configuration
// document goes through the same ThemeConfigValidator as store theme assignment.
// When stored is not nil, preview_image_url and config_schema are validated only if they differ
// from the stored values, so an unchanged echo of existing data never fails. With skipStoredChecks
// those two fields are not validated at all: it is the cheap pre-database pass, and the full pass
// runs once the stored theme is read.
func normalizeUpdateTheme(v *ThemeConfigValidator, req *UpdateThemeRequest, stored *ThemeSummaryResponse, skipStoredChecks bool) error {
	var c validation.Collector
	editable := false

	if req.Name != nil {
		editable = true
		n := strings.TrimSpace(*req.Name)
		if n == "" || len(n) > 100 {
			c.Add("name", "name is required and must be at most 100 characters")
		}
		req.Name = &n
	}
	if req.Description != nil {
		editable = true
		d := strings.TrimSpace(*req.Description)
		if len(d) > 2000 {
			c.Add("description", "description must be at most 2000 characters")
		}
		req.Description = &d
	}
	if req.Version != nil {
		editable = true
		ver := strings.TrimSpace(*req.Version)
		if !themeVersionRegex.MatchString(ver) {
			c.Add("version", "version must be 1 to 20 characters of letters, digits, dots, plus and hyphens, such as 1.2.0")
		}
		req.Version = &ver
	}
	if req.PreviewImageURL != nil {
		editable = true
		p := strings.TrimSpace(*req.PreviewImageURL)
		unchanged := stored != nil && p == stored.PreviewImageURL
		if p != "" && !unchanged && !skipStoredChecks && !validPreviewURL(p) {
			c.Add("preview_image_url", "preview_image_url must be an http(s) URL or a /uploads/ path of at most 2048 characters")
		}
		req.PreviewImageURL = &p
	}
	if req.IsActive != nil {
		editable = true
	}
	if len(req.ConfigSchema) > 0 && strings.TrimSpace(string(req.ConfigSchema)) != "null" {
		editable = true
		trimmed := strings.TrimSpace(string(req.ConfigSchema))
		switch {
		case skipStoredChecks, stored != nil && sameJSON(trimmed, stored.ConfigSchema):
			// Deferred to the full pass, or an unchanged echo of the stored document.
		case len(trimmed) > maxConfigSchemaBytes:
			c.Add("config_schema", fmt.Sprintf("config_schema must be at most %d bytes", maxConfigSchemaBytes))
		case !strings.HasPrefix(trimmed, "{"):
			c.Add("config_schema", "config_schema must be a JSON object")
		default:
			if err := v.ValidateThemeSchema(json.RawMessage(trimmed)); err != nil {
				c.Add("config_schema", err.Error())
			}
		}
	} else {
		req.ConfigSchema = nil
	}
	if !editable {
		c.Add("body", "at least one editable field is required: name, description, version, preview_image_url, config_schema or is_active")
	}
	return c.Err()
}

// sameJSON reports whether the JSON text a decodes to the same value as the stored document b.
func sameJSON(a string, b []byte) bool {
	if len(b) == 0 {
		return false
	}
	var x, y any
	if err := json.Unmarshal([]byte(a), &x); err != nil {
		return false
	}
	if err := json.Unmarshal(b, &y); err != nil {
		return false
	}
	return reflect.DeepEqual(x, y)
}

func validPreviewURL(p string) bool {
	if len(p) > 2048 {
		return false
	}
	if strings.HasPrefix(p, "/uploads/") {
		return true
	}
	u, err := url.Parse(p)
	return err == nil && (u.Scheme == "http" || u.Scheme == "https") && u.Host != ""
}

// UpdateTheme edits a theme blueprint's name, description, version, preview image,
// configuration document and active flag. The slug never changes. The row is locked,
// updated and audited in one transaction, then the cached theme of every store that
// uses this theme is dropped from Redis so storefronts pick the change up.
// It returns ErrThemeNotFound for an unknown theme and a *validation.Error for bad input.
func (s *Service) UpdateTheme(ctx context.Context, themeID string, req UpdateThemeRequest, actor audit.Actor) (*ThemeSummaryResponse, error) {
	if err := normalizeUpdateTheme(s.validator, &req, nil, true); err != nil {
		return nil, err
	}
	if !audit.IsUUID(themeID) {
		return nil, ErrThemeNotFound
	}
	if s.db == nil {
		return nil, fmt.Errorf("themes: platform database connection handle is nil")
	}

	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("beginning theme update transaction: %w", err)
	}
	defer func() { _ = tx.Rollback() }()

	var t ThemeSummaryResponse
	var schema []byte
	err = tx.QueryRowContext(ctx, `
		SELECT id, name, slug, COALESCE(description, ''), version, COALESCE(preview_image_url, ''),
		       config_schema, is_active, created_at, updated_at
		FROM themes WHERE id = $1 FOR UPDATE;`, themeID,
	).Scan(&t.ID, &t.Name, &t.Slug, &t.Description, &t.Version, &t.PreviewImageURL,
		&schema, &t.IsActive, &t.CreatedAt, &t.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrThemeNotFound
	} else if err != nil {
		return nil, fmt.Errorf("reading theme %s for update: %w", themeID, err)
	}
	t.ConfigSchema = schema
	if err := normalizeUpdateTheme(s.validator, &req, &t, false); err != nil {
		return nil, err
	}
	before := themeAuditView(&t)

	if req.Name != nil {
		t.Name = *req.Name
	}
	if req.Description != nil {
		t.Description = *req.Description
	}
	if req.Version != nil {
		t.Version = *req.Version
	}
	if req.PreviewImageURL != nil {
		t.PreviewImageURL = *req.PreviewImageURL
	}
	if req.ConfigSchema != nil {
		t.ConfigSchema = req.ConfigSchema
	}
	if req.IsActive != nil {
		t.IsActive = *req.IsActive
	}

	err = tx.QueryRowContext(ctx, `
		UPDATE themes
		SET name = $1, description = $2, version = $3, preview_image_url = NULLIF($4, ''),
		    config_schema = $5::jsonb, is_active = $6, updated_at = CURRENT_TIMESTAMP
		WHERE id = $7
		RETURNING config_schema, updated_at;`,
		t.Name, t.Description, t.Version, t.PreviewImageURL, string(t.ConfigSchema), t.IsActive, themeID,
	).Scan(&schema, &t.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("updating theme %s: %w", themeID, err)
	}
	t.ConfigSchema = schema

	storeIDs, err := activeThemeStoreIDs(ctx, tx, themeID)
	if err != nil {
		return nil, err
	}
	t.ActiveStoresCount = len(storeIDs)

	if err := audit.Record(ctx, tx, actor, "THEME_UPDATED", "themes", themeID, "", before, themeAuditView(&t)); err != nil {
		return nil, fmt.Errorf("auditing theme update: %w", err)
	}
	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("committing theme update: %w", err)
	}

	s.invalidateThemeCaches(ctx, storeIDs)
	return &t, nil
}

// activeThemeStoreIDs lists the stores whose active theme is themeID.
func activeThemeStoreIDs(ctx context.Context, tx *sql.Tx, themeID string) ([]string, error) {
	rows, err := tx.QueryContext(ctx, `SELECT store_id FROM store_themes WHERE theme_id = $1 AND is_active = TRUE;`, themeID)
	if err != nil {
		return nil, fmt.Errorf("listing stores using theme %s: %w", themeID, err)
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, fmt.Errorf("scanning store using theme %s: %w", themeID, err)
		}
		ids = append(ids, id)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating stores using theme %s: %w", themeID, err)
	}
	return ids, nil
}

// invalidateThemeCaches drops the cached theme of each store. The database change is already
// committed, so a Redis failure is logged and the entries expire on their own TTL.
func (s *Service) invalidateThemeCaches(ctx context.Context, storeIDs []string) {
	if s.redisClient == nil || len(storeIDs) == 0 {
		return
	}
	keys := make([]string, 0, len(storeIDs))
	for _, id := range storeIDs {
		keys = append(keys, redisThemeStorePrefix+id)
	}
	if err := s.redisClient.Del(ctx, keys...).Err(); err != nil {
		slog.Default().Warn("themes: failed to invalidate store theme cache; entries expire after TTL",
			slog.Int("stores", len(storeIDs)), slog.String("error", err.Error()))
	}
}

func themeAuditView(t *ThemeSummaryResponse) map[string]any {
	return map[string]any{
		"name": t.Name, "slug": t.Slug, "description": t.Description, "version": t.Version,
		"preview_image_url": t.PreviewImageURL, "is_active": t.IsActive, "config_schema": json.RawMessage(t.ConfigSchema),
	}
}

// Update handles PATCH /api/v1/platform/themes/{id}.
// Unknown theme: 404. Invalid input, including a configuration the theme validator rejects: 422.
func (h *Handler) Update(w http.ResponseWriter, r *http.Request) {
	themeID := chi.URLParam(r, "id")
	if themeID == "" {
		response.BadRequest(w, r, "Missing theme ID parameter.")
		return
	}

	var req UpdateThemeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request JSON payload.")
		return
	}

	updated, err := h.service.UpdateTheme(r.Context(), themeID, req, audit.ActorFromRequest(r))
	if err != nil {
		if validation.Write(w, r, err) {
			return
		}
		if errors.Is(err, ErrThemeNotFound) {
			response.NotFound(w, r, "The requested theme does not exist.")
			return
		}
		slog.ErrorContext(r.Context(), "themes: updating theme failed", slog.String("theme_id", themeID), slog.String("error", err.Error()))
		response.InternalServerError(w, r)
		return
	}

	response.JSON(w, http.StatusOK, updated)
}
