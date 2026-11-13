// Package settings provides domain logic, database operations, and HTTP APIs
// for managing store operational preferences, tax/currency rules, and staff RBAC.
package settings

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"ecom-ventures/backend/internal/middleware"
	pkgAuth "ecom-ventures/backend/pkg/auth"
	"ecom-ventures/backend/pkg/response"
)

// Handler handles HTTP routes for store settings and staff members.
type Handler struct {
	service *Service
}

// NewHandler instantiates the settings and staff HTTP handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// GetSettings handles GET /api/v1/store/{store_slug}/settings
func (h *Handler) GetSettings(w http.ResponseWriter, r *http.Request) {
	s, err := h.service.GetSettings(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Failed to retrieve store settings: "+err.Error())
		return
	}
	response.WriteJSON(w, http.StatusOK, s)
}

// UpdateSettings handles PUT /api/v1/store/{store_slug}/settings
func (h *Handler) UpdateSettings(w http.ResponseWriter, r *http.Request) {
	var req UpdateSettingsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	s, err := h.service.UpdateSettings(r.Context(), &req)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to update store settings: "+err.Error())
		return
	}
	response.WriteJSON(w, http.StatusOK, s)
}

// ListStaff handles GET /api/v1/store/{store_slug}/staff
func (h *Handler) ListStaff(w http.ResponseWriter, r *http.Request) {
	staff, err := h.service.ListStaff(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Failed to list staff: "+err.Error())
		return
	}
	response.WriteJSON(w, http.StatusOK, staff)
}

// CreateStaff handles POST /api/v1/store/{store_slug}/staff
func (h *Handler) CreateStaff(w http.ResponseWriter, r *http.Request) {
	var req CreateStaffRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	if req.Email == "" || req.FirstName == "" || req.Password == "" {
		response.WriteValidationError(w, r, []response.InvalidParam{
			{Name: "email", Reason: "Email is required"},
			{Name: "first_name", Reason: "First name is required"},
			{Name: "password", Reason: "Password is required"},
		})
		return
	}

	m, err := h.service.CreateStaff(r.Context(), &req)
	if err != nil {
		if errors.Is(err, ErrStaffConflict) {
			response.WriteConflict(w, r, "Staff email already exists in this store")
			return
		}
		response.WriteInternalError(w, r, "Failed to create staff member: "+err.Error())
		return
	}
	response.WriteJSON(w, http.StatusCreated, m)
}

// UpdateStaff handles PUT /api/v1/store/{store_slug}/staff/{staff_id}
func (h *Handler) UpdateStaff(w http.ResponseWriter, r *http.Request) {
	staffID := chi.URLParam(r, "staff_id")
	var req UpdateStaffRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	m, err := h.service.UpdateStaff(r.Context(), staffID, &req)
	if err != nil {
		if errors.Is(err, ErrStaffNotFound) {
			response.WriteNotFound(w, r, "Staff member not found")
			return
		}
		if errors.Is(err, ErrCannotDemoteLastOwner) {
			response.WriteBadRequest(w, r, err.Error())
			return
		}
		response.WriteInternalError(w, r, "Failed to update staff member: "+err.Error())
		return
	}
	response.WriteJSON(w, http.StatusOK, m)
}

// DeleteStaff handles DELETE /api/v1/store/{store_slug}/staff/{staff_id}
func (h *Handler) DeleteStaff(w http.ResponseWriter, r *http.Request) {
	staffID := chi.URLParam(r, "staff_id")
	if err := h.service.DeleteStaff(r.Context(), staffID); err != nil {
		if errors.Is(err, ErrStaffNotFound) {
			response.WriteNotFound(w, r, "Staff member not found")
			return
		}
		if errors.Is(err, ErrCannotDemoteLastOwner) {
			response.WriteBadRequest(w, r, err.Error())
			return
		}
		response.WriteInternalError(w, r, "Failed to delete staff member: "+err.Error())
		return
	}
	response.WriteNoContent(w)
}

// ChangePassword handles POST /api/v1/store/{store_slug}/staff/change-password
func (h *Handler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	var staffID string
	if id, ok := r.Context().Value("staff_id").(string); ok && id != "" {
		staffID = id
	} else if claims, ok := r.Context().Value(middleware.AuthClaimsKey).(*pkgAuth.Claims); ok && claims != nil {
		staffID = claims.UserID
	}

	if staffID == "" {
		response.WriteUnauthorized(w, r, "Authenticated staff context required")
		return
	}

	var req ChangePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	if err := h.service.ChangePassword(r.Context(), staffID, &req); err != nil {
		if errors.Is(err, ErrInvalidCurrentPassword) {
			response.WriteBadRequest(w, r, "Current password is incorrect")
			return
		}
		response.WriteInternalError(w, r, "Failed to change password: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Password changed successfully",
	})
}
