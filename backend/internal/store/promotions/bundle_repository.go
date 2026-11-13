// Package promotions provides domain logic, database operations, and HTTP APIs
// for managing coupon codes, multi-item bundle tiers, and cart promotion evaluations.
package promotions

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

var (
	// ErrBundleTierNotFound indicates the requested bundle tier does not exist.
	ErrBundleTierNotFound = errors.New("bundle tier not found")
)

// EnsureBundleSchema idempotently creates the bundle_tiers table and default seeds if missing.
func (r *SQLRepository) EnsureBundleSchema(ctx context.Context, db *sql.DB) error {
	query := `
		CREATE TABLE IF NOT EXISTS bundle_tiers (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			name VARCHAR(100) NOT NULL,
			required_items_count INTEGER NOT NULL CHECK (required_items_count >= 2),
			discount_percentage NUMERIC(5, 2) NOT NULL CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
			badge_text VARCHAR(50),
			subtitle VARCHAR(255),
			perks JSONB NOT NULL DEFAULT '[]'::jsonb,
			has_free_delivery BOOLEAN NOT NULL DEFAULT FALSE,
			display_order INTEGER NOT NULL DEFAULT 0,
			is_active BOOLEAN NOT NULL DEFAULT TRUE,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
		);

		CREATE INDEX IF NOT EXISTS idx_bundle_tiers_active_order ON bundle_tiers (is_active, display_order ASC);
	`
	_, err := db.ExecContext(ctx, query)
	return err
}

// ListBundleTiers returns all bundle tiers ordered by display_order ASC, created_at ASC.
func (r *SQLRepository) ListBundleTiers(ctx context.Context, db *sql.DB, activeOnly bool) ([]BundleTier, error) {
	if err := r.EnsureBundleSchema(ctx, db); err != nil {
		return nil, fmt.Errorf("failed to ensure bundle schema: %w", err)
	}

	query := `
		SELECT id, name, required_items_count, discount_percentage,
		       COALESCE(badge_text, ''), COALESCE(subtitle, ''), perks,
		       has_free_delivery, display_order, is_active, created_at, updated_at
		FROM bundle_tiers
	`
	if activeOnly {
		query += " WHERE is_active = TRUE"
	}
	query += " ORDER BY display_order ASC, created_at ASC"

	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query bundle tiers: %w", err)
	}
	defer rows.Close()

	var tiers []BundleTier
	for rows.Next() {
		var t BundleTier
		var perksRaw []byte
		err := rows.Scan(
			&t.ID,
			&t.Name,
			&t.RequiredItemsCount,
			&t.DiscountPercentage,
			&t.BadgeText,
			&t.Subtitle,
			&perksRaw,
			&t.HasFreeDelivery,
			&t.DisplayOrder,
			&t.IsActive,
			&t.CreatedAt,
			&t.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan bundle tier: %w", err)
		}

		if len(perksRaw) > 0 {
			_ = json.Unmarshal(perksRaw, &t.Perks)
		}
		if t.Perks == nil {
			t.Perks = []string{}
		}

		tiers = append(tiers, t)
	}

	if tiers == nil {
		tiers = []BundleTier{}
	}

	return tiers, nil
}

// GetBundleTierByID retrieves a bundle tier by its unique UUID.
func (r *SQLRepository) GetBundleTierByID(ctx context.Context, db *sql.DB, id string) (*BundleTier, error) {
	if err := r.EnsureBundleSchema(ctx, db); err != nil {
		return nil, fmt.Errorf("failed to ensure bundle schema: %w", err)
	}

	query := `
		SELECT id, name, required_items_count, discount_percentage,
		       COALESCE(badge_text, ''), COALESCE(subtitle, ''), perks,
		       has_free_delivery, display_order, is_active, created_at, updated_at
		FROM bundle_tiers
		WHERE id = $1
	`

	var t BundleTier
	var perksRaw []byte
	err := db.QueryRowContext(ctx, query, id).Scan(
		&t.ID,
		&t.Name,
		&t.RequiredItemsCount,
		&t.DiscountPercentage,
		&t.BadgeText,
		&t.Subtitle,
		&perksRaw,
		&t.HasFreeDelivery,
		&t.DisplayOrder,
		&t.IsActive,
		&t.CreatedAt,
		&t.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrBundleTierNotFound
		}
		return nil, fmt.Errorf("failed to get bundle tier by id: %w", err)
	}

	if len(perksRaw) > 0 {
		_ = json.Unmarshal(perksRaw, &t.Perks)
	}
	if t.Perks == nil {
		t.Perks = []string{}
	}

	return &t, nil
}

