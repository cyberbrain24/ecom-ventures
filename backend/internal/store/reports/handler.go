package reports

import (
	"encoding/json"
	"net/http"

	"ecom-ventures/backend/pkg/response"
)

// Handler serves HTTP endpoints for store-level executive sales reporting.
type Handler struct {
	service *Service
}

// NewHandler creates a new reports Handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// GetSalesReport handles GET /api/v1/store/{store_slug}/reports/sales
func (h *Handler) GetSalesReport(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	res, err := h.service.GetSalesReport(
		r.Context(),
		q.Get("preset"),
		q.Get("date_from"),
		q.Get("date_to"),
	)
	if err != nil {
		response.WriteBadRequest(w, r, err.Error())
		return
	}
	response.WriteJSON(w, http.StatusOK, res)
}

// UpdateUSDRate handles POST /api/v1/store/{store_slug}/reports/settings/usd-rate
func (h *Handler) UpdateUSDRate(w http.ResponseWriter, r *http.Request) {
	var req UpdateUSDRateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}
	updated, err := h.service.UpdateUSDRate(r.Context(), req.USDRate)
	if err != nil {
		response.WriteBadRequest(w, r, err.Error())
		return
	}
	response.WriteJSON(w, http.StatusOK, map[string]float64{"usd_rate": updated})
}
