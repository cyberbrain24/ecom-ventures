package worker

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"time"

	storeDB "ecom-ventures/backend/internal/store/database"
	"ecom-ventures/backend/pkg/crypto"
)

// idleCartTTL is how long a cart may stay untouched before JOB_EXPIRE_CARTS removes it.
const idleCartTTL = 14 * 24 * time.Hour

// tenantRegistryRow is one store's connection record as stored in the platform registry.
// PasswordEncrypted is the AES-256-GCM ciphertext of the tenant database password.
type tenantRegistryRow struct {
	ID                string
	Slug              string
	Host              string
	Port              int
	DBName            string
	User              string
	PasswordEncrypted string
	SSLMode           string
}

// loadActiveTenants reads every active store from the platform registry.
func loadActiveTenants(ctx context.Context, platformDB *sql.DB) ([]tenantRegistryRow, error) {
	if platformDB == nil {
		return nil, errors.New("platform database handle is nil")
	}
	rows, err := platformDB.QueryContext(ctx, `
		SELECT id, slug, db_host, db_port, db_name, db_user, db_password_encrypted, db_sslmode
		FROM stores WHERE status = 'ACTIVE' ORDER BY slug;`)
	if err != nil {
		return nil, fmt.Errorf("querying active stores: %w", err)
	}
	defer rows.Close()

	var tenants []tenantRegistryRow
	for rows.Next() {
		var t tenantRegistryRow
		if err := rows.Scan(&t.ID, &t.Slug, &t.Host, &t.Port, &t.DBName, &t.User, &t.PasswordEncrypted, &t.SSLMode); err != nil {
			return nil, fmt.Errorf("scanning active store row: %w", err)
		}
		tenants = append(tenants, t)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterating active stores: %w", err)
	}
	return tenants, nil
}

// decryptTenantPassword decrypts a registry password with the platform encryption key.
// Failure is returned as an error; the ciphertext is never used as a password.
func decryptTenantPassword(passwordEncrypted string, encryptionKey []byte) (string, error) {
	if passwordEncrypted == "" {
		return "", errors.New("tenant password ciphertext is empty")
	}
	plain, err := crypto.DecryptAESGCM(passwordEncrypted, encryptionKey)
	if err != nil {
		return "", fmt.Errorf("decrypting tenant database password: %w", err)
	}
	return plain, nil
}

// tenantConnection returns a pool for one tenant using its decrypted credentials.
func tenantConnection(tenantPool *storeDB.TenantPoolManager, t tenantRegistryRow, encryptionKey []byte) (*sql.DB, error) {
	if tenantPool == nil {
		return nil, errors.New("tenant pool is nil")
	}
	password, err := decryptTenantPassword(t.PasswordEncrypted, encryptionKey)
	if err != nil {
		return nil, err
	}
	db, err := tenantPool.GetPool(t.ID, t.Host, t.Port, t.DBName, t.User, password, t.SSLMode)
	if err != nil {
		return nil, fmt.Errorf("opening tenant pool: %w", err)
	}
	return db, nil
}

// BuildExpireCartsHandler creates a handler for JOB_EXPIRE_CARTS. It visits every active store;
// a failure for any store is returned as a job failure after the remaining stores are processed.
func BuildExpireCartsHandler(platformDB *sql.DB, tenantPool *storeDB.TenantPoolManager, encryptionKey []byte) JobHandlerFunc {
	return func(ctx context.Context, env *JobEnvelope) error {
		tenants, err := loadActiveTenants(ctx, platformDB)
		if err != nil {
			return err
		}

		threshold := time.Now().Add(-idleCartTTL)
		var failures []error
		for _, t := range tenants {
			if err := expireTenantCarts(ctx, tenantPool, t, encryptionKey, threshold); err != nil {
				slog.Default().Error("Cart expiry failed for store", slog.String("store", t.Slug), slog.String("error", err.Error()))
				failures = append(failures, fmt.Errorf("store %s: %w", t.Slug, err))
			}
		}
		return errors.Join(failures...)
	}
}

// expireTenantCarts deletes one tenant's carts idle since the threshold.
func expireTenantCarts(ctx context.Context, tenantPool *storeDB.TenantPoolManager, t tenantRegistryRow, encryptionKey []byte, threshold time.Time) error {
	conn, err := tenantConnection(tenantPool, t, encryptionKey)
	if err != nil {
		return err
	}
	res, err := conn.ExecContext(ctx, `DELETE FROM carts WHERE updated_at < $1;`, threshold)
	if err != nil {
		return fmt.Errorf("deleting idle carts: %w", err)
	}
	count, err := res.RowsAffected()
	if err != nil {
		return fmt.Errorf("reading deleted cart count: %w", err)
	}
	if count > 0 {
		slog.Default().Info("Expired abandoned carts purged", slog.String("store", t.Slug), slog.Int64("purged_count", count))
	}
	return nil
}

// BuildAuditLowStockHandler creates a handler for JOB_AUDIT_LOW_STOCK. Failures for individual
// stores are collected and returned as a job failure.
func BuildAuditLowStockHandler(platformDB *sql.DB, tenantPool *storeDB.TenantPoolManager, encryptionKey []byte) JobHandlerFunc {
	return func(ctx context.Context, env *JobEnvelope) error {
		tenants, err := loadActiveTenants(ctx, platformDB)
		if err != nil {
			return err
		}

		var failures []error
		for _, t := range tenants {
			if err := auditTenantLowStock(ctx, tenantPool, t, encryptionKey); err != nil {
				slog.Default().Error("Low stock audit failed for store", slog.String("store", t.Slug), slog.String("error", err.Error()))
				failures = append(failures, fmt.Errorf("store %s: %w", t.Slug, err))
			}
		}
		return errors.Join(failures...)
	}
}

