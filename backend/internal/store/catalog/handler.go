package catalog

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"ecom-ventures/backend/pkg/response"
	"github.com/go-chi/chi/v5"
)

// Handler manages HTTP endpoints for store catalog operations.
type Handler struct {
	service *Service
}

// NewHandler instantiates the catalog HTTP handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// --- CATEGORY HANDLERS ---

// CreateCategory handles POST /api/v1/store/{store_slug}/catalog/categories.
func (h *Handler) CreateCategory(w http.ResponseWriter, r *http.Request) {
	var req CreateCategoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request JSON payload.")
		return
	}

	category, err := h.service.CreateCategory(r.Context(), req)
	if err != nil {
		if errors.Is(err, ErrSlugCollision) {
			response.Problem(w, r, http.StatusConflict, "CATEGORY_SLUG_CONFLICT", "Conflict", "Category slug already exists in this store.")
			return
		}
		response.BadRequest(w, r, err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, category)
}

// ListCategories handles GET /api/v1/store/{store_slug}/catalog/categories.
func (h *Handler) ListCategories(w http.ResponseWriter, r *http.Request) {
	tree, err := h.service.GetCategoryTree(r.Context())
	if err != nil {
		response.InternalServerError(w, r)
		return
	}
	response.JSON(w, http.StatusOK, tree)
}

// UpdateCategory handles PUT /api/v1/store/{store_slug}/catalog/categories/{id}.
func (h *Handler) UpdateCategory(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		response.BadRequest(w, r, "Category ID is required.")
		return
	}

	var req UpdateCategoryRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request JSON payload.")
		return
	}

	cat, err := h.service.UpdateCategory(r.Context(), id, req)
	if err != nil {
		if errors.Is(err, ErrCategoryNotFound) {
			response.NotFound(w, r, "Category not found.")
			return
		}
		if errors.Is(err, ErrSlugCollision) {
			response.Problem(w, r, http.StatusConflict, "CATEGORY_SLUG_CONFLICT", "Conflict", "Category slug already exists in this store.")
			return
		}
		response.BadRequest(w, r, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, cat)
}

// DeleteCategory handles DELETE /api/v1/store/{store_slug}/catalog/categories/{id}.
func (h *Handler) DeleteCategory(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		response.BadRequest(w, r, "Category ID is required.")
		return
	}

	if err := h.service.DeleteCategory(r.Context(), id); err != nil {
		if errors.Is(err, ErrCategoryNotFound) {
			response.NotFound(w, r, "Category not found.")
			return
		}
		response.InternalServerError(w, r)
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"message": "Category deleted successfully."})
}

// --- PRODUCT HANDLERS ---

// CreateProduct handles POST /api/v1/store/{store_slug}/catalog/products.
func (h *Handler) CreateProduct(w http.ResponseWriter, r *http.Request) {
	var req CreateProductRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request JSON payload.")
		return
	}

	product, err := h.service.CreateProduct(r.Context(), req)
	if err != nil {
		if errors.Is(err, ErrSlugCollision) {
			response.Problem(w, r, http.StatusConflict, "PRODUCT_SLUG_CONFLICT", "Conflict", "Product slug or SKU already exists.")
			return
		}
		response.BadRequest(w, r, err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, product)
}

// ListProducts handles GET /api/v1/store/{store_slug}/catalog/products.
func (h *Handler) ListProducts(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	page, _ := strconv.Atoi(q.Get("page"))
	limit, _ := strconv.Atoi(q.Get("limit"))

	var categoryID *string
	if cat := q.Get("category_id"); cat != "" {
		categoryID = &cat
	}

	var minPrice, maxPrice *float64
	if minP, err := strconv.ParseFloat(q.Get("min_price"), 64); err == nil {
		minPrice = &minP
	}
	if maxP, err := strconv.ParseFloat(q.Get("max_price"), 64); err == nil {
		maxPrice = &maxP
	}

	var isFeatured *bool
	if feat := q.Get("is_featured"); feat != "" {
		val := feat == "true"
		isFeatured = &val
	}

	params := ProductFilterParams{
		CategoryID: categoryID,
		Status:     q.Get("status"),
		Search:     q.Get("search"),
		MinPrice:   minPrice,
		MaxPrice:   maxPrice,
		IsFeatured: isFeatured,
		Page:       page,
		Limit:      limit,
	}

	products, total, err := h.service.ListProducts(r.Context(), params)
	if err != nil {
		response.InternalServerError(w, r)
		return
	}

	response.JSONWithMeta(w, http.StatusOK, products, map[string]interface{}{
		"total": total,
		"page":  params.Page,
		"limit": params.Limit,
	})
}

