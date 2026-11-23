// Package catalog provides domain models, matrix generation logic, and HTTP APIs
// for managing dynamic attributes, SKU matrices, and variant pricing.
package catalog

import (
	storeModels "ecom-ventures/backend/internal/store/models"
)

// CreateAttributeRequest defines payload to create an attribute dimension.
type CreateAttributeRequest struct {
	Name        string                        `json:"name"`
	Code        string                        `json:"code"`
	DataType    string                        `json:"data_type"`    // text, number, boolean, select
	DisplayType string                        `json:"display_type"` // text, color, image, button, select
	SortOrder   int                           `json:"sort_order"`
	Values      []CreateAttributeValueRequest `json:"values,omitempty"`
}

// CreateAttributeValueRequest defines an option value within an attribute.
type CreateAttributeValueRequest struct {
	Value        string  `json:"value"`
	DisplayValue string  `json:"display_value"`
	ColorHex     *string `json:"color_hex,omitempty"`
	ImageURL     string  `json:"image_url,omitempty"`
	SortOrder    int     `json:"sort_order"`
}

// UpdateAttributeRequest defines payload to modify an existing attribute dimension.
type UpdateAttributeRequest struct {
	Name        string                        `json:"name"`
	DataType    string                        `json:"data_type"`
	DisplayType string                        `json:"display_type"`
	SortOrder   int                           `json:"sort_order"`
	Values      []CreateAttributeValueRequest `json:"values,omitempty"`
}

// AttributeSelector represents an attribute and selected values for variant matrix generation.
type AttributeSelector struct {
	AttributeID string   `json:"attribute_id"`
	ValueIDs    []string `json:"value_ids"`
}

// GenerateMatrixRequest defines the input payload to compute a Cartesian variant matrix.
type GenerateMatrixRequest struct {
	Attributes []AttributeSelector `json:"attributes"`
	BasePrice  *float64            `json:"base_price,omitempty"` // Overrides parent base price if provided
	SKUPrefix  *string             `json:"sku_prefix,omitempty"` // Overrides parent base SKU if provided
}

// GeneratedVariantProposal represents a pre-computed variant item from Cartesian permutation.
type GeneratedVariantProposal struct {
	Title             string   `json:"title"`
	SKU               string   `json:"sku"`
	Price             float64  `json:"price"`
	CompareAtPrice    *float64 `json:"compare_at_price,omitempty"`
	CostPrice         *float64 `json:"cost_price,omitempty"`
	WeightGrams       float64  `json:"weight_grams"`
	AttributeValueIDs []string `json:"attribute_value_ids"`
}

// BatchInsertMatrixRequest persists pre-computed or customized variant proposals.
type BatchInsertMatrixRequest struct {
	Variants []CreateVariantRequest `json:"variants"`
}

// CreateVariantRequest defines payload to manually add a single variant SKU.
type CreateVariantRequest struct {
	SKU               string   `json:"sku"`
	Barcode           *string  `json:"barcode,omitempty"`
	Title             string   `json:"title"`
	Price             float64  `json:"price"`
	CompareAtPrice    *float64 `json:"compare_at_price,omitempty"`
	CostPrice         *float64 `json:"cost_price,omitempty"`
	WeightGrams       float64  `json:"weight_grams"`
	IsActive          bool     `json:"is_active"`
	AttributeValueIDs []string `json:"attribute_value_ids"`
	ImageIDs          []string `json:"image_ids,omitempty"`
}

// UpdateVariantRequest defines payload to modify variant pricing, SKU, and weight.
type UpdateVariantRequest struct {
	SKU            string   `json:"sku"`
	Barcode        *string  `json:"barcode,omitempty"`
	Title          string   `json:"title"`
	Price          float64  `json:"price"`
	CompareAtPrice *float64 `json:"compare_at_price,omitempty"`
	CostPrice      *float64 `json:"cost_price,omitempty"`
	WeightGrams    float64  `json:"weight_grams"`
	IsActive       bool     `json:"is_active"`
}

// BatchUpdateVariantsRequest defines payload for bulk updating multiple SKUs.
type BatchUpdateVariantsRequest struct {
	VariantIDs     []string `json:"variant_ids"`
	Price          *float64 `json:"price,omitempty"`
	CompareAtPrice *float64 `json:"compare_at_price,omitempty"`
	IsActive       *bool    `json:"is_active,omitempty"`
}

// BindVariantImagesRequest maps gallery image IDs to a variant SKU.
type BindVariantImagesRequest struct {
	ImageIDs []string `json:"image_ids"`
}

// VariantDetailResponse represents a variant with its bound attribute values and images.
type VariantDetailResponse struct {
	storeModels.ProductVariant
	Attributes []storeModels.AttributeValue `json:"attributes"`
	Images     []storeModels.ProductImage   `json:"images"`
}

// AttributeDetailResponse represents an attribute dimension with its registered values.
type AttributeDetailResponse struct {
	storeModels.Attribute
	Values []storeModels.AttributeValue `json:"values"`
}
