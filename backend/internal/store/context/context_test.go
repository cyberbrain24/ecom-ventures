package context

import (
	"context"
	"testing"

	"ecom-ventures/backend/internal/platform/models"
)

func TestStoreContextPropagation(t *testing.T) {
	dummyStore := &models.Store{
		ID:   "00000000-0000-0000-0000-000000000001",
		Slug: "mior-fashion",
		Name: "Mior Fashion",
	}

	sc := &StoreContext{
		Store:    dummyStore,
		Domain:   "mior.localhost",
		IsCustom: false,
	}

	ctx := WithStoreContext(context.Background(), sc)

	retrieved, err := GetStoreContext(ctx)
	if err != nil {
		t.Fatalf("unexpected error getting store context: %v", err)
	}

	if retrieved.Store.ID != dummyStore.ID {
		t.Errorf("expected store ID %s, got %s", dummyStore.ID, retrieved.Store.ID)
	}

	storeID, err := GetStoreID(ctx)
	if err != nil || storeID != dummyStore.ID {
		t.Errorf("expected GetStoreID %s, got %s", dummyStore.ID, storeID)
	}

	slug, err := GetStoreSlug(ctx)
	if err != nil || slug != dummyStore.Slug {
		t.Errorf("expected GetStoreSlug %s, got %s", dummyStore.Slug, slug)
	}
}

func TestStoreContextNotFound(t *testing.T) {
	ctx := context.Background()

	_, err := GetStoreContext(ctx)
	if err != ErrStoreContextNotFound {
		t.Fatalf("expected ErrStoreContextNotFound, got: %v", err)
	}

	_, err = GetTenantDB(ctx)
	if err != ErrStoreContextNotFound {
		t.Fatalf("expected ErrStoreContextNotFound on GetTenantDB, got: %v", err)
	}
}

func TestMustGetStoreContextPanics(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Fatalf("expected panic on MustGetStoreContext with empty context")
		}
	}()

	MustGetStoreContext(context.Background())
}
