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
		limit = 50
	}

	filter := &CustomerFilterParams{
		Search:         r.URL.Query().Get("search"),
		MembershipTier: r.URL.Query().Get("membership_tier"),
		Page:           page,
		Limit:          limit,
	}

	if activeStr := r.URL.Query().Get("is_active"); activeStr != "" {
		b := activeStr == "true"
		filter.IsActive = &b
	}

	if blacklistedStr := r.URL.Query().Get("is_blacklisted"); blacklistedStr != "" {
		b := blacklistedStr == "true"
		filter.IsBlacklisted = &b
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

	if req.FirstName == "" || (req.Email == "" && (req.Phone == nil || *req.Phone == "")) {
		response.WriteValidationError(w, r, []response.InvalidParam{
			{Name: "first_name", Reason: "First name is required"},
			{Name: "phone", Reason: "Either phone or email must be provided"},
		})
		return
	}

	customer, err := h.service.CreateCustomer(r.Context(), &req)
	if err != nil {
		if errors.Is(err, ErrEmailConflict) {
			response.WriteConflict(w, r, "Customer email already registered in this store")
			return
		}
		if errors.Is(err, ErrPhoneConflict) {
			response.WriteConflict(w, r, "Customer phone number already registered in this store")
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

	customer, err := h.service.UpdateCustomer(r.Context(), customerID, &req)
	if err != nil {
		if errors.Is(err, ErrCustomerNotFound) {
			response.WriteNotFound(w, r, "Customer not found")
			return
		}
		if errors.Is(err, ErrPhoneConflict) {
			response.WriteConflict(w, r, "Phone number is already associated with another customer")
			return
		}
		response.WriteInternalError(w, r, "Failed to update customer: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, customer)
}

// UpdateCRMProfile handles PATCH /api/v1/store/{store_slug}/customers/{customer_id}/crm
func (h *Handler) UpdateCRMProfile(w http.ResponseWriter, r *http.Request) {
	customerID := chi.URLParam(r, "customer_id")
	var req UpdateCRMProfileRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	customer, err := h.service.UpdateCRMProfile(r.Context(), customerID, &req)
	if err != nil {
		if errors.Is(err, ErrCustomerNotFound) {
			response.WriteNotFound(w, r, "Customer not found")
			return
		}
		response.WriteInternalError(w, r, "Failed to update CRM profile: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, customer)
}

// ToggleBlacklist handles POST /api/v1/store/{store_slug}/customers/{customer_id}/blacklist
func (h *Handler) ToggleBlacklist(w http.ResponseWriter, r *http.Request) {
	customerID := chi.URLParam(r, "customer_id")
	var req ToggleBlacklistRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	if err := h.service.ToggleBlacklist(r.Context(), customerID, &req); err != nil {
		if errors.Is(err, ErrCustomerNotFound) {
			response.WriteNotFound(w, r, "Customer not found")
			return
		}
		response.WriteInternalError(w, r, "Failed to toggle blacklist status: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]interface{}{
		"success":        true,
		"is_blacklisted": req.IsBlacklisted,
		"reason":         req.Reason,
	})
}

// ImpersonateCustomer handles POST /api/v1/store/{store_slug}/customers/{customer_id}/impersonate
func (h *Handler) ImpersonateCustomer(w http.ResponseWriter, r *http.Request) {
	customerID := chi.URLParam(r, "customer_id")
	impersonateResp, err := h.service.ImpersonateCustomer(r.Context(), customerID)
	if err != nil {
		if errors.Is(err, ErrCustomerNotFound) {
			response.WriteNotFound(w, r, "Customer not found")
			return
		}
		response.WriteInternalError(w, r, "Failed to generate impersonation token: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, impersonateResp)
}

// DeleteCustomer handles DELETE /api/v1/store/{store_slug}/customers/{customer_id}
func (h *Handler) DeleteCustomer(w http.ResponseWriter, r *http.Request) {
	customerID := chi.URLParam(r, "customer_id")
	if err := h.service.DeleteCustomer(r.Context(), customerID); err != nil {
		if errors.Is(err, ErrCustomerNotFound) {
			response.WriteNotFound(w, r, "Customer not found")
			return
		}
		if errors.Is(err, ErrCustomerHasOrders) {
			// HTTP 422 Unprocessable Entity - guardrail blocks deletion of customer with financial records
			response.WriteProblem(w, r, http.StatusUnprocessableEntity, "Deletion Forbidden", err.Error())
			return
		}
		response.WriteInternalError(w, r, "Failed to delete customer: "+err.Error())
		return
	}

	response.WriteNoContent(w)
}

// ---------------- Address Book Handlers ----------------

// AddAddress handles POST /api/v1/store/{store_slug}/customers/{customer_id}/addresses
func (h *Handler) AddAddress(w http.ResponseWriter, r *http.Request) {
	customerID := chi.URLParam(r, "customer_id")
	var req AddressRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	if req.RecipientName == "" || req.Phone == "" || req.StreetAddress == "" || req.City == "" {
		response.WriteValidationError(w, r, []response.InvalidParam{
			{Name: "recipient_name", Reason: "Recipient name is required"},
			{Name: "phone", Reason: "Phone is required"},
			{Name: "street_address", Reason: "Street address is required"},
			{Name: "city", Reason: "City is required"},
		})
		return
	}

	addr, err := h.service.AddAddress(r.Context(), customerID, &req)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to add customer address: "+err.Error())
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
