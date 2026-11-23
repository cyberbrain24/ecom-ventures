package cart

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"ecom-ventures/backend/pkg/response"
)

// Handler handles HTTP requests for storefront carts.
type Handler struct {
	service *Service
}

// NewHandler instantiates the cart handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

func getSessionID(r *http.Request) string {
	sess := r.Header.Get("X-Cart-Session")
	if sess == "" {
		if cookie, err := r.Cookie("ecom_cart_session"); err == nil {
			sess = cookie.Value
		}
	}
	return sess
}

// GetCart handles GET /api/v1/storefront/cart
func (h *Handler) GetCart(w http.ResponseWriter, r *http.Request) {
	sessID := getSessionID(r)
	cart, err := h.service.GetOrCreateCart(r.Context(), sessID)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to retrieve cart: "+err.Error())
		return
	}
	response.WriteJSON(w, http.StatusOK, cart)
}

// AddItem handles POST /api/v1/storefront/cart/items
func (h *Handler) AddItem(w http.ResponseWriter, r *http.Request) {
	sessID := getSessionID(r)
	var req AddCartItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	if req.VariantID == "" {
		response.WriteValidationError(w, r, []response.InvalidParam{
			{Name: "variant_id", Reason: "Variant ID is required"},
		})
		return
	}

	cart, err := h.service.AddItem(r.Context(), sessID, &req)
	if err != nil {
		if errors.Is(err, ErrInsufficientStock) || errors.Is(err, ErrVariantInactive) {
			response.WriteBadRequest(w, r, err.Error())
			return
		}
		if errors.Is(err, ErrCartItemNotFound) {
			response.WriteNotFound(w, r, "The product variant was not found.")
			return
		}
		response.WriteInternalError(w, r, "Failed to add item to cart: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, cart)
}

// UpdateItem handles PUT /api/v1/storefront/cart/items/{item_id}
func (h *Handler) UpdateItem(w http.ResponseWriter, r *http.Request) {
	sessID := getSessionID(r)
	itemID := chi.URLParam(r, "item_id")
	var req UpdateCartItemRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	cart, err := h.service.UpdateItemQuantity(r.Context(), sessID, itemID, req.Quantity)
	if err != nil {
		if errors.Is(err, ErrInsufficientStock) {
			response.WriteBadRequest(w, r, err.Error())
			return
		}
		if errors.Is(err, ErrCartItemNotFound) {
			response.WriteNotFound(w, r, "Cart item not found")
			return
		}
		response.WriteInternalError(w, r, "Failed to update item: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, cart)
}

// RemoveItem handles DELETE /api/v1/storefront/cart/items/{item_id}
func (h *Handler) RemoveItem(w http.ResponseWriter, r *http.Request) {
	sessID := getSessionID(r)
	itemID := chi.URLParam(r, "item_id")
	cart, err := h.service.RemoveItem(r.Context(), sessID, itemID)
	if err != nil {
		if errors.Is(err, ErrCartItemNotFound) {
			response.WriteNotFound(w, r, "Cart item not found")
			return
		}
		response.WriteInternalError(w, r, "Failed to remove item: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, cart)
}