// auditTenantLowStock counts one tenant's variants at or below their low-stock threshold.
func auditTenantLowStock(ctx context.Context, tenantPool *storeDB.TenantPoolManager, t tenantRegistryRow, encryptionKey []byte) error {
	conn, err := tenantConnection(tenantPool, t, encryptionKey)
	if err != nil {
		return err
	}
	query := `
		SELECT COUNT(*)
		FROM variant_inventory vi
		WHERE (vi.quantity_available - vi.quantity_reserved) <= vi.low_stock_threshold;`
	var lowStockCount int
	if err := conn.QueryRowContext(ctx, query).Scan(&lowStockCount); err != nil {
		return fmt.Errorf("counting low-stock variants: %w", err)
	}
	if lowStockCount > 0 {
		slog.Default().Warn("Low stock items detected for brand",
			slog.String("store", t.Slug),
			slog.Int("items_below_threshold", lowStockCount),
		)
	}
	return nil
}

// BuildTenantBackupHandler creates a handler for JOB_TENANT_DB_BACKUP. It dumps the named store's
// own database, using the host and port from the platform registry and the password decrypted with
// encryptionKey, then writes an AES-GCM encrypted snapshot. Any failure returns an error and leaves
// no plaintext dump or fabricated file behind.
func BuildTenantBackupHandler(platformDB *sql.DB, backupDir string, encryptionKey []byte) JobHandlerFunc {
	return func(ctx context.Context, env *JobEnvelope) error {
		if env.StoreSlug == "" {
			return errors.New("backup job requires a store slug")
		}
		if len(encryptionKey) != 32 {
			return errors.New("backup job requires a 32-byte encryption key")
		}
		if platformDB == nil {
			return errors.New("platform database handle is nil")
		}

		var t tenantRegistryRow
		err := platformDB.QueryRowContext(ctx, `
			SELECT id, slug, db_host, db_port, db_name, db_user, db_password_encrypted, db_sslmode
			FROM stores WHERE slug = $1;`, env.StoreSlug,
		).Scan(&t.ID, &t.Slug, &t.Host, &t.Port, &t.DBName, &t.User, &t.PasswordEncrypted, &t.SSLMode)
		if errors.Is(err, sql.ErrNoRows) {
			return fmt.Errorf("backup: store %q not found", env.StoreSlug)
		} else if err != nil {
			return fmt.Errorf("backup: reading store registry: %w", err)
		}

		password, err := decryptTenantPassword(t.PasswordEncrypted, encryptionKey)
		if err != nil {
			return fmt.Errorf("backup for store %s: %w", t.Slug, err)
		}

		storeDir := filepath.Join(backupDir, t.Slug)
		if err := os.MkdirAll(storeDir, 0755); err != nil {
			return fmt.Errorf("backup: creating directory %s: %w", storeDir, err)
		}

		timestamp := time.Now().UTC().Format("20060102_150405")
		dumpFile := filepath.Join(storeDir, fmt.Sprintf("backup_%s.sql", timestamp))

		if err := runPGDump(ctx, t, password, dumpFile); err != nil {
			return err
		}

		if err := encryptDumpFile(dumpFile, encryptionKey); err != nil {
			return fmt.Errorf("backup for store %s: %w", t.Slug, err)
		}

		slog.Default().Info("Tenant database snapshot completed",
			slog.String("store", t.Slug),
			slog.String("timestamp", timestamp),
		)
		return nil
	}
}

// runPGDump executes pg_dump against one tenant database. The password is passed through PGPASSWORD
// and never appears on the command line. On failure the partial output is removed.
func runPGDump(ctx context.Context, t tenantRegistryRow, password, dumpFile string) error {
	cmd := exec.CommandContext(ctx, "pg_dump",
		"-h", t.Host,
		"-p", strconv.Itoa(t.Port),
		"-U", t.User,
		"-d", t.DBName,
		"-f", dumpFile,
		"--no-password",
	)
	cmd.Env = append(os.Environ(), "PGPASSWORD="+password)
	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	if err := cmd.Run(); err != nil {
		_ = os.Remove(dumpFile)
		return fmt.Errorf("pg_dump failed for store %s: %w: %s", t.Slug, err, stderr.String())
	}

	info, err := os.Stat(dumpFile)
	if err != nil {
		return fmt.Errorf("pg_dump for store %s produced no output file: %w", t.Slug, err)
	}
	if info.Size() == 0 {
		_ = os.Remove(dumpFile)
		return fmt.Errorf("pg_dump for store %s produced an empty file", t.Slug)
	}
	return nil
}

// encryptDumpFile replaces a plaintext dump with an encrypted .enc file and removes the plaintext.
// Any failure removes the plaintext and returns an error; the plaintext is never kept.
func encryptDumpFile(dumpFile string, encryptionKey []byte) error {
	content, err := os.ReadFile(dumpFile)
	if err != nil {
		_ = os.Remove(dumpFile)
		return fmt.Errorf("reading dump for encryption: %w", err)
	}
	encrypted, err := crypto.EncryptAESGCM(string(content), encryptionKey)
	if err != nil {
		_ = os.Remove(dumpFile)
		return fmt.Errorf("encrypting dump: %w", err)
	}
	if err := os.WriteFile(dumpFile+".enc", []byte(encrypted), 0600); err != nil {
		_ = os.Remove(dumpFile)
		return fmt.Errorf("writing encrypted dump: %w", err)
	}
	if err := os.Remove(dumpFile); err != nil {
		return fmt.Errorf("removing plaintext dump: %w", err)
	}
	return nil
}
