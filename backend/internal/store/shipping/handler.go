package shipping

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"

	"github.com/go-chi/chi/v5"

	"ecom-ventures/backend/pkg/response"
)

// Handler exposes delivery zone routes for store staff and the public storefront.
type Handler struct {
	service *Service
}

// NewHandler instantiates the delivery zone HTTP handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// ListZones handles GET /api/v1/store/{store_slug}/shipping/zones.
func (h *Handler) ListZones(w http.ResponseWriter, r *http.Request) {
	zones, err := h.service.ListZones(r.Context())
	if err != nil {
		h.writeError(w, r, err, "Failed to list delivery zones")
		return
	}
	if zones == nil {
		zones = []Zone{}
	}
	response.JSON(w, http.StatusOK, zones)
}

// CreateZone handles POST /api/v1/store/{store_slug}/shipping/zones.
func (h *Handler) CreateZone(w http.ResponseWriter, r *http.Request) {
	var req ZoneRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}
	zone, err := h.service.CreateZone(r.Context(), req)
	if err != nil {
		h.writeError(w, r, err, "Failed to create delivery zone")
		return
	}
	response.JSON(w, http.StatusCreated, zone)
}

// UpdateZone handles PUT /api/v1/store/{store_slug}/shipping/zones/{id}.
func (h *Handler) UpdateZone(w http.ResponseWriter, r *http.Request) {
	var req ZoneRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}
	zone, err := h.service.UpdateZone(r.Context(), chi.URLParam(r, "id"), req)
	if err != nil {
		h.writeError(w, r, err, "Failed to update delivery zone")
		return
	}
	response.JSON(w, http.StatusOK, zone)
}

// DeleteZone handles DELETE /api/v1/store/{store_slug}/shipping/zones/{id}.
func (h *Handler) DeleteZone(w http.ResponseWriter, r *http.Request) {
	if err := h.service.DeleteZone(r.Context(), chi.URLParam(r, "id")); err != nil {
		h.writeError(w, r, err, "Failed to delete delivery zone")
		return
	}
	response.WriteNoContent(w)
}

// ListPublicZones handles GET /api/v1/storefront/shipping/zones.
// It answers 404 when the store has no zones, which the storefront reads as "not configured".
func (h *Handler) ListPublicZones(w http.ResponseWriter, r *http.Request) {
	zones, err := h.service.ListPublicZones(r.Context())
	if err != nil {
		h.writeError(w, r, err, "Failed to list delivery zones")
		return
	}
	response.JSON(w, http.StatusOK, zones)
}

// ListDistricts handles GET /api/v1/store/{store_slug}/shipping/locations/districts.
func (h *Handler) ListDistricts(w http.ResponseWriter, r *http.Request) {
	search := r.URL.Query().Get("search")
	districts, err := h.service.ListDistricts(r.Context(), search)
	if err != nil {
		h.writeError(w, r, err, "Failed to list districts")
		return
	}
	if districts == nil {
		districts = []DistrictEntity{}
	}
	response.JSON(w, http.StatusOK, districts)
}

// CreateDistrict handles POST /api/v1/store/{store_slug}/shipping/locations/districts.
func (h *Handler) CreateDistrict(w http.ResponseWriter, r *http.Request) {
	var req DistrictRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}
	d, err := h.service.CreateDistrict(r.Context(), req)
	if err != nil {
		h.writeError(w, r, err, "Failed to create district")
		return
	}
	response.JSON(w, http.StatusCreated, d)
}

// UpdateDistrict handles PUT /api/v1/store/{store_slug}/shipping/locations/districts/{id}.
func (h *Handler) UpdateDistrict(w http.ResponseWriter, r *http.Request) {
	var req DistrictRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}
	idStr := chi.URLParam(r, "id")
	var id int
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		response.BadRequest(w, r, "Invalid district ID")
		return
	}
	d, err := h.service.UpdateDistrict(r.Context(), id, req)
	if err != nil {
		h.writeError(w, r, err, "Failed to update district")
		return
	}
	response.JSON(w, http.StatusOK, d)
}

