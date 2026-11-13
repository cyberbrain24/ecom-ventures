// Package provisioner executes the automated PostgreSQL database creation, user setup,
// schema migration, and rollback procedures for newly created brands.
package provisioner

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
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

var validDBIdentifier = regexp.MustCompile(`^[a-z0-9_]{3,63}$`)

// Provisioner orchestrates tenant database creation and baseline migrations.
type Provisioner struct {
	platformDB     *sql.DB
	adminDB        *sql.DB // Connection to PostgreSQL cluster admin DB (e.g. postgres or template db)
	migrationsPath string
	encryptionKey  []byte
}

// NewProvisioner instantiates an automated database provisioner.
func NewProvisioner(platformDB, adminDB *sql.DB, migrationsPath string, encryptionKey []byte) (*Provisioner, error) {
	if len(encryptionKey) != 32 {
		return nil, crypto.ErrInvalidKeySize
	}
	return &Provisioner{
		platformDB:     platformDB,
		adminDB:        adminDB,
		migrationsPath: migrationsPath,
		encryptionKey:  encryptionKey,
	}, nil
}

// ProvisionStoreDatabase creates an isolated PostgreSQL database, applies schema, and registers status.
func (p *Provisioner) ProvisionStoreDatabase(ctx context.Context, store *models.Store, rawPassword string) error {
	if !validDBIdentifier.MatchString(store.DBName) {
		return fmt.Errorf("provisioner: invalid database name %q (must be lowercase alphanumeric + underscores, 3-63 chars)", store.DBName)
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

	if p.adminDB == nil {
		return fmt.Errorf("provisioner: cluster admin database handle is nil")
	}

	// Step 2: Create physical database on PostgreSQL cluster
	p.logStep(ctx, store.ID, "CREATE_PHYSICAL_DATABASE", 3, "IN_PROGRESS", map[string]string{"db_name": store.DBName})
	createDBSQL := fmt.Sprintf("CREATE DATABASE %s ENCODING 'UTF8' TEMPLATE template1;", store.DBName)
	if _, err := p.adminDB.ExecContext(ctx, createDBSQL); err != nil {
		p.logStep(ctx, store.ID, "CREATE_PHYSICAL_DATABASE", 3, "FAILED", map[string]string{"error": err.Error()})
		return fmt.Errorf("provisioner: failed to execute physical database creation for %s: %w", store.DBName, err)
	}
	p.logStep(ctx, store.ID, "CREATE_PHYSICAL_DATABASE", 3, "COMPLETED", map[string]string{"db_name": store.DBName})

	// Step 3: Run baseline migrations against the new tenant database
	p.logStep(ctx, store.ID, "APPLY_STORE_MIGRATIONS", 4, "IN_PROGRESS", map[string]string{"migrations_path": p.migrationsPath})
	if err := p.applyMigrations(ctx, store, rawPassword); err != nil {
		p.logStep(ctx, store.ID, "APPLY_STORE_MIGRATIONS", 4, "FAILED", map[string]string{"error": err.Error()})

		// Compensating transaction: Drop orphaned database on migration failure
		log.Printf("provisioner: migration failed for %s, executing rollback compensation...", store.DBName)
		_ = p.DropStoreDatabase(ctx, store.DBName)
		return fmt.Errorf("provisioner: migration failed, database rolled back: %w", err)
	}
	p.logStep(ctx, store.ID, "APPLY_STORE_MIGRATIONS", 4, "COMPLETED", map[string]string{"status": "baseline_applied"})

	// Step 4: Seed Initial Store Settings
	p.logStep(ctx, store.ID, "SEED_STORE_SETTINGS", 5, "IN_PROGRESS", map[string]string{"store_name": store.Name})
	if err := p.seedStoreSettings(ctx, store, rawPassword); err != nil {
		p.logStep(ctx, store.ID, "SEED_STORE_SETTINGS", 5, "FAILED", map[string]string{"error": err.Error()})
		_ = p.DropStoreDatabase(ctx, store.DBName)
		return fmt.Errorf("provisioner: failed to seed default store settings: %w", err)
	}
	p.logStep(ctx, store.ID, "SEED_STORE_SETTINGS", 5, "COMPLETED", map[string]string{"status": "seeded"})

	p.logStep(ctx, store.ID, "PROVISIONING_COMPLETE", 6, "COMPLETED", map[string]string{"status": "ready"})
	return nil
}

// DropStoreDatabase safely deletes a database during rollback or store deletion.
func (p *Provisioner) DropStoreDatabase(ctx context.Context, dbName string) error {
	if !validDBIdentifier.MatchString(dbName) {
		return fmt.Errorf("provisioner: invalid database name %q", dbName)
	}
	if p.adminDB == nil {
		return fmt.Errorf("provisioner: cluster admin database handle is nil")
	}

	// Terminate any active connections to the database before dropping
	terminateSQL := fmt.Sprintf(`
		SELECT pg_terminate_backend(pg_stat_activity.pid)
		FROM pg_stat_activity
		WHERE pg_stat_activity.datname = '%s' AND pid <> pg_backend_pid();`, dbName)
	_, _ = p.adminDB.ExecContext(ctx, terminateSQL)

	dropSQL := fmt.Sprintf("DROP DATABASE IF EXISTS %s WITH (FORCE);", dbName)
	_, err := p.adminDB.ExecContext(ctx, dropSQL)
	if err != nil {
		log.Printf("provisioner: warning - failed to force drop database %s: %v", dbName, err)
		return err
	}

	log.Printf("provisioner: successfully dropped store database %s", dbName)
	return nil
}

// applyMigrations applies all '.up.sql' migration files to the newly created tenant DB.
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
