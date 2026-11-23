package reviews

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"ecom-ventures/backend/internal/middleware"
	pkgAuth "ecom-ventures/backend/pkg/auth"
	"ecom-ventures/backend/pkg/response"
)

// Handler exposes HTTP handlers for Product Reviews in Store Admin CRM and Public Storefront.
type Handler struct {
	service *Service
}

// NewHandler instantiates the review Handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// ======================== STORE ADMIN CRM ENDPOINTS ========================

// ListReviews handles GET /api/v1/store/{store_slug}/reviews
func (h *Handler) ListReviews(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 100 {
		limit = 20
	}

	filter := ReviewFilter{
		ProductID:  r.URL.Query().Get("product_id"),
		CustomerID: r.URL.Query().Get("customer_id"),
		Search:     r.URL.Query().Get("search"),
		Page:       page,
		Limit:      limit,
	}

	if statusStr := r.URL.Query().Get("status"); statusStr != "" {
		st := ReviewStatus(statusStr)
		filter.Status = &st
	}

	if ratingStr := r.URL.Query().Get("rating"); ratingStr != "" {
		if rate, err := strconv.Atoi(ratingStr); err == nil && rate >= 1 && rate <= 5 {
			filter.Rating = rate
		}
	}

	if featStr := r.URL.Query().Get("is_featured"); featStr != "" {
		b := featStr == "true"
		filter.IsFeatured = &b
	}

	reviews, total, err := h.service.ListReviews(r.Context(), filter)
	if err != nil {
		response.InternalServerError(w, r)
		return
	}

	meta := map[string]interface{}{
		"total": total,
		"page":  page,
		"limit": limit,
	}
	response.JSONWithMeta(w, http.StatusOK, reviews, meta)
}

// GetReview handles GET /api/v1/store/{store_slug}/reviews/{id}
func (h *Handler) GetReview(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		response.BadRequest(w, r, "Review ID is required")
		return
	}

	review, err := h.service.GetReview(r.Context(), id)
	if err != nil {
		response.NotFound(w, r, "Review not found")
		return
	}

	response.JSON(w, http.StatusOK, review)
}

// CreateStaffReview handles POST /api/v1/store/{store_slug}/reviews (Channel B)
func (h *Handler) CreateStaffReview(w http.ResponseWriter, r *http.Request) {
	claims, ok := r.Context().Value(middleware.AuthClaimsKey).(*pkgAuth.Claims)
	staffID := "staff-system"
	if ok && claims != nil {
		staffID = claims.Subject
	}

	var req CreateStaffReviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request body: "+err.Error())
		return
	}

	created, err := h.service.CreateStaffReview(r.Context(), &req, staffID)
	if err != nil {
		response.BadRequest(w, r, err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, created)
}

// UpdateReview handles PUT /api/v1/store/{store_slug}/reviews/{id}
func (h *Handler) UpdateReview(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		response.BadRequest(w, r, "Review ID is required")
		return
	}

	var req UpdateReviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request body: "+err.Error())
		return
	}

	updated, err := h.service.UpdateReview(r.Context(), id, &req)
	if err != nil {
		response.BadRequest(w, r, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, updated)
}

// QuickModerate handles PATCH /api/v1/store/{store_slug}/reviews/{id}/status
func (h *Handler) QuickModerate(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		response.BadRequest(w, r, "Review ID is required")
		return
	}

	var req QuickModerateRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request body: "+err.Error())
		return
	}

	if err := h.service.QuickModerate(r.Context(), id, &req); err != nil {
		response.BadRequest(w, r, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, map[string]interface{}{
		"id":      id,
		"status":  req.Status,
		"message": "Review status updated successfully",
	})
}

// DeleteReview handles DELETE /api/v1/store/{store_slug}/reviews/{id}
func (h *Handler) DeleteReview(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		response.BadRequest(w, r, "Review ID is required")
		return
	}

	if err := h.service.DeleteReview(r.Context(), id); err != nil {
		response.InternalServerError(w, r)
		return
	}

	response.JSON(w, http.StatusOK, map[string]interface{}{
		"id":      id,
		"deleted": true,
		"message": "Review permanently purged from database and cache",
	})
}

// ======================== PUBLIC STOREFRONT ENDPOINTS ========================

// GetProductReviewsStorefront handles GET /api/v1/storefront/products/{product_slug}/reviews
func (h *Handler) GetProductReviewsStorefront(w http.ResponseWriter, r *http.Request) {
	productID := r.URL.Query().Get("product_id")
	if productID == "" {
		productID = chi.URLParam(r, "product_slug") // can pass product_id or product_slug
	}
	if productID == "" {
		response.BadRequest(w, r, "product_id is required")
		return
	}

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 50 {
		limit = 10
	}

	res, err := h.service.GetProductReviewsStorefront(r.Context(), productID, page, limit)
	if err != nil {
		response.InternalServerError(w, r)
		return
	}

	response.JSON(w, http.StatusOK, res)
}

// SubmitCustomerReview handles POST /api/v1/storefront/products/{product_slug}/reviews (Channel A)
func (h *Handler) SubmitCustomerReview(w http.ResponseWriter, r *http.Request) {
	customerID := ""
	if claims, ok := r.Context().Value(middleware.AuthClaimsKey).(*pkgAuth.Claims); ok && claims != nil {
		customerID = claims.Subject
	}

	var req CreateCustomerReviewRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	if customerID == "" {
		// No customer authentication exists yet, so the X-Customer-ID header is not an identity.
		// Anonymous review submission is rejected rather than attributed to a caller-supplied ID.
		response.Unauthorized(w, r, "Customer authentication is required to submit a review.")
		return
	}

	review, err := h.service.CreateCustomerReview(r.Context(), customerID, &req)
	if err != nil {
		response.BadRequest(w, r, err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, map[string]interface{}{
		"review":  review,
		"message": "Your review has been submitted for moderation and will appear publicly once verified.",
	})
}
