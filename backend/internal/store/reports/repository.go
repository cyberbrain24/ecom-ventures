package reports

import (
	"context"
	"database/sql"
	"fmt"
	"sync"
	"time"
)

// StoreMetaSettings holds tenant-level currency, timezone, and exchange rate settings.
type StoreMetaSettings struct {
	Currency string
	Timezone string
	USDRate  float64
}

// StatusAggregateRow holds raw SQL aggregates for a single order status.
type StatusAggregateRow struct {
	StatusKey string
	Orders    int
	Products  int
	Value     float64
	Costing   float64
}

// Repository defines database operations for executive sales reporting.
type Repository interface {
	GetStoreMetaSettings(ctx context.Context, db *sql.DB) (StoreMetaSettings, error)
	UpdateUSDRate(ctx context.Context, db *sql.DB, rate float64) error
	AggregateOrdersByStatus(ctx context.Context, db *sql.DB, startUTC, endUTC time.Time) ([]StatusAggregateRow, error)
	GetMetaAdsSpendUSD(ctx context.Context, db *sql.DB, startUTC, endUTC time.Time) (float64, error)
	GetFixedExpenses(ctx context.Context, db *sql.DB, dateFrom, dateTo string) (float64, error)
}

// SQLRepository implements Repository against tenant PostgreSQL databases.
type SQLRepository struct {
	schemaSynced sync.Map
}

// NewSQLRepository creates a new SQLRepository instance.
func NewSQLRepository() *SQLRepository {
	return &SQLRepository{}
}

func (r *SQLRepository) ensureSchema(ctx context.Context, db *sql.DB) {
	if db == nil {
		return
	}
	key := fmt.Sprintf("%p", db)
	if _, ok := r.schemaSynced.Load(key); ok {
		return
	}
	_, _ = db.ExecContext(ctx, `
		ALTER TABLE store_settings
			ADD COLUMN IF NOT EXISTS usd_exchange_rate NUMERIC(10, 2) NOT NULL DEFAULT 132.00;
		ALTER TABLE order_items
			ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12, 2);
	`)
	r.schemaSynced.Store(key, true)
}

// GetStoreMetaSettings reads currency, timezone, and USD exchange rate from store_settings.
func (r *SQLRepository) GetStoreMetaSettings(ctx context.Context, db *sql.DB) (StoreMetaSettings, error) {
	r.ensureSchema(ctx, db)
	meta := StoreMetaSettings{
		Currency: "BDT",
		Timezone: "Asia/Dhaka",
		USDRate:  132.00,
	}
	var currency, tz sql.NullString
	var usdRate sql.NullFloat64
	err := db.QueryRowContext(ctx, `
		SELECT currency, timezone, usd_exchange_rate
		FROM store_settings
		LIMIT 1
	`).Scan(&currency, &tz, &usdRate)
	if err != nil && err != sql.ErrNoRows {
		return meta, fmt.Errorf("reading store settings: %w", err)
	}
	if currency.Valid && currency.String != "" {
		meta.Currency = currency.String
	}
	if tz.Valid && tz.String != "" {
		meta.Timezone = tz.String
	}
	if usdRate.Valid && usdRate.Float64 > 0 {
		meta.USDRate = usdRate.Float64
	}
	return meta, nil
}

// UpdateUSDRate persists the tenant's USD-to-local-currency conversion rate.
func (r *SQLRepository) UpdateUSDRate(ctx context.Context, db *sql.DB, rate float64) error {
	r.ensureSchema(ctx, db)
	res, err := db.ExecContext(ctx, `
		UPDATE store_settings
		SET usd_exchange_rate = $1, updated_at = NOW()
	`, rate)
	if err != nil {
		return fmt.Errorf("updating usd_exchange_rate: %w", err)
	}
	rows, _ := res.RowsAffected()
	if rows == 0 {
		return fmt.Errorf("store_settings row not found")
	}
	return nil
}

// AggregateOrdersByStatus returns order count, item quantity, revenue, and COGS grouped by status.
func (r *SQLRepository) AggregateOrdersByStatus(ctx context.Context, db *sql.DB, startUTC, endUTC time.Time) ([]StatusAggregateRow, error) {
	r.ensureSchema(ctx, db)
	query := `
		WITH filtered_orders AS (
			SELECT id, LOWER(status::text) AS status_key, total_amount
			FROM orders
			WHERE created_at >= $1 AND created_at < $2
		),
		order_totals AS (
			SELECT
				status_key,
				COUNT(*) AS orders_count,
				COALESCE(SUM(total_amount), 0) AS total_value
			FROM filtered_orders
			GROUP BY status_key
		),
		item_totals AS (
			SELECT
				fo.status_key,
				COALESCE(SUM(oi.quantity), 0) AS products_count,
				COALESCE(SUM(oi.quantity * COALESCE(oi.unit_cost, pv.cost_price, p.cost_price, 0)), 0) AS total_costing
			FROM filtered_orders fo
			LEFT JOIN order_items oi ON oi.order_id = fo.id
			LEFT JOIN product_variants pv ON pv.id = oi.variant_id
			LEFT JOIN products p ON p.id = pv.product_id
			GROUP BY fo.status_key
		)
		SELECT
			ot.status_key,
			ot.orders_count,
			COALESCE(it.products_count, 0),
			ot.total_value,
			COALESCE(it.total_costing, 0)
		FROM order_totals ot
		LEFT JOIN item_totals it ON it.status_key = ot.status_key
	`
	rows, err := db.QueryContext(ctx, query, startUTC, endUTC)
	if err != nil {
		return nil, fmt.Errorf("aggregating orders by status: %w", err)
	}
	defer rows.Close()

	var result []StatusAggregateRow
	for rows.Next() {
		var row StatusAggregateRow
		if err := rows.Scan(&row.StatusKey, &row.Orders, &row.Products, &row.Value, &row.Costing); err != nil {
			return nil, fmt.Errorf("scanning status aggregate row: %w", err)
		}
		result = append(result, row)
	}
	return result, rows.Err()
}

// GetMetaAdsSpendUSD returns synced Meta Ads spend in USD for the selected time window.
func (r *SQLRepository) GetMetaAdsSpendUSD(ctx context.Context, db *sql.DB, startUTC, endUTC time.Time) (float64, error) {
	var spendUSD float64
	err := db.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(ad_spend_usd), 0)
		FROM meta_ad_campaigns
		WHERE synced_at >= $1 AND synced_at < $2
	`, startUTC, endUTC).Scan(&spendUSD)
	if err != nil {
		// Gracefully return 0 if meta_ad_campaigns is not populated or absent
		return 0, nil
	}
	return spendUSD, nil
}

// GetFixedExpenses returns logged operational expenses (excluding META_ADS) for the date range.
func (r *SQLRepository) GetFixedExpenses(ctx context.Context, db *sql.DB, dateFrom, dateTo string) (float64, error) {
	var total float64
	err := db.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(amount), 0)
		FROM account_expenses
		WHERE expense_date >= $1 AND expense_date <= $2
		  AND UPPER(COALESCE(category, '')) <> 'META_ADS'
	`, dateFrom, dateTo).Scan(&total)
	if err != nil {
		return 0, nil
	}
	return total, nil
}
