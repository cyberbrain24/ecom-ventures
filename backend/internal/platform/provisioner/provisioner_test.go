package provisioner

import (
	"context"
	"testing"

	"ecom-ventures/backend/internal/platform/models"
)

func TestProvisionerInvalidKeySize(t *testing.T) {
	shortKey := []byte("invalid-length")
	_, err := NewProvisioner(nil, nil, "path", shortKey)
	if err == nil {
		t.Fatalf("expected error on invalid key size, got nil")
	}
}

func TestProvisionerInvalidDatabaseName(t *testing.T) {
	key := make([]byte, 32)
	p, err := NewProvisioner(nil, nil, "path", key)
	if err != nil {
		t.Fatalf("unexpected provisioner initialization error: %v", err)
	}

	invalidStore := &models.Store{
		ID:     "00000000-0000-0000-0000-000000000001",
		DBName: "DROP TABLE stores; --", // Malicious identifier attempt
	}

	err = p.ProvisionStoreDatabase(context.Background(), invalidStore, "password")
	if err == nil {
		t.Fatalf("expected validation error on SQL injection attempt in DBName, got nil")
	}
}

func TestProvisionerDropInvalidDatabaseName(t *testing.T) {
	key := make([]byte, 32)
	p, err := NewProvisioner(nil, nil, "path", key)
	if err != nil {
		t.Fatalf("unexpected provisioner initialization error: %v", err)
	}

	err = p.DropStoreDatabase(context.Background(), "invalid-db-name;DROP--", "user_testshop_0a1b2c3d")
	if err == nil {
		t.Fatalf("expected error on invalid db name in DropStoreDatabase, got nil")
	}
}
