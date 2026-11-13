package models

import (
	"encoding/json"
	"time"
)

// OrderStatus defines the operational state in the fulfillment pipeline.
type OrderStatus string

const (
	OrderStatusPending    OrderStatus = "PENDING"
	OrderStatusConfirmed  OrderStatus = "CONFIRMED"
	OrderStatusProcessing OrderStatus = "PROCESSING"
	OrderStatusShipped    OrderStatus = "SHIPPED"
	OrderStatusDelivered  OrderStatus = "DELIVERED"
	OrderStatusCancelled  OrderStatus = "CANCELLED"
	OrderStatusRefunded   OrderStatus = "REFUNDED"
)

// PaymentStatus defines the transaction settlement state.
type PaymentStatus string

const (
	PaymentStatusPending  PaymentStatus = "PENDING"
	PaymentStatusPaid     PaymentStatus = "PAID"
	PaymentStatusFailed   PaymentStatus = "FAILED"
	PaymentStatusRefunded PaymentStatus = "REFUNDED"
)

// ShipmentStatus defines carrier logistics milestones.
type ShipmentStatus string

const (
	ShipmentPending        ShipmentStatus = "PENDING"
	ShipmentLabelCreated   ShipmentStatus = "LABEL_CREATED"
	ShipmentInTransit      ShipmentStatus = "IN_TRANSIT"
	ShipmentOutForDelivery ShipmentStatus = "OUT_FOR_DELIVERY"
	ShipmentDelivered      ShipmentStatus = "DELIVERED"
	ShipmentFailedAttempt  ShipmentStatus = "FAILED_ATTEMPT"
	ShipmentReturned       ShipmentStatus = "RETURNED"
)

// RiskFlag represents a fraud, payment, or operational hazard detected for an order.
type RiskFlag struct {
	Code        string `json:"code"`
	Severity    string `json:"severity"` // "WARNING", "DANGER", "INFO"
	Label       string `json:"label"`
	Description string `json:"description"`
}

// Order represents a finalized customer purchase transaction.
type Order struct {
	ID                   string               `json:"id"`
	OrderNumber          string               `json:"order_number"`
	CustomerID           *string              `json:"customer_id,omitempty"`
	CustomerEmail        string               `json:"customer_email,omitempty"`
	CustomerPhone        string               `json:"customer_phone,omitempty"`
	Status               OrderStatus          `json:"status"`
	PaymentStatus        PaymentStatus        `json:"payment_status"`
	Subtotal             float64              `json:"subtotal"`
	DiscountAmount       float64              `json:"discount_amount"`
	TaxAmount            float64              `json:"tax_amount"`
	ShippingCost         float64              `json:"shipping_cost,omitempty"`
	ShippingFee          float64              `json:"shipping_fee"`
	TotalAmount          float64              `json:"total_amount"`
	PaidAmount           float64              `json:"paid_amount"`
	DueAmount            float64              `json:"due_amount"`
	Currency             string               `json:"currency"`
	ShippingAddress      CustomerAddress      `json:"shipping_address"`
	BillingAddress       *CustomerAddress     `json:"billing_address,omitempty"`
	PaymentMethod        string               `json:"payment_method,omitempty"`
	Notes                string               `json:"notes,omitempty"`
	SpecialNote          *string              `json:"special_note,omitempty"`
	ShippingDistrict     string               `json:"shipping_district,omitempty"`
	ShippingThana        string               `json:"shipping_thana,omitempty"`
	RiskScoreFlags       []RiskFlag           `json:"risk_score_flags"`
	CourierConsignmentID *string              `json:"courier_consignment_id,omitempty"`
	CourierTrackingCode  *string              `json:"courier_tracking_code,omitempty"`
	CourierStatusSyncAt  *time.Time           `json:"courier_status_sync_at,omitempty"`
	Items                []OrderItem          `json:"items,omitempty"`
	Shipments            []OrderShipment      `json:"shipments,omitempty"`
	Transactions         []PaymentTransaction `json:"transactions,omitempty"`
	StatusHistory        []OrderStatusHistory `json:"status_history,omitempty"`
	CallNotes            []OrderCallNote      `json:"call_notes,omitempty"`
	CreatedAt            time.Time            `json:"created_at"`
	UpdatedAt            time.Time            `json:"updated_at"`
}

// OrderItem represents a line item within a customer order.
type OrderItem struct {
	ID           string    `json:"id"`
	OrderID      string    `json:"order_id"`
	ProductID    *string   `json:"product_id,omitempty"`
	VariantID    string    `json:"variant_id"`
	ProductTitle string    `json:"product_title"`
	VariantTitle string    `json:"variant_title"`
	Title        string    `json:"title,omitempty"`
	SKU          string    `json:"sku"`
	UnitPrice    float64   `json:"unit_price"`
	Quantity     int       `json:"quantity"`
	TotalPrice   float64   `json:"total_price"`
	CreatedAt    time.Time `json:"created_at"`
}

// OrderShipment tracks parcels handled by third-party delivery partners.
type OrderShipment struct {
	ID                string         `json:"id"`
	OrderID           string         `json:"order_id"`
	Carrier           string         `json:"carrier"` // Pathao, RedX, Steadfast, DHL, FedEx
	TrackingNumber    string         `json:"tracking_number"`
	TrackingURL       string         `json:"tracking_url,omitempty"`
	Status            ShipmentStatus `json:"status"`
	ShippedAt         *time.Time     `json:"shipped_at,omitempty"`
	EstimatedDelivery *time.Time     `json:"estimated_delivery,omitempty"`
	DeliveredAt       *time.Time     `json:"delivered_at,omitempty"`
	ShippingNotes     *string        `json:"shipping_notes,omitempty"`
	Notes             string         `json:"notes,omitempty"`
	CreatedAt         time.Time      `json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
}

// PaymentTransaction records gateway payment lifecycle events.
type PaymentTransaction struct {
	ID                   string          `json:"id"`
	OrderID              string          `json:"order_id"`
	Gateway              string          `json:"gateway"` // bKash, Nagad, SSLCommerz, Stripe, COD
	TransactionID        string          `json:"transaction_id"`
	TransactionReference *string         `json:"transaction_reference,omitempty"`
	Amount               float64         `json:"amount"`
	Currency             string          `json:"currency,omitempty"`
	Status               string          `json:"status"` // INITIATED, SUCCESS, PAID, FAILED, REFUNDED
	RawResponse          string          `json:"raw_response,omitempty"`
	GatewayResponse      json.RawMessage `json:"gateway_response,omitempty"`
	CreatedAt            time.Time       `json:"created_at"`
}

// OrderStatusHistory tracks the append-only lifecycle changes of an order.
type OrderStatusHistory struct {
	ID             string      `json:"id"`
	OrderID        string      `json:"order_id"`
	OldStatus      OrderStatus `json:"old_status"`
	NewStatus      OrderStatus `json:"new_status"`
	PreviousStatus string      `json:"previous_status,omitempty"`
	PerformedBy    string      `json:"performed_by"`
	ChangedBy      string      `json:"changed_by,omitempty"`
	Reason         *string     `json:"reason,omitempty"`
	Notes          string      `json:"notes,omitempty"`
	CreatedAt      time.Time   `json:"created_at"`
}

// OrderCallNote represents staff verification, customer coordination, or delivery phone remarks.
type OrderCallNote struct {
	ID        string    `json:"id"`
	OrderID   string    `json:"order_id"`
	StaffName string    `json:"staff_name"`
	Note      string    `json:"note"`
	CreatedAt time.Time `json:"created_at"`
}
