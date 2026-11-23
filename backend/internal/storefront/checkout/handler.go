// Package checkout provides domain logic and HTTP APIs for storefront
// checkout submission, atomic order creation, and public order tracking.
package checkout

import (
	"encoding/json"
	"errors"
	"net/http"

	"github.com/go-chi/chi/v5"

	"ecom-ventures/backend/internal/store/inventory"
	"ecom-ventures/backend/internal/store/shipping"
	"ecom-ventures/backend/pkg/response"
)

// Handler handles HTTP requests for storefront checkout.
type Handler struct {
	service *Service
}

// NewHandler instantiates the handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// ProcessCheckout handles POST /api/v1/storefront/checkout
func (h *Handler) ProcessCheckout(w http.ResponseWriter, r *http.Request) {
	var req CheckoutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	if req.SessionID == "" {
		// Fallback to headers
		req.SessionID = r.Header.Get("X-Cart-Session")
	}

	if req.CustomerEmail == "" || req.CustomerPhone == "" {
		response.WriteValidationError(w, r, []response.InvalidParam{
			{Name: "customer_email", Reason: "Email address is required"},
			{Name: "customer_phone", Reason: "Phone number is required"},
		})
		return
	}

	receipt, err := h.service.ProcessCheckout(r.Context(), &req)
	if err != nil {
		if errors.Is(err, ErrEmptyCart) {
			response.WriteBadRequest(w, r, "Cannot checkout with an empty cart.")
			return
		}
		if errors.Is(err, shipping.ErrZoneNotFound) {
			response.Problem(w, r, http.StatusUnprocessableEntity, "SHIPPING_ZONE_NOT_FOUND", "Shipping Not Available",
				"We do not deliver to this district and city yet. Please check the shipping address.")
			return
		}
		if errors.Is(err, inventory.ErrInsufficientStock) {
			response.WriteBadRequest(w, r, err.Error())
			return
		}
		response.WriteInternalError(w, r, "Failed to place order: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusCreated, receipt)
}

// LookupOrder handles GET /api/v1/storefront/orders/{order_number}
func (h *Handler) LookupOrder(w http.ResponseWriter, r *http.Request) {
	orderNumber := chi.URLParam(r, "order_number")
	verify := r.URL.Query().Get("verify")

	if verify == "" {
		response.WriteBadRequest(w, r, "Query parameter 'verify' (email or phone) is required.")
		return
	}

	receipt, err := h.service.LookupOrder(r.Context(), orderNumber, verify)
	if err != nil {
		if errors.Is(err, ErrOrderNotFound) {
			response.WriteNotFound(w, r, "Order not found or contact verification failed.")
			return
		}
		response.WriteInternalError(w, r, "Failed to lookup order: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, receipt)
}
