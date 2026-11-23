// Package provisioner executes the automated PostgreSQL database creation, user setup,
// schema migration, and rollback procedures for newly created brands.
//
// Each store gets its own PostgreSQL login role (user_<slug>_<8 hex>) that owns the store's
// database. The role is created through the cluster admin connection with a random 32-character
// hex password, which is stored encrypted on the store row. The platform database user does not
// own tenant databases and is never used for tenant connections.
//
// REQUIREMENT: the platform database user (PLATFORM_DB_USER) must hold CREATEROLE and CREATEDB,
// because it runs CREATE ROLE, CREATE DATABASE ... OWNER, DROP DATABASE and DROP ROLE. On
// PostgreSQL 16 and later, a role that creates another role is also allowed to act as that role
// (membership is granted automatically), which CREATE DATABASE ... OWNER needs. On earlier
// versions an operator must grant that membership manually. This code does not grant any
// privilege itself.
package provisioner

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
	"time"

	"ecom-ventures/backend/internal/platform/models"
	"ecom-ventures/backend/pkg/crypto"
	_ "github.com/lib/pq"
)

var (
	// validDBIdentifier guards every database name before it is interpolated into SQL.
	validDBIdentifier = regexp.MustCompile(`^[a-z0-9_]{3,63}$`)

	// validTenantRole matches role names produced by NewTenantRoleName. The slug part is at most
	// 49 characters so the whole name is at most 63 bytes (5 + 49 + 1 + 8).
	validTenantRole = regexp.MustCompile(`^user_[a-z0-9_]{1,49}_[0-9a-f]{8}$`)

	// validTenantPassword matches the hex password generated for a tenant role. Hex characters
	// contain no quotes, so the password may be inlined in CREATE ROLE after this check.
	validTenantPassword = regexp.MustCompile(`^[0-9a-f]{32}$`)

	// slugCharsRegex matches a slug after hyphens have been converted to underscores.
	slugCharsRegex = regexp.MustCompile(`^[a-z0-9_]+$`)
)

// maxRoleSlugLen is the longest slug part that still fits a tenant role name in 63 bytes.
const maxRoleSlugLen = 49

// clusterAdmin is the subset of *sql.DB used for cluster-level statements. It exists so that
// tests can record the statements issued without a live PostgreSQL server.
type clusterAdmin interface {
	ExecContext(ctx context.Context, query string, args ...any) (sql.Result, error)
}

// Provisioner orchestrates tenant database creation and baseline migrations.
type Provisioner struct {
	platformDB     *sql.DB
	admin          clusterAdmin // Cluster admin connection (e.g. postgres or template db); nil when unavailable
	migrationsPath string
	encryptionKey  []byte
}

// NewProvisioner instantiates an automated database provisioner.
func NewProvisioner(platformDB, adminDB *sql.DB, migrationsPath string, encryptionKey []byte) (*Provisioner, error) {
	if len(encryptionKey) != 32 {
		return nil, crypto.ErrInvalidKeySize
	}
	p := &Provisioner{
		platformDB:     platformDB,
		migrationsPath: migrationsPath,
		encryptionKey:  encryptionKey,
	}
	if adminDB != nil {
		p.admin = adminDB
	}
	return p, nil
}

// NewTenantRoleName returns a new PostgreSQL login role name for a store, shaped
// user_<slug with underscores>_<8 random hex characters>. Hyphens in the slug become underscores,
// and the slug part is truncated so the name fits PostgreSQL's 63-byte identifier limit.
func NewTenantRoleName(slug string) (string, error) {
	base := strings.ReplaceAll(strings.ToLower(slug), "-", "_")
	if !slugCharsRegex.MatchString(base) {
		return "", fmt.Errorf("provisioner: slug %q cannot form a database role name", slug)
	}
	if len(base) > maxRoleSlugLen {
		base = base[:maxRoleSlugLen]
	}
	suffix, err := randomHex(4)
	if err != nil {
		return "", fmt.Errorf("provisioner: generating role suffix: %w", err)
	}
	name := "user_" + base + "_" + suffix
	if !validTenantRole.MatchString(name) {
		return "", fmt.Errorf("provisioner: generated role name %q is invalid", name)
	}
	return name, nil
}

