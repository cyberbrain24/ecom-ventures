package settings

import (
	"context"
	"testing"
)

func TestTaxCalculationFormula(t *testing.T) {
	taxRate := 7.5 // 7.5%
	subtotal := 2000.00

	taxAmount := (subtotal * taxRate) / 100.0
	expectedTax := 150.00
	if taxAmount != expectedTax {
		t.Errorf("expected tax %.2f, got %.2f", expectedTax, taxAmount)
	}

	// Test prices include tax formula: Base = Price / (1 + Rate)
	grossPrice := 107.50
	netPrice := grossPrice / (1.0 + (taxRate / 100.0))
	if netPrice != 100.00 {
		t.Errorf("expected net price 100.00, got %.2f", netPrice)
	}
}

func TestStoreRoleConstants(t *testing.T) {
	roles := []StoreRole{RoleStoreOwner, RoleStoreAdmin, RoleStoreStaff}
	for _, r := range roles {
		if r == "" {
			t.Errorf("role must not be empty string")
		}
	}
}

func TestUpdateSettingsValidation(t *testing.T) {
	service := &Service{}
	ctx := context.Background()

	// Tax rate > 100
	_, err := service.UpdateSettings(ctx, &UpdateSettingsRequest{
		TaxRatePercent: 120.0,
	})
	if err == nil {
		t.Errorf("expected error for tax rate > 100%%")
	}

	// Tax rate < 0
	_, err = service.UpdateSettings(ctx, &UpdateSettingsRequest{
		TaxRatePercent: -5.0,
	})
	if err == nil {
		t.Errorf("expected error for negative tax rate")
	}

	// Negative shipping fee
	_, err = service.UpdateSettings(ctx, &UpdateSettingsRequest{
		TaxRatePercent:     10.0,
		DefaultShippingFee: -10.0,
	})
	if err == nil {
		t.Errorf("expected error for negative shipping fee")
	}
}

func TestCreateStaffValidation(t *testing.T) {
	service := &Service{}
	ctx := context.Background()

	// Empty email
	_, err := service.CreateStaff(ctx, &CreateStaffRequest{
		Email:    "",
		Password: "password123",
	})
	if err == nil {
		t.Errorf("expected error for empty staff email")
	}

	// Short password
	_, err = service.CreateStaff(ctx, &CreateStaffRequest{
		Email:    "staff@example.com",
		Password: "short",
	})
	if err == nil {
		t.Errorf("expected error for short staff password")
	}
}
