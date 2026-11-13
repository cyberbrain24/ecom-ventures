// Package catalog provides public domain models and HTTP APIs for storefront
// product discovery, category hierarchy browsing, and faceted filtering.
package catalog

import (
	"time"

	storeModels "ecom-ventures/backend/internal/store/models"
)

// PublicCategoryNode represents a public taxonomy node with nested subcategories.
type PublicCategoryNode struct {
	ID              string               `json:"id"`
	ParentID        *string              `json:"parent_id,omitempty"`
	Name            string               `json:"name"`
	Slug            string               `json:"slug"`
	Description     string               `json:"description,omitempty"`
	ImageURL        string               `json:"image_url,omitempty"`
	DisplayOrder    int                  `json:"display_order"`
	MetaTitle       string               `json:"meta_title,omitempty"`
	MetaDescription string               `json:"meta_description,omitempty"`
	FocusKeyword    string               `json:"focus_keyword,omitempty"`
	CanonicalURL    string               `json:"canonical_url,omitempty"`
	MetaRobots      string               `json:"meta_robots,omitempty"`
	Children        []PublicCategoryNode `json:"children,omitempty"`
}

// PublicProductCard represents sanitized product information tailored for storefront catalog grids.
type PublicProductCard struct {
	ID               string    `json:"id"`
	Title            string    `json:"title"`
	Slug             string    `json:"slug"`
	Summary          string    `json:"summary,omitempty"`
	FeaturedImageURL string    `json:"featured_image_url"`
	BasePrice        float64   `json:"base_price"`
	CompareAtPrice   *float64  `json:"compare_at_price,omitempty"`
	HasDiscount      bool      `json:"has_discount"`
	DiscountPercent  int       `json:"discount_percent,omitempty"`
	InStock          bool      `json:"in_stock"`
	TotalVariants    int       `json:"total_variants"`
	CategorySlug     *string   `json:"category_slug,omitempty"`
	CategoryName     *string   `json:"category_name,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
}

// StorefrontFilterParams encapsulates URL query parameters for catalog searching and faceted filtering.
type StorefrontFilterParams struct {
	Search       string
	CategorySlug string
	MinPrice     *float64
	MaxPrice     *float64
	InStockOnly  bool
	Sort         string // "featured", "price_asc", "price_desc", "newest"
	Page         int
	Limit        int
}

// StorefrontCatalogResponse wraps listed products with faceted count metadata and pagination.
type StorefrontCatalogResponse struct {
	Products   []PublicProductCard `json:"products"`
	Total      int                 `json:"total"`
	Page       int                 `json:"page"`
	Limit      int                 `json:"limit"`
	TotalPages int                 `json:"total_pages"`
	MinPrice   float64             `json:"min_price"`
	MaxPrice   float64             `json:"max_price"`
}

// PublicVariantDetail represents an individual purchasable SKU with live availability.
type PublicVariantDetail struct {
	ID                string   `json:"id"`
	SKU               string   `json:"sku"`
	Title             string   `json:"title"`
	Price             float64  `json:"price"`
	CompareAtPrice    *float64 `json:"compare_at_price,omitempty"`
	WeightGrams       float64  `json:"weight_grams"`
	InStock           bool     `json:"in_stock"`
	AvailableQuantity int      `json:"available_quantity"`
	AttributeValueIDs []string `json:"attribute_value_ids"`
	ImageIDs          []string `json:"image_ids"`
}

// PublicAttributeOption represents a selectable variation axis (e.g. Color, Size).
type PublicAttributeOption struct {
	ID          string                       `json:"id"`
	Name        string                       `json:"name"`
	Code        string                       `json:"code"`
	DisplayType string                       `json:"display_type"` // SELECT, COLOR_SWATCH, BUTTON
	Values      []storeModels.AttributeValue `json:"values"`
}

// PublicProductDetail represents the complete aggregate payload for the PDP.
type PublicProductDetail struct {
	ID               string                     `json:"id"`
	Title            string                     `json:"title"`
	Slug             string                     `json:"slug"`
	SKU              string                     `json:"sku,omitempty"`
	Summary          string                     `json:"summary,omitempty"`
	Description      string                     `json:"description,omitempty"`
	BasePrice        float64                    `json:"base_price"`
	CompareAtPrice   *float64                   `json:"compare_at_price,omitempty"`
	FeaturedImageURL string                     `json:"featured_image_url"`
	CategorySlug     *string                    `json:"category_slug,omitempty"`
	CategoryName     *string                    `json:"category_name,omitempty"`
	MetaTitle        string                     `json:"meta_title,omitempty"`
	MetaDescription  string                     `json:"meta_description,omitempty"`
	FocusKeyword     string                     `json:"focus_keyword,omitempty"`
	CanonicalURL     string                     `json:"canonical_url,omitempty"`
	MetaRobots       string                     `json:"meta_robots,omitempty"`
	OGImageURL       string                     `json:"og_image_url,omitempty"`
	Images           []storeModels.ProductImage `json:"images"`
	Attributes       []PublicAttributeOption    `json:"attributes"`
	Variants         []PublicVariantDetail      `json:"variants"`
	CreatedAt        time.Time                  `json:"created_at"`
}
