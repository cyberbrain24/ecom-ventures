package catalog

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"ecom-ventures/backend/pkg/response"
)

// VariantsHandler handles HTTP routes for attributes, values, and variant matrices.
type VariantsHandler struct {
	service *VariantsService
}

// NewVariantsHandler instantiates the handler.
func NewVariantsHandler(service *VariantsService) *VariantsHandler {
	return &VariantsHandler{service: service}
}

// CreateAttribute handles POST /api/v1/store/{store_slug}/catalog/attributes
func (h *VariantsHandler) CreateAttribute(w http.ResponseWriter, r *http.Request) {
	var req CreateAttributeRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	if req.Name == "" {
		response.WriteValidationError(w, r, []response.InvalidParam{
			{Name: "name", Reason: "Attribute name is required"},
		})
		return
	}

	attr, err := h.service.CreateAttribute(r.Context(), &req)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to create attribute: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusCreated, attr)
}

// ListAttributes handles GET /api/v1/store/{store_slug}/catalog/attributes
func (h *VariantsHandler) ListAttributes(w http.ResponseWriter, r *http.Request) {
	list, err := h.service.ListAttributes(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Failed to fetch attributes: "+err.Error())
		return
	}
	response.WriteJSON(w, http.StatusOK, list)
}

// AddAttributeValue handles POST /api/v1/store/{store_slug}/catalog/attributes/{attribute_id}/values
func (h *VariantsHandler) AddAttributeValue(w http.ResponseWriter, r *http.Request) {
	attrID := chi.URLParam(r, "attribute_id")
	var req CreateAttributeValueRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	if req.Value == "" {
		response.WriteValidationError(w, r, []response.InvalidParam{
			{Name: "value", Reason: "Attribute value is required"},
		})
		return
	}

	val, err := h.service.AddAttributeValue(r.Context(), attrID, &req)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to add attribute value: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusCreated, val)
}

// PreviewMatrix handles POST /api/v1/store/{store_slug}/catalog/products/{product_id}/variants/preview
func (h *VariantsHandler) PreviewMatrix(w http.ResponseWriter, r *http.Request) {
	productID := chi.URLParam(r, "product_id")
	var req GenerateMatrixRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	proposals, err := h.service.PreviewMatrix(r.Context(), productID, &req)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to preview variant matrix: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, proposals)
}

// GenerateMatrix handles POST /api/v1/store/{store_slug}/catalog/products/{product_id}/variants/generate
func (h *VariantsHandler) GenerateMatrix(w http.ResponseWriter, r *http.Request) {
	productID := chi.URLParam(r, "product_id")
	var req GenerateMatrixRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	variants, err := h.service.GenerateAndPersistMatrix(r.Context(), productID, &req)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to generate variant matrix: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusCreated, variants)
}

// CreateVariant handles POST /api/v1/store/{store_slug}/catalog/products/{product_id}/variants
func (h *VariantsHandler) CreateVariant(w http.ResponseWriter, r *http.Request) {
	productID := chi.URLParam(r, "product_id")
	var req CreateVariantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	if req.SKU == "" || req.Title == "" {
		response.WriteValidationError(w, r, []response.InvalidParam{
			{Name: "sku", Reason: "SKU is required"},
			{Name: "title", Reason: "Variant title is required"},
		})
		return
	}

	variant, err := h.service.CreateVariant(r.Context(), productID, &req)
	if err != nil {
		if errors.Is(err, ErrInvalidPricing) {
			response.WriteBadRequest(w, r, err.Error())
			return
		}
		response.WriteInternalError(w, r, "Failed to create variant: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusCreated, variant)
}

// ListVariants handles GET /api/v1/store/{store_slug}/catalog/products/{product_id}/variants
func (h *VariantsHandler) ListVariants(w http.ResponseWriter, r *http.Request) {
	productID := chi.URLParam(r, "product_id")
	variants, err := h.service.ListVariantsByProductID(r.Context(), productID)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to list variants: "+err.Error())
		return
	}
	response.WriteJSON(w, http.StatusOK, variants)
}

// UpdateVariant handles PUT /api/v1/store/{store_slug}/catalog/variants/{variant_id}
func (h *VariantsHandler) UpdateVariant(w http.ResponseWriter, r *http.Request) {
	variantID := chi.URLParam(r, "variant_id")
	var req UpdateVariantRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	variant, err := h.service.UpdateVariant(r.Context(), variantID, &req)
	if err != nil {
		if errors.Is(err, ErrVariantNotFound) {
			response.WriteNotFound(w, r, "Variant not found")
			return
		}
		if errors.Is(err, ErrInvalidPricing) {
			response.WriteBadRequest(w, r, err.Error())
			return
		}
		response.WriteInternalError(w, r, "Failed to update variant: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, variant)
}

// DeleteVariant handles DELETE /api/v1/store/{store_slug}/catalog/variants/{variant_id}
func (h *VariantsHandler) DeleteVariant(w http.ResponseWriter, r *http.Request) {
	variantID := chi.URLParam(r, "variant_id")
	if err := h.service.DeleteVariant(r.Context(), variantID); err != nil {
		if errors.Is(err, ErrVariantNotFound) {
			response.WriteNotFound(w, r, "Variant not found")
			return
		}
		response.WriteInternalError(w, r, "Failed to delete variant: "+err.Error())
		return
	}
	response.WriteNoContent(w)
}

// BatchUpdateVariants handles PATCH /api/v1/store/{store_slug}/catalog/variants/batch
func (h *VariantsHandler) BatchUpdateVariants(w http.ResponseWriter, r *http.Request) {
	var req BatchUpdateVariantsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	count, err := h.service.BatchUpdateVariants(r.Context(), &req)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to batch update variants: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success":       true,
		"updated_count": count,
	})
}

// BindVariantImages handles POST /api/v1/store/{store_slug}/catalog/variants/{variant_id}/images
func (h *VariantsHandler) BindVariantImages(w http.ResponseWriter, r *http.Request) {
	variantID := chi.URLParam(r, "variant_id")
	var req BindVariantImagesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	if err := h.service.BindVariantImages(r.Context(), variantID, req.ImageIDs); err != nil {
		response.WriteInternalError(w, r, "Failed to bind variant images: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success": true,
		"message": "Variant images mapped successfully",
	})
}