// GetProduct handles GET /api/v1/store/{store_slug}/catalog/products/{id}.
func (h *Handler) GetProduct(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		response.BadRequest(w, r, "Product ID is required.")
		return
	}

	product, err := h.service.GetProduct(r.Context(), id)
	if err != nil {
		if errors.Is(err, ErrProductNotFound) {
			response.NotFound(w, r, "Product not found.")
			return
		}
		response.InternalServerError(w, r)
		return
	}

	response.JSON(w, http.StatusOK, product)
}

// UpdateProduct handles PUT /api/v1/store/{store_slug}/catalog/products/{id}.
func (h *Handler) UpdateProduct(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		response.BadRequest(w, r, "Product ID is required.")
		return
	}

	var req UpdateProductRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request JSON payload.")
		return
	}

	product, err := h.service.UpdateProduct(r.Context(), id, req)
	if err != nil {
		if errors.Is(err, ErrProductNotFound) {
			response.NotFound(w, r, "Product not found.")
			return
		}
		if errors.Is(err, ErrSlugCollision) {
			response.Problem(w, r, http.StatusConflict, "PRODUCT_SLUG_CONFLICT", "Conflict", "Product slug or SKU already exists.")
			return
		}
		response.BadRequest(w, r, err.Error())
		return
	}

	response.JSON(w, http.StatusOK, product)
}

// DeleteProduct handles DELETE /api/v1/store/{store_slug}/catalog/products/{id}.
func (h *Handler) DeleteProduct(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if id == "" {
		response.BadRequest(w, r, "Product ID is required.")
		return
	}

	if err := h.service.DeleteProduct(r.Context(), id); err != nil {
		if errors.Is(err, ErrProductNotFound) {
			response.NotFound(w, r, "Product not found.")
			return
		}
		response.InternalServerError(w, r)
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"message": "Product deleted successfully."})
}

// --- ORDERING AND FEATURED HANDLERS ---

// decodeReorder reads a ReorderRequest and writes the 400 response itself when the body is not valid JSON.
func decodeReorder(w http.ResponseWriter, r *http.Request) (ReorderRequest, bool) {
	var req ReorderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request JSON payload.")
		return req, false
	}
	return req, true
}

// writeReorderError maps reorder errors to HTTP responses.
func writeReorderError(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, ErrInvalidReorder):
		response.BadRequest(w, r, err.Error())
	case errors.Is(err, ErrReorderUnknownID):
		response.Problem(w, r, http.StatusConflict, "REORDER_UNKNOWN_ID", "Conflict",
			"The list contains an item that no longer exists or is not featured. Reload the page and try again.")
	case errors.Is(err, ErrProductNotFound):
		response.NotFound(w, r, "Product not found.")
	default:
		response.InternalServerError(w, r)
	}
}

// ReorderProducts handles PUT /api/v1/store/{store_slug}/catalog/products/reorder.
func (h *Handler) ReorderProducts(w http.ResponseWriter, r *http.Request) {
	req, ok := decodeReorder(w, r)
	if !ok {
		return
	}
	if err := h.service.ReorderProducts(r.Context(), req.IDs); err != nil {
		writeReorderError(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"message": "Product order saved."})
}

// ReorderFeaturedProducts handles PUT /api/v1/store/{store_slug}/catalog/products/featured/reorder.
func (h *Handler) ReorderFeaturedProducts(w http.ResponseWriter, r *http.Request) {
	req, ok := decodeReorder(w, r)
	if !ok {
		return
	}
	if err := h.service.ReorderFeaturedProducts(r.Context(), req.IDs); err != nil {
		writeReorderError(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"message": "Featured order saved."})
}

