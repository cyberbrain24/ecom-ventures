package marketing

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

var (
	// ErrMarketingConfigNotFound indicates the marketing settings row could not be located.
	ErrMarketingConfigNotFound = errors.New("marketing configuration not found")
)

// Repository specifies database interactions for marketing settings.
type Repository interface {
	EnsureSchema(ctx context.Context, db *sql.DB) error
	GetConfig(ctx context.Context, db *sql.DB) (*MarketingConfig, error)
	SaveConfig(ctx context.Context, db *sql.DB, c *MarketingConfig) error
}

// SQLRepository implements Repository for PostgreSQL tenant operational databases.
type SQLRepository struct{}

// NewSQLRepository instantiates a new SQLRepository.
func NewSQLRepository() *SQLRepository {
	return &SQLRepository{}
}

// EnsureSchema provisions the store_marketing_configs table if not already present.
func (r *SQLRepository) EnsureSchema(ctx context.Context, db *sql.DB) error {
	query := `
		CREATE TABLE IF NOT EXISTS store_marketing_configs (
			id INT PRIMARY KEY DEFAULT 1,
			meta_pixel_id VARCHAR(50) NOT NULL DEFAULT '',
			meta_capi_token TEXT NOT NULL DEFAULT '',
			meta_test_code VARCHAR(50) NOT NULL DEFAULT '',
			ga4_measurement_id VARCHAR(50) NOT NULL DEFAULT '',
			gtm_container_id VARCHAR(50) NOT NULL DEFAULT '',
			google_ads_id VARCHAR(50) NOT NULL DEFAULT '',
			is_pixel_enabled BOOLEAN NOT NULL DEFAULT FALSE,
			is_capi_enabled BOOLEAN NOT NULL DEFAULT FALSE,
			is_ga4_enabled BOOLEAN NOT NULL DEFAULT FALSE,
			is_gtm_enabled BOOLEAN NOT NULL DEFAULT FALSE,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
			CONSTRAINT single_marketing_row_check CHECK (id = 1)
		);
	`
	_, err := db.ExecContext(ctx, query)
	return err
}

// GetConfig retrieves the singleton store marketing configuration row, initializing a blank row if empty.
func (r *SQLRepository) GetConfig(ctx context.Context, db *sql.DB) (*MarketingConfig, error) {
	query := `
		SELECT meta_pixel_id, meta_capi_token, meta_test_code, ga4_measurement_id,
		       gtm_container_id, google_ads_id, is_pixel_enabled, is_capi_enabled,
		       is_ga4_enabled, is_gtm_enabled, created_at, updated_at
		FROM store_marketing_configs
		WHERE id = 1;
	`
	c := &MarketingConfig{ID: "1"}
	err := db.QueryRowContext(ctx, query).Scan(
		&c.MetaPixelID, &c.MetaCAPIToken, &c.MetaTestCode, &c.GA4MeasurementID,
		&c.GTMContainerID, &c.GoogleAdsID, &c.IsPixelEnabled, &c.IsCAPIEnabled,
		&c.IsGA4Enabled, &c.IsGTMEnabled, &c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			// Initialize default row
			initQuery := `
				INSERT INTO store_marketing_configs (id, updated_at)
				VALUES (1, NOW())
				ON CONFLICT (id) DO NOTHING;
			`
			_, _ = db.ExecContext(ctx, initQuery)
			return c, nil
		}
		return nil, fmt.Errorf("failed to query marketing settings: %w", err)
	}
	return c, nil
}

// SaveConfig updates or inserts the singleton marketing configuration record.
func (r *SQLRepository) SaveConfig(ctx context.Context, db *sql.DB, c *MarketingConfig) error {
	query := `
		INSERT INTO store_marketing_configs (
			id, meta_pixel_id, meta_capi_token, meta_test_code, ga4_measurement_id,
			gtm_container_id, google_ads_id, is_pixel_enabled, is_capi_enabled,
			is_ga4_enabled, is_gtm_enabled, updated_at
		) VALUES (
			1, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW()
		)
		ON CONFLICT (id) DO UPDATE SET
			meta_pixel_id = EXCLUDED.meta_pixel_id,
			meta_capi_token = EXCLUDED.meta_capi_token,
			meta_test_code = EXCLUDED.meta_test_code,
			ga4_measurement_id = EXCLUDED.ga4_measurement_id,
			gtm_container_id = EXCLUDED.gtm_container_id,
			google_ads_id = EXCLUDED.google_ads_id,
			is_pixel_enabled = EXCLUDED.is_pixel_enabled,
			is_capi_enabled = EXCLUDED.is_capi_enabled,
			is_ga4_enabled = EXCLUDED.is_ga4_enabled,
			is_gtm_enabled = EXCLUDED.is_gtm_enabled,
			updated_at = NOW();
	`
	_, err := db.ExecContext(ctx, query,
		c.MetaPixelID, c.MetaCAPIToken, c.MetaTestCode, c.GA4MeasurementID,
		c.GTMContainerID, c.GoogleAdsID, c.IsPixelEnabled, c.IsCAPIEnabled,
		c.IsGA4Enabled, c.IsGTMEnabled,
	)
	return err
}
