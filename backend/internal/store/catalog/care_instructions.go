package catalog

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/lib/pq"

	storeCtx "ecom-ventures/backend/internal/store/context"
	"ecom-ventures/backend/pkg/response"
)

// ErrCareInstructionNotFound is returned when a care instruction id matches nothing in the store.
var ErrCareInstructionNotFound = errors.New("catalog: care instruction not found")

const (
	maxCareTitleLen        = 160
	maxCareStepLen         = 300
	maxCareSteps           = 30
	maxCareSymbols         = 20
	maxCareSymbolCodeLen   = 40
	careInstructionColumns = `id, title, material_category, instructions, care_symbols, description, is_active, sort_order, created_at, updated_at`
)

// careSymbolPattern is the shape of a care symbol code such as "wash-30" or "no-bleach".
var careSymbolPattern = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)

// CareInstruction is a reusable set of care steps for a material, for example "Silk: hand wash cold".
type CareInstruction struct {
	ID               string    `json:"id"`
	Title            string    `json:"title"`
	MaterialCategory string    `json:"material_category"`
	Instructions     []string  `json:"instructions"`
	CareSymbols      []string  `json:"care_symbols"`
	Description      string    `json:"description"`
	IsActive         bool      `json:"is_active"`
	SortOrder        int       `json:"sort_order"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// CareInstructionRequest is the body of create and update care instruction calls. IsActive is a pointer so a
// create that leaves it out defaults to active, while an update must send it.
type CareInstructionRequest struct {
	Title            string   `json:"title"`
	MaterialCategory string   `json:"material_category"`
	Instructions     []string `json:"instructions"`
	CareSymbols      []string `json:"care_symbols"`
	Description      string   `json:"description"`
	IsActive         *bool    `json:"is_active"`
}

// normalizeCareInstruction trims and validates a request and returns the record to store.
// Blank steps are dropped; symbol codes are lower-cased and checked.
func normalizeCareInstruction(req CareInstructionRequest) (*CareInstruction, error) {
	c := &CareInstruction{
		Title:            strings.TrimSpace(req.Title),
		MaterialCategory: strings.TrimSpace(req.MaterialCategory),
		Description:      strings.TrimSpace(req.Description),
		Instructions:     []string{},
		CareSymbols:      []string{},
		IsActive:         true,
	}
	if req.IsActive != nil {
		c.IsActive = *req.IsActive
	}
	if err := validateText("title", c.Title, maxCareTitleLen, true); err != nil {
		return nil, err
	}
	if err := validateText("material_category", c.MaterialCategory, maxShortTextLen, false); err != nil {
		return nil, err
	}
	if err := validateText("description", c.Description, maxDescriptionLen, false); err != nil {
		return nil, err
	}

	for _, step := range req.Instructions {
		step = strings.TrimSpace(step)
		if step == "" {
			continue
		}
		if err := validateText("instruction step", step, maxCareStepLen, false); err != nil {
			return nil, err
		}
		c.Instructions = append(c.Instructions, step)
	}
	if len(c.Instructions) == 0 {
		return nil, fmt.Errorf("%w: at least one care step is required", ErrInvalidInput)
	}
	if len(c.Instructions) > maxCareSteps {
		return nil, fmt.Errorf("%w: at most %d care steps are allowed", ErrInvalidInput, maxCareSteps)
	}

	seen := map[string]struct{}{}
	for _, code := range req.CareSymbols {
		code = strings.ToLower(strings.TrimSpace(code))
		if code == "" {
			continue
		}
		if len(code) > maxCareSymbolCodeLen || !careSymbolPattern.MatchString(code) {
			return nil, fmt.Errorf("%w: %q is not a valid care symbol code (use letters, numbers and hyphens)", ErrInvalidInput, code)
		}
		if _, dup := seen[code]; dup {
			continue
		}
		seen[code] = struct{}{}
		c.CareSymbols = append(c.CareSymbols, code)
	}
	if len(c.CareSymbols) > maxCareSymbols {
		return nil, fmt.Errorf("%w: at most %d care symbols are allowed", ErrInvalidInput, maxCareSymbols)
	}
	return c, nil
}

func scanCareInstruction(row interface{ Scan(dest ...any) error }) (*CareInstruction, error) {
	var c CareInstruction
	if err := row.Scan(&c.ID, &c.Title, &c.MaterialCategory, pq.Array(&c.Instructions), pq.Array(&c.CareSymbols),
		&c.Description, &c.IsActive, &c.SortOrder, &c.CreatedAt, &c.UpdatedAt); err != nil {
		return nil, err
	}
	if c.Instructions == nil {
		c.Instructions = []string{}
	}
	if c.CareSymbols == nil {
		c.CareSymbols = []string{}
	}
	return &c, nil
}

// ListCareInstructions returns every care instruction in display order.
func (r *Repository) ListCareInstructions(ctx context.Context, db *sql.DB) ([]CareInstruction, error) {
	if err := EnsureBrandCareSchema(ctx, db); err != nil {
		return nil, err
	}
	rows, err := db.QueryContext(ctx, `SELECT `+careInstructionColumns+` FROM care_instructions ORDER BY sort_order ASC, title ASC, id ASC`)
	if err != nil {
		return nil, fmt.Errorf("listing care instructions: %w", err)
	}
	defer rows.Close()

	list := []CareInstruction{}
	for rows.Next() {
		c, err := scanCareInstruction(rows)
		if err != nil {
			return nil, fmt.Errorf("scanning care instruction: %w", err)
		}
		list = append(list, *c)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("reading care instructions: %w", err)
	}
	return list, nil
}

// CreateCareInstruction inserts a care instruction at the end of the list.
func (r *Repository) CreateCareInstruction(ctx context.Context, db *sql.DB, c *CareInstruction) (*CareInstruction, error) {
	if err := EnsureBrandCareSchema(ctx, db); err != nil {
		return nil, err
	}
	row := db.QueryRowContext(ctx, `
		INSERT INTO care_instructions (title, material_category, instructions, care_symbols, description, is_active, sort_order)
		VALUES ($1, $2, $3, $4, $5, $6, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM care_instructions))
		RETURNING `+careInstructionColumns,
		c.Title, c.MaterialCategory, pq.Array(c.Instructions), pq.Array(c.CareSymbols), c.Description, c.IsActive)
	created, err := scanCareInstruction(row)
	if err != nil {
		return nil, fmt.Errorf("creating care instruction: %w", err)
	}
	return created, nil
}

// UpdateCareInstruction replaces the editable fields of a care instruction. Its position does not change.
func (r *Repository) UpdateCareInstruction(ctx context.Context, db *sql.DB, id string, c *CareInstruction) (*CareInstruction, error) {
	if err := EnsureBrandCareSchema(ctx, db); err != nil {
		return nil, err
	}
	row := db.QueryRowContext(ctx, `
		UPDATE care_instructions
		SET title = $2, material_category = $3, instructions = $4, care_symbols = $5, description = $6,
		    is_active = $7, updated_at = CURRENT_TIMESTAMP
		WHERE id = $1
		RETURNING `+careInstructionColumns,
		id, c.Title, c.MaterialCategory, pq.Array(c.Instructions), pq.Array(c.CareSymbols), c.Description, c.IsActive)
	updated, err := scanCareInstruction(row)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrCareInstructionNotFound
	}
	if err != nil {
		return nil, fmt.Errorf("updating care instruction: %w", err)
	}
	return updated, nil
}

// DeleteCareInstruction removes a care instruction.
func (r *Repository) DeleteCareInstruction(ctx context.Context, db *sql.DB, id string) error {
	if err := EnsureBrandCareSchema(ctx, db); err != nil {
		return err
	}
	res, err := db.ExecContext(ctx, `DELETE FROM care_instructions WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("deleting care instruction: %w", err)
	}
	n, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("reading care instruction delete result: %w", err)
	}
	if n == 0 {
		return ErrCareInstructionNotFound
	}
	return nil
}

