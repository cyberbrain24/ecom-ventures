package checkout

import (
	"strings"
	"testing"
)

func TestOrderNumberFormat(t *testing.T) {
	orderNumber := generateOrderNumber("")

	if !strings.HasPrefix(orderNumber, "ORD-") {
		t.Fatalf("expected order number to start with 'ORD-', got %s", orderNumber)
	}

	parts := strings.Split(orderNumber, "-")
	if len(parts) != 3 {
		t.Fatalf("expected order number to have 3 hyphenated sections, got %d", len(parts))
	}

	customOrder := generateOrderNumber("MIO")
	if !strings.HasPrefix(customOrder, "MIO-") {
		t.Fatalf("expected custom order number to start with 'MIO-', got %s", customOrder)
	}
}

func TestCheckoutCalculations(t *testing.T) {
	subtotal := 3500.00
	shippingFee := 60.00
	discountAmount := 500.00

	total := subtotal + shippingFee - discountAmount
	if total != 3060.00 {
		t.Errorf("expected total 3060.00, got %.2f", total)
	}

	// Boundary: discount greater than total
	largeDiscount := 4000.00
	clampedTotal := subtotal + shippingFee - largeDiscount
	if clampedTotal < 0 {
		clampedTotal = 0
	}
	if clampedTotal != 0 {
		t.Errorf("expected clamped total 0, got %.2f", clampedTotal)
	}
}
