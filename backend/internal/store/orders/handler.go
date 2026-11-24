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

// CaptureAbandoned handles POST /api/v1/orders/abandoned/capture (public storefront telemetry)
func (h *Handler) CaptureAbandoned(w http.ResponseWriter, r *http.Request) {
	var req CaptureAbandonedCheckoutRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	if err := h.service.CaptureAbandonedCheckout(r.Context(), &req); err != nil {
		response.WriteInternalError(w, r, "Failed to capture abandoned intent: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]string{
		"status":  "captured",
		"message": "Intent telemetry recorded",
	})
}

// ListAbandoned handles GET /api/v1/store/{store_slug}/orders/abandoned (Tele-sales queue)
func (h *Handler) ListAbandoned(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 100 {
		limit = 20
	}
	status := r.URL.Query().Get("status")

	res, err := h.service.ListAbandonedCheckouts(r.Context(), status, page, limit)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to list abandoned checkouts: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, res)
}

// UpdateAbandonedStatus handles PATCH /api/v1/store/{store_slug}/orders/abandoned/{id}/status
func (h *Handler) UpdateAbandonedStatus(w http.ResponseWriter, r *http.Request) {
	dropID := chi.URLParam(r, "id")
	var req UpdateAbandonedStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	if err := h.service.UpdateAbandonedStatus(r.Context(), dropID, &req); err != nil {
		response.WriteInternalError(w, r, "Failed to update abandoned status: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]string{
		"status":  "updated",
		"message": "Abandoned checkout status updated successfully",
	})
}

// ConvertAbandonedToOrder handles POST /api/v1/store/{store_slug}/orders/abandoned/{id}/convert (1-Click Order Genesis)
func (h *Handler) ConvertAbandonedToOrder(w http.ResponseWriter, r *http.Request) {
	dropID := chi.URLParam(r, "id")
	var req ConvertAbandonedToOrderRequest
	_ = json.NewDecoder(r.Body).Decode(&req)

	order, err := h.service.ConvertAbandonedToOrder(r.Context(), dropID, &req)
	if err != nil {
		response.WriteBadRequest(w, r, "Failed to convert abandoned checkout: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusCreated, order)
}

// GetFulfillmentQueue handles GET /api/v1/store/{store_slug}/fulfillment-queue
func (h *Handler) GetFulfillmentQueue(w http.ResponseWriter, r *http.Request) {
	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit < 1 || limit > 100 {
		limit = 20
	}
	urgentOnly := r.URL.Query().Get("urgent_only") == "true"

	res, err := h.service.GetFulfillmentQueue(r.Context(), page, limit, urgentOnly)
	if err != nil {
		response.WriteInternalError(w, r, "Failed to retrieve fulfillment queue: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, res)
}

// UpdateFulfillmentFlags handles PATCH /api/v1/store/{store_slug}/orders/{order_id}/fulfillment-flags
func (h *Handler) UpdateFulfillmentFlags(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "order_id")
	var req UpdateFulfillmentFlagsRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	if err := h.service.UpdateFulfillmentFlags(r.Context(), orderID, &req); err != nil {
		response.WriteInternalError(w, r, "Failed to update fulfillment flags: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]string{
		"message": "Fulfillment flags updated successfully",
	})
}

// GetOrderPulseDiagnostics handles GET /api/v1/store/{store_slug}/orders/orderpulse/diagnostics
func (h *Handler) GetOrderPulseDiagnostics(w http.ResponseWriter, r *http.Request) {
	res, err := h.service.GetOrderPulseDiagnostics(r.Context())
	if err != nil {
		response.WriteInternalError(w, r, "Failed to retrieve OrderPulse diagnostics: "+err.Error())
		return
	}
	response.WriteJSON(w, http.StatusOK, res)
}

// UpdateOrderPulseTags handles PATCH /api/v1/store/{store_slug}/orders/{order_id}/orderpulse-tags
func (h *Handler) UpdateOrderPulseTags(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "order_id")
	var req UpdateOrderPulseTagRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	if err := h.service.UpdateOrderPulseTags(r.Context(), orderID, &req); err != nil {
		response.WriteInternalError(w, r, "Failed to update OrderPulse tags: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]string{
		"message": "OrderPulse tags updated successfully",
	})
}

// PartialSplit handles POST /api/v1/store/{store_slug}/orders/{order_id}/partial-split
func (h *Handler) PartialSplit(w http.ResponseWriter, r *http.Request) {
	orderID := chi.URLParam(r, "order_id")
	var req PartialSplitRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.WriteBadRequest(w, r, "Invalid request payload: "+err.Error())
		return
	}

	if len(req.Items) == 0 {
		response.WriteBadRequest(w, r, "Partial split requires items list")
		return
	}

	if err := h.service.ExecutePartialSplit(r.Context(), orderID, &req); err != nil {
		response.WriteInternalError(w, r, "Failed to execute partial split: "+err.Error())
		return
	}

	response.WriteJSON(w, http.StatusOK, map[string]string{
		"message": "Order successfully split into accepted and returned items",
	})
}
