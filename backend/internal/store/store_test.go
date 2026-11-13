package store

import (
	"context"
	"testing"
)

func TestTenantContext(t *testing.T) {
	ctx := context.Background()

	// Extracting from empty context must return error
	_, err := FromContext(ctx)
	if err == nil {
		t.Fatal("expected error when tenant context is missing")
	}

	expected := TenantContext{
		StoreID:   "store-123",
		StoreSlug: "mior",
		DBName:    "ecom_store_mior",
		DBHost:    "localhost",
		DBPort:    5432,
	}

	enriched := WithTenantContext(ctx, expected)
	actual, err := FromContext(enriched)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if actual.StoreID != expected.StoreID {
		t.Errorf("expected StoreID %q, got %q", expected.StoreID, actual.StoreID)
	}
	if actual.StoreSlug != expected.StoreSlug {
		t.Errorf("expected StoreSlug %q, got %q", expected.StoreSlug, actual.StoreSlug)
	}
	if actual.DBName != expected.DBName {
		t.Errorf("expected DBName %q, got %q", expected.DBName, actual.DBName)
	}
}
