package store_mgmt

import (
	"context"
	"testing"
)

func TestSlugRegexValidation(t *testing.T) {
	validSlugs := []string{"mior", "brand-a", "perfume-house-bd", "baby-clothing-123"}
	for _, slug := range validSlugs {
		if !slugRegex.MatchString(slug) {
			t.Errorf("expected valid slug for %q, got invalid", slug)
		}
	}

	invalidSlugs := []string{"Mior", "brand_a", "perfume--house", "-leading-dash", "trailing-dash-", "space in slug"}
	for _, slug := range invalidSlugs {
		if slugRegex.MatchString(slug) {
			t.Errorf("expected invalid slug for %q, got valid", slug)
		}
	}
}

func TestUpdateStoreStatusValidation(t *testing.T) {
	s := &Service{}
	ctx := context.Background()

	err := s.UpdateStoreStatus(ctx, "00000000-0000-0000-0000-000000000001", UpdateStoreStatusRequest{
		Status: "INVALID_STATUS_XYZ",
	}, "user-1")

	if err != ErrInvalidStatus {
		t.Fatalf("expected ErrInvalidStatus, got: %v", err)
	}
}

func TestCreateStoreInputValidation(t *testing.T) {
	s := &Service{}
	ctx := context.Background()

	// Test 1: Invalid slug format
	_, err := s.CreateStore(ctx, &CreateStoreRequest{
		Name: "Test Store",
		Slug: "Invalid_Slug!",
	}, "user-1")
	if err == nil {
		t.Fatal("expected error for invalid slug format, got nil")
	}

	// Test 2: Missing required fields
	_, err = s.CreateStore(ctx, &CreateStoreRequest{
		Name: "",
		Slug: "valid-slug",
	}, "user-1")
	if err == nil {
		t.Fatal("expected error for missing name, got nil")
	}

	// Test 3: Missing owner credentials
	_, err = s.CreateStore(ctx, &CreateStoreRequest{
		Name:         "Brand X",
		Slug:         "brand-x",
		ContactEmail: "contact@brandx.com",
		InitialOwner: OwnerCredentials{
			Email:    "",
			Password: "",
		},
	}, "user-1")
	if err == nil {
		t.Fatal("expected error for missing owner credentials, got nil")
	}
}
