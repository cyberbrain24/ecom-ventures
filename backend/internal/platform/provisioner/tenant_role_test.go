package provisioner

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"errors"
	"regexp"
	"strings"
	"testing"

	"ecom-ventures/backend/internal/platform/models"
)

// fakeAdmin records cluster admin statements in order and fails any statement that contains failOn.
type fakeAdmin struct {
	stmts   []string
	failOn  string
	failErr error
}

func (f *fakeAdmin) ExecContext(_ context.Context, query string, _ ...any) (sql.Result, error) {
	f.stmts = append(f.stmts, query)
	if f.failOn != "" && strings.Contains(query, f.failOn) {
		if f.failErr != nil {
			return nil, f.failErr
		}
		return nil, errors.New("boom")
	}
	return driver.RowsAffected(0), nil
}

// indexOf returns the position of the first recorded statement containing substr, or -1.
func (f *fakeAdmin) indexOf(substr string) int {
	for i, s := range f.stmts {
		if strings.Contains(s, substr) {
			return i
		}
	}
	return -1
}

const (
	testRole     = "user_testshop_0a1b2c3d"
	testDBName   = "store_testshop_abcd1234"
	testPassword = "0123456789abcdef0123456789abcdef"
)

func newTestProvisioner(t *testing.T, admin *fakeAdmin, migrationsPath string) *Provisioner {
	t.Helper()
	p, err := NewProvisioner(nil, nil, migrationsPath, make([]byte, 32))
	if err != nil {
		t.Fatalf("unexpected provisioner initialization error: %v", err)
	}
	p.admin = admin
	return p
}

func testStore() *models.Store {
	return &models.Store{
		ID:        "00000000-0000-0000-0000-000000000001",
		Name:      "Test Shop",
		DBName:    testDBName,
		DBUser:    testRole,
		DBHost:    "localhost",
		DBPort:    5432,
		DBSSLMode: "disable",
	}
}

func TestNewTenantRoleNameFormat(t *testing.T) {
	cases := []string{"testshop", "mior", "brand-a", "perfume-house-bd", strings.Repeat("a", 80)}
	for _, slug := range cases {
		name, err := NewTenantRoleName(slug)
		if err != nil {
			t.Fatalf("NewTenantRoleName(%q) returned error: %v", slug, err)
		}
		if !validTenantRole.MatchString(name) {
			t.Errorf("NewTenantRoleName(%q) = %q, does not match tenant role pattern", slug, name)
		}
		if !validDBIdentifier.MatchString(name) {
			t.Errorf("NewTenantRoleName(%q) = %q, is not a valid identifier", slug, name)
		}
		if len(name) > 63 {
			t.Errorf("NewTenantRoleName(%q) = %q has %d bytes, limit is 63", slug, name, len(name))
		}
		if !strings.HasPrefix(name, "user_") {
			t.Errorf("NewTenantRoleName(%q) = %q, missing user_ prefix", slug, name)
		}
	}
}

func TestNewTenantRoleNameShape(t *testing.T) {
	name, err := NewTenantRoleName("testshop")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.HasPrefix(name, "user_testshop_") || len(name) != len("user_testshop_")+8 {
		t.Fatalf("unexpected role name %q", name)
	}
	hexSuffix := name[len(name)-8:]
	if !regexpHex8.MatchString(hexSuffix) {
		t.Errorf("suffix %q is not 8 lowercase hex characters", hexSuffix)
	}
}

func TestNewTenantRoleNameHyphenatedSlug(t *testing.T) {
	name, err := NewTenantRoleName("perfume-house")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.HasPrefix(name, "user_perfume_house_") {
		t.Fatalf("hyphens must become underscores, got %q", name)
	}
}

func TestNewTenantRoleNameRejectsUnsafeSlug(t *testing.T) {
	if _, err := NewTenantRoleName("bad'slug; DROP"); err == nil {
		t.Fatal("expected error for slug with SQL metacharacters")
	}
}

func TestNewTenantRoleNamesAreUnique(t *testing.T) {
	a, err := NewTenantRoleName("testshop")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	b, err := NewTenantRoleName("testshop")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if a == b {
		t.Fatalf("two generated role names collided: %q", a)
	}
}

func TestTenantPasswordFormat(t *testing.T) {
	if !validTenantPassword.MatchString(testPassword) {
		t.Fatal("expected 32 lowercase hex characters to be accepted")
	}
	for _, bad := range []string{"", "short", "0123456789ABCDEF0123456789ABCDEF", "0123456789abcdef0123456789abcde'", strings.Repeat("g", 32)} {
		if validTenantPassword.MatchString(bad) {
			t.Errorf("password %q should be rejected", bad)
		}
	}
}

func TestProvisionRejectsInvalidRoleAndPassword(t *testing.T) {
	admin := &fakeAdmin{}
	p := newTestProvisioner(t, admin, "path")

	store := testStore()
	store.DBUser = "platform_user"
	if err := p.ProvisionStoreDatabase(context.Background(), store, testPassword); err == nil {
		t.Fatal("expected error for shared platform role")
	}

	store = testStore()
	if err := p.ProvisionStoreDatabase(context.Background(), store, "not-hex-password"); err == nil {
		t.Fatal("expected error for non-hex password")
	}
	if len(admin.stmts) != 0 {
		t.Fatalf("no cluster statements should run for invalid input, got %v", admin.stmts)
	}
}

