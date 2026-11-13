// Package promotions provides domain logic, database operations, and HTTP APIs
// for managing coupon codes, discount rules, and cart promotion evaluations.
package promotions

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"ecom-ventures/backend/pkg/response"
)

// Handler handles HTTP routes for coupons and promotions.
type Handler struct {
	service *Service
}

// NewHandler instantiates the promotion HTTP controller.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// ListCoupons handles GET /api/v1/store/{store_slug}/promotions/coupons
func (h *Handler) ListCoupons(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 100 {
		limit = 20
	}

	filter := &CouponFilterParams{
		Search: r.URL.Query().Get("search"),
		Page:   page,
		Limit:  limit,
	}

	if activeStr := r.URL.Query().Get("is_active"); activeStr != "" {
		b := activeStr == "true"
		filter.IsActive = &b
	}

	res, err := h.service.ListCoupons(r.Context(), filter)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to list coupons: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, res)
}

// CreateCoupon handles POST /api/v1/store/{store_slug}/promotions/coupons
func (h *Handler) CreateCoupon(w http.ResponseWriter, r *http.Request) {
	var req CreateCouponRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	if req.Code == "" {
		response.WriteValidationError(w, r, []response.InvalidParam{
			{Name: "code", Reason: "Coupon code is required"},
		})
		return
	}

	coupon, err := h.service.CreateCoupon(r.Context(), &req)
	if err != nil {
		if errors.Is(err, ErrCodeConflict) {
			response.WriteConflict(w, r, "Coupon code already exists in this store")
			return
		}
		response.WriteInternalError(w, r, "Failed to create coupon: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusCreated, coupon)
}

// GetCoupon handles GET /api/v1/store/{store_slug}/promotions/coupons/{coupon_id}
func (h *Handler) GetCoupon(w http.ResponseWriter, r *http.Request) {
	couponID := chi.URLParam(r, "coupon_id")
	coupon, err := h.service.GetCoupon(r.Context(), couponID)
	if err != nil {
		if errors.Is(err, ErrCouponNotFound) {
			response.WriteNotFound(w, r, "Coupon not found")
			return
		}
		response.WriteInternalError(w, r, "Failed to retrieve coupon: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, coupon)
}

// UpdateCoupon handles PUT /api/v1/store/{store_slug}/promotions/coupons/{coupon_id}
func (h *Handler) UpdateCoupon(w http.ResponseWriter, r *http.Request) {
	couponID := chi.URLParam(r, "coupon_id")
	var req UpdateCouponRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	coupon, err := h.service.UpdateCoupon(r.Context(), couponID, &req)
	if err != nil {
		if errors.Is(err, ErrCouponNotFound) {
			response.WriteNotFound(w, r, "Coupon not found")
			return
		}
		response.WriteInternalError(w, r, "Failed to update coupon: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, coupon)
}

// DeleteCoupon handles DELETE /api/v1/store/{store_slug}/promotions/coupons/{coupon_id}
func (h *Handler) DeleteCoupon(w http.ResponseWriter, r *http.Request) {
	couponID := chi.URLParam(r, "coupon_id")
	if err := h.service.DeleteCoupon(r.Context(), couponID); err != nil {
		if errors.Is(err, ErrCouponNotFound) {
			response.WriteNotFound(w, r, "Coupon not found")
			return
		}
		response.WriteInternalError(w, r, "Failed to delete coupon: "+err.Error())
		return
	}
	response.WriteNoContent(w)
}

// ValidateCoupon handles POST /api/v1/store/{store_slug}/promotions/validate
func (h *Handler) ValidateCoupon(w http.ResponseWriter, r *http.Request) {
	var req ValidateCouponRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	if req.Code == "" {
		response.WriteValidationError(w, r, []response.InvalidParam{
			{Name: "code", Reason: "Coupon code is required"},
		})
		return
	}

	res, err := h.service.ValidateAndCalculateDiscount(r.Context(), &req)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to validate coupon: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, res)
}

// ListBundleTiers handles GET /api/v1/store/{store_slug}/promotions/bundle-tiers
func (h *Handler) ListBundleTiers(w http.ResponseWriter, r *http.Request) {
	activeOnly := r.URL.Query().Get("active_only") == "true"
	tiers, err := h.service.ListBundleTiers(r.Context(), activeOnly)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to list bundle tiers: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, tiers)
}

// CreateBundleTier handles POST /api/v1/store/{store_slug}/promotions/bundle-tiers
func (h *Handler) CreateBundleTier(w http.ResponseWriter, r *http.Request) {
	var req CreateBundleTierRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	if req.Name == "" {
		response.WriteValidationError(w, r, []response.InvalidParam{
			{Name: "name", Reason: "Bundle tier name is required"},
		})
		return
	}

	tier, err := h.service.CreateBundleTier(r.Context(), &req)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to create bundle tier: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusCreated, tier)
}

// GetBundleTier handles GET /api/v1/store/{store_slug}/promotions/bundle-tiers/{tier_id}
func (h *Handler) GetBundleTier(w http.ResponseWriter, r *http.Request) {
	tierID := chi.URLParam(r, "tier_id")
	tier, err := h.service.GetBundleTier(r.Context(), tierID)
	if err != nil {
		if errors.Is(err, ErrBundleTierNotFound) {
			response.WriteNotFound(w, r, "Bundle tier not found")
			return
		}
		response.WriteInternalError(w, r, "Failed to retrieve bundle tier: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, tier)
}

// UpdateBundleTier handles PUT /api/v1/store/{store_slug}/promotions/bundle-tiers/{tier_id}
func (h *Handler) UpdateBundleTier(w http.ResponseWriter, r *http.Request) {
	tierID := chi.URLParam(r, "tier_id")
	var req UpdateBundleTierRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	tier, err := h.service.UpdateBundleTier(r.Context(), tierID, &req)
	if err != nil {
		if errors.Is(err, ErrBundleTierNotFound) {
			response.WriteNotFound(w, r, "Bundle tier not found")
			return
		}
		response.WriteInternalError(w, r, "Failed to update bundle tier: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, tier)
}

// DeleteBundleTier handles DELETE /api/v1/store/{store_slug}/promotions/bundle-tiers/{tier_id}
func (h *Handler) DeleteBundleTier(w http.ResponseWriter, r *http.Request) {
	tierID := chi.URLParam(r, "tier_id")
	if err := h.service.DeleteBundleTier(r.Context(), tierID); err != nil {
		if errors.Is(err, ErrBundleTierNotFound) {
			response.WriteNotFound(w, r, "Bundle tier not found")
			return
		}
		response.WriteInternalError(w, r, "Failed to delete bundle tier: "+err.Error())
		return
	}
	response.WriteNoContent(w)
}

// ToggleBundleTierStatus handles PATCH /api/v1/store/{store_slug}/promotions/bundle-tiers/{tier_id}/status
func (h *Handler) ToggleBundleTierStatus(w http.ResponseWriter, r *http.Request) {
	tierID := chi.URLParam(r, "tier_id")
	var req ToggleBundleTierStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	if err := h.service.ToggleBundleTierStatus(r.Context(), tierID, req.IsActive); err != nil {
		if errors.Is(err, ErrBundleTierNotFound) {
			response.WriteNotFound(w, r, "Bundle tier not found")
			return
		}
		response.WriteInternalError(w, r, "Failed to toggle bundle tier status: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success":   true,
		"is_active": req.IsActive,
	})
}

// CalculateBundle handles POST /api/v1/store/{store_slug}/promotions/bundle-tiers/calculate
func (h *Handler) CalculateBundle(w http.ResponseWriter, r *http.Request) {
	var req struct {
		TierID string                  `json:"tier_id"`
		Slots  []BundleCalculationSlot `json:"slots"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	result, err := h.service.CalculateBundle(r.Context(), req.TierID, req.Slots)
	if err != nil {
		response.WriteBadRequest(w, r, err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, result)
}

// ListStorefrontBundleTiers handles GET /api/v1/storefront/bundle-tiers
func (h *Handler) ListStorefrontBundleTiers(w http.ResponseWriter, r *http.Request) {
	tiers, err := h.service.ListBundleTiers(r.Context(), true)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to list storefront bundle tiers: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, tiers)
}
