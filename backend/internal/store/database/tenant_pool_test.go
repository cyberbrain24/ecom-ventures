package database

import (
	"context"
	"testing"
	"time"

	"ecom-ventures/backend/internal/platform/models"
)

func TestTenantPoolNilStore(t *testing.T) {
	mgr := NewTenantPoolManager(10, 5, 5*time.Minute)
	_, err := mgr.GetOrOpen(context.Background(), nil, "password")
	if err == nil {
		t.Fatalf("expected error when store is nil, got nil")
	}
}

func TestTenantPoolInvalidCredentials(t *testing.T) {
	mgr := NewTenantPoolManager(10, 5, 5*time.Minute)
	fakeStore := &models.Store{
		ID:        "00000000-0000-0000-0000-000000000001",
		Slug:      "test-store",
		DBHost:    "localhost",
		DBPort:    5433,
		DBName:    "non_existent_db_xyz",
		DBUser:    "store_prototype_user",
		DBSSLMode: "disable",
	}

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	_, err := mgr.GetOrOpen(ctx, fakeStore, "wrong_password")
	if err == nil {
		t.Fatalf("expected error connecting to non-existent database, got nil")
	}
}

func TestTenantPoolManagerCloseAll(t *testing.T) {
	mgr := NewTenantPoolManager(5, 2, 1*time.Minute)
	if count := mgr.ActivePoolsCount(); count != 0 {
		t.Errorf("expected 0 active pools, got %d", count)
	}
	mgr.CloseAll()
	if count := mgr.ActivePoolsCount(); count != 0 {
		t.Errorf("expected 0 active pools after CloseAll, got %d", count)
	}
}

func TestTenantPoolManagerCloseTenantNonExistent(t *testing.T) {
	mgr := NewTenantPoolManager(5, 2, 1*time.Minute)
	err := mgr.CloseTenant("non-existent-id")
	if err != nil {
		t.Errorf("expected nil error closing non-existent tenant, got %v", err)
	}
}
