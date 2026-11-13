package marketing

import (
	"encoding/json"
	"net/http"

	"ecom-ventures/backend/pkg/response"
)

// Handler handles HTTP requests for store marketing configurations.
type Handler struct {
	service *Service
}

// NewHandler instantiates a new marketing Handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// GetStorefrontConfig handles GET /api/v1/storefront/marketing/config
func (h *Handler) GetStorefrontConfig(w http.ResponseWriter, r *http.Request) {
	cfg, err := h.service.GetPublicConfig(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Failed to load marketing settings: "+err.Error())
		return
	}
	response.WriteJSON(w, http.StatusOK, cfg)
}

// GetAdminConfig handles GET /api/v1/store/{store_slug}/settings/marketing
func (h *Handler) GetAdminConfig(w http.ResponseWriter, r *http.Request) {
	cfg, err := h.service.GetAdminConfig(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Failed to load marketing configuration: "+err.Error())
		return
	}
	response.WriteJSON(w, http.StatusOK, cfg)
}

// SaveAdminConfig handles PUT /api/v1/store/{store_slug}/settings/marketing
func (h *Handler) SaveAdminConfig(w http.ResponseWriter, r *http.Request) {
	var req UpdateMarketingConfigRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	if err := h.service.SaveAdminConfig(r.Context(), &req); err != nil {
		response.WriteInternalError(w, r, "Failed to update marketing settings: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Marketing and telemetry configuration updated successfully",
	})
}
