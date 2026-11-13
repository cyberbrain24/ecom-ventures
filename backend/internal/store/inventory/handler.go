package inventory

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	storeModels "ecom-ventures/backend/internal/store/models"
	"ecom-ventures/backend/pkg/response"
)

// Handler handles HTTP requests for inventory administration.
type Handler struct {
	service *Service
}

// NewHandler instantiates the inventory handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// ListInventory handles GET /api/v1/store/{store_slug}/inventory
func (h *Handler) ListInventory(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 100 {
		limit = 20
	}

	filter := &InventoryFilterParams{
		Search: r.URL.Query().Get("search"),
		Page:   page,
		Limit:  limit,
	}

	if r.URL.Query().Get("is_low_stock") == "true" {
		t := true
		filter.IsLowStock = &t
	}

	resp, err := h.service.ListInventory(r.Context(), filter)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to retrieve inventory: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, resp)
}

// AdjustStock handles POST /api/v1/store/{store_slug}/inventory/adjust
func (h *Handler) AdjustStock(w http.ResponseWriter, r *http.Request) {
	var req AdjustStockRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	if req.VariantID == "" {
		response.WriteValidationError(w, r, []response.InvalidParam{
			{Name: "variant_id", Reason: "Variant ID is required"},
		})
		return
	}

	if req.Reason == "" {
		response.WriteValidationError(w, r, []response.InvalidParam{
			{Name: "reason", Reason: "Adjustment reason is mandatory for double-entry audit records"},
		})
		return
	}

	movement, err := h.service.AdjustStock(r.Context(), &req)
	if err != nil {
		if errors.Is(err, ErrInsufficientStock) || errors.Is(err, ErrInvalidStockOperation) {
			response.WriteBadRequest(w, r, err.Error())
			return
		}
		if errors.Is(err, ErrVariantStockNotFound) {
			response.WriteNotFound(w, r, "Variant inventory record not found")
			return
		}
		response.WriteInternalError(w, r, "Failed to adjust inventory: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, movement)
}

// BatchAdjustStock handles POST /api/v1/store/{store_slug}/inventory/adjust/batch
func (h *Handler) BatchAdjustStock(w http.ResponseWriter, r *http.Request) {
	var req BatchStockAdjustmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	if len(req.Adjustments) == 0 {
		response.WriteBadRequest(w, r, "Adjustment list must not be empty")
		return
	}

	movements, err := h.service.BatchAdjustStock(r.Context(), &req)
	if err != nil {
		response.WriteInternalError(w, r, "Failed executing batch adjustments: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success":   true,
		"movements": movements,
	})
}

// ListMovements handles GET /api/v1/store/{store_slug}/inventory/movements
func (h *Handler) ListMovements(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 100 {
		limit = 50
	}

	filter := &StockMovementFilterParams{
		Page:  page,
		Limit: limit,
	}

	if vID := r.URL.Query().Get("variant_id"); vID != "" {
		filter.VariantID = &vID
	}
	if reason := r.URL.Query().Get("reason"); reason != "" {
		rReason := storeModels.StockMovementReason(reason)
		filter.Reason = &rReason
	}

	resp, err := h.service.ListMovements(r.Context(), filter)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to fetch stock movements: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, resp)
}

// UpdateThreshold handles PATCH /api/v1/store/{store_slug}/inventory/{variant_id}/threshold
func (h *Handler) UpdateThreshold(w http.ResponseWriter, r *http.Request) {
	variantID := chi.URLParam(r, "variant_id")
	var req UpdateThresholdRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	if req.LowStockThreshold < 0 {
		response.WriteValidationError(w, r, []response.InvalidParam{
			{Name: "low_stock_threshold", Reason: "Threshold cannot be negative"},
		})
		return
	}

	if err := h.service.UpdateThreshold(r.Context(), variantID, req.LowStockThreshold); err != nil {
		if errors.Is(err, ErrVariantStockNotFound) {
			response.WriteNotFound(w, r, "Variant inventory record not found")
			return
		}
		response.WriteInternalError(w, r, "Failed to update threshold: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Low stock threshold updated successfully",
	})
}

// GetLowStockAlerts handles GET /api/v1/store/{store_slug}/inventory/alerts/low-stock
func (h *Handler) GetLowStockAlerts(w http.ResponseWriter, r *http.Request) {
	alerts, err := h.service.GetLowStockAlerts(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Failed to fetch low stock alerts: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"total_alerts": len(alerts),
		"items":        alerts,
	})
}
