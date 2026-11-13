package accounts

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"ecom-ventures/backend/pkg/response"
)

// Handler handles platform-level portfolio accounts HTTP endpoints.
type Handler struct {
	service *Service
}

// NewHandler creates a new platform accounts Handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// GetOverview handles GET /api/v1/platform/accounts/overview
func (h *Handler) GetOverview(w http.ResponseWriter, r *http.Request) {
	summary, err := h.service.GetPortfolioOverview(r.Context())
	if err != nil {
		response.JSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	response.JSON(w, http.StatusOK, summary)
}

// GetLeaderboard handles GET /api/v1/platform/accounts/leaderboard
func (h *Handler) GetLeaderboard(w http.ResponseWriter, r *http.Request) {
	period := r.URL.Query().Get("period")
	items, err := h.service.GetLeaderboard(r.Context(), period)
	if err != nil {
		response.JSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	response.JSON(w, http.StatusOK, items)
}

// ListBilling handles GET /api/v1/platform/accounts/billing
func (h *Handler) ListBilling(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	records, err := h.service.ListBillingRecords(r.Context(), status)
	if err != nil {
		response.JSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	response.JSON(w, http.StatusOK, records)
}

// UpdateBillingStatus handles PATCH /api/v1/platform/accounts/billing/{id}/status
func (h *Handler) UpdateBillingStatus(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var body struct {
		Status string `json:"status"`
	}
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil || body.Status == "" {
		response.JSON(w, http.StatusBadRequest, map[string]string{"error": "Valid status is required"})
		return
	}

	if err := h.service.UpdateBillingStatus(r.Context(), id, body.Status); err != nil {
		response.JSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"message": "Billing status updated successfully"})
}

// GetGateways handles GET /api/v1/platform/accounts/gateways
func (h *Handler) GetGateways(w http.ResponseWriter, r *http.Request) {
	allocations, err := h.service.GetGatewayAllocations(r.Context())
	if err != nil {
		response.JSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	response.JSON(w, http.StatusOK, allocations)
}
