package platform

import (
	"context"
	"testing"
)

func TestMemoryRegistry(t *testing.T) {
	reg := NewMemoryRegistry()
	ctx := context.Background()

	// Verify baseline seed store
	s, err := reg.GetBySlug(ctx, "mior")
	if err != nil {
		t.Fatalf("expected store mior to exist: %v", err)
	}
	if s.Name != "Mior Fashion" {
		t.Errorf("expected name 'Mior Fashion', got %q", s.Name)
	}

	// Verify domain mapping
	byDomain, err := reg.GetByDomain(ctx, "mior.com")
	if err != nil {
		t.Fatalf("expected domain mior.com to resolve: %v", err)
	}
	if byDomain.ID != s.ID {
		t.Errorf("expected store ID %q, got %q", s.ID, byDomain.ID)
	}

	// Verify not found
	_, err = reg.GetBySlug(ctx, "nonexistent")
	if err == nil {
		t.Fatal("expected error for nonexistent store slug")
	}

	// Verify listing
	stores, err := reg.ListStores(ctx)
	if err != nil {
		t.Fatalf("unexpected error listing stores: %v", err)
	}
	if len(stores) < 2 {
		t.Errorf("expected at least 2 seeded stores, got %d", len(stores))
	}
}
