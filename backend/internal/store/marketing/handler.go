package marketing

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"

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

// GetMetaAttribution handles GET /api/v1/store/{store_slug}/marketing/meta-attribution
func (h *Handler) GetMetaAttribution(w http.ResponseWriter, r *http.Request) {
	model := r.URL.Query().Get("model")
	res, err := h.service.GetMetaAttributionDashboard(r.Context(), model)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to load Meta attribution dashboard: "+err.Error())
		return
	}
	response.WriteJSON(w, http.StatusOK, res)
}

// ListMetaAdAccounts handles GET /api/v1/store/{store_slug}/marketing/meta-accounts
func (h *Handler) ListMetaAdAccounts(w http.ResponseWriter, r *http.Request) {
	list, err := h.service.ListMetaAdAccounts(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Failed to list Meta ad accounts: "+err.Error())
		return
	}
	response.WriteJSON(w, http.StatusOK, list)
}

// SaveMetaAdAccount handles POST /api/v1/store/{store_slug}/marketing/meta-accounts
func (h *Handler) SaveMetaAdAccount(w http.ResponseWriter, r *http.Request) {
	var req ConnectMetaAdAccountRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}
	res, err := h.service.SaveMetaAdAccount(r.Context(), req)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to connect Meta ad account: "+err.Error())
		return
	}
	response.WriteJSON(w, http.StatusCreated, res)
}

// DeleteMetaAdAccount handles DELETE /api/v1/store/{store_slug}/marketing/meta-accounts/{id}
func (h *Handler) DeleteMetaAdAccount(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	var id int
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		response.WriteBadRequest(w, r, "Invalid account ID")
		return
	}
	if err := h.service.DeleteMetaAdAccount(r.Context(), id); err != nil {
		response.WriteInternalError(w, r, "Failed to remove Meta ad account: "+err.Error())
		return
	}
	response.WriteNoContent(w)
}

// SyncMetaAdAccount handles POST /api/v1/store/{store_slug}/marketing/meta-accounts/{id}/sync
func (h *Handler) SyncMetaAdAccount(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	var id int
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		response.WriteBadRequest(w, r, "Invalid account ID")
		return
	}
	if err := h.service.SyncMetaAccountSpend(r.Context(), id); err != nil {
		response.WriteInternalError(w, r, "Failed to sync Meta ad account: "+err.Error())
		return
	}
	response.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Account metrics synced successfully",
	})
}

// TestGraphAPIExplorer handles POST /api/v1/store/{store_slug}/marketing/meta-explorer/test
func (h *Handler) TestGraphAPIExplorer(w http.ResponseWriter, r *http.Request) {
	var req GraphAPIExplorerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}
	res, err := h.service.ExecuteGraphAPIExplorer(r.Context(), req)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to execute Graph API test: "+err.Error())
		return
	}
	response.WriteJSON(w, http.StatusOK, res)
}
