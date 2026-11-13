// Package inventory provides domain logic, database operations, and HTTP APIs
// for managing real-time stock levels, reservations, and double-entry movement ledgers.
package inventory

import (
	"time"

	storeModels "ecom-ventures/backend/internal/store/models"
)

// AdjustStockRequest defines the payload to alter an SKU's physical inventory.
type AdjustStockRequest struct {
	VariantID      string                          `json:"variant_id"`
	QuantityChange int                             `json:"quantity_change"` // Positive for receipts, negative for shrinkage/adjustments
	Reason         storeModels.StockMovementReason `json:"reason"`
	ReferenceID    *string                         `json:"reference_id,omitempty"`
	Notes          string                          `json:"notes,omitempty"`
}

// BatchStockAdjustmentRequest defines the payload for multi-SKU inventory intake or count.
type BatchStockAdjustmentRequest struct {
	Adjustments []AdjustStockRequest `json:"adjustments"`
}

// ReserveStockRequest defines payload to lock stock for an order or active cart checkout.
type ReserveStockRequest struct {
	VariantID string `json:"variant_id"`
	Quantity  int    `json:"quantity"`
	OrderID   string `json:"order_id"`
}

// FulfillStockRequest commits the stock decrement after an order is processed or shipped.
type FulfillStockRequest struct {
	VariantID string `json:"variant_id"`
	Quantity  int    `json:"quantity"`
	OrderID   string `json:"order_id"`
}

// ReleaseStockRequest unlocks reserved stock when an order is cancelled or checkout expires.
type ReleaseStockRequest struct {
	VariantID string `json:"variant_id"`
	Quantity  int    `json:"quantity"`
	OrderID   string `json:"order_id"`
}

// UpdateThresholdRequest defines payload to configure SKU low-stock alert boundaries.
type UpdateThresholdRequest struct {
	LowStockThreshold int `json:"low_stock_threshold"`
}

// InventoryItemSummary represents comprehensive stock metrics for store admin tables.
type InventoryItemSummary struct {
	VariantID         string    `json:"variant_id"`
	ProductID         string    `json:"product_id"`
	SKU               string    `json:"sku"`
	ProductTitle      string    `json:"product_title"`
	VariantTitle      string    `json:"variant_title"`
	QuantityOnHand    int       `json:"quantity_on_hand"`
	QuantityReserved  int       `json:"quantity_reserved"`
	QuantityAvailable int       `json:"quantity_available"` // QuantityOnHand - QuantityReserved
	LowStockThreshold int       `json:"low_stock_threshold"`
	IsLowStock        bool      `json:"is_low_stock"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// InventoryFilterParams defines query parameters for paginated stock searches.
type InventoryFilterParams struct {
	Search     string
	IsLowStock *bool
	Page       int
	Limit      int
}

// StockMovementFilterParams defines query parameters for auditing movement ledgers.
type StockMovementFilterParams struct {
	VariantID *string
	Reason    *storeModels.StockMovementReason
	Page      int
	Limit     int
}

// PaginatedInventoryResponse wraps listed inventory items with pagination metadata.
type PaginatedInventoryResponse struct {
	Items []InventoryItemSummary `json:"items"`
	Total int                    `json:"total"`
	Page  int                    `json:"page"`
	Limit int                    `json:"limit"`
}

// PaginatedMovementsResponse wraps audited stock movements with pagination metadata.
type PaginatedMovementsResponse struct {
	Movements []storeModels.StockMovement `json:"movements"`
	Total     int                         `json:"total"`
	Page      int                         `json:"page"`
	Limit     int                         `json:"limit"`
}
