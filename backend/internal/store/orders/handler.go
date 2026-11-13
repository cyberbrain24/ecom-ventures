package orders

import (
	"encoding/json"
	"errors"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	storeModels "ecom-ventures/backend/internal/store/models"
	"ecom-ventures/backend/pkg/response"
)

// Handler handles HTTP routes for order processing and tracking.
type Handler struct {
	service *Service
}

// NewHandler instantiates the order handler.
func NewHandler(service *Service) *Handler {
	return &Handler{service: service}
}

// ListOrders handles GET /api/v1/store/{store_slug}/orders
func (h *Handler) ListOrders(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 100 {
		limit = 20
	}

	filter := &OrderFilterParams{
		Search: r.URL.Query().Get("search"),
		Page:   page,
		Limit:  limit,
	}

	if st := r.URL.Query().Get("status"); st != "" {
		status := storeModels.OrderStatus(st)
		filter.Status = &status
	}

	if ps := r.URL.Query().Get("payment_status"); ps != "" {
		payStatus := storeModels.PaymentStatus(ps)
		filter.PaymentStatus = &payStatus
	}

	res, err := h.service.ListOrders(r.Context(), filter)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to list orders: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, res)
}

// CreateOrder handles POST /api/v1/store/{store_slug}/orders
func (h *Handler) CreateOrder(w http.ResponseWriter, r *http.Request) {
	var req CreateOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	if req.CustomerEmail == "" && req.CustomerPhone == "" {
		response.WriteValidationError(w, r, []response.InvalidParam{
			{Name: "customer_contact", Reason: "Either customer_email or customer_phone is required"},
		})
		return
	}

	order, err := h.service.CreateOrder(r.Context(), &req)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to create order: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusCreated, order)
}

// GetOrder handles GET /api/v1/store/{store_slug}/orders/{order_id}
func (h *Handler) GetOrder(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "order_id")
	detail, err := h.service.GetOrder(r.Context(), orderID)
	if err != nil {
		if errors.Is(err, ErrOrderNotFound) {
			response.WriteNotFound(w, r, "Order not found")
			return
		}
		response.WriteInternalError(w, r, "Failed to retrieve order: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, detail)
}

// TransitionStatus handles PATCH /api/v1/store/{store_slug}/orders/{order_id}/status
func (h *Handler) TransitionStatus(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "order_id")
	var req UpdateOrderStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	detail, err := h.service.TransitionOrderStatus(r.Context(), orderID, &req)
	if err != nil {
		if errors.Is(err, ErrInvalidOrderTransition) || errors.Is(err, ErrOrderAlreadyTerminal) {
			response.WriteBadRequest(w, r, err.Error())
			return
		}
		if errors.Is(err, ErrOrderNotFound) {
			response.WriteNotFound(w, r, "Order not found")
			return
		}
		response.WriteInternalError(w, r, "Failed to transition order status: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, detail)
}

// CreateShipment handles POST /api/v1/store/{store_slug}/orders/{order_id}/shipments
func (h *Handler) CreateShipment(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "order_id")
	var req CreateShipmentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	shipment, err := h.service.CreateShipment(r.Context(), orderID, &req)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to create shipment: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusCreated, shipment)
}

// RecordPayment handles POST /api/v1/store/{store_slug}/orders/{order_id}/payments
func (h *Handler) RecordPayment(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "order_id")
	var req RecordPaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	txn, err := h.service.RecordPayment(r.Context(), orderID, &req)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to record payment: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusCreated, txn)
}

// AddCallNote handles POST /api/v1/store/{store_slug}/orders/{order_id}/call-notes
func (h *Handler) AddCallNote(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "order_id")
	var req AddCallNoteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	note, err := h.service.AddCallNote(r.Context(), orderID, &req)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to add call note: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusCreated, note)
}

// GetCallNotes handles GET /api/v1/store/{store_slug}/orders/{order_id}/call-notes
func (h *Handler) GetCallNotes(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "order_id")
	notes, err := h.service.GetCallNotes(r.Context(), orderID)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to retrieve call notes: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]interface{}{"call_notes": notes})
}

// UpdateOrder handles PUT /api/v1/store/{store_slug}/orders/{order_id}
func (h *Handler) UpdateOrder(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "order_id")
	var req UpdateOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	order, err := h.service.UpdateOrder(r.Context(), orderID, &req)
	if err != nil {
		if errors.Is(err, ErrOrderNotFound) {
			response.WriteNotFound(w, r, "Order not found")
			return
		}
		response.WriteInternalError(w, r, "Failed to update order: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, order)
}

// DeleteOrder handles DELETE /api/v1/store/{store_slug}/orders/{order_id}
func (h *Handler) DeleteOrder(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "order_id")
	if err := h.service.DeleteOrder(r.Context(), orderID); err != nil {
		if errors.Is(err, ErrOrderNotFound) {
			response.WriteNotFound(w, r, "Order not found")
			return
		}
		response.WriteBadRequest(w, r, err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]string{
		"message": "Order deleted successfully",
		"id":      orderID,
	})
}
