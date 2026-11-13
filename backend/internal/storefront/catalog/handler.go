package catalog

import (
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"ecom-ventures/backend/pkg/response"
)

// Handler handles public HTTP requests for storefront catalog browsing.
type Handler struct {
	service *Service
}

// NewHandler instantiates the handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// ListCategories handles GET /api/v1/storefront/catalog/categories
func (h *Handler) ListCategories(w http.ResponseWriter, r *http.Request) {
	categories, err := h.service.ListCategories(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Failed to fetch categories: "+err.Error())
		return
	}
	response.WriteJSON(w, http.StatusOK, categories)
}

// SearchProducts handles GET /api/v1/storefront/catalog/products
func (h *Handler) SearchProducts(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))

	filter := &StorefrontFilterParams{
		Search:       r.URL.Query().Get("search"),
		CategorySlug: r.URL.Query().Get("category"),
		Sort:         r.URL.Query().Get("sort"),
		Page:         page,
		Limit:        limit,
	}

	if minStr := r.URL.Query().Get("min_price"); minStr != "" {
		if val, err := strconv.ParseFloat(minStr, 64); err == nil {
			filter.MinPrice = &val
		}
	}

	if maxStr := r.URL.Query().Get("max_price"); maxStr != "" {
		if val, err := strconv.ParseFloat(maxStr, 64); err == nil {
			filter.MaxPrice = &val
		}
	}

	if r.URL.Query().Get("in_stock") == "true" {
		filter.InStockOnly = true
	}

	res, err := h.service.SearchProducts(r.Context(), filter)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to query catalog: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, res)
}

// GetProductBySlug handles GET /api/v1/storefront/catalog/products/{slug}
func (h *Handler) GetProductBySlug(w http.ResponseWriter, r *http.Request) {
	slug := chi.URLParam(r, "slug")
	if slug == "" {
		response.WriteBadRequest(w, r, "Product slug is required")
		return
	}

	product, err := h.service.GetProductBySlug(r.Context(), slug)
	if err != nil {
		if errors.Is(err, ErrProductNotFound) {
			response.WriteNotFound(w, r, "Product not found")
			return
		}
		response.WriteInternalError(w, r, "Failed to retrieve product: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, product)
}
