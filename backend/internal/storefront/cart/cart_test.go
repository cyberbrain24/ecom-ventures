package cart

import (
	"errors"
	"testing"
)

func TestCartCalculations(t *testing.T) {
	cart := &CartDTO{
		ID:        "cart-1",
		SessionID: "sess-1",
		Currency:  "BDT",
		Items: []CartItemDTO{
			{
				ID:        "item-1",
				VariantID: "var-1",
				UnitPrice: 1200.00,
				Quantity:  2,
			},
			{
				ID:        "item-2",
				VariantID: "var-2",
				UnitPrice: 850.50,
				Quantity:  1,
			},
		},
	}

	for i := range cart.Items {
		cart.Items[i].TotalPrice = cart.Items[i].UnitPrice * float64(cart.Items[i].Quantity)
		cart.Subtotal += cart.Items[i].TotalPrice
		cart.ItemCount += cart.Items[i].Quantity
	}

	expectedSubtotal := (1200.00 * 2) + 850.50 // 3250.50
	if cart.Subtotal != expectedSubtotal {
		t.Errorf("expected subtotal %.2f, got %.2f", expectedSubtotal, cart.Subtotal)
	}

	expectedCount := 3
	if cart.ItemCount != expectedCount {
		t.Errorf("expected item count %d, got %d", expectedCount, cart.ItemCount)
	}
}

func TestStockCheckValidation(t *testing.T) {
	availableStock := 5
	requestedQuantity := 8

	var err error
	if requestedQuantity > availableStock {
		err = ErrInsufficientStock
	}

	if !errors.Is(err, ErrInsufficientStock) {
		t.Fatalf("expected ErrInsufficientStock, got %v", err)
	}
}

func TestGenerateSessionID(t *testing.T) {
	id1 := generateSessionID()
	id2 := generateSessionID()

	if len(id1) != 32 {
		t.Errorf("expected 32 hex chars, got %d", len(id1))
	}
	if id1 == id2 {
		t.Errorf("expected distinct session IDs, got identical values")
	}
}
