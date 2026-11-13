// Package store_mgmt provides HTTP handlers and orchestration for store creation,
// lifecycle management, and portfolio administration within the Master Admin panel.
package store_mgmt

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"ecom-ventures/backend/internal/middleware"
	pkgAuth "ecom-ventures/backend/pkg/auth"
	"ecom-ventures/backend/pkg/response"

	"github.com/go-chi/chi/v5"
)

// Handler exposes store provisioning and lifecycle management operations via REST endpoints.
type Handler struct {
	service *Service
}

// NewHandler instantiates a new store management HTTP handler backed by the given Service.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// Create handles POST /api/v1/platform/stores (Store Creator Engine).
// It decodes the creation request, extracts caller identity from JWT claims,
// and invokes the automated 10-step provisioning pipeline.
// On failure, compensating rollbacks clean up any partially allocated resources
// and an appropriate RFC 7807 problem detail response is returned.
func (h *Handler) Create(w http.ResponseWriter, r *http.Request) {
	var req CreateStoreRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request JSON payload.")
		return
	}

	claims, _ := r.Context().Value(middleware.AuthClaimsKey).(*pkgAuth.Claims)
	userID := "system"
	if claims != nil && claims.UserID != "" {
		userID = claims.UserID
	}

	result, err := h.service.CreateStore(r.Context(), &req, userID)
	if err != nil {
		if errors.Is(err, ErrSlugAlreadyExists) {
			response.Problem(w, r, http.StatusConflict, "SLUG_ALREADY_EXISTS", "Conflict", "Store slug is already registered in the platform.")
			return
		}
		if errors.Is(err, ErrDomainConflict) {
			response.Problem(w, r, http.StatusConflict, "DOMAIN_ALREADY_EXISTS", "Conflict", "Domain is already mapped to another brand.")
			return
		}
		if errors.Is(err, ErrThemeNotFound) {
			response.Problem(w, r, http.StatusBadRequest, "THEME_NOT_FOUND", "Bad Request", "Selected theme is not available in the platform.")
			return
		}
		response.Problem(w, r, http.StatusInternalServerError, "PROVISIONING_FAILED", "Store Provisioning Failed", err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, result)
}

// List handles GET /api/v1/platform/stores.
// It retrieves a paginated, filterable summary of all stores across the platform portfolio.
// Query parameters:
//   - page: integer (default 1)
//   - limit: integer (default 20, max 100)
//   - status: filter by store status (e.g. ACTIVE, MAINTENANCE, SUSPENDED, ARCHIVED)
//   - search: search substring against store name or slug
func (h *Handler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	limit, _ := strconv.Atoi(q.Get("limit"))

	params := StoreFilterParams{
		Status: q.Get("status"),
		Search: q.Get("search"),
		Page:   page,
		Limit:  limit,
	}

	stores, total, err := h.service.ListStores(r.Context(), params)
	if err != nil {
		response.InternalServerError(w, r)
		return
	}

	response.JSONWithMeta(w, http.StatusOK, stores, map[string]interface{}{
		"total": total,
		"page":  params.Page,
		"limit": params.Limit,
	})
}

// GetByID handles GET /api/v1/platform/stores/{id}.
// It returns full store metadata including all registered domains, active theme bindings,
// and database connectivity specifications.
func (h *Handler) GetByID(w http.ResponseWriter, r *http.Request) {
	storeID := chi.URLParam(r, "id")
	if storeID == "" {
		response.BadRequest(w, r, "Missing store ID parameter.")
		return
	}

	detail, err := h.service.GetStoreDetails(r.Context(), storeID)
	if err != nil {
		if errors.Is(err, ErrStoreNotFound) {
			response.NotFound(w, r, "The requested store does not exist.")
			return
		}
		response.InternalServerError(w, r)
		return
	}

	response.JSON(w, http.StatusOK, detail)
}

// UpdateStatus handles PATCH /api/v1/platform/stores/{id}/status.
// It updates the operational lifecycle status of a brand store (ACTIVE, MAINTENANCE, SUSPENDED, ARCHIVED).
// When transitioning to SUSPENDED or ARCHIVED, tenant connection pools are terminated immediately.
func (h *Handler) UpdateStatus(w http.ResponseWriter, r *http.Request) {
	storeID := chi.URLParam(r, "id")
	if storeID == "" {
		response.BadRequest(w, r, "Missing store ID parameter.")
		return
	}

	var req UpdateStoreStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid JSON payload.")
		return
	}

	claims, _ := r.Context().Value(middleware.AuthClaimsKey).(*pkgAuth.Claims)
	userID := "system"
	if claims != nil && claims.UserID != "" {
		userID = claims.UserID
	}

	err := h.service.UpdateStoreStatus(r.Context(), storeID, req, userID)
	if err != nil {
		if errors.Is(err, ErrStoreNotFound) {
			response.NotFound(w, r, "Store not found.")
			return
		}
		if errors.Is(err, ErrInvalidStatus) {
			response.BadRequest(w, r, "Invalid status. Allowed values: ACTIVE, MAINTENANCE, SUSPENDED, ARCHIVED.")
			return
		}
		response.InternalServerError(w, r)
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{
		"message": "Store status updated successfully.",
	})
}

// GetLogs handles GET /api/v1/platform/stores/{id}/provisioning-logs.
// It returns the step-by-step audit logs of the provisioning pipeline for the specified store.
func (h *Handler) GetLogs(w http.ResponseWriter, r *http.Request) {
	storeID := chi.URLParam(r, "id")
	if storeID == "" {
		response.BadRequest(w, r, "Missing store ID parameter.")
		return
	}

	logs, err := h.service.GetProvisioningLogs(r.Context(), storeID)
	if err != nil {
		response.InternalServerError(w, r)
		return
	}

	response.JSON(w, http.StatusOK, logs)
}

// Delete handles DELETE /api/v1/platform/stores/{id}.
// It hard-deletes the store, drops its dedicated PostgreSQL database, and clears all routes.
func (h *Handler) Delete(w http.ResponseWriter, r *http.Request) {
	storeID := chi.URLParam(r, "id")
	if storeID == "" {
		response.BadRequest(w, r, "Missing store ID parameter.")
		return
	}

	claims, _ := r.Context().Value(middleware.AuthClaimsKey).(*pkgAuth.Claims)
	userID := "system"
	if claims != nil && claims.UserID != "" {
		userID = claims.UserID
	}

	err := h.service.DeleteStore(r.Context(), storeID, userID)
	if err != nil {
		if errors.Is(err, ErrStoreNotFound) {
			response.NotFound(w, r, "Store not found.")
			return
		}
		response.Problem(w, r, http.StatusInternalServerError, "DELETE_STORE_FAILED", "Failed to delete store", err.Error())
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{
		"message": "Store and its dedicated database permanently deleted.",
	})
}
