// Package cart provides domain logic and HTTP APIs for persistent shopping carts.
package cart

import (
	"time"
)

// CartItemDTO represents an item line inside a shopping cart.
type CartItemDTO struct {
	ID                string  `json:"id"`
	VariantID         string  `json:"variant_id"`
	ProductID         string  `json:"product_id"`
	ProductTitle      string  `json:"product_title"`
	VariantTitle      string  `json:"variant_title"`
	SKU               string  `json:"sku"`
	ImageURL          string  `json:"image_url"`
	UnitPrice         float64 `json:"unit_price"`
	Quantity          int     `json:"quantity"`
	TotalPrice        float64 `json:"total_price"`
	AvailableQuantity int     `json:"available_quantity"`
}

// CartDTO represents the active shopping cart state.
type CartDTO struct {
	ID        string        `json:"id"`
	SessionID string        `json:"session_id"`
	Currency  string        `json:"currency"`
	Items     []CartItemDTO `json:"items"`
	ItemCount int           `json:"item_count"`
	Subtotal  float64       `json:"subtotal"`
	UpdatedAt time.Time     `json:"updated_at"`
}

// AddCartItemRequest defines payload to add a product variant to the cart.
type AddCartItemRequest struct {
	VariantID string `json:"variant_id"`
	Quantity  int    `json:"quantity"`
}

// UpdateCartItemRequest defines payload to adjust the quantity of an existing cart item.
type UpdateCartItemRequest struct {
	Quantity int `json:"quantity"`
}
