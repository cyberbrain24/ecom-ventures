// Package promotions provides domain logic, database operations, and HTTP APIs
// for managing coupon codes, discount rules, and cart promotion evaluations.
package promotions

import (
	"time"
)

// DiscountType defines the calculation method applied to the order subtotal.
type DiscountType string

const (
	// DiscountTypePercentage applies a percentage discount (e.g., 15% off) with an optional max cap.
	DiscountTypePercentage DiscountType = "PERCENTAGE"
	// DiscountTypeFixedAmount deducts an exact monetary value from the subtotal.
	DiscountTypeFixedAmount DiscountType = "FIXED_AMOUNT"
	// DiscountTypeFreeShipping sets the order shipping fee to 0.00 while preserving subtotal.
	DiscountTypeFreeShipping DiscountType = "FREE_SHIPPING"
)

// Coupon represents a store-scoped promotional voucher.
type Coupon struct {
	ID                 string       `json:"id"`
	Code               string       `json:"code"`
	Description        string       `json:"description,omitempty"`
	DiscountType       DiscountType `json:"discount_type"`
	DiscountValue      float64      `json:"discount_value"`
	MinSubtotal        float64      `json:"min_subtotal"`
	MaxDiscountAmount  *float64     `json:"max_discount_amount,omitempty"`
	MaxUses            int          `json:"max_uses"` // 0 indicates unlimited uses
	MaxUsesPerCustomer int          `json:"max_uses_per_customer"`
	TimesUsed          int          `json:"times_used"`
	ValidFrom          time.Time    `json:"valid_from"`
	ValidTo            time.Time    `json:"valid_to"`
	IsActive           bool         `json:"is_active"`
	CreatedAt          time.Time    `json:"created_at"`
	UpdatedAt          time.Time    `json:"updated_at"`
}

// CouponUsage represents an immutable audit record of a redeemed coupon.
type CouponUsage struct {
	ID             string    `json:"id"`
	CouponID       string    `json:"coupon_id"`
	OrderID        string    `json:"order_id"`
	CustomerID     *string   `json:"customer_id,omitempty"`
	CustomerEmail  string    `json:"customer_email"`
	DiscountAmount float64   `json:"discount_amount"`
	CreatedAt      time.Time `json:"created_at"`
}

// CreateCouponRequest defines payload to register a promotional coupon.
type CreateCouponRequest struct {
	Code               string       `json:"code"`
	Description        string       `json:"description,omitempty"`
	DiscountType       DiscountType `json:"discount_type"`
	DiscountValue      float64      `json:"discount_value"`
	MinSubtotal        float64      `json:"min_subtotal"`
	MaxDiscountAmount  *float64     `json:"max_discount_amount,omitempty"`
	MaxUses            int          `json:"max_uses"`
	MaxUsesPerCustomer int          `json:"max_uses_per_customer"`
	ValidFrom          time.Time    `json:"valid_from"`
	ValidTo            time.Time    `json:"valid_to"`
	IsActive           bool         `json:"is_active"`
}

// UpdateCouponRequest defines payload to modify mutable coupon properties.
type UpdateCouponRequest struct {
	Description        string    `json:"description,omitempty"`
	MinSubtotal        float64   `json:"min_subtotal"`
	MaxDiscountAmount  *float64  `json:"max_discount_amount,omitempty"`
	MaxUses            int       `json:"max_uses"`
	MaxUsesPerCustomer int       `json:"max_uses_per_customer"`
	ValidFrom          time.Time `json:"valid_from"`
	ValidTo            time.Time `json:"valid_to"`
	IsActive           bool      `json:"is_active"`
}

// ValidateCouponRequest represents an active cart snapshot submitted for discount verification.
type ValidateCouponRequest struct {
	Code          string  `json:"code"`
	Subtotal      float64 `json:"subtotal"`
	ShippingFee   float64 `json:"shipping_fee"`
	CustomerID    *string `json:"customer_id,omitempty"`
	CustomerEmail string  `json:"customer_email"`
}

// ValidateCouponResponse represents the evaluated discount breakdown for checkout.
type ValidateCouponResponse struct {
	IsValid          bool         `json:"is_valid"`
	Code             string       `json:"code"`
	DiscountType     DiscountType `json:"discount_type"`
	DiscountAmount   float64      `json:"discount_amount"`
	FinalSubtotal    float64      `json:"final_subtotal"`
	FinalShippingFee float64      `json:"final_shipping_fee"`
	Message          string       `json:"message"`
}

// CouponFilterParams defines query filters for listing coupons.
type CouponFilterParams struct {
	Search   string
	IsActive *bool
	Page     int
	Limit    int
}

// PaginatedCouponsResponse wraps listed coupons with pagination metadata.
type PaginatedCouponsResponse struct {
	Coupons []Coupon `json:"coupons"`
	Total   int      `json:"total"`
	Page    int      `json:"page"`
	Limit   int      `json:"limit"`
}
