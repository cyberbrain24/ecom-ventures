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

// UpdateFulfillmentFlagsRequest defines the payload to toggle is_ready and is_print_ready flags.
type UpdateFulfillmentFlagsRequest struct {
	IsReady      *bool `json:"is_ready,omitempty"`
	IsPrintReady *bool `json:"is_print_ready,omitempty"`
	IsUrgent     *bool `json:"is_urgent,omitempty"`
}

// FulfillmentQueueItem wraps an order in the actionable warehouse fulfillment queue with OrderPulse aging metrics.
type FulfillmentQueueItem struct {
	Order             storeModels.Order `json:"order"`
	AgingHours        float64           `json:"aging_hours"`
	AgingTier         string            `json:"aging_tier"` // "NORMAL" (<24h), "WARNING" (24-48h), "HIGH_DELAY" (48-72h), "CRITICAL" (>72h)
	IsDelayedHubAlert bool              `json:"is_delayed_hub_alert"`
}

// FulfillmentQueueSummary provides aggregated pipeline counts for the fulfillment hub.
type FulfillmentQueueSummary struct {
	TotalQueueCount   int `json:"total_queue_count"`
	UrgentCount       int `json:"urgent_count"`
	ReadyToShipCount  int `json:"ready_to_ship_count"`
	PrintPendingCount int `json:"print_pending_count"`
	DelayedAlertCount int `json:"delayed_alert_count"`
}

// FulfillmentQueueResponse provides the prioritized queue list and summary statistics.
type FulfillmentQueueResponse struct {
	Items   []FulfillmentQueueItem  `json:"items"`
	Summary FulfillmentQueueSummary `json:"summary"`
	Total   int                     `json:"total"`
	Page    int                     `json:"page"`
	Limit   int                     `json:"limit"`
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

// PaginatedOrdersResponse wraps listed orders with pagination metadata and status counts.
type PaginatedOrdersResponse struct {
	Orders       []storeModels.Order `json:"orders"`
	StatusCounts map[string]int      `json:"status_counts,omitempty"`
	Total        int                 `json:"total"`
	Page         int                 `json:"page"`
	Limit        int                 `json:"limit"`
}

// CaptureAbandonedCheckoutRequest represents silent background telemetry from storefront checkout.
type CaptureAbandonedCheckoutRequest struct {
	SessionToken  string                 `json:"session_token"`
	Phone         string                 `json:"phone"`
	CustomerName  string                 `json:"customer_name"`
	CustomerEmail string                 `json:"customer_email"`
	District      string                 `json:"district"`
	Thana         string                 `json:"thana"`
	Address       string                 `json:"address"`
	CartItems     []storeModels.CartItem `json:"cart_items"`
	CartTotal     float64                `json:"cart_total"`
}

// UpdateAbandonedStatusRequest allows tele-sales staff to record call outcomes and follow-ups.
type UpdateAbandonedStatusRequest struct {
	Status              storeModels.AbandonedCheckoutStatus `json:"status"`
	CallNotes           string                              `json:"call_notes"`
	ScheduledCallbackAt *time.Time                          `json:"scheduled_callback_at,omitempty"`
}

// ConvertAbandonedToOrderRequest initiates 1-click order genesis from tele-sales.
type ConvertAbandonedToOrderRequest struct {
	CustomerName  *string `json:"customer_name,omitempty"`
	Phone         *string `json:"phone,omitempty"`
	CustomerEmail *string `json:"customer_email,omitempty"`
	District      *string `json:"district,omitempty"`
	Thana         *string `json:"thana,omitempty"`
	Address       *string `json:"address,omitempty"`
	PaymentMethod string  `json:"payment_method,omitempty"` // default "COD"
	Notes         string  `json:"notes,omitempty"`
}

// AbandonedCheckoutsSummary provides pipeline counts for tele-sales.
type AbandonedCheckoutsSummary struct {
	TotalCount          int `json:"total_count"`
	PendingCount        int `json:"pending_count"`
	CalledBusyCount     int `json:"called_busy_count"`
	CalledFollowupCount int `json:"called_followup_count"`
	DeclinedCount       int `json:"declined_count"`
	ConvertedCount      int `json:"converted_count"`
}

// PaginatedAbandonedResponse returns paginated abandoned carts with summary counts.
type PaginatedAbandonedResponse struct {
	Items   []storeModels.AbandonedCheckout `json:"items"`
	Summary AbandonedCheckoutsSummary       `json:"summary"`
	Total   int                             `json:"total"`
	Page    int                             `json:"page"`
	Limit   int                             `json:"limit"`
}

// OrderPulseAgingSummary aggregates orders stuck by aging buckets and blockers.
type OrderPulseAgingSummary struct {
	TotalDelayedCount int            `json:"total_delayed_count"`
	Aging24to48hCount int            `json:"aging_24_to_48h_count"`
	Aging48to72hCount int            `json:"aging_48_to_72h_count"`
	CriticalOver72h   int            `json:"critical_over_72h_count"`
	BlockerCounts     map[string]int `json:"blocker_counts"`
}

// OrderPulseCancellationSummary aggregates pre vs post dispatch cancellation causes.
type OrderPulseCancellationSummary struct {
	PreDispatchCount   int            `json:"pre_dispatch_count"`
	PostDispatchCount  int            `json:"post_dispatch_count"`
	PreDispatchCauses  map[string]int `json:"pre_dispatch_causes"`
	PostDispatchCauses map[string]int `json:"post_dispatch_causes"`
	TopPreReason       string         `json:"top_pre_reason"`
	FrictionRate       float64        `json:"friction_rate"`
}

// CatalogRDMatrixItem represents SKU defect and return diagnostics.
type CatalogRDMatrixItem struct {
	VariantID        string         `json:"variant_id"`
	SKU              string         `json:"sku"`
	ProductTitle     string         `json:"product_title"`
	VariantTitle     string         `json:"variant_title"`
	ImageURL         *string        `json:"image_url,omitempty"`
	ReturnedQuantity int            `json:"returned_quantity"`
	PrimaryRootCause string         `json:"primary_root_cause"`
	ReasonBreakdown  map[string]int `json:"reason_breakdown"`
}

// OrderPulseDiagnosticsResponse provides the complete OrderPulse intelligence suite payload.
type OrderPulseDiagnosticsResponse struct {
	AgingSummary        OrderPulseAgingSummary        `json:"aging_summary"`
	CancellationSummary OrderPulseCancellationSummary `json:"cancellation_summary"`
	PartialRecoveredBDT float64                       `json:"partial_recovered_bdt"`
	PartialCount        int                           `json:"partial_count"`
	TopPartialReason    string                        `json:"top_partial_reason"`
	CatalogRDMatrix     []CatalogRDMatrixItem         `json:"catalog_rd_matrix"`
}

// UpdateOrderPulseTagRequest allows staff to tag blockers or root causes inline.
type UpdateOrderPulseTagRequest struct {
	DelayBlockerReason    *string `json:"delay_blocker_reason,omitempty"`
	CancellationRootCause *string `json:"cancellation_root_cause,omitempty"`
	ReturnRootCause       *string `json:"return_root_cause,omitempty"`
}

// PartialSplitItem defines accepted vs returned allocation for an item.
type PartialSplitItem struct {
	ItemID       string  `json:"item_id"`
	Action       string  `json:"action"` // "ACCEPT" or "RETURN"
	ReturnReason *string `json:"return_reason,omitempty"`
}

// PartialSplitRequest separates accepted cash items from returned items in an order.
type PartialSplitRequest struct {
	Items []PartialSplitItem `json:"items"`
	Notes string             `json:"notes,omitempty"`
}
