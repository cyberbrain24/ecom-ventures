// Package models defines strongly typed domain entities reflecting a brand's isolated PostgreSQL database.
package models

import (
	"time"
)

// ProductStatus defines lifecycle state in catalog management.
type ProductStatus string

const (
	ProductStatusDraft    ProductStatus = "DRAFT"
	ProductStatusActive   ProductStatus = "ACTIVE"
	ProductStatusArchived ProductStatus = "ARCHIVED"
)

// Category represents a hierarchical taxonomy category for store products.
type Category struct {
	ID              string     `json:"id"`
	ParentID        *string    `json:"parent_id,omitempty"`
	Name            string     `json:"name"`
	Slug            string     `json:"slug"`
	Description     string     `json:"description,omitempty"`
	ImageURL        string     `json:"image_url,omitempty"`
	DisplayOrder    int        `json:"display_order"`
	IsActive        bool       `json:"is_active"`
	MetaTitle       string     `json:"meta_title,omitempty"`
	MetaDescription string     `json:"meta_description,omitempty"`
	FocusKeyword    string     `json:"focus_keyword,omitempty"`
	CanonicalURL    string     `json:"canonical_url,omitempty"`
	MetaRobots      string     `json:"meta_robots,omitempty"`
	OGImageURL      string     `json:"og_image_url,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	Children        []Category `json:"children,omitempty"`
}

// Attribute defines a variation dimension (e.g. Size, Color, Fragrance Notes).
type Attribute struct {
	ID          string           `json:"id"`
	Name        string           `json:"name"`
	Code        string           `json:"code"`
	DataType    string           `json:"data_type"`    // text, number, boolean, select
	DisplayType string           `json:"display_type"` // text, color, image, button, select
	SortOrder   int              `json:"sort_order"`
	Values      []AttributeValue `json:"values,omitempty"`
	CreatedAt   time.Time        `json:"created_at"`
	UpdatedAt   time.Time        `json:"updated_at"`
}

// AttributeValue defines an individual selectable value belonging to an Attribute.
type AttributeValue struct {
	ID           string    `json:"id"`
	AttributeID  string    `json:"attribute_id"`
	Value        string    `json:"value"`
	DisplayValue string    `json:"display_value"`
	ColorHex     *string   `json:"color_hex,omitempty"`
	ImageURL     string    `json:"image_url,omitempty"`
	SortOrder    int       `json:"sort_order"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// ProductImage represents a media gallery asset mapped to a product.
type ProductImage struct {
	ID        string    `json:"id"`
	ProductID string    `json:"product_id"`
	URL       string    `json:"url"`
	AltText   string    `json:"alt_text,omitempty"`
	SortOrder int       `json:"sort_order"`
	IsPrimary bool      `json:"is_primary"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Product represents the parent catalog entity.
type Product struct {
	ID                string           `json:"id"`
	CategoryID        *string          `json:"category_id,omitempty"`
	Title             string           `json:"title"`
	Slug              string           `json:"slug"`
	Summary           string           `json:"summary,omitempty"`
	Description       string           `json:"description,omitempty"`
	Status            ProductStatus    `json:"status"`
	FeaturedImageURL  string           `json:"featured_image_url,omitempty"`
	BasePrice         float64          `json:"base_price"`
	CompareAtPrice    *float64         `json:"compare_at_price,omitempty"`
	SKU               string           `json:"sku,omitempty"`
	IsFeatured        bool             `json:"is_featured"`
	SortOrder         int              `json:"sort_order"`
	FeaturedOrder     int              `json:"featured_order"`
	BrandID           *string          `json:"brand_id,omitempty"`
	CareInstructionID *string          `json:"care_instruction_id,omitempty"`
	VideoURL          string           `json:"video_url,omitempty"`
	VideoAutoplay     bool             `json:"video_autoplay"`
	VideoMuted        bool             `json:"video_muted"`
	CostPrice         *float64         `json:"cost_price,omitempty"`
	OptionLayout      string           `json:"product_option_layout,omitempty"`
	SizeGuideTemplate string           `json:"size_guide_template,omitempty"`
	CategoryIDs       []string         `json:"category_ids,omitempty"`
	MetaTitle         string           `json:"meta_title,omitempty"`
	MetaDescription   string           `json:"meta_description,omitempty"`
	FocusKeyword      string           `json:"focus_keyword,omitempty"`
	CanonicalURL      string           `json:"canonical_url,omitempty"`
	MetaRobots        string           `json:"meta_robots,omitempty"`
	OGImageURL        string           `json:"og_image_url,omitempty"`
	Images            []ProductImage   `json:"images,omitempty"`
	Variants          []ProductVariant `json:"variants,omitempty"`
	CreatedAt         time.Time        `json:"created_at"`
	UpdatedAt         time.Time        `json:"updated_at"`
}

// ProductVariant represents a distinct, purchaseable SKU item in the inventory matrix.
type ProductVariant struct {
	ID             string           `json:"id"`
	ProductID      string           `json:"product_id"`
	SKU            string           `json:"sku"`
	Barcode        *string          `json:"barcode,omitempty"`
	Title          string           `json:"title"`
	Price          float64          `json:"price"`
	CompareAtPrice *float64         `json:"compare_at_price,omitempty"`
	CostPrice      *float64         `json:"cost_price,omitempty"`
	WeightGrams    float64          `json:"weight_grams"`
	IsActive       bool             `json:"is_active"`
	Attributes     []AttributeValue `json:"attributes,omitempty"`
	Inventory      *VariantStock    `json:"inventory,omitempty"`
	CreatedAt      time.Time        `json:"created_at"`
	UpdatedAt      time.Time        `json:"updated_at"`
}
