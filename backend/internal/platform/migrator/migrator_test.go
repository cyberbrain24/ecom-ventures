package migrator

import (
	"context"
	"testing"
)

func TestMigratorNew(t *testing.T) {
	mgr := New(nil, "../infra/migrations/platform")
	if mgr == nil {
		t.Fatal("expected non-nil Migrator instance from New()")
	}
	if mgr.migrationsPath != "../infra/migrations/platform" {
		t.Errorf("expected migrationsPath '../infra/migrations/platform', got %s", mgr.migrationsPath)
	}
}

func TestMigratorInvalidDirectory(t *testing.T) {
	mgr := New(nil, "/non_existent_migrations_dir_xyz")
	ctx := context.Background()

	// Calling EnsureSchemaTable on nil DB must fail
	err := mgr.EnsureSchemaTable(ctx)
	if err == nil {
		t.Fatal("expected error on EnsureSchemaTable with nil DB, got nil")
	}

	err = mgr.Up(ctx)
	if err == nil {
		t.Fatal("expected error on Up() with nil DB, got nil")
	}

	err = mgr.Down(ctx)
	if err == nil {
		t.Fatal("expected error on Down() with nil DB, got nil")
	}
}
