// Package catalog provides domain logic, database operations, and HTTP APIs
// for managing product taxonomy, listings, and media assets.
package catalog

import (
	storeModels "ecom-ventures/backend/internal/store/models"
)

// CreateCategoryRequest defines the payload to register a taxonomy node.
type CreateCategoryRequest struct {
	ParentID        *string `json:"parent_id,omitempty"`
	Name            string  `json:"name"`
	Slug            string  `json:"slug"`
	Description     string  `json:"description,omitempty"`
	ImageURL        string  `json:"image_url,omitempty"`
	DisplayOrder    int     `json:"display_order"`
	IsActive        *bool   `json:"is_active,omitempty"`
	MetaTitle       string  `json:"meta_title,omitempty"`
	MetaDescription string  `json:"meta_description,omitempty"`
	FocusKeyword    string  `json:"focus_keyword,omitempty"`
	CanonicalURL    string  `json:"canonical_url,omitempty"`
	MetaRobots      string  `json:"meta_robots,omitempty"`
}

// UpdateCategoryRequest defines payload to modify an existing category.
type UpdateCategoryRequest struct {
	ParentID        *string `json:"parent_id,omitempty"`
	Name            string  `json:"name"`
	Slug            string  `json:"slug"`
	Description     string  `json:"description,omitempty"`
	ImageURL        string  `json:"image_url,omitempty"`
	DisplayOrder    int     `json:"display_order"`
	IsActive        bool    `json:"is_active"`
	MetaTitle       string  `json:"meta_title,omitempty"`
	MetaDescription string  `json:"meta_description,omitempty"`
	FocusKeyword    string  `json:"focus_keyword,omitempty"`
	CanonicalURL    string  `json:"canonical_url,omitempty"`
	MetaRobots      string  `json:"meta_robots,omitempty"`
}

// CreateProductRequest defines payload to create a new base product.
type CreateProductRequest struct {
	CategoryID       *string  `json:"category_id,omitempty"`
	Title            string   `json:"title"`
	Slug             string   `json:"slug"`
	Summary          string   `json:"summary,omitempty"`
	Description      string   `json:"description,omitempty"`
	Status           string   `json:"status"` // DRAFT, ACTIVE, ARCHIVED
	FeaturedImageURL string   `json:"featured_image_url,omitempty"`
	BasePrice        float64  `json:"base_price"`
	CompareAtPrice   *float64 `json:"compare_at_price,omitempty"`
	SKU              string   `json:"sku,omitempty"`
	IsFeatured       bool     `json:"is_featured"`
	MetaTitle        string   `json:"meta_title,omitempty"`
	MetaDescription  string   `json:"meta_description,omitempty"`
	FocusKeyword     string   `json:"focus_keyword,omitempty"`
	CanonicalURL     string   `json:"canonical_url,omitempty"`
	MetaRobots       string   `json:"meta_robots,omitempty"`
	OGImageURL       string   `json:"og_image_url,omitempty"`
}

// UpdateProductRequest defines payload to modify base product properties.
type UpdateProductRequest struct {
	CategoryID       *string  `json:"category_id,omitempty"`
	Title            string   `json:"title"`
	Slug             string   `json:"slug"`
	Summary          string   `json:"summary,omitempty"`
	Description      string   `json:"description,omitempty"`
	Status           string   `json:"status"`
	FeaturedImageURL string   `json:"featured_image_url,omitempty"`
	BasePrice        float64  `json:"base_price"`
	CompareAtPrice   *float64 `json:"compare_at_price,omitempty"`
	SKU              string   `json:"sku,omitempty"`
	IsFeatured       bool     `json:"is_featured"`
	MetaTitle        string   `json:"meta_title,omitempty"`
	MetaDescription  string   `json:"meta_description,omitempty"`
	FocusKeyword     string   `json:"focus_keyword,omitempty"`
	CanonicalURL     string   `json:"canonical_url,omitempty"`
	MetaRobots       string   `json:"meta_robots,omitempty"`
	OGImageURL       string   `json:"og_image_url,omitempty"`
}

// ProductFilterParams defines query parameters for searching and paginating catalog items.
type ProductFilterParams struct {
	CategoryID *string
	Status     string
	Search     string
	MinPrice   *float64
	MaxPrice   *float64
	IsFeatured *bool
	Page       int
	Limit      int
}

// AttachImageRequest defines parameters for registering uploaded media to a product.
type AttachImageRequest struct {
	URL       string `json:"url"`
	AltText   string `json:"alt_text,omitempty"`
	SortOrder int    `json:"sort_order"`
	IsPrimary bool   `json:"is_primary"`
}

// ReorderImagesRequest updates gallery asset sequence.
type ReorderImagesRequest struct {
	ImageIDs []string `json:"image_ids"`
}

// CategoryTreeNode represents a hierarchical taxonomy category with nested children.
type CategoryTreeNode struct {
	storeModels.Category
	Children []CategoryTreeNode `json:"children"`
}