// ProvisionStoreDatabase creates the store's login role and its database owned by that role,
// applies schema, seeds settings, and registers status. On any failure after the role exists, the
// database (if created) is dropped and then the role is dropped; cleanup errors are joined into
// the returned error.
func (p *Provisioner) ProvisionStoreDatabase(ctx context.Context, store *models.Store, rawPassword string) error {
	if !validDBIdentifier.MatchString(store.DBName) {
		return fmt.Errorf("provisioner: invalid database name %q (must be lowercase alphanumeric + underscores, 3-63 chars)", store.DBName)
	}
	if !validTenantRole.MatchString(store.DBUser) {
		return fmt.Errorf("provisioner: invalid tenant role name %q", store.DBUser)
	}
	if !validTenantPassword.MatchString(rawPassword) {
		return fmt.Errorf("provisioner: tenant password must be 32 lowercase hex characters")
	}

	p.logStep(ctx, store.ID, "VALIDATE_SPECIFICATION", 1, "IN_PROGRESS", map[string]string{"db_name": store.DBName})

	// Step 1: Encrypt tenant database password
	encryptedPassword, err := crypto.Encrypt(rawPassword, p.encryptionKey)
	if err != nil {
		p.logStep(ctx, store.ID, "ENCRYPT_CREDENTIALS", 2, "FAILED", map[string]string{"error": err.Error()})
		return fmt.Errorf("provisioner: failed to encrypt store database password: %w", err)
	}
	store.DBPasswordEncrypted = encryptedPassword
	p.logStep(ctx, store.ID, "ENCRYPT_CREDENTIALS", 2, "COMPLETED", map[string]string{"status": "encrypted"})

	if p.admin == nil {
		return fmt.Errorf("provisioner: cluster admin database handle is nil")
	}

	// Step 2: Create the store's login role
	p.logStep(ctx, store.ID, "CREATE_DATABASE_ROLE", 3, "IN_PROGRESS", map[string]string{"role": store.DBUser})
	createRoleSQL := fmt.Sprintf("CREATE ROLE %s LOGIN PASSWORD '%s';", store.DBUser, rawPassword)
	if _, err := p.admin.ExecContext(ctx, createRoleSQL); err != nil {
		err = withPermissionHint(fmt.Errorf("failed to create tenant role %s: %w", store.DBUser, err))
		p.logStep(ctx, store.ID, "CREATE_DATABASE_ROLE", 3, "FAILED", map[string]string{"error": err.Error()})
		return fmt.Errorf("provisioner: %w", err)
	}
	// PostgreSQL 15 and earlier require the creating user to be a member of the owner role
	// before CREATE DATABASE ... OWNER can use it. The role name was validated above, so it is
	// safe to interpolate. CURRENT_USER is the platform admin connection, which owns no tenant data.
	grantSQL := fmt.Sprintf("GRANT %s TO CURRENT_USER;", store.DBUser)
	if _, err := p.admin.ExecContext(ctx, grantSQL); err != nil {
		err = withPermissionHint(fmt.Errorf("failed to grant tenant role %s to the platform user: %w", store.DBUser, err))
		p.logStep(ctx, store.ID, "CREATE_DATABASE_ROLE", 3, "FAILED", map[string]string{"error": err.Error()})
		cleanupErr := p.teardown(ctx, "", store.DBUser, false)
		return fmt.Errorf("provisioner: %w", errors.Join(err, cleanupErr))
	}
	p.logStep(ctx, store.ID, "CREATE_DATABASE_ROLE", 3, "COMPLETED", map[string]string{"role": store.DBUser})

	// Step 3: Create the physical database owned by the store's role
	p.logStep(ctx, store.ID, "CREATE_PHYSICAL_DATABASE", 4, "IN_PROGRESS", map[string]string{"db_name": store.DBName})
	createDBSQL := fmt.Sprintf("CREATE DATABASE %s ENCODING 'UTF8' TEMPLATE template1 OWNER %s;", store.DBName, store.DBUser)
	if _, err := p.admin.ExecContext(ctx, createDBSQL); err != nil {
		err = withPermissionHint(fmt.Errorf("failed to execute physical database creation for %s: %w", store.DBName, err))
		p.logStep(ctx, store.ID, "CREATE_PHYSICAL_DATABASE", 4, "FAILED", map[string]string{"error": err.Error()})
		// The database was not created, so only the role needs removing.
		cleanupErr := p.teardown(ctx, store.DBName, store.DBUser, false)
		return fmt.Errorf("provisioner: %w", errors.Join(err, cleanupErr))
	}
	p.logStep(ctx, store.ID, "CREATE_PHYSICAL_DATABASE", 4, "COMPLETED", map[string]string{"db_name": store.DBName})

	// Step 4: Run baseline migrations against the new tenant database as the store's role
	p.logStep(ctx, store.ID, "APPLY_STORE_MIGRATIONS", 5, "IN_PROGRESS", map[string]string{"migrations_path": p.migrationsPath})
	if err := p.applyMigrations(ctx, store, rawPassword); err != nil {
		p.logStep(ctx, store.ID, "APPLY_STORE_MIGRATIONS", 5, "FAILED", map[string]string{"error": err.Error()})
		log.Printf("provisioner: migration failed for %s, executing rollback compensation...", store.DBName)
		cleanupErr := p.DropStoreDatabase(ctx, store.DBName, store.DBUser)
		return fmt.Errorf("provisioner: migration failed, database and role rolled back: %w", errors.Join(err, cleanupErr))
	}
	p.logStep(ctx, store.ID, "APPLY_STORE_MIGRATIONS", 5, "COMPLETED", map[string]string{"status": "baseline_applied"})

	// Step 5: Seed Initial Store Settings
	p.logStep(ctx, store.ID, "SEED_STORE_SETTINGS", 6, "IN_PROGRESS", map[string]string{"store_name": store.Name})
	if err := p.seedStoreSettings(ctx, store, rawPassword); err != nil {
		p.logStep(ctx, store.ID, "SEED_STORE_SETTINGS", 6, "FAILED", map[string]string{"error": err.Error()})
		cleanupErr := p.DropStoreDatabase(ctx, store.DBName, store.DBUser)
		return fmt.Errorf("provisioner: failed to seed default store settings, database and role rolled back: %w", errors.Join(err, cleanupErr))
	}
	p.logStep(ctx, store.ID, "SEED_STORE_SETTINGS", 6, "COMPLETED", map[string]string{"status": "seeded"})

	p.logStep(ctx, store.ID, "PROVISIONING_COMPLETE", 7, "COMPLETED", map[string]string{"status": "ready"})
	return nil
}

