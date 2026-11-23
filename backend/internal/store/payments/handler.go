package payments

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"

	"ecom-ventures/backend/pkg/response"
)

// Handler handles payment HTTP endpoints.
type Handler struct {
	service *Service
}

// NewHandler instantiates the payment HTTP handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// GetService returns the underlying payments Service.
func (h *Handler) GetService() *Service {
	return h.service
}

// Initiate handles POST /api/v1/storefront/payments/initiate
func (h *Handler) Initiate(w http.ResponseWriter, r *http.Request) {
	var req InitiatePaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	var invalidParams []response.InvalidParam
	if req.OrderID == "" {
		invalidParams = append(invalidParams, response.InvalidParam{Name: "order_id", Reason: "Order ID is required"})
	}
	if req.Gateway == "" {
		invalidParams = append(invalidParams, response.InvalidParam{Name: "gateway", Reason: "Payment gateway is required"})
	}
	if len(invalidParams) > 0 {
		response.WriteValidationError(w, r, invalidParams)
		return
	}

	res, err := h.service.InitiatePayment(r.Context(), &req)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to initiate payment: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, res)
}

// Callback handles GET and POST /api/v1/storefront/payments/{gateway}/callback
func (h *Handler) Callback(w http.ResponseWriter, r *http.Request) {
	gwStr := strings.ToUpper(chi.URLParam(r, "gateway"))
	gateway := GatewayType(gwStr)

	// Collect form values or query parameters
	_ = r.ParseForm()
	payload := make(map[string]string)
	for k, v := range r.Form {
		if len(v) > 0 {
			payload[k] = v[0]
		}
	}
	for k, v := range r.URL.Query() {
		if len(v) > 0 {
			payload[k] = v[0]
		}
	}

	result, err := h.service.ProcessCallback(r.Context(), gateway, payload)
	if err != nil {
		response.WriteBadRequest(w, r, "Payment verification failed: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, result)
}

// Webhook handles POST /api/v1/storefront/payments/{gateway}/webhook
func (h *Handler) Webhook(w http.ResponseWriter, r *http.Request) {
	gwStr := strings.ToUpper(chi.URLParam(r, "gateway"))
	gateway := GatewayType(gwStr)

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

	if err := h.service.ProcessWebhook(r.Context(), gateway, bodyBytes, headers); err != nil {
		if err == ErrDuplicateWebhook {
			// Idempotent success response to provider
			w.WriteHeader(http.StatusOK)
			return
		}
		response.WriteBadRequest(w, r, "Webhook processing error: "+err.Error())
		return
	}

	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(`{"status":"success"}`))
}

// ListConfigs handles GET /api/v1/store/{store_slug}/settings/payments
func (h *Handler) ListConfigs(w http.ResponseWriter, r *http.Request) {
	configs, err := h.service.ListGatewayConfigs(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Failed to list payment configs: "+err.Error())
		return
	}
	response.WriteJSON(w, http.StatusOK, configs)
}

// SaveConfig handles PUT /api/v1/store/{store_slug}/settings/payments
func (h *Handler) SaveConfig(w http.ResponseWriter, r *http.Request) {
	var req UpdateGatewayConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	if err := h.service.SaveGatewayConfig(r.Context(), &req); err != nil {
		response.WriteInternalError(w, r, "Failed to update payment gateway: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Payment gateway configuration updated successfully",
	})
}

// ListPublicGateways handles GET /api/v1/storefront/payments/methods and /gateways
func (h *Handler) ListPublicGateways(w http.ResponseWriter, r *http.Request) {
	gateways, err := h.service.ListPublicGateways(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Failed to list payment options: "+err.Error())
		return
	}
	response.WriteJSON(w, http.StatusOK, gateways)
}

// SetDefault handles POST /api/v1/store/{store_slug}/settings/payments/{gateway}/default
func (h *Handler) SetDefault(w http.ResponseWriter, r *http.Request) {
	gwStr := strings.ToUpper(chi.URLParam(r, "gateway"))
	gateway := GatewayType(gwStr)

	if err := h.service.SetDefaultGateway(r.Context(), gateway); err != nil {
		response.WriteInternalError(w, r, "Failed to set default payment gateway: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": string(gateway) + " is now set as the default payment method",
	})
}

// ToggleActive handles PATCH /api/v1/store/{store_slug}/settings/payments/{gateway}/toggle
func (h *Handler) ToggleActive(w http.ResponseWriter, r *http.Request) {
	gwStr := strings.ToUpper(chi.URLParam(r, "gateway"))
	gateway := GatewayType(gwStr)

	var req struct {
		IsEnabled bool `json:"is_enabled"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	if err := h.service.ToggleGatewayActive(r.Context(), gateway, req.IsEnabled); err != nil {
		response.WriteInternalError(w, r, "Failed to toggle gateway status: "+err.Error())
		return
	}

	statusText := "activated"
	if !req.IsEnabled {
		statusText = "deactivated"
	}
	response.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": string(gateway) + " gateway has been " + statusText,
	})
}
