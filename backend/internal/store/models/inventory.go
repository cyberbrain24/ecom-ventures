package models

import (
	"time"
)

// StockMovementReason defines standardized audit reasons for inventory changes.
type StockMovementReason string

const (
	ReasonPurchaseReceipt          StockMovementReason = "PURCHASE_RECEIPT"
	ReasonOrderReservation         StockMovementReason = "ORDER_RESERVATION"
	ReasonOrderFulfillment         StockMovementReason = "ORDER_FULFILLMENT"
	ReasonOrderCancellationRestock StockMovementReason = "ORDER_CANCELLATION_RESTOCK"
	ReasonReturnRestock            StockMovementReason = "RETURN_RESTOCK"
	ReasonManualAdjustment         StockMovementReason = "MANUAL_ADJUSTMENT"
	ReasonDamagedWriteOff          StockMovementReason = "DAMAGED_WRITE_OFF"
	ReasonInventoryCount           StockMovementReason = "INVENTORY_COUNT"
)

// VariantStock represents current physical and reserved inventory for an individual SKU.
type VariantStock struct {
	VariantID         string    `json:"variant_id"`
	QuantityAvailable int       `json:"quantity_available"`
	QuantityReserved  int       `json:"quantity_reserved"`
	LowStockThreshold int       `json:"low_stock_threshold"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// StockMovement represents an immutable ledger entry recording quantity adjustments.
type StockMovement struct {
	ID             string              `json:"id"`
	VariantID      string              `json:"variant_id"`
	QuantityChange int                 `json:"quantity_change"`
	BalanceAfter   int                 `json:"balance_after"`
	Reason         StockMovementReason `json:"reason"`
	ReferenceID    *string             `json:"reference_id,omitempty"`
	PerformedBy    string              `json:"performed_by"`
	Notes          string              `json:"notes,omitempty"`
	CreatedAt      time.Time           `json:"created_at"`
}
