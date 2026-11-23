package payments

import (
	"context"
	"database/sql"
	"errors"
	"fmt"

	storeModels "ecom-ventures/backend/internal/store/models"
)

var (
	ErrDuplicateWebhook = errors.New("webhook event already processed")
)

// Repository specifies database interactions for payment configurations and transactions.
type Repository interface {
	EnsureSchema(ctx context.Context, db *sql.DB) error
	GetGatewayConfig(ctx context.Context, db *sql.DB, gw GatewayType) (*GatewayConfig, error)
	ListGatewayConfigs(ctx context.Context, db *sql.DB) ([]GatewayConfig, error)
	SaveGatewayConfig(ctx context.Context, db *sql.DB, c *GatewayConfig) error
	SetDefaultGateway(ctx context.Context, db *sql.DB, gw GatewayType) error
	ToggleGatewayActive(ctx context.Context, db *sql.DB, gw GatewayType, isEnabled bool) error

	// Idempotency and Transaction Ledger
	LockIdempotencyKeyTx(ctx context.Context, tx *sql.Tx, key, gateway string) error
	RecordTransactionTx(ctx context.Context, tx *sql.Tx, txn *storeModels.PaymentTransaction) error
	UpdateOrderPaymentSettledTx(ctx context.Context, tx *sql.Tx, orderID string, paymentMethod string) error
	GetOrderByNumber(ctx context.Context, db *sql.DB, orderNumber string) (*storeModels.Order, error)
}

// SQLRepository implements Repository.
type SQLRepository struct{}

// NewSQLRepository instantiates the SQL repository for payments.
func NewSQLRepository() *SQLRepository {
	return &SQLRepository{}
}

// EnsureSchema provisions gateway credential and idempotency tables in the tenant DB.
func (r *SQLRepository) EnsureSchema(ctx context.Context, db *sql.DB) error {
	query := `
		CREATE TABLE IF NOT EXISTS store_payment_gateways (
			id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
			gateway VARCHAR(30) NOT NULL UNIQUE,
			is_enabled BOOLEAN NOT NULL DEFAULT FALSE,
			is_default BOOLEAN NOT NULL DEFAULT FALSE,
			is_test_mode BOOLEAN NOT NULL DEFAULT TRUE,
			account_id TEXT NOT NULL DEFAULT '',
			client_id TEXT NOT NULL DEFAULT '',
			client_secret TEXT NOT NULL DEFAULT '',
			webhook_key TEXT NOT NULL DEFAULT '',
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
			updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
		);

		ALTER TABLE store_payment_gateways ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT FALSE;

		CREATE TABLE IF NOT EXISTS payment_idempotency_keys (
			idempotency_key VARCHAR(255) PRIMARY KEY,
			gateway VARCHAR(30) NOT NULL,
			created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
		);

		ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(150);
		ALTER TABLE payment_transactions ADD COLUMN IF NOT EXISTS raw_response TEXT;

		-- Seed COD as enabled and default payment method if no gateway exists yet
		INSERT INTO store_payment_gateways (gateway, is_enabled, is_default, is_test_mode)
		VALUES ('COD', TRUE, TRUE, FALSE)
		ON CONFLICT (gateway) DO NOTHING;
	`
	_, err := db.ExecContext(ctx, query)
	return err
}

// GetGatewayConfig retrieves provider credentials for a given gateway channel.
func (r *SQLRepository) GetGatewayConfig(ctx context.Context, db *sql.DB, gw GatewayType) (*GatewayConfig, error) {
	query := `
		SELECT id, gateway, is_enabled, is_default, is_test_mode, account_id, client_id, client_secret, webhook_key, created_at, updated_at
		FROM store_payment_gateways
		WHERE gateway = $1;
	`
	c := &GatewayConfig{}
	err := db.QueryRowContext(ctx, query, gw).Scan(
		&c.ID, &c.Gateway, &c.IsEnabled, &c.IsDefault, &c.IsTestMode,
		&c.AccountID, &c.ClientID, &c.ClientSecret, &c.WebhookKey,
		&c.CreatedAt, &c.UpdatedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrGatewayDisabled
		}
		return nil, err
	}
	return c, nil
}

