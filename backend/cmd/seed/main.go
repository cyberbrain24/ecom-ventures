// Package main provides the one-time bootstrap command that creates the first platform
// super administrator. It creates no stores, themes, or sample records. Credentials come
// only from the environment: SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD are required.
package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"log/slog"
	"os"
	"strings"
	"time"

	_ "github.com/lib/pq"

	"ecom-ventures/backend/internal/config"
	"ecom-ventures/backend/internal/platform/database"
	"ecom-ventures/backend/pkg/hasher"
)

// minBootstrapPasswordLength is the minimum length accepted for the bootstrap super admin password.
const minBootstrapPasswordLength = 12

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelInfo}))
	slog.SetDefault(logger)

	if err := run(logger); err != nil {
		logger.Error("FATAL: bootstrap super admin not created", slog.String("error", err.Error()))
		os.Exit(1)
	}
}

// run validates the environment, refuses to run when a super admin already exists, and inserts
// the single bootstrap super administrator in one statement.
func run(logger *slog.Logger) error {
	adminEmail := strings.ToLower(strings.TrimSpace(os.Getenv("SEED_ADMIN_EMAIL")))
	adminPassword := os.Getenv("SEED_ADMIN_PASSWORD")
	if adminEmail == "" {
		return errors.New("SEED_ADMIN_EMAIL is required")
	}
	if adminPassword == "" {
		return errors.New("SEED_ADMIN_PASSWORD is required")
	}
	if len(adminPassword) < minBootstrapPasswordLength {
		return fmt.Errorf("SEED_ADMIN_PASSWORD must be at least %d characters", minBootstrapPasswordLength)
	}
	firstName := strings.TrimSpace(os.Getenv("SEED_ADMIN_FIRST_NAME"))
	if firstName == "" {
		firstName = "Platform"
	}
	lastName := strings.TrimSpace(os.Getenv("SEED_ADMIN_LAST_NAME"))
	if lastName == "" {
		lastName = "Administrator"
	}

	cfg, err := config.Load()
	if err != nil {
		return fmt.Errorf("loading configuration: %w", err)
	}

	passwordHash, err := hasher.HashPassword(adminPassword)
	if err != nil {
		return fmt.Errorf("hashing bootstrap password: %w", err)
	}

	platformPool, err := database.NewPlatformConnection(&cfg.PlatformDB)
	if err != nil {
		return fmt.Errorf("connecting to platform database: %w", err)
	}
	defer platformPool.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 1*time.Minute)
	defer cancel()

	created, err := bootstrapSuperAdmin(ctx, platformPool.DB, adminEmail, passwordHash, firstName, lastName)
	if err != nil {
		return err
	}
	if !created {
		return errors.New("a SUPER_ADMIN already exists; bootstrap refused")
	}

	logger.Info("Bootstrap super admin created", slog.String("email", adminEmail))
	return nil
}

// bootstrapSuperAdmin inserts the super admin only when no SUPER_ADMIN exists yet. It returns
// false (and no error) when a super admin is already present.
func bootstrapSuperAdmin(ctx context.Context, db *sql.DB, email, passwordHash, firstName, lastName string) (bool, error) {
	if db == nil {
		return false, errors.New("platform database handle is nil")
	}
	result, err := db.ExecContext(ctx, `
		INSERT INTO platform_users (email, password_hash, first_name, last_name, role, status)
		SELECT $1, $2, $3, $4, 'SUPER_ADMIN', 'ACTIVE'
		WHERE NOT EXISTS (SELECT 1 FROM platform_users WHERE role = 'SUPER_ADMIN');`,
		email, passwordHash, firstName, lastName,
	)
	if err != nil {
		return false, fmt.Errorf("inserting bootstrap super admin: %w", err)
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return false, fmt.Errorf("confirming bootstrap super admin insert: %w", err)
	}
	return affected == 1, nil
}