// DeleteDistrict handles DELETE /api/v1/store/{store_slug}/shipping/locations/districts/{id}.
func (h *Handler) DeleteDistrict(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	var id int
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		response.BadRequest(w, r, "Invalid district ID")
		return
	}
	if err := h.service.DeleteDistrict(r.Context(), id); err != nil {
		h.writeError(w, r, err, "Failed to delete district")
		return
	}
	response.WriteNoContent(w)
}

// ListThanas handles GET /api/v1/store/{store_slug}/shipping/locations/thanas.
func (h *Handler) ListThanas(w http.ResponseWriter, r *http.Request) {
	search := r.URL.Query().Get("search")
	var districtID int
	if dIDStr := r.URL.Query().Get("district_id"); dIDStr != "" {
		_, _ = fmt.Sscanf(dIDStr, "%d", &districtID)
	}
	thanas, err := h.service.ListThanas(r.Context(), districtID, search)
	if err != nil {
		h.writeError(w, r, err, "Failed to list thanas")
		return
	}
	if thanas == nil {
		thanas = []ThanaEntity{}
	}
	response.JSON(w, http.StatusOK, thanas)
}

// CreateThana handles POST /api/v1/store/{store_slug}/shipping/locations/thanas.
func (h *Handler) CreateThana(w http.ResponseWriter, r *http.Request) {
	var req ThanaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}
	t, err := h.service.CreateThana(r.Context(), req)
	if err != nil {
		h.writeError(w, r, err, "Failed to create thana")
		return
	}
	response.JSON(w, http.StatusCreated, t)
}

// UpdateThana handles PUT /api/v1/store/{store_slug}/shipping/locations/thanas/{id}.
func (h *Handler) UpdateThana(w http.ResponseWriter, r *http.Request) {
	var req ThanaRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}
	idStr := chi.URLParam(r, "id")
	var id int
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		response.BadRequest(w, r, "Invalid thana ID")
		return
	}
	t, err := h.service.UpdateThana(r.Context(), id, req)
	if err != nil {
		h.writeError(w, r, err, "Failed to update thana")
		return
	}
	response.JSON(w, http.StatusOK, t)
}

// DeleteThana handles DELETE /api/v1/store/{store_slug}/shipping/locations/thanas/{id}.
func (h *Handler) DeleteThana(w http.ResponseWriter, r *http.Request) {
	idStr := chi.URLParam(r, "id")
	var id int
	if _, err := fmt.Sscanf(idStr, "%d", &id); err != nil {
		response.BadRequest(w, r, "Invalid thana ID")
		return
	}
	if err := h.service.DeleteThana(r.Context(), id); err != nil {
		h.writeError(w, r, err, "Failed to delete thana")
		return
	}
	response.WriteNoContent(w)
}

// writeError maps service errors onto problem responses.
func (h *Handler) writeError(w http.ResponseWriter, r *http.Request, err error, fallback string) {
	var validation *ValidationError
	switch {
	case errors.As(err, &validation):
		response.WriteValidationError(w, r, validation.Params)
	case errors.Is(err, ErrNoZonesConfigured):
		response.Problem(w, r, http.StatusNotFound, "SHIPPING_ZONES_NOT_CONFIGURED", "Delivery Zones Not Configured",
			"This store has not configured any delivery zones yet, so orders cannot be placed.")
	case errors.Is(err, ErrZoneNotFound):
		response.Problem(w, r, http.StatusNotFound, "SHIPPING_ZONE_NOT_FOUND", "Delivery Zone Not Found",
			"The delivery zone does not exist in this store.")
	case errors.Is(err, ErrZoneConflict):
		response.Conflict(w, r, ErrZoneConflict.Error())
	default:
		response.WriteInternalError(w, r, fallback+": "+err.Error())
	}
}