// ReorderCareInstructions stores the position of each care instruction, first id first.
func (r *Repository) ReorderCareInstructions(ctx context.Context, db *sql.DB, ids []string) error {
	if err := EnsureBrandCareSchema(ctx, db); err != nil {
		return err
	}
	return reorderByIDs(ctx, db, "care_instructions", "sort_order", "", ids)
}

// ListCareInstructions returns the store's care instructions in display order.
func (s *Service) ListCareInstructions(ctx context.Context) ([]CareInstruction, error) {
	db, err := storeCtx.GetTenantDB(ctx)
	if err != nil {
		return nil, err
	}
	return s.repo.ListCareInstructions(ctx, db)
}

// CreateCareInstruction validates and creates a care instruction.
func (s *Service) CreateCareInstruction(ctx context.Context, req CareInstructionRequest) (*CareInstruction, error) {
	db, err := storeCtx.GetTenantDB(ctx)
	if err != nil {
		return nil, err
	}
	c, err := normalizeCareInstruction(req)
	if err != nil {
		return nil, err
	}
	return s.repo.CreateCareInstruction(ctx, db, c)
}

// UpdateCareInstruction validates and updates a care instruction. The request must say whether it is active.
func (s *Service) UpdateCareInstruction(ctx context.Context, id string, req CareInstructionRequest) (*CareInstruction, error) {
	db, err := storeCtx.GetTenantDB(ctx)
	if err != nil {
		return nil, err
	}
	if !uuidPattern.MatchString(id) {
		return nil, ErrCareInstructionNotFound
	}
	if req.IsActive == nil {
		return nil, fmt.Errorf("%w: is_active is required", ErrInvalidInput)
	}
	c, err := normalizeCareInstruction(req)
	if err != nil {
		return nil, err
	}
	return s.repo.UpdateCareInstruction(ctx, db, id, c)
}

