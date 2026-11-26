package logistics

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"ecom-ventures/backend/pkg/response"
)

// Handler handles logistics HTTP routes.
type Handler struct {
	service *Service
}

// NewHandler instantiates the logistics HTTP handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// DispatchOrder handles POST /api/v1/store/{store_slug}/logistics/dispatch/{order_id}
func (h *Handler) DispatchOrder(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "order_id")
	var req DispatchOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	if req.Carrier == "" {
		response.WriteValidationError(w, r, []response.InvalidParam{
			{Name: "carrier", Reason: "Shipping carrier is required"},
		})
		return
	}

	shipment, err := h.service.DispatchOrder(r.Context(), orderID, &req)
	if err != nil {
		response.WriteInternalError(w, r, "Dispatch failed: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusCreated, shipment)
}

// TrackShipment handles GET /api/v1/storefront/logistics/track/{tracking_number}
func (h *Handler) TrackShipment(w http.ResponseWriter, r *http.Request) {
	trackingNumber := chi.URLParam(r, "tracking_number")
	timeline, err := h.service.TrackShipment(r.Context(), trackingNumber)
	if err != nil {
		response.WriteNotFound(w, r, "Tracking record not found: "+err.Error())
		return
	}
	response.WriteJSON(w, http.StatusOK, timeline)
}

// SyncCouriers handles POST /api/v1/store/{store_slug}/logistics/sync-couriers
func (h *Handler) SyncCouriers(w http.ResponseWriter, r *http.Request) {
	res, err := h.service.SyncCouriers(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Courier sync failed: "+err.Error())
		return
	}
	response.WriteJSON(w, http.StatusOK, res)
}

// CarrierWebhook handles POST /api/v1/storefront/logistics/{carrier}/webhook
func (h *Handler) CarrierWebhook(w http.ResponseWriter, r *http.Request) {
	carrierStr := strings.ToUpper(chi.URLParam(r, "carrier"))
	carrier := CarrierType(carrierStr)

	bodyBytes, err := io.ReadAll(r.Body)
	if err != nil {
		response.WriteBadRequest(w, r, "Failed to read webhook payload")
		return
	}

	headers := make(map[string]string)
	for k, v := range r.Header {
		if len(v) > 0 {
			headers[k] = v[0]
		}
	}

	if err := h.service.ProcessCourierWebhook(r.Context(), carrier, bodyBytes, headers); err != nil {
		response.WriteBadRequest(w, r, "Failed to process courier webhook: "+err.Error())
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"success"}`))
}

// ListConfigs handles GET /api/v1/store/{store_slug}/settings/logistics
func (h *Handler) ListConfigs(w http.ResponseWriter, r *http.Request) {
	configs, err := h.service.ListCourierConfigs(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Failed to list courier configurations: "+err.Error())
		return
	}
	response.WriteJSON(w, http.StatusOK, configs)
}

// SaveConfig handles PUT /api/v1/store/{store_slug}/settings/logistics
func (h *Handler) SaveConfig(w http.ResponseWriter, r *http.Request) {
	var req UpdateCourierConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	if err := h.service.SaveCourierConfig(r.Context(), &req); err != nil {
		response.WriteInternalError(w, r, "Failed to update courier configuration: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Courier configuration updated successfully",
	})
}
