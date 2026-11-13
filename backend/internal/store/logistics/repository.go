package logistics

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	storeModels "ecom-ventures/backend/internal/store/models"
)

var (
	ErrCarrierConfigNotFound = errors.New("courier configuration not found")
)

// Repository specifies database interactions for courier logistics.
type Repository interface {
	EnsureSchema(ctx context.Context, db *sql.DB) error
	GetCourierConfig(ctx context.Context, db *sql.DB, carrier CarrierType) (*CourierConfig, error)
	ListCourierConfigs(ctx context.Context, db *sql.DB) ([]CourierConfig, error)
	SaveCourierConfig(ctx context.Context, db *sql.DB, c *CourierConfig) error

	// Shipment Tracking Updates
	GetShipmentByTrackingNumber(ctx context.Context, db *sql.DB, trackingNumber string) (*storeModels.OrderShipment, error)
	UpdateShipmentMilestoneTx(ctx context.Context, tx *sql.Tx, shipmentID string, status storeModels.ShipmentStatus) error
}

// SQLRepository implements Repository.
type SQLRepository struct{}

// NewSQLRepository instantiates the SQL repository for logistics.
func NewSQLRepository() *SQLRepository {
	return &SQLRepository{}
}

// EnsureSchema provisions courier configurations table and adds tracking columns if missing.
func (r *SQLRepository) EnsureSchema(ctx context.Context, db *sql.DB) error {
	query := `
		CREATE TABLE IF NOT EXISTS store_courier_configs (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			carrier VARCHAR(30) NOT NULL UNIQUE,
			is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
			is_test_mode BOOLEAN NOT NULL DEFAULT TRUE,
			api_key TEXT NOT NULL DEFAULT '',
			secret_key TEXT NOT NULL DEFAULT '',
			client_id TEXT NOT NULL DEFAULT '',
			webhook_key TEXT NOT NULL DEFAULT '',
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
		);

		ALTER TABLE order_shipments ADD COLUMN IF NOT EXISTS tracking_url TEXT;
		ALTER TABLE order_shipments ADD COLUMN IF NOT EXISTS notes TEXT;
		ALTER TABLE order_shipments ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;
	`
	_, err := db.ExecContext(ctx, query)
	return err
}

// GetCourierConfig retrieves credentials and operational mode for a shipping carrier.
func (r *SQLRepository) GetCourierConfig(ctx context.Context, db *sql.DB, carrier CarrierType) (*CourierConfig, error) {
	query := `
		SELECT id, carrier, is_enabled, is_test_mode, api_key, secret_key, client_id, webhook_key, created_at, updated_at
		FROM store_courier_configs
		WHERE carrier = $1;
	`
	c := &CourierConfig{}
	err := db.QueryRowContext(ctx, query, carrier).Scan(
		&c.ID, &c.Carrier, &c.IsEnabled, &c.IsTestMode,
		&c.ApiKey, &c.SecretKey, &c.ClientID, &c.WebhookKey,
		&c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrCarrierConfigNotFound
		}
		return nil, err
	}
	return c, nil
}

// ListCourierConfigs lists all registered carrier profiles for the tenant.
func (r *SQLRepository) ListCourierConfigs(ctx context.Context, db *sql.DB) ([]CourierConfig, error) {
	query := `
		SELECT id, carrier, is_enabled, is_test_mode, api_key, secret_key, client_id, webhook_key, created_at, updated_at
		FROM store_courier_configs
		ORDER BY carrier ASC;
	`
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []CourierConfig
	for rows.Next() {
		var c CourierConfig
		if err := rows.Scan(
			&c.ID, &c.Carrier, &c.IsEnabled, &c.IsTestMode,
			&c.ApiKey, &c.SecretKey, &c.ClientID, &c.WebhookKey,
			&c.CreatedAt, &c.UpdatedAt,
		); err == nil {
			list = append(list, c)
		}
	}
	return list, nil
}

// SaveCourierConfig inserts or updates credentials for a carrier.
func (r *SQLRepository) SaveCourierConfig(ctx context.Context, db *sql.DB, c *CourierConfig) error {
	query := `
		INSERT INTO store_courier_configs (
			carrier, is_enabled, is_test_mode, api_key, secret_key, client_id, webhook_key, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, NOW()
		)
		ON CONFLICT (carrier) DO UPDATE SET
			is_enabled = EXCLUDED.is_enabled,
			is_test_mode = EXCLUDED.is_test_mode,
			api_key = EXCLUDED.api_key,
			secret_key = EXCLUDED.secret_key,
			client_id = EXCLUDED.client_id,
			webhook_key = EXCLUDED.webhook_key,
			updated_at = NOW();
	`
	_, err := db.ExecContext(ctx, query,
		c.Carrier, c.IsEnabled, c.IsTestMode, c.ApiKey, c.SecretKey, c.ClientID, c.WebhookKey,
	)
	return err
}

// GetShipmentByTrackingNumber queries the shipment record matching tracking number.
func (r *SQLRepository) GetShipmentByTrackingNumber(ctx context.Context, db *sql.DB, trackingNumber string) (*storeModels.OrderShipment, error) {
	query := `
		SELECT id, order_id, carrier, tracking_number, COALESCE(tracking_url, ''), status, COALESCE(notes, ''), shipped_at, delivered_at, created_at, updated_at
		FROM order_shipments
		WHERE tracking_number = $1
		ORDER BY created_at DESC
		LIMIT 1;
	`
	s := &storeModels.OrderShipment{}
	err := db.QueryRowContext(ctx, query, trackingNumber).Scan(
		&s.ID, &s.OrderID, &s.Carrier, &s.TrackingNumber, &s.TrackingURL,
		&s.Status, &s.Notes, &s.ShippedAt, &s.DeliveredAt, &s.CreatedAt, &s.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}
	return s, nil
}

// UpdateShipmentMilestoneTx updates shipment status and optional delivery timestamp inside a transaction.
func (r *SQLRepository) UpdateShipmentMilestoneTx(ctx context.Context, tx *sql.Tx, shipmentID string, status storeModels.ShipmentStatus) error {
	deliveredAtClause := ""
	if status == storeModels.ShipmentDelivered {
		deliveredAtClause = ", delivered_at = NOW()"
	}

	query := fmt.Sprintf(`
		UPDATE order_shipments
		SET status = $1, updated_at = NOW() %s
		WHERE id = $2;
	`, deliveredAtClause)

	_, err := tx.ExecContext(ctx, query, status, shipmentID)
	return err
}
