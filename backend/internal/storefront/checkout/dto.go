// Package checkout provides domain logic and HTTP APIs for storefront
// checkout submission, atomic order creation, and public order tracking.
package checkout

import (
	"time"

	storeModels "ecom-ventures/backend/internal/store/models"
)

// CheckoutRequest defines payload submitted by shopper to finalize an order.
type CheckoutRequest struct {
	SessionID       string                       `json:"session_id"`
	CustomerID      *string                      `json:"customer_id,omitempty"`
	CustomerEmail   string                       `json:"customer_email"`
	CustomerPhone   string                       `json:"customer_phone"`
	CustomerName    string                       `json:"customer_name"`
	ShippingAddress storeModels.CustomerAddress  `json:"shipping_address"`
	BillingAddress  *storeModels.CustomerAddress `json:"billing_address,omitempty"`
	PaymentMethod   string                       `json:"payment_method"` // COD, BKASH, NAGAD, SSLCOMMERZ
	CouponCode      *string                      `json:"coupon_code,omitempty"`
	Notes           string                       `json:"notes,omitempty"`
}

// CheckoutReceiptItem represents a line item on the customer receipt.
type CheckoutReceiptItem struct {
	VariantID    string  `json:"variant_id"`
	ProductTitle string  `json:"product_title"`
	VariantTitle string  `json:"variant_title"`
	SKU          string  `json:"sku"`
	UnitPrice    float64 `json:"unit_price"`
	Quantity     int     `json:"quantity"`
	TotalPrice   float64 `json:"total_price"`
}

// CheckoutReceiptResponse represents the confirmed order payload returned upon successful placement.
type CheckoutReceiptResponse struct {
	ID              string                      `json:"id"`
	OrderNumber     string                      `json:"order_number"`
	CustomerEmail   string                      `json:"customer_email"`
	CustomerPhone   string                      `json:"customer_phone"`
	Status          storeModels.OrderStatus     `json:"status"`
	PaymentStatus   storeModels.PaymentStatus   `json:"payment_status"`
	PaymentMethod   string                      `json:"payment_method"`
	Currency        string                      `json:"currency"`
	Subtotal        float64                     `json:"subtotal"`
	ShippingFee     float64                     `json:"shipping_fee"`
	DiscountAmount  float64                     `json:"discount_amount"`
	TotalAmount     float64                     `json:"total_amount"`
	ShippingAddress storeModels.CustomerAddress `json:"shipping_address"`
	Items           []CheckoutReceiptItem       `json:"items"`
	CreatedAt       time.Time                   `json:"created_at"`
}

// OrderLookupRequest defines payload to query public order status securely.
type OrderLookupRequest struct {
	OrderNumber   string `json:"order_number"`
	ContactVerify string `json:"contact_verify"` // Email or phone verification
}
