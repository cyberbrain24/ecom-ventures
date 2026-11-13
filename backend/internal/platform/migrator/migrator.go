// Package migrator provides a transactional, file-based SQL migration engine
// for the Ecom Ventures Central Platform Database.
package migrator

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"
)

// Migrator manages SQL migration execution and schema version tracking.
type Migrator struct {
	db             *sql.DB
	migrationsPath string
}

// New creates an initialized Migrator instance.
func New(db *sql.DB, migrationsPath string) *Migrator {
	return &Migrator{
		db:             db,
		migrationsPath: migrationsPath,
	}
}

// EnsureSchemaTable creates the version tracking table if it does not exist.
func (m *Migrator) EnsureSchemaTable(ctx context.Context) error {
	if m.db == nil {
		return fmt.Errorf("migrator: database connection handle is nil")
	}
	query := `
	CREATE TABLE IF NOT EXISTS platform_schema_migrations (
		version VARCHAR(50) PRIMARY KEY,
		applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
	);`
	_, err := m.db.ExecContext(ctx, query)
	if err != nil {
		return fmt.Errorf("failed to create platform_schema_migrations table: %w", err)
	}
	return nil
}

// Up runs all unapplied '.up.sql' migrations in alphabetical order within transactions.
func (m *Migrator) Up(ctx context.Context) error {
	if m.db == nil {
		return fmt.Errorf("migrator: database connection handle is nil")
	}
	if err := m.EnsureSchemaTable(ctx); err != nil {
		return err
	}

	files, err := os.ReadDir(m.migrationsPath)
	if err != nil {
		return fmt.Errorf("failed to read migrations directory %s: %w", m.migrationsPath, err)
	}

	var upFiles []string
	for _, f := range files {
		if !f.IsDir() && strings.HasSuffix(f.Name(), ".up.sql") {
			upFiles = append(upFiles, f.Name())
		}
	}
	sort.Strings(upFiles)

	for _, fileName := range upFiles {
		version := strings.Split(fileName, "_")[0]

		var exists bool
		checkQuery := `SELECT EXISTS(SELECT 1 FROM platform_schema_migrations WHERE version = $1);`
		if err := m.db.QueryRowContext(ctx, checkQuery, version).Scan(&exists); err != nil {
			return fmt.Errorf("failed to verify migration version %s: %w", version, err)
		}

		if exists {
			log.Printf("Migration %s already applied. Skipping.", fileName)
			continue
		}

		fullPath := filepath.Join(m.migrationsPath, fileName)
		content, err := os.ReadFile(fullPath)
		if err != nil {
			return fmt.Errorf("failed to read migration file %s: %w", fullPath, err)
		}

		log.Printf("Applying platform migration: %s", fileName)
		tx, err := m.db.BeginTx(ctx, nil)
		if err != nil {
			return fmt.Errorf("failed to begin transaction for %s: %w", fileName, err)
		}

		if _, err := tx.ExecContext(ctx, string(content)); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("migration failure in %s: %w", fileName, err)
		}

		recordQuery := `INSERT INTO platform_schema_migrations (version, applied_at) VALUES ($1, $2);`
		if _, err := tx.ExecContext(ctx, recordQuery, version, time.Now().UTC()); err != nil {
			_ = tx.Rollback()
			return fmt.Errorf("failed to log migration %s: %w", version, err)
		}

		if err := tx.Commit(); err != nil {
			return fmt.Errorf("failed to commit transaction for migration %s: %w", fileName, err)
		}

		log.Printf("Successfully applied platform migration: %s", fileName)
	}

	return nil
}

// Down reverts the latest applied migration using its corresponding '.down.sql' file.
func (m *Migrator) Down(ctx context.Context) error {
	if m.db == nil {
		return fmt.Errorf("migrator: database connection handle is nil")
	}
	if err := m.EnsureSchemaTable(ctx); err != nil {
		return err
	}

	var latestVersion string
	query := `SELECT version FROM platform_schema_migrations ORDER BY version DESC LIMIT 1;`
	err := m.db.QueryRowContext(ctx, query).Scan(&latestVersion)
	if err == sql.ErrNoRows {
		log.Println("No migrations found to revert.")
		return nil
	} else if err != nil {
		return fmt.Errorf("failed to fetch latest applied migration: %w", err)
	}

	files, err := os.ReadDir(m.migrationsPath)
	if err != nil {
		return fmt.Errorf("failed to read migrations directory: %w", err)
	}

	var targetDownFile string
	for _, f := range files {
		if strings.HasPrefix(f.Name(), latestVersion) && strings.HasSuffix(f.Name(), ".down.sql") {
			targetDownFile = f.Name()
			break
		}
	}

	if targetDownFile == "" {
		return fmt.Errorf("corresponding .down.sql file for version %s not found", latestVersion)
	}

	fullPath := filepath.Join(m.migrationsPath, targetDownFile)
	content, err := os.ReadFile(fullPath)
	if err != nil {
		return fmt.Errorf("failed to read down migration %s: %w", fullPath, err)
	}

	log.Printf("Reverting platform migration: %s", targetDownFile)
	tx, err := m.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("failed to begin rollback transaction: %w", err)
	}

	if _, err := tx.ExecContext(ctx, string(content)); err != nil {
		_ = tx.Rollback()
		return fmt.Errorf("rollback execution failure in %s: %w", targetDownFile, err)
	}

	deleteQuery := `DELETE FROM platform_schema_migrations WHERE version = $1;`
	if _, err := tx.ExecContext(ctx, deleteQuery, latestVersion); err != nil {
		_ = tx.Rollback()
		return fmt.Errorf("failed to remove migration log %s: %w", latestVersion, err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("failed to commit rollback transaction: %w", err)
	}

	log.Printf("Successfully reverted platform migration: %s", targetDownFile)
	return nil
}