// DropStoreDatabase deletes a store's database and then its login role. The database is dropped
// first because the role owns it. A failed database drop is returned and the role is kept.
//
// Stores created before per-store roles existed use the shared PLATFORM_DB_USER role. That role
// is never dropped: only names produced by NewTenantRoleName are removed, and any other role name
// is logged and skipped.
func (p *Provisioner) DropStoreDatabase(ctx context.Context, dbName, dbRole string) error {
	if !validDBIdentifier.MatchString(dbName) {
		return fmt.Errorf("provisioner: invalid database name %q", dbName)
	}
	if p.admin == nil {
		return fmt.Errorf("provisioner: cluster admin database handle is nil")
	}
	return p.teardown(ctx, dbName, dbRole, true)
}

// teardown drops the database (when dropDB is true) and then the role, in that order.
func (p *Provisioner) teardown(ctx context.Context, dbName, dbRole string, dropDB bool) error {
	if dropDB {
		if err := p.dropDatabase(ctx, dbName); err != nil {
			return err
		}
	}
	return p.dropRole(ctx, dbRole)
}

// dropDatabase force-drops a database after terminating its sessions.
func (p *Provisioner) dropDatabase(ctx context.Context, dbName string) error {
	// Terminate any active connections to the database before dropping
	terminateSQL := fmt.Sprintf(`
		SELECT pg_terminate_backend(pg_stat_activity.pid)
		FROM pg_stat_activity
		WHERE pg_stat_activity.datname = '%s' AND pid <> pg_backend_pid();`, dbName)
	if _, err := p.admin.ExecContext(ctx, terminateSQL); err != nil {
		log.Printf("provisioner: warning - terminating sessions on database %s: %v", dbName, err)
	}

	dropSQL := fmt.Sprintf("DROP DATABASE IF EXISTS %s WITH (FORCE);", dbName)
	if _, err := p.admin.ExecContext(ctx, dropSQL); err != nil {
		log.Printf("provisioner: warning - failed to force drop database %s: %v", dbName, err)
		return fmt.Errorf("provisioner: failed to drop database %s: %w", dbName, err)
	}
	log.Printf("provisioner: successfully dropped store database %s", dbName)
	return nil
}

