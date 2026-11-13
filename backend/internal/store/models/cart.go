package models

import (
	"time"
)

// Cart represents an active shopping session on a brand storefront.
type Cart struct {
	ID           string     `json:"id"`
	CustomerID   *string    `json:"customer_id,omitempty"`
	SessionToken string     `json:"session_token"`
	Currency     string     `json:"currency"`
	CouponCode   *string    `json:"coupon_code,omitempty"`
	Items        []CartItem `json:"items,omitempty"`
	ExpiresAt    time.Time  `json:"expires_at"`
	CreatedAt    time.Time  `json:"created_at"`
	UpdatedAt    time.Time  `json:"updated_at"`
}

// CartItem represents an itemized product variant placed in a shopping cart.
type CartItem struct {
	ID        string          `json:"id"`
	CartID    string          `json:"cart_id"`
	VariantID string          `json:"variant_id"`
	Quantity  int             `json:"quantity"`
	UnitPrice float64         `json:"unit_price"`
	Variant   *ProductVariant `json:"variant,omitempty"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

// Total calculates the aggregated price of all items in the cart.
func (c *Cart) Total() float64 {
	var total float64
	for _, item := range c.Items {
		total += float64(item.Quantity) * item.UnitPrice
	}
	return total
}