// ListGatewayConfigs returns all configured payment channels for the store.
func (r *SQLRepository) ListGatewayConfigs(ctx context.Context, db *sql.DB) ([]GatewayConfig, error) {
	query := `
		SELECT id, gateway, is_enabled, is_default, is_test_mode, account_id, client_id, client_secret, webhook_key, created_at, updated_at
		FROM store_payment_gateways
		ORDER BY gateway ASC;
	`
	rows, err := db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []GatewayConfig
	for rows.Next() {
		var c GatewayConfig
		if err := rows.Scan(
			&c.ID, &c.Gateway, &c.IsEnabled, &c.IsDefault, &c.IsTestMode,
			&c.AccountID, &c.ClientID, &c.ClientSecret, &c.WebhookKey,
			&c.CreatedAt, &c.UpdatedAt,
		); err == nil {
			list = append(list, c)
		}
	}
	return list, nil
}

// SaveGatewayConfig creates or updates credentials for a store payment channel.
func (r *SQLRepository) SaveGatewayConfig(ctx context.Context, db *sql.DB, c *GatewayConfig) error {
	// If marking as default, ensure it is enabled and unmark all others
	if c.IsDefault {
		c.IsEnabled = true
		if _, err := db.ExecContext(ctx, `UPDATE store_payment_gateways SET is_default = FALSE WHERE gateway != $1;`, c.Gateway); err != nil {
			return err
		}
	} else if !c.IsEnabled {
		c.IsDefault = false
	}

	query := `
		INSERT INTO store_payment_gateways (
			gateway, is_enabled, is_default, is_test_mode, account_id, client_id, client_secret, webhook_key, updated_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, NOW()
		)
		ON CONFLICT (gateway) DO UPDATE SET
			is_enabled = EXCLUDED.is_enabled,
			is_default = EXCLUDED.is_default,
			is_test_mode = EXCLUDED.is_test_mode,
			account_id = EXCLUDED.account_id,
			client_id = EXCLUDED.client_id,
			client_secret = EXCLUDED.client_secret,
			webhook_key = EXCLUDED.webhook_key,
			updated_at = NOW();
	`
	_, err := db.ExecContext(ctx, query,
		c.Gateway, c.IsEnabled, c.IsDefault, c.IsTestMode, c.AccountID, c.ClientID, c.ClientSecret, c.WebhookKey,
	)
	return err
}

// SetDefaultGateway designates one gateway as active and default, clearing other defaults.
func (r *SQLRepository) SetDefaultGateway(ctx context.Context, db *sql.DB, gw GatewayType) error {
	if _, err := db.ExecContext(ctx, `UPDATE store_payment_gateways SET is_default = FALSE;`); err != nil {
		return err
	}
	query := `
		INSERT INTO store_payment_gateways (gateway, is_enabled, is_default, is_test_mode, updated_at)
		VALUES ($1, TRUE, TRUE, FALSE, NOW())
		ON CONFLICT (gateway) DO UPDATE SET is_enabled = TRUE, is_default = TRUE, updated_at = NOW();
	`
	_, err := db.ExecContext(ctx, query, gw)
	return err
}

// ToggleGatewayActive activates or deactivates a payment gateway.
func (r *SQLRepository) ToggleGatewayActive(ctx context.Context, db *sql.DB, gw GatewayType, isEnabled bool) error {
	if !isEnabled {
		// Deactivating: also unmark default
		query := `
			INSERT INTO store_payment_gateways (gateway, is_enabled, is_default, is_test_mode, updated_at)
			VALUES ($1, FALSE, FALSE, FALSE, NOW())
			ON CONFLICT (gateway) DO UPDATE SET is_enabled = FALSE, is_default = FALSE, updated_at = NOW();
		`
		_, err := db.ExecContext(ctx, query, gw)
		return err
	}

	query := `
		INSERT INTO store_payment_gateways (gateway, is_enabled, is_default, is_test_mode, updated_at)
		VALUES ($1, TRUE, FALSE, FALSE, NOW())
		ON CONFLICT (gateway) DO UPDATE SET is_enabled = TRUE, updated_at = NOW();
	`
	_, err := db.ExecContext(ctx, query, gw)
	return err
}