// SetProductLinks handles PATCH /api/v1/store/{store_slug}/catalog/products/{id}/links.
func (h *Handler) SetProductLinks(w http.ResponseWriter, r *http.Request) {
	var req ProductLinksRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request JSON payload.")
		return
	}
	product, err := h.service.SetProductLinks(r.Context(), chi.URLParam(r, "id"), req)
	if err != nil {
		if errors.Is(err, ErrLinkTargetNotFound) {
			response.Problem(w, r, http.StatusUnprocessableEntity, "LINK_TARGET_NOT_FOUND", "Unprocessable",
				"The selected brand or care instruction no longer exists. Reload the page and try again.")
			return
		}
		writeReorderError(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, product)
}

// SetProductFeatured handles PATCH /api/v1/store/{store_slug}/catalog/products/{id}/featured.
func (h *Handler) SetProductFeatured(w http.ResponseWriter, r *http.Request) {
	var req SetFeaturedRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.BadRequest(w, r, "Invalid request JSON payload.")
		return
	}
	product, err := h.service.SetProductFeatured(r.Context(), chi.URLParam(r, "id"), req.IsFeatured)
	if err != nil {
		writeReorderError(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, product)
}

// ReorderCategories handles PUT /api/v1/store/{store_slug}/catalog/categories/reorder.
func (h *Handler) ReorderCategories(w http.ResponseWriter, r *http.Request) {
	req, ok := decodeReorder(w, r)
	if !ok {
		return
	}
	if err := h.service.ReorderCategories(r.Context(), req.IDs); err != nil {
		writeReorderError(w, r, err)
		return
	}
	response.JSON(w, http.StatusOK, map[string]string{"message": "Category order saved."})
}

// --- MEDIA HANDLERS ---

// UploadMedia handles POST /api/v1/store/{store_slug}/catalog/products/{id}/media (Multipart upload).
func (h *Handler) UploadMedia(w http.ResponseWriter, r *http.Request) {
	productID := chi.URLParam(r, "id")
	if productID == "" {
		response.BadRequest(w, r, "Product ID is required.")
		return
	}

	// 10MB max upload buffer
	if err := r.ParseMultipartForm(10 * 1024 * 1024); err != nil {
		response.BadRequest(w, r, "Failed to parse multipart file upload.")
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		response.BadRequest(w, r, "Missing 'file' parameter in multipart form.")
		return
	}
	defer file.Close()

	contentType := header.Header.Get("Content-Type")
	isPrimary := r.FormValue("is_primary") == "true"

	img, err := h.service.UploadProductMedia(r.Context(), productID, header.Filename, contentType, file, header.Size, isPrimary)
	if err != nil {
		response.BadRequest(w, r, err.Error())
		return
	}

	response.JSON(w, http.StatusCreated, img)
}

// SetPrimaryImage handles PATCH /api/v1/store/{store_slug}/catalog/products/{id}/media/{image_id}/primary.
func (h *Handler) SetPrimaryImage(w http.ResponseWriter, r *http.Request) {
	productID := chi.URLParam(r, "id")
	imageID := chi.URLParam(r, "image_id")

	if productID == "" || imageID == "" {
		response.BadRequest(w, r, "Product ID and Image ID are required.")
		return
	}

	if err := h.service.SetPrimaryImage(r.Context(), productID, imageID); err != nil {
		if errors.Is(err, ErrImageNotFound) {
			response.NotFound(w, r, "Media image not found.")
			return
		}
		response.InternalServerError(w, r)
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"message": "Primary product image updated successfully."})
}

// DeleteImage handles DELETE /api/v1/store/{store_slug}/catalog/products/{id}/media/{image_id}.
func (h *Handler) DeleteImage(w http.ResponseWriter, r *http.Request) {
	imageID := chi.URLParam(r, "image_id")
	if imageID == "" {
		response.BadRequest(w, r, "Image ID is required.")
		return
	}

	if err := h.service.DeleteProductImage(r.Context(), imageID); err != nil {
		if errors.Is(err, ErrImageNotFound) {
			response.NotFound(w, r, "Media image not found.")
			return
		}
		response.InternalServerError(w, r)
		return
	}

	response.JSON(w, http.StatusOK, map[string]string{"message": "Product image deleted successfully."})
}
