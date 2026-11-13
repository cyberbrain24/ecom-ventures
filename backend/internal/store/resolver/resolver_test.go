package resolver

import (
	"context"
	"testing"

	"ecom-ventures/backend/internal/platform/models"
	"ecom-ventures/backend/pkg/crypto"
)

func TestCleanHostString(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"mior.localhost:8080", "mior.localhost"},
		{"DROPiobd.com:443", "dropiobd.com"},
		{"  StoreA.com  ", "storea.com"},
		{"sub.domain.co.uk:3000", "sub.domain.co.uk"},
	}

	for _, tt := range tests {
		got := cleanHostString(tt.input)
		if got != tt.expected {
			t.Errorf("cleanHostString(%q) = %q, expected %q", tt.input, got, tt.expected)
		}
	}
}

func TestExtractSubdomain(t *testing.T) {
	tests := []struct {
		input    string
		expected string
	}{
		{"mior.localhost", "mior"},
		{"branda.dropiobd.com", "branda"},
		{"localhost", ""},
	}

	for _, tt := range tests {
		got := extractSubdomain(tt.input)
		if got != tt.expected {
			t.Errorf("extractSubdomain(%q) = %q, expected %q", tt.input, got, tt.expected)
		}
	}
}

func TestSuspendedStoreRejection(t *testing.T) {
	r := &StoreResolver{
		encryptionKey: make([]byte, 32),
	}

	suspendedStore := &models.Store{
		ID:     "00000000-0000-0000-0000-000000000001",
		Slug:   "suspended-brand",
		Status: models.StoreStatusSuspended,
	}

	_, err := r.buildStoreContext(context.Background(), suspendedStore, "suspended.localhost", false)
	if err != ErrStoreSuspended {
		t.Fatalf("expected ErrStoreSuspended, got: %v", err)
	}
}

func TestArchivedStoreRejection(t *testing.T) {
	r := &StoreResolver{
		encryptionKey: make([]byte, 32),
	}

	archivedStore := &models.Store{
		ID:     "00000000-0000-0000-0000-000000000002",
		Slug:   "archived-brand",
		Status: models.StoreStatusArchived,
	}

	_, err := r.buildStoreContext(context.Background(), archivedStore, "archived.localhost", false)
	if err != ErrStoreArchived {
		t.Fatalf("expected ErrStoreArchived, got: %v", err)
	}
}

func TestNewStoreResolverKeySize(t *testing.T) {
	shortKey := []byte("too-short")
	_, err := NewStoreResolver(nil, nil, nil, shortKey)
	if err != crypto.ErrInvalidKeySize {
		t.Fatalf("expected ErrInvalidKeySize, got: %v", err)
	}
}