// CreateBundleTier inserts a new tier record into the database.
func (r *SQLRepository) CreateBundleTier(ctx context.Context, db *sql.DB, tier *BundleTier) error {
	if err := r.EnsureBundleSchema(ctx, db); err != nil {
		return fmt.Errorf("failed to ensure bundle schema: %w", err)
	}

	perksJSON, err := json.Marshal(tier.Perks)
	if err != nil {
		perksJSON = []byte("[]")
	}

	query := `
		INSERT INTO bundle_tiers (
			name, required_items_count, discount_percentage, badge_text,
			subtitle, perks, has_free_delivery, display_order, is_active,
			created_at, updated_at
		)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
		RETURNING id, created_at, updated_at
	`

	err = db.QueryRowContext(
		ctx,
		query,
		tier.Name,
		tier.RequiredItemsCount,
		tier.DiscountPercentage,
		tier.BadgeText,
		tier.Subtitle,
		perksJSON,
		tier.HasFreeDelivery,
		tier.DisplayOrder,
		tier.IsActive,
	).Scan(&tier.ID, &tier.CreatedAt, &tier.UpdatedAt)

	if err != nil {
		return fmt.Errorf("failed to insert bundle tier: %w", err)
	}

	return nil
}

// UpdateBundleTier modifies an existing tier record.
func (r *SQLRepository) UpdateBundleTier(ctx context.Context, db *sql.DB, tier *BundleTier) error {
	if err := r.EnsureBundleSchema(ctx, db); err != nil {
		return fmt.Errorf("failed to ensure bundle schema: %w", err)
	}

	perksJSON, err := json.Marshal(tier.Perks)
	if err != nil {
		perksJSON = []byte("[]")
	}

	query := `
		UPDATE bundle_tiers
		SET name = $1,
		    required_items_count = $2,
		    discount_percentage = $3,
		    badge_text = $4,
		    subtitle = $5,
		    perks = $6,
		    has_free_delivery = $7,
		    display_order = $8,
		    is_active = $9,
		    updated_at = NOW()
		WHERE id = $10
	`

	res, err := db.ExecContext(
		ctx,
		query,
		tier.Name,
		tier.RequiredItemsCount,
		tier.DiscountPercentage,
		tier.BadgeText,
		tier.Subtitle,
		perksJSON,
		tier.HasFreeDelivery,
		tier.DisplayOrder,
		tier.IsActive,
		tier.ID,
	)
	if err != nil {
		return fmt.Errorf("failed to update bundle tier: %w", err)
	}

	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrBundleTierNotFound
	}

	tier.UpdatedAt = time.Now().UTC()
	return nil
}

// DeleteBundleTier removes a bundle tier permanently.
func (r *SQLRepository) DeleteBundleTier(ctx context.Context, db *sql.DB, id string) error {
	if err := r.EnsureBundleSchema(ctx, db); err != nil {
		return fmt.Errorf("failed to ensure bundle schema: %w", err)
	}

	query := `DELETE FROM bundle_tiers WHERE id = $1`
	res, err := db.ExecContext(ctx, query, id)
	if err != nil {
		return fmt.Errorf("failed to delete bundle tier: %w", err)
	}

	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrBundleTierNotFound
	}

	return nil
}

// ToggleBundleTierStatus changes the active flag of a bundle tier.
func (r *SQLRepository) ToggleBundleTierStatus(ctx context.Context, db *sql.DB, id string, isActive bool) error {
	if err := r.EnsureBundleSchema(ctx, db); err != nil {
		return fmt.Errorf("failed to ensure bundle schema: %w", err)
	}

	query := `UPDATE bundle_tiers SET is_active = $1, updated_at = NOW() WHERE id = $2`
	res, err := db.ExecContext(ctx, query, isActive, id)
	if err != nil {
		return fmt.Errorf("failed to toggle bundle tier status: %w", err)
	}

	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrBundleTierNotFound
	}

	return nil
}
