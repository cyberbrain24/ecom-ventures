package catalog

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"

	storeCtx "ecom-ventures/backend/internal/store/context"
	"ecom-ventures/backend/pkg/response"
)

// ErrSizeGuideTemplateNotFound indicates the requested template does not exist.
var ErrSizeGuideTemplateNotFound = errors.New("catalog: size guide template not found")

// SizeGuideMeasurementTable holds one dimensional matrix (e.g. Inches or Centimeters).
type SizeGuideMeasurementTable struct {
	Name    string     `json:"name"`
	Headers []string   `json:"headers"`
	Rows    [][]string `json:"rows"`
}

// SizeGuideTemplate is a reusable dimensional fit matrix attached to drops.
type SizeGuideTemplate struct {
	ID          string                      `json:"id"`
	Name        string                      `json:"name"`
	Description string                      `json:"description"`
	Tables      []SizeGuideMeasurementTable `json:"tables"`
	SortOrder   int                         `json:"sort_order"`
	LinkedItems int                         `json:"linked_items,omitempty"`
	CreatedAt   time.Time                   `json:"created_at"`
	UpdatedAt   time.Time                   `json:"updated_at"`
}

// SizeGuideTemplateRequest defines creation/update payload.
type SizeGuideTemplateRequest struct {
	Name        string                      `json:"name"`
	Description string                      `json:"description"`
	Tables      []SizeGuideMeasurementTable `json:"tables"`
}

// ListSizeGuideTemplates retrieves templates with attached drop count.
func (h *Handler) ListSizeGuideTemplates(w http.ResponseWriter, r *http.Request) {
	tenantDB, err := storeCtx.GetTenantDB(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Database connection not available")
		return
	}

	templates, err := listSizeTemplates(r.Context(), tenantDB)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to load size guide templates: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, templates)
}

// CreateSizeGuideTemplate handles POST /catalog/size-guides.
func (h *Handler) CreateSizeGuideTemplate(w http.ResponseWriter, r *http.Request) {
	tenantDB, err := storeCtx.GetTenantDB(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Database connection not available")
		return
	}

	var req SizeGuideTemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid payload format")
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		response.WriteBadRequest(w, r, "Template name is required")
		return
	}

	if req.Tables == nil {
		req.Tables = []SizeGuideMeasurementTable{}
	}

	tablesJSON, err := json.Marshal(req.Tables)
	if err != nil {
		response.WriteBadRequest(w, r, "Invalid measurement tables structure")
		return
	}

	var t SizeGuideTemplate
	query := `
		INSERT INTO size_guide_templates (name, description, tables, sort_order)
		VALUES ($1, $2, $3, COALESCE((SELECT MAX(sort_order) + 1 FROM size_guide_templates), 0))
		RETURNING id, name, description, tables, sort_order, created_at, updated_at
	`
	var rawTables []byte
	err = tenantDB.QueryRowContext(r.Context(), query, name, strings.TrimSpace(req.Description), tablesJSON).
		Scan(&t.ID, &t.Name, &t.Description, &rawTables, &t.SortOrder, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to save size template: "+err.Error())
		return
	}
	_ = json.Unmarshal(rawTables, &t.Tables)

	response.WriteJSON(w, http.StatusCreated, t)
}

// UpdateSizeGuideTemplate handles PUT /catalog/size-guides/{id}.
func (h *Handler) UpdateSizeGuideTemplate(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tenantDB, err := storeCtx.GetTenantDB(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Database connection not available")
		return
	}

	var req SizeGuideTemplateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid payload format")
		return
	}

	name := strings.TrimSpace(req.Name)
	if name == "" {
		response.WriteBadRequest(w, r, "Template name is required")
		return
	}

	if req.Tables == nil {
		req.Tables = []SizeGuideMeasurementTable{}
	}

	tablesJSON, err := json.Marshal(req.Tables)
	if err != nil {
		response.WriteBadRequest(w, r, "Invalid measurement tables structure")
		return
	}

	query := `
		UPDATE size_guide_templates
		SET name = $1, description = $2, tables = $3, updated_at = CURRENT_TIMESTAMP
		WHERE id = $4
		RETURNING id, name, description, tables, sort_order, created_at, updated_at
	`
	var t SizeGuideTemplate
	var rawTables []byte
	err = tenantDB.QueryRowContext(r.Context(), query, name, strings.TrimSpace(req.Description), tablesJSON, id).
		Scan(&t.ID, &t.Name, &t.Description, &rawTables, &t.SortOrder, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			response.WriteNotFound(w, r, "Size guide template not found")
			return
		}
		response.WriteInternalError(w, r, "Failed to update size template: "+err.Error())
		return
	}
	_ = json.Unmarshal(rawTables, &t.Tables)

	response.WriteJSON(w, http.StatusOK, t)
}

// DeleteSizeGuideTemplate handles DELETE /catalog/size-guides/{id}.
func (h *Handler) DeleteSizeGuideTemplate(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	tenantDB, err := storeCtx.GetTenantDB(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Database connection not available")
		return
	}

	res, err := tenantDB.ExecContext(r.Context(), "DELETE FROM size_guide_templates WHERE id = $1", id)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to delete size template: "+err.Error())
		return
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		response.WriteNotFound(w, r, "Size guide template not found")
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]string{"message": "Size guide template deleted successfully."})
}

func listSizeTemplates(ctx context.Context, db *sql.DB) ([]SizeGuideTemplate, error) {
	query := `
		SELECT s.id, s.name, s.description, s.tables, s.sort_order, s.created_at, s.updated_at,
		       COALESCE(COUNT(p.id), 0) AS linked_items
		FROM size_guide_templates s
		LEFT JOIN products p ON p.size_template_id = s.id
		GROUP BY s.id
		ORDER BY s.sort_order ASC, s.created_at ASC
	`
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query size guide templates: %w", err)
	}
	defer rows.Close()

	list := make([]SizeGuideTemplate, 0)
	for rows.Next() {
		var t SizeGuideTemplate
		var rawTables []byte
		if err := rows.Scan(&t.ID, &t.Name, &t.Description, &rawTables, &t.SortOrder, &t.CreatedAt, &t.UpdatedAt, &t.LinkedItems); err != nil {
			return nil, err
		}
		t.Tables = make([]SizeGuideMeasurementTable, 0)
		if len(rawTables) > 0 {
			_ = json.Unmarshal(rawTables, &t.Tables)
		}
		list = append(list, t)
	}
	return list, rows.Err()
}