// dropRole removes a store's login role. Names that are not tenant roles (legacy shared roles or
// an empty value) are logged and left alone.
func (p *Provisioner) dropRole(ctx context.Context, role string) error {
	if !validTenantRole.MatchString(role) {
		log.Printf("provisioner: warning - role %q is not a per-store tenant role; it was not dropped", role)
		return nil
	}
	dropRoleSQL := fmt.Sprintf("DROP ROLE IF EXISTS %s;", role)
	if _, err := p.admin.ExecContext(ctx, dropRoleSQL); err != nil {
		return fmt.Errorf("provisioner: failed to drop tenant role %s: %w", role, err)
	}
	log.Printf("provisioner: successfully dropped tenant role %s", role)
	return nil
}

// withPermissionHint appends the CREATEROLE/CREATEDB requirement when PostgreSQL denies the statement.
func withPermissionHint(err error) error {
	if strings.Contains(strings.ToLower(err.Error()), "permission denied") {
		return fmt.Errorf("%w (the platform database user needs CREATEROLE and CREATEDB, and must be able to act as the store role)", err)
	}
	return err
}

// applyMigrations applies all '.up.sql' migration files to the newly created tenant DB as the store's role.
func (p *Provisioner) applyMigrations(ctx context.Context, store *models.Store, password string) error {
	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		store.DBHost, store.DBPort, store.DBUser, password, store.DBName, store.DBSSLMode,
	)

	tenantDB, err := sql.Open("postgres", dsn)
	if err != nil {
		return fmt.Errorf("failed to open tenant connection for migration: %w", err)
	}
	defer tenantDB.Close()

	files, err := os.ReadDir(p.migrationsPath)
	if err != nil {
		return fmt.Errorf("failed to read store migrations path %s: %w", p.migrationsPath, err)
	}

	var upFiles []string
	for _, f := range files {
		if !f.IsDir() && strings.HasSuffix(f.Name(), ".up.sql") {
			upFiles = append(upFiles, f.Name())
		}
	}
	sort.Strings(upFiles)

	for _, fileName := range upFiles {
		fullPath := filepath.Join(p.migrationsPath, fileName)
		content, err := os.ReadFile(fullPath)
		if err != nil {
			return fmt.Errorf("failed to read migration file %s: %w", fullPath, err)
		}

		tx, err := tenantDB.BeginTx(ctx, nil)
		if err != nil {
			return fmt.Errorf("failed to begin migration transaction for %s: %w", fileName, err)
		}

		if _, err := tx.ExecContext(ctx, string(content)); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("error executing migration %s: %w", fileName, err)
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("failed to commit migration transaction %s: %w", fileName, err)
		}
		log.Printf("provisioner: applied store migration %s to %s", fileName, store.DBName)
	}

	return nil
}

// seedStoreSettings writes initial metadata and baseline settings into the tenant database.
func (p *Provisioner) seedStoreSettings(ctx context.Context, store *models.Store, password string) error {
	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		store.DBHost, store.DBPort, store.DBUser, password, store.DBName, store.DBSSLMode,
	)

	tenantDB, err := sql.Open("postgres", dsn)
	if err != nil {
		return fmt.Errorf("failed to connect to tenant db for seeding: %w", err)
	}
	defer tenantDB.Close()

	query := `
	INSERT INTO store_settings (store_name, support_email, support_phone, default_currency, timezone)
	VALUES ($1, $2, $3, $4, $5);`

	_, err = tenantDB.ExecContext(ctx, query, store.Name, store.ContactEmail, store.ContactPhone, store.Currency, store.Timezone)
	if err != nil {
		return fmt.Errorf("failed to execute store_settings seed: %w", err)
	}
	return nil
}

// logStep writes structured logs to store_provisioning_logs in the central platform database.
func (p *Provisioner) logStep(ctx context.Context, storeID, step string, order int, status string, details map[string]string) {
	if p.platformDB == nil {
		return
	}
	detailsJSON, _ := json.Marshal(details)
	query := `
	INSERT INTO store_provisioning_logs (store_id, step, step_order, status, details, started_at)
	VALUES ($1, $2, $3, $4, $5, $6);`

	_, err := p.platformDB.ExecContext(ctx, query, storeID, step, order, status, detailsJSON, time.Now().UTC())
	if err != nil {
		log.Printf("provisioner: warning - failed to write provisioning log: %v", err)
	}
}

// randomHex returns 2*bytesLen lowercase hex characters from crypto/rand.
func randomHex(bytesLen int) (string, error) {
	b := make([]byte, bytesLen)
	if _, err := io.ReadFull(rand.Reader, b); err != nil {
		return "", fmt.Errorf("reading crypto/rand: %w", err)
	}
	return hex.EncodeToString(b), nil
}
