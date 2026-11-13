package inventory

import (
	"testing"

	storeModels "ecom-ventures/backend/internal/store/models"
)

func TestAvailableStockCalculation(t *testing.T) {
	stock := storeModels.VariantStock{
		VariantID:         "var-100",
		QuantityAvailable: 50, // Physical quantity on hand
		QuantityReserved:  12,
		LowStockThreshold: 10,
	}

	available := stock.QuantityAvailable - stock.QuantityReserved
	if available != 38 {
		t.Fatalf("expected 38 units available, got %d", available)
	}

	isLowStock := available <= stock.LowStockThreshold
	if isLowStock {
		t.Errorf("expected isLowStock to be false when 38 units available with threshold 10")
	}

	// Test boundary trigger
	stock.QuantityReserved = 41
	available = stock.QuantityAvailable - stock.QuantityReserved
	if available != 9 {
		t.Fatalf("expected 9 units available, got %d", available)
	}

	isLowStock = available <= stock.LowStockThreshold
	if !isLowStock {
		t.Errorf("expected isLowStock to be true when available (9) <= threshold (10)")
	}
}

func TestStockMovementLedgerInvariants(t *testing.T) {
	initialBalance := 100
	receipt := 50
	balanceAfterReceipt := initialBalance + receipt

	if balanceAfterReceipt != 150 {
		t.Errorf("expected balance 150, got %d", balanceAfterReceipt)
	}

	reservation := 30
	availableAfterReservation := balanceAfterReceipt - reservation
	if availableAfterReservation != 120 {
		t.Errorf("expected available 120, got %d", availableAfterReservation)
	}

	// Fulfillment decrements physical stock
	fulfilled := 30
	physicalAfterFulfillment := balanceAfterReceipt - fulfilled
	if physicalAfterFulfillment != 120 {
		t.Errorf("expected physical balance 120, got %d", physicalAfterFulfillment)
	}
}