// DeleteCareInstruction removes a care instruction.
func (s *Service) DeleteCareInstruction(ctx context.Context, id string) error {
	db, err := storeCtx.GetTenantDB(ctx)
	if err != nil {
		return err
	}
	if !uuidPattern.MatchString(id) {
		return ErrCareInstructionNotFound
	}
	return s.repo.DeleteCareInstruction(ctx, db, id)
}

// ReorderCareInstructions saves the order of the care instruction list.
func (s *Service) ReorderCareInstructions(ctx context.Context, ids []string) error {
	db, err := storeCtx.GetTenantDB(ctx)
	if err != nil {
		return err
	}
	if err := ValidateOrderedIDs(ids); err != nil {
		return err
	}
	return s.repo.ReorderCareInstructions(ctx, db, ids)
}

// ListCareInstructions handles GET /api/v1/store/{store_slug}/catalog/care-instructions.
func (h *Handler) ListCareInstructions(w http.ResponseWriter, r *http.Request) {
	list, err := h.service.ListCareInstructions(r.Context())
	if err != nil {
		writeBrandCareError(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, list)
}

// CreateCareInstruction handles POST /api/v1/store/{store_slug}/catalog/care-instructions.
func (h *Handler) CreateCareInstruction(w http.ResponseWriter, r *http.Request) {
	var req CareInstructionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request JSON payload.")
		return
	}
	c, err := h.service.CreateCareInstruction(r.Context(), req)
	if err != nil {
		writeBrandCareError(w, r, err)
		return
	}
	response.JSON(w, http.StatusCreated, c)
}

// UpdateCareInstruction handles PUT /api/v1/store/{store_slug}/catalog/care-instructions/{id}.
func (h *Handler) UpdateCareInstruction(w http.ResponseWriter, r *http.Request) {
	var req CareInstructionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request JSON payload.")
		return
	}
	c, err := h.service.UpdateCareInstruction(r.Context(), chi.URLParam(r, "id"), req)
	if err != nil {
		writeBrandCareError(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, c)
}

// DeleteCareInstruction handles DELETE /api/v1/store/{store_slug}/catalog/care-instructions/{id}.
func (h *Handler) DeleteCareInstruction(w http.ResponseWriter, r *http.Request) {
	if err := h.service.DeleteCareInstruction(r.Context(), chi.URLParam(r, "id")); err != nil {
		writeBrandCareError(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"message": "Care instruction deleted successfully."})
}

// ReorderCareInstructions handles PUT /api/v1/store/{store_slug}/catalog/care-instructions/reorder.
func (h *Handler) ReorderCareInstructions(w http.ResponseWriter, r *http.Request) {
	req, ok := decodeReorder(w, r)
	if !ok {
		return
	}
	if err := h.service.ReorderCareInstructions(r.Context(), req.IDs); err != nil {
		writeBrandCareError(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"message": "Care instruction order saved."})
}
