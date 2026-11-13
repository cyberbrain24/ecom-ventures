// Package orders provides domain logic, state machine execution, and HTTP APIs
// for order processing, fulfillment, and payment reconciliation.
package orders

import (
	"time"

	storeModels "ecom-ventures/backend/internal/store/models"
)

// CreateOrderItemRequest defines an item to include when creating an order manually.
type CreateOrderItemRequest struct {
	VariantID string  `json:"variant_id"`
	Quantity  int     `json:"quantity"`
	UnitPrice float64 `json:"unit_price"`
}

// CreateOrderRequest defines the payload for creating an order (e.g., via phone order or draft order).
type CreateOrderRequest struct {
	CustomerID       *string                      `json:"customer_id,omitempty"`
	CustomerEmail    string                       `json:"customer_email"`
	CustomerPhone    string                       `json:"customer_phone"`
	CustomerName     string                       `json:"customer_name"`
	ShippingAddress  storeModels.CustomerAddress  `json:"shipping_address"`
	BillingAddress   *storeModels.CustomerAddress `json:"billing_address,omitempty"`
	ShippingDistrict string                       `json:"shipping_district,omitempty"`
	ShippingThana    string                       `json:"shipping_thana,omitempty"`
	Items            []CreateOrderItemRequest     `json:"items"`
	ShippingFee      float64                      `json:"shipping_fee"`
	DiscountAmount   float64                      `json:"discount_amount"`
	PaidAmount       float64                      `json:"paid_amount"`
	PaymentMethod    string                       `json:"payment_method"` // COD, BKASH, NAGAD, SSLCOMMERZ, STRIPE
	Notes            string                       `json:"notes,omitempty"`
	SpecialNote      *string                      `json:"special_note,omitempty"`
}

// UpdateOrderRequest defines the fields available for universal CRUD order modification.
type UpdateOrderRequest struct {
	CustomerName     string                       `json:"customer_name"`
	CustomerEmail    string                       `json:"customer_email"`
	CustomerPhone    string                       `json:"customer_phone"`
	ShippingDistrict string                       `json:"shipping_district"`
	ShippingThana    string                       `json:"shipping_thana"`
	ShippingAddress  *storeModels.CustomerAddress `json:"shipping_address,omitempty"`
	PaymentMethod    string                       `json:"payment_method"`
	PaidAmount       *float64                     `json:"paid_amount,omitempty"`
	Notes            string                       `json:"notes"`
	SpecialNote      *string                      `json:"special_note,omitempty"`
}

// AddCallNoteRequest defines the payload for logging a staff call remark.
type AddCallNoteRequest struct {
	StaffName string `json:"staff_name"`
	Note      string `json:"note"`
}

// UpdateOrderStatusRequest defines the payload to trigger a state machine transition.
type UpdateOrderStatusRequest struct {
	Status storeModels.OrderStatus `json:"status"`
	Notes  string                  `json:"notes,omitempty"`
}

// CreateShipmentRequest defines details to dispatch an order with a shipping carrier.
type CreateShipmentRequest struct {
	Carrier        string   `json:"carrier"` // STEADFAST, PATHAO, REDX, DHL, etc.
	TrackingNumber string   `json:"tracking_number"`
	TrackingURL    string   `json:"tracking_url,omitempty"`
	Notes          string   `json:"notes,omitempty"`
	ItemIDs        []string `json:"item_ids,omitempty"`
}

// RecordPaymentRequest registers an append-only transaction settlement record.
type RecordPaymentRequest struct {
	Gateway       string  `json:"gateway"` // COD, BKASH, NAGAD, SSLCOMMERZ, STRIPE
	TransactionID string  `json:"transaction_id"`
	Amount        float64 `json:"amount"`
	Status        string  `json:"status"` // PAID, FAILED, REFUNDED
	RawResponse   string  `json:"raw_response,omitempty"`
}

// OrderFilterParams defines query parameters for searching and paginating orders.
type OrderFilterParams struct {
	Search        string
	Status        *storeModels.OrderStatus
	PaymentStatus *storeModels.PaymentStatus
	StartDate     *time.Time
	EndDate       *time.Time
	Page          int
	Limit         int
}

// OrderDetailResponse represents the complete aggregate order with items, shipments, payments, and history.
type OrderDetailResponse struct {
	Order     storeModels.Order                `json:"order"`
	Items     []storeModels.OrderItem          `json:"items"`
	Shipments []storeModels.OrderShipment      `json:"shipments"`
	Payments  []storeModels.PaymentTransaction `json:"payments"`
	History   []storeModels.OrderStatusHistory `json:"history"`
}

// PaginatedOrdersResponse wraps listed orders with pagination metadata.
type PaginatedOrdersResponse struct {
	Orders []storeModels.Order `json:"orders"`
	Total  int                 `json:"total"`
	Page   int                 `json:"page"`
	Limit  int                 `json:"limit"`
}
