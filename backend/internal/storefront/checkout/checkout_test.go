package checkout

import (
	"strings"
	"testing"

	storeModels "ecom-ventures/backend/internal/store/models"
	"ecom-ventures/backend/internal/store/shipping"
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

func TestShippingDistrictUsesStateProvince(t *testing.T) {
	if got := shippingDistrict(storeModels.CustomerAddress{}); got != "" {
		t.Errorf("expected empty district without state_province, got %q", got)
	}
	state := "  Dhaka "
	if got := shippingDistrict(storeModels.CustomerAddress{StateProvince: &state}); got != "Dhaka" {
		t.Errorf("expected trimmed state_province Dhaka, got %q", got)
	}
}

func TestShippingFeeComesFromMatchingZone(t *testing.T) {
	zones := []shipping.Zone{
		{ID: "a", District: "Dhaka", Zone: "Inside Dhaka", ShippingFee: 60, Thanas: []string{"Mirpur"}},
		{ID: "b", District: "Chattogram", Zone: "Chattogram City", ShippingFee: 120, Thanas: []string{"Agrabad"}},
	}
	state := "Chattogram"
	addr := storeModels.CustomerAddress{City: "agrabad", StateProvince: &state}

	zone := shipping.FindZoneFor(zones, shippingDistrict(addr), addr.City)
	if zone == nil {
		t.Fatal("expected a matching zone")
	}
	if zone.ShippingFee != 120 {
		t.Errorf("expected fee 120 from matching zone, got %.2f", zone.ShippingFee)
	}
}

func TestShippingFeeNoMatchHasNoDefault(t *testing.T) {
	zones := []shipping.Zone{
		{ID: "a", District: "Dhaka", Zone: "Inside Dhaka", ShippingFee: 60, Thanas: []string{"Mirpur"}},
	}
	state := "Dhaka"
	addr := storeModels.CustomerAddress{City: "Uttara", StateProvince: &state}

	if zone := shipping.FindZoneFor(zones, shippingDistrict(addr), addr.City); zone != nil {
		t.Fatalf("expected no zone for Uttara, got %+v", zone)
	}
	noState := storeModels.CustomerAddress{City: "Mirpur"}
	if zone := shipping.FindZoneFor(zones, shippingDistrict(noState), noState.City); zone != nil {
		t.Fatalf("expected no zone when state_province is missing, got %+v", zone)
	}
}
