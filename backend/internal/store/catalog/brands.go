package catalog

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/lib/pq"

	storeCtx "ecom-ventures/backend/internal/store/context"
	"ecom-ventures/backend/pkg/response"
)

var (
	// ErrBrandNotFound is returned when a brand id matches no brand in the store.
	ErrBrandNotFound = errors.New("catalog: brand not found")
	// ErrBrandSlugCollision is returned when another brand already uses the slug.
	ErrBrandSlugCollision = errors.New("catalog: brand slug is already in use")
	// ErrInvalidInput is returned when a request body fails validation; the message says which field.
	ErrInvalidInput = errors.New("catalog: invalid input")
)

const (
	maxBrandNameLen   = 120
	maxShortTextLen   = 120
	maxDescriptionLen = 2000
	maxURLLen         = 2048
)

// Brand is a product brand shown in the store admin and, later, on product pages.
type Brand struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Slug        string    `json:"slug"`
	LogoURL     string    `json:"logo_url"`
	Origin      string    `json:"origin"`
	Description string    `json:"description"`
	WebsiteURL  string    `json:"website_url"`
	IsActive    bool      `json:"is_active"`
	SortOrder   int       `json:"sort_order"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// BrandRequest is the body of create and update brand calls. IsActive is a pointer so a create that leaves
// it out defaults to active, while an update must send it.
type BrandRequest struct {
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	LogoURL     string `json:"logo_url"`
	Origin      string `json:"origin"`
	Description string `json:"description"`
	WebsiteURL  string `json:"website_url"`
	IsActive    *bool  `json:"is_active"`
}

// validateHTTPURL accepts an empty value or an absolute http or https URL.
func validateHTTPURL(field, value string) error {
	if value == "" {
		return nil
	}
	if len(value) > maxURLLen {
		return fmt.Errorf("%w: %s is longer than %d characters", ErrInvalidInput, field, maxURLLen)
	}
	u, err := url.Parse(value)
	if err != nil || (u.Scheme != "http" && u.Scheme != "https") || u.Host == "" {
		return fmt.Errorf("%w: %s must be a full http or https address", ErrInvalidInput, field)
	}
	return nil
}

// validateText checks a trimmed text field against a maximum length counted in characters.
func validateText(field, value string, max int, required bool) error {
	if required && value == "" {
		return fmt.Errorf("%w: %s is required", ErrInvalidInput, field)
	}
	if len([]rune(value)) > max {
		return fmt.Errorf("%w: %s is longer than %d characters", ErrInvalidInput, field, max)
	}
	return nil
}

// normalizeBrand trims and validates a request and returns the brand to store (without id and order).
func normalizeBrand(req BrandRequest) (*Brand, error) {
	b := &Brand{
		Name:        strings.TrimSpace(req.Name),
		Slug:        GenerateSlug(req.Slug),
		LogoURL:     strings.TrimSpace(req.LogoURL),
		Origin:      strings.TrimSpace(req.Origin),
		Description: strings.TrimSpace(req.Description),
		WebsiteURL:  strings.TrimSpace(req.WebsiteURL),
		IsActive:    true,
	}
	if req.IsActive != nil {
		b.IsActive = *req.IsActive
	}
	if err := validateText("name", b.Name, maxBrandNameLen, true); err != nil {
		return nil, err
	}
	if b.Slug == "" {
		b.Slug = GenerateSlug(b.Name)
	}
	if b.Slug == "" {
		return nil, fmt.Errorf("%w: name must contain letters or numbers", ErrInvalidInput)
	}
	if err := validateText("origin", b.Origin, maxShortTextLen, false); err != nil {
		return nil, err
	}
	if err := validateText("description", b.Description, maxDescriptionLen, false); err != nil {
		return nil, err
	}
	if err := validateHTTPURL("logo_url", b.LogoURL); err != nil {
		return nil, err
	}
	if err := validateHTTPURL("website_url", b.WebsiteURL); err != nil {
		return nil, err
	}
	return b, nil
}

// isUniqueViolation reports whether err is a PostgreSQL unique constraint violation.
func isUniqueViolation(err error) bool {
	var pqErr *pq.Error
	return errors.As(err, &pqErr) && pqErr.Code == "23505"
}

const brandColumns = `id, name, slug, logo_url, origin, description, website_url, is_active, sort_order, created_at, updated_at`

func scanBrand(row interface{ Scan(dest ...any) error }) (*Brand, error) {
	var b Brand
	if err := row.Scan(&b.ID, &b.Name, &b.Slug, &b.LogoURL, &b.Origin, &b.Description, &b.WebsiteURL,
		&b.IsActive, &b.SortOrder, &b.CreatedAt, &b.UpdatedAt); err != nil {
		return nil, err
	}
	return &b, nil
}

// ListBrands returns every brand in display order.
func (r *Repository) ListBrands(ctx context.Context, db *sql.DB) ([]Brand, error) {
	if err := EnsureBrandCareSchema(ctx, db); err != nil {
		return nil, err
	}
	rows, err := db.QueryContext(ctx, `SELECT `+brandColumns+` FROM brands ORDER BY sort_order ASC, name ASC, id ASC`)
	if err != nil {
		return nil, fmt.Errorf("listing brands: %w", err)
	}
	defer rows.Close()

	brands := []Brand{}
	for rows.Next() {
		b, err := scanBrand(rows)
		if err != nil {
			return nil, fmt.Errorf("scanning brand: %w", err)
		}
		brands = append(brands, *b)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("reading brands: %w", err)
	}
	return brands, nil
}

// CreateBrand inserts a brand at the end of the brand list.
func (r *Repository) CreateBrand(ctx context.Context, db *sql.DB, b *Brand) (*Brand, error) {
	if err := EnsureBrandCareSchema(ctx, db); err != nil {
		return nil, err
	}
	row := db.QueryRowContext(ctx, `
		INSERT INTO brands (name, slug, logo_url, origin, description, website_url, is_active, sort_order)
		VALUES ($1, $2, $3, $4, $5, $6, $7, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM brands))
		RETURNING `+brandColumns,
		b.Name, b.Slug, b.LogoURL, b.Origin, b.Description, b.WebsiteURL, b.IsActive)
	created, err := scanBrand(row)
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrBrandSlugCollision
		}
		return nil, fmt.Errorf("creating brand: %w", err)
	}
	return created, nil
}

// UpdateBrand replaces the editable fields of a brand. Its position in the list does not change.
func (r *Repository) UpdateBrand(ctx context.Context, db *sql.DB, id string, b *Brand) (*Brand, error) {
	if err := EnsureBrandCareSchema(ctx, db); err != nil {
		return nil, err
	}
	row := db.QueryRowContext(ctx, `
		UPDATE brands
		SET name = $2, slug = $3, logo_url = $4, origin = $5, description = $6, website_url = $7,
		    is_active = $8, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1
		RETURNING `+brandColumns,
		id, b.Name, b.Slug, b.LogoURL, b.Origin, b.Description, b.WebsiteURL, b.IsActive)
	updated, err := scanBrand(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrBrandNotFound
	}
	if err != nil {
		if isUniqueViolation(err) {
			return nil, ErrBrandSlugCollision
		}
		return nil, fmt.Errorf("updating brand: %w", err)
	}
	return updated, nil
}

// DeleteBrand removes a brand.
func (r *Repository) DeleteBrand(ctx context.Context, db *sql.DB, id string) error {
	if err := EnsureBrandCareSchema(ctx, db); err != nil {
		return err
	}
	res, err := db.ExecContext(ctx, `DELETE FROM brands WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("deleting brand: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("reading brand delete result: %w", err)
	}
	if n == 0 {
		return ErrBrandNotFound
	}
	return nil
}

