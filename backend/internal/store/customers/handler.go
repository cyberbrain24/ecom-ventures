package customers

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"ecom-ventures/backend/pkg/response"
)

// Handler handles HTTP requests for customer operations.
type Handler struct {
	service *Service
}

// NewHandler instantiates the customer handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// ListCustomers handles GET /api/v1/store/{store_slug}/customers
func (h *Handler) ListCustomers(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 100 {
		limit = 20
	}

	filter := &CustomerFilterParams{
		Search: r.URL.Query().Get("search"),
		Page:   page,
		Limit:  limit,
	}

	if activeStr := r.URL.Query().Get("is_active"); activeStr != "" {
		b := activeStr == "true"
		filter.IsActive = &b
	}

	res, err := h.service.ListCustomers(r.Context(), filter)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to list customers: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, res)
}

// CreateCustomer handles POST /api/v1/store/{store_slug}/customers
func (h *Handler) CreateCustomer(w http.ResponseWriter, r *http.Request) {
	var req CreateCustomerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	if req.Email == "" || req.FirstName == "" {
		response.WriteValidationError(w, r, []response.InvalidParam{
			{Name: "email", Reason: "Email is required"},
			{Name: "first_name", Reason: "First name is required"},
		})
		return
	}

	customer, err := h.service.CreateCustomer(r.Context(), &req)
	if err != nil {
		if errors.Is(err, ErrEmailConflict) {
			response.WriteConflict(w, r, "Customer email already registered in this store")
			return
		}
		response.WriteInternalError(w, r, "Failed to create customer: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusCreated, customer)
}

// GetCustomer handles GET /api/v1/store/{store_slug}/customers/{customer_id}
func (h *Handler) GetCustomer(w http.ResponseWriter, r *http.Request) {
	customerID := chi.URLParam(r, "customer_id")
	detail, err := h.service.GetCustomer(r.Context(), customerID)
	if err != nil {
		if errors.Is(err, ErrCustomerNotFound) {
			response.WriteNotFound(w, r, "Customer not found")
			return
		}
		response.WriteInternalError(w, r, "Failed to retrieve customer: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, detail)
}

// UpdateCustomer handles PUT /api/v1/store/{store_slug}/customers/{customer_id}
func (h *Handler) UpdateCustomer(w http.ResponseWriter, r *http.Request) {
	customerID := chi.URLParam(r, "customer_id")
	var req UpdateCustomerRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	detail, err := h.service.UpdateCustomer(r.Context(), customerID, &req)
	if err != nil {
		if errors.Is(err, ErrCustomerNotFound) {
			response.WriteNotFound(w, r, "Customer not found")
			return
		}
		response.WriteInternalError(w, r, "Failed to update customer: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, detail)
}

// DeleteCustomer handles DELETE /api/v1/store/{store_slug}/customers/{customer_id}
func (h *Handler) DeleteCustomer(w http.ResponseWriter, r *http.Request) {
	customerID := chi.URLParam(r, "customer_id")
	if err := h.service.DeleteCustomer(r.Context(), customerID); err != nil {
		if errors.Is(err, ErrCustomerNotFound) {
			response.WriteNotFound(w, r, "Customer not found")
			return
		}
		response.WriteInternalError(w, r, "Failed to delete customer: "+err.Error())
		return
	}
	response.WriteNoContent(w)
}

// AddAddress handles POST /api/v1/store/{store_slug}/customers/{customer_id}/addresses
func (h *Handler) AddAddress(w http.ResponseWriter, r *http.Request) {
	customerID := chi.URLParam(r, "customer_id")
	var req AddressRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	if req.RecipientName == "" || req.StreetAddress == "" || req.City == "" {
		response.WriteValidationError(w, r, []response.InvalidParam{
			{Name: "recipient_name", Reason: "Recipient name is required"},
			{Name: "street_address", Reason: "Street address is required"},
			{Name: "city", Reason: "City is required"},
		})
		return
	}

	addr, err := h.service.AddAddress(r.Context(), customerID, &req)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to create address: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusCreated, addr)
}

// UpdateAddress handles PUT /api/v1/store/{store_slug}/customers/{customer_id}/addresses/{address_id}
func (h *Handler) UpdateAddress(w http.ResponseWriter, r *http.Request) {
	customerID := chi.URLParam(r, "customer_id")
	addressID := chi.URLParam(r, "address_id")
	var req AddressRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	addr, err := h.service.UpdateAddress(r.Context(), customerID, addressID, &req)
	if err != nil {
		if errors.Is(err, ErrAddressNotFound) {
			response.WriteNotFound(w, r, "Address not found")
			return
		}
		response.WriteInternalError(w, r, "Failed to update address: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, addr)
}

// DeleteAddress handles DELETE /api/v1/store/{store_slug}/customers/{customer_id}/addresses/{address_id}
func (h *Handler) DeleteAddress(w http.ResponseWriter, r *http.Request) {
	addressID := chi.URLParam(r, "address_id")
	if err := h.service.DeleteAddress(r.Context(), addressID); err != nil {
		if errors.Is(err, ErrAddressNotFound) {
			response.WriteNotFound(w, r, "Address not found")
			return
		}
		response.WriteInternalError(w, r, "Failed to delete address: "+err.Error())
		return
	}
	response.WriteNoContent(w)
}
