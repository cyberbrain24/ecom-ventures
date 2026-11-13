// Package promotions provides domain logic, database operations, and HTTP APIs
// for managing coupon codes, multi-item bundle tiers, and cart promotion evaluations.
package promotions

import "time"

// BundleTier represents a multi-item combo discount tier (e.g. Duo, Trio, 4 Pack, 5 Pack).
type BundleTier struct {
	ID                 string    `json:"id"`
	Name               string    `json:"name"`
	RequiredItemsCount int       `json:"required_items_count"`
	DiscountPercentage float64   `json:"discount_percentage"`
	BadgeText          string    `json:"badge_text"`
	Subtitle           string    `json:"subtitle"`
	Perks              []string  `json:"perks"`
	HasFreeDelivery    bool      `json:"has_free_delivery"`
	DisplayOrder       int       `json:"display_order"`
	IsActive           bool      `json:"is_active"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

// CreateBundleTierRequest defines payload to register a new bundle tier.
type CreateBundleTierRequest struct {
	Name               string   `json:"name"`
	RequiredItemsCount int      `json:"required_items_count"`
	DiscountPercentage float64  `json:"discount_percentage"`
	BadgeText          string   `json:"badge_text"`
	Subtitle           string   `json:"subtitle"`
	Perks              []string `json:"perks"`
	HasFreeDelivery    bool     `json:"has_free_delivery"`
	DisplayOrder       int      `json:"display_order"`
	IsActive           bool     `json:"is_active"`
}

// UpdateBundleTierRequest defines payload to modify an existing bundle tier.
type UpdateBundleTierRequest struct {
	Name               string   `json:"name"`
	RequiredItemsCount int      `json:"required_items_count"`
	DiscountPercentage float64  `json:"discount_percentage"`
	BadgeText          string   `json:"badge_text"`
	Subtitle           string   `json:"subtitle"`
	Perks              []string `json:"perks"`
	HasFreeDelivery    bool     `json:"has_free_delivery"`
	DisplayOrder       int      `json:"display_order"`
	IsActive           bool     `json:"is_active"`
}

// ToggleBundleTierStatusRequest defines payload to toggle active status of a bundle tier.
type ToggleBundleTierStatusRequest struct {
	IsActive bool `json:"is_active"`
}

// BundleCalculationSlot represents a garment slot selected by the customer.
type BundleCalculationSlot struct {
	ProductID string  `json:"product_id"`
	VariantID string  `json:"variant_id"`
	Title     string  `json:"title"`
	UnitPrice float64 `json:"unit_price"`
}

// BundleCalculationResult represents calculated bundle pricing breakdown.
type BundleCalculationResult struct {
	TierID             string                  `json:"tier_id"`
	TierName           string                  `json:"tier_name"`
	DiscountPercentage float64                 `json:"discount_percentage"`
	OriginalTotal      float64                 `json:"original_total"`
	DiscountAmount     float64                 `json:"discount_amount"`
	FinalTotal         float64                 `json:"final_total"`
	HasFreeDelivery    bool                    `json:"has_free_delivery"`
	Items              []BundleCalculationItem `json:"items"`
}

// BundleCalculationItem represents an individual garment in a bundle with pro-rated discount.
type BundleCalculationItem struct {
	ProductID       string  `json:"product_id"`
	VariantID       string  `json:"variant_id"`
	Title           string  `json:"title"`
	OriginalPrice   float64 `json:"original_price"`
	DiscountedPrice float64 `json:"discounted_price"`
	Savings         float64 `json:"savings"`
}