// LockIdempotencyKeyTx attempts an atomic insert of the webhook key, returning ErrDuplicateWebhook on collision.
func (r *SQLRepository) LockIdempotencyKeyTx(ctx context.Context, tx *sql.Tx, key, gateway string) error {
	query := `
		INSERT INTO payment_idempotency_keys (idempotency_key, gateway, created_at)
		VALUES ($1, $2, NOW())
		ON CONFLICT (idempotency_key) DO NOTHING;
	`
	res, err := tx.ExecContext(ctx, query, key, gateway)
	if err != nil {
		return err
	}
	rows, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rows == 0 {
		return ErrDuplicateWebhook
	}
	return nil
}

// RecordTransactionTx appends a payment ledger record to payment_transactions.
func (r *SQLRepository) RecordTransactionTx(ctx context.Context, tx *sql.Tx, txn *storeModels.PaymentTransaction) error {
	query := `
		INSERT INTO payment_transactions (order_id, gateway, transaction_id, transaction_reference, amount, status, raw_response, created_at)
		VALUES ($1, $2, $3, $3, $4, $5, $6, NOW())
		RETURNING id, created_at;
	`
	return tx.QueryRowContext(ctx, query,
		txn.OrderID, txn.Gateway, txn.TransactionID, txn.Amount, txn.Status, txn.RawResponse,
	).Scan(&txn.ID, &txn.CreatedAt)
}

// UpdateOrderPaymentSettledTx updates order payment status to PAID, transitions PENDING to PROCESSING, and records audit history.
func (r *SQLRepository) UpdateOrderPaymentSettledTx(ctx context.Context, tx *sql.Tx, orderID string, paymentMethod string) error {
	// Advance payment_status to PAID and status to PROCESSING if currently PENDING
	query := `
		UPDATE orders
		SET payment_status = 'PAID',
		    payment_method = $1,
		    status = CASE WHEN status = 'PENDING' THEN 'PROCESSING' ELSE status END,
		    updated_at = NOW()
		WHERE id = $2;
	`
	if _, err := tx.ExecContext(ctx, query, paymentMethod, orderID); err != nil {
		return fmt.Errorf("failed to update order payment settled: %w", err)
	}

	// Record audit history entry
	queryHistory := `
		INSERT INTO order_status_history (order_id, old_status, new_status, performed_by, notes, created_at)
		VALUES ($1, 'PENDING', 'PROCESSING', 'PAYMENT_GATEWAY', 'Order payment settled via ' || $2, NOW());
	`
	_, _ = tx.ExecContext(ctx, queryHistory, orderID, paymentMethod)

	return nil
}

// GetOrderByNumber finds an order by its unique order number or UUID string.
func (r *SQLRepository) GetOrderByNumber(ctx context.Context, db *sql.DB, orderNumber string) (*storeModels.Order, error) {
	query := `
		SELECT id, order_number, customer_email, customer_phone, status, payment_status,
		       currency, subtotal, shipping_fee, discount_amount, total_amount, payment_method
		FROM orders
		WHERE order_number = $1 OR id::TEXT = $1;
	`
	o := &storeModels.Order{}
	var email, phone, payMethod sql.NullString

	err := db.QueryRowContext(ctx, query, orderNumber).Scan(
		&o.ID, &o.OrderNumber, &email, &phone, &o.Status, &o.PaymentStatus,
		&o.Currency, &o.Subtotal, &o.ShippingFee, &o.DiscountAmount, &o.TotalAmount, &payMethod,
	)
	if err != nil {
		return nil, err
	}

	if email.Valid {
		o.CustomerEmail = email.String
	}
	if phone.Valid {
		o.CustomerPhone = phone.String
	}
	if payMethod.Valid {
		o.PaymentMethod = payMethod.String
	}

	return o, nil
}