// ReorderBrands stores the position of each brand; ids must list every brand to be placed, first position first.
func (r *Repository) ReorderBrands(ctx context.Context, db *sql.DB, ids []string) error {
	if err := EnsureBrandCareSchema(ctx, db); err != nil {
		return err
	}
	return reorderByIDs(ctx, db, "brands", "sort_order", "", ids)
}

// ListBrands returns the store's brands in display order.
func (s *Service) ListBrands(ctx context.Context) ([]Brand, error) {
	db, err := storeCtx.GetTenantDB(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.ListBrands(ctx, db)
}

// CreateBrand validates and creates a brand.
func (s *Service) CreateBrand(ctx context.Context, req BrandRequest) (*Brand, error) {
	db, err := storeCtx.GetTenantDB(ctx)
	if err != nil {
		return nil, err
	}
	b, err := normalizeBrand(req)
	if err != nil {
		return nil, err
	}
	return s.repo.CreateBrand(ctx, db, b)
}

// UpdateBrand validates and updates a brand. The request must say whether the brand is active.
func (s *Service) UpdateBrand(ctx context.Context, id string, req BrandRequest) (*Brand, error) {
	db, err := storeCtx.GetTenantDB(ctx)
	if err != nil {
		return nil, err
	}
	if !uuidPattern.MatchString(id) {
		return nil, ErrBrandNotFound
	}
	if req.IsActive == nil {
		return nil, fmt.Errorf("%w: is_active is required", ErrInvalidInput)
	}
	b, err := normalizeBrand(req)
	if err != nil {
		return nil, err
	}
	return s.repo.UpdateBrand(ctx, db, id, b)
}

// DeleteBrand removes a brand.
func (s *Service) DeleteBrand(ctx context.Context, id string) error {
	db, err := storeCtx.GetTenantDB(ctx)
	if err != nil {
		return err
	}
	if !uuidPattern.MatchString(id) {
		return ErrBrandNotFound
	}
	return s.repo.DeleteBrand(ctx, db, id)
}

// ReorderBrands saves the order of the brand list.
func (s *Service) ReorderBrands(ctx context.Context, ids []string) error {
	db, err := storeCtx.GetTenantDB(ctx)
	if err != nil {
		return err
	}
	if err := ValidateOrderedIDs(ids); err != nil {
		return err
	}
	return s.repo.ReorderBrands(ctx, db, ids)
}

// writeBrandCareError maps brand and care instruction errors to HTTP responses.
func writeBrandCareError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, ErrInvalidInput), errors.Is(err, ErrInvalidReorder):
		response.BadRequest(w, r, err.Error())
	case errors.Is(err, ErrBrandNotFound):
		response.NotFound(w, r, "Brand not found.")
	case errors.Is(err, ErrCareInstructionNotFound):
		response.NotFound(w, r, "Care instruction not found.")
	case errors.Is(err, ErrBrandSlugCollision):
		response.Problem(w, r, http.StatusConflict, "BRAND_SLUG_CONFLICT", "Conflict", "Another brand already uses this slug.")
	case errors.Is(err, ErrReorderUnknownID):
		response.Problem(w, r, http.StatusConflict, "REORDER_UNKNOWN_ID", "Conflict",
			"The list contains an item that no longer exists. Reload the page and try again.")
	default:
		response.InternalServerError(w, r)
	}
}