func TestProvisionCreatesRoleBeforeDatabaseOwnedByRole(t *testing.T) {
	admin := &fakeAdmin{failOn: ""}
	p := newTestProvisioner(t, admin, "does-not-exist")

	// The migrations path does not exist, so the run fails after the database is created,
	// which exercises the full compensation path without opening a tenant connection.
	err := p.ProvisionStoreDatabase(context.Background(), testStore(), testPassword)
	if err == nil {
		t.Fatal("expected migration failure")
	}

	createRole := admin.indexOf("CREATE ROLE " + testRole + " LOGIN PASSWORD '" + testPassword + "'")
	createDB := admin.indexOf("CREATE DATABASE " + testDBName + " ENCODING 'UTF8' TEMPLATE template1 OWNER " + testRole)
	if createRole < 0 || createDB < 0 || createRole > createDB {
		t.Fatalf("expected CREATE ROLE before CREATE DATABASE OWNER, statements: %v", admin.stmts)
	}
}

func TestProvisionCompensationDropsDatabaseThenRole(t *testing.T) {
	admin := &fakeAdmin{failOn: ""}
	p := newTestProvisioner(t, admin, "does-not-exist")

	err := p.ProvisionStoreDatabase(context.Background(), testStore(), testPassword)
	if err == nil {
		t.Fatal("expected migration failure")
	}

	dropDB := admin.indexOf("DROP DATABASE IF EXISTS " + testDBName)
	dropRole := admin.indexOf("DROP ROLE IF EXISTS " + testRole)
	if dropDB < 0 || dropRole < 0 {
		t.Fatalf("expected DROP DATABASE and DROP ROLE, statements: %v", admin.stmts)
	}
	if dropDB > dropRole {
		t.Fatalf("database must be dropped before its role, statements: %v", admin.stmts)
	}
}

func TestProvisionCreateDatabaseFailureDropsOnlyRole(t *testing.T) {
	admin := &fakeAdmin{failOn: "CREATE DATABASE"}
	p := newTestProvisioner(t, admin, "does-not-exist")

	err := p.ProvisionStoreDatabase(context.Background(), testStore(), testPassword)
	if err == nil {
		t.Fatal("expected create database failure")
	}
	if admin.indexOf("DROP DATABASE IF EXISTS") >= 0 {
		t.Fatalf("database was never created and must not be dropped, statements: %v", admin.stmts)
	}
	if admin.indexOf("DROP ROLE IF EXISTS "+testRole) < 0 {
		t.Fatalf("role must be dropped after failed database creation, statements: %v", admin.stmts)
	}
}

func TestProvisionCleanupErrorsAreReturned(t *testing.T) {
	admin := &fakeAdmin{failOn: "DROP ROLE", failErr: errors.New("role still owns objects")}
	p := newTestProvisioner(t, admin, "does-not-exist")

	err := p.ProvisionStoreDatabase(context.Background(), testStore(), testPassword)
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "failed to drop tenant role") {
		t.Fatalf("role drop failure must be included in the returned error, got: %v", err)
	}
}

func TestProvisionPermissionDeniedHintsAtCreateRole(t *testing.T) {
	admin := &fakeAdmin{failOn: "CREATE ROLE", failErr: errors.New("pq: permission denied to create role")}
	p := newTestProvisioner(t, admin, "does-not-exist")

	err := p.ProvisionStoreDatabase(context.Background(), testStore(), testPassword)
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "CREATEROLE and CREATEDB") {
		t.Fatalf("expected CREATEROLE hint in error, got: %v", err)
	}
}

func TestDropStoreDatabaseOrderAndSkipsLegacyRole(t *testing.T) {
	admin := &fakeAdmin{}
	p := newTestProvisioner(t, admin, "path")

	if err := p.DropStoreDatabase(context.Background(), testDBName, testRole); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	dropDB := admin.indexOf("DROP DATABASE IF EXISTS " + testDBName)
	dropRole := admin.indexOf("DROP ROLE IF EXISTS " + testRole)
	if dropDB < 0 || dropRole < 0 || dropDB > dropRole {
		t.Fatalf("expected database dropped before role, statements: %v", admin.stmts)
	}

	legacy := &fakeAdmin{}
	p = newTestProvisioner(t, legacy, "path")
	if err := p.DropStoreDatabase(context.Background(), testDBName, "platform_user"); err != nil {
		t.Fatalf("unexpected error for legacy store: %v", err)
	}
	for _, s := range legacy.stmts {
		if strings.Contains(s, "DROP ROLE") {
			t.Fatalf("legacy shared role must never be dropped, got %q", s)
		}
	}
}

func TestDropStoreDatabaseFailureKeepsRole(t *testing.T) {
	admin := &fakeAdmin{failOn: "DROP DATABASE"}
	p := newTestProvisioner(t, admin, "path")

	if err := p.DropStoreDatabase(context.Background(), testDBName, testRole); err == nil {
		t.Fatal("expected error when database drop fails")
	}
	if admin.indexOf("DROP ROLE") >= 0 {
		t.Fatalf("role must not be dropped while its database still exists, statements: %v", admin.stmts)
	}
}

var regexpHex8 = regexp.MustCompile(`^[0-9a-f]{8}$`)