// ListBrands handles GET /api/v1/store/{store_slug}/catalog/brands.
func (h *Handler) ListBrands(w http.ResponseWriter, r *http.Request) {
	brands, err := h.service.ListBrands(r.Context())
	if err != nil {
		writeBrandCareError(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, brands)
}

// CreateBrand handles POST /api/v1/store/{store_slug}/catalog/brands.
func (h *Handler) CreateBrand(w http.ResponseWriter, r *http.Request) {
	var req BrandRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request JSON payload.")
		return
	}
	brand, err := h.service.CreateBrand(r.Context(), req)
	if err != nil {
		writeBrandCareError(w, r, err)
		return
	}
	response.JSON(w, http.StatusCreated, brand)
}

// UpdateBrand handles PUT /api/v1/store/{store_slug}/catalog/brands/{id}.
func (h *Handler) UpdateBrand(w http.ResponseWriter, r *http.Request) {
	var req BrandRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request JSON payload.")
		return
	}
	brand, err := h.service.UpdateBrand(r.Context(), chi.URLParam(r, "id"), req)
	if err != nil {
		writeBrandCareError(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, brand)
}

// DeleteBrand handles DELETE /api/v1/store/{store_slug}/catalog/brands/{id}.
func (h *Handler) DeleteBrand(w http.ResponseWriter, r *http.Request) {
	if err := h.service.DeleteBrand(r.Context(), chi.URLParam(r, "id")); err != nil {
		writeBrandCareError(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"message": "Brand deleted successfully."})
}

// ReorderBrands handles PUT /api/v1/store/{store_slug}/catalog/brands/reorder.
func (h *Handler) ReorderBrands(w http.ResponseWriter, r *http.Request) {
	req, ok := decodeReorder(w, r)
	if !ok {
		return
	}
	if err := h.service.ReorderBrands(r.Context(), req.IDs); err != nil {
		writeBrandCareError(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"message": "Brand order saved."})
}
