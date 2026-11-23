package accounts

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"
)

// Service coordinates central portfolio financial aggregation and brand billing records.
type Service struct {
	db *sql.DB
}

// NewService instantiates the Platform Accounts Service.
func NewService(db *sql.DB) *Service {
	return &Service{db: db}
}

func (s *Service) requireDB() error {
	if s.db == nil {
		return fmt.Errorf("platform accounts database is unavailable")
	}
	return nil
}

// GetPortfolioOverview queries summarized financial metrics across managed stores.
func (s *Service) GetPortfolioOverview(ctx context.Context) (*PortfolioFinancialSummary, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	summary := &PortfolioFinancialSummary{
		Currency:         "BDT",
		RevenueByStore:   make(map[string]float64),
		UpdatedTimestamp: time.Now().UTC(),
	}

	err := s.db.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM stores
		WHERE status = 'ACTIVE'
	`).Scan(&summary.TotalActiveStores)
	if err != nil {
		return nil, fmt.Errorf("count active stores: %w", err)
	}

	err = s.db.QueryRowContext(ctx, `
		SELECT COALESCE(SUM(gross_sales), 0),
		       COALESCE(SUM(net_sales), 0),
		       COALESCE(SUM(order_count), 0),
		       COALESCE(SUM(platform_fee_amount), 0),
		       COALESCE(MAX(currency), 'BDT')
		FROM portfolio_financial_summaries
	`).Scan(
		&summary.TotalGMV,
		&summary.TotalNetCashFlow,
		&summary.TotalOrdersProcessed,
		&summary.TotalPlatformFeesEarned,
		&summary.Currency,
	)
	if err != nil {
		return nil, fmt.Errorf("query portfolio financial summary: %w", err)
	}
	if summary.TotalOrdersProcessed > 0 {
		summary.AverageOrderValue = summary.TotalGMV / float64(summary.TotalOrdersProcessed)
	}

	rows, err := s.db.QueryContext(ctx, `
		SELECT s.name, COALESCE(SUM(pfs.gross_sales), 0)
		FROM stores s
		LEFT JOIN portfolio_financial_summaries pfs ON pfs.store_id = s.id
		GROUP BY s.id, s.name
		ORDER BY s.name
	`)
	if err != nil {
		return nil, fmt.Errorf("query portfolio revenue by store: %w", err)
	}
	defer rows.Close()
	for rows.Next() {
		var name string
		var sales float64
		if err := rows.Scan(&name, &sales); err != nil {
			return nil, fmt.Errorf("scan portfolio revenue by store: %w", err)
		}
		summary.RevenueByStore[name] = sales
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate portfolio revenue by store: %w", err)
	}
	return summary, nil
}

// GetLeaderboard returns comparative metrics from the platform's stored monthly aggregates.
func (s *Service) GetLeaderboard(ctx context.Context, period string) ([]BrandRevenueLeaderboardItem, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	period = strings.TrimSpace(period)
	growthExpression := "NULL::double precision"
	growthJoin := ""
	growthGroupBy := ""
	query := `
		SELECT s.id::text, s.name, s.slug,
		       COALESCE(SUM(pfs.gross_sales), 0),
		       COALESCE(SUM(pfs.net_sales), 0),
		       COALESCE(SUM(pfs.order_count), 0),
		       CASE WHEN SUM(pfs.order_count) > 0
		            THEN SUM(pfs.gross_sales) / SUM(pfs.order_count) ELSE 0 END,
		       COALESCE(SUM(pfs.cogs), 0),
		       COALESCE(SUM(pfs.total_expenses), 0),
		       COALESCE(SUM(pfs.net_profit), 0),
		       CASE WHEN SUM(pfs.gross_sales) > 0
		            THEN 100 * SUM(pfs.net_profit) / SUM(pfs.gross_sales) ELSE 0 END,
		       COALESCE(SUM(pfs.platform_fee_amount), 0),
		       %s,
		       s.status
		FROM portfolio_financial_summaries pfs
		JOIN stores s ON s.id = pfs.store_id
		%s
	`
	var args []interface{}
	if period != "" {
		growthExpression = `CASE WHEN COALESCE(previous.gross_sales, 0) > 0
			THEN 100 * (SUM(pfs.gross_sales) - previous.gross_sales) / previous.gross_sales
			ELSE NULL END`
		growthJoin = `
			LEFT JOIN LATERAL (
				SELECT SUM(previous_period.gross_sales) AS gross_sales
				FROM portfolio_financial_summaries previous_period
				WHERE previous_period.store_id = s.id
				  AND previous_period.period_month = TO_CHAR(
					TO_DATE($1 || '-01', 'YYYY-MM-DD') - INTERVAL '1 month', 'YYYY-MM'
				  )
			) previous ON TRUE
		`
		growthGroupBy = ", previous.gross_sales"
		args = append(args, period)
	}
	query = fmt.Sprintf(query, growthExpression, growthJoin)
	if period != "" {
		query += " WHERE pfs.period_month = $1"
	}
	query += fmt.Sprintf(`
		GROUP BY s.id, s.name, s.slug, s.status
		%s
		ORDER BY SUM(pfs.gross_sales) DESC, s.name
	`, growthGroupBy)

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query portfolio revenue leaderboard: %w", err)
	}
	defer rows.Close()

	items := make([]BrandRevenueLeaderboardItem, 0)
	for rows.Next() {
		var item BrandRevenueLeaderboardItem
		var growthPct sql.NullFloat64
		if err := rows.Scan(
			&item.StoreID,
			&item.StoreName,
			&item.StoreSlug,
			&item.GrossSales,
			&item.NetRevenue,
			&item.OrderCount,
			&item.AOV,
			&item.COGS,
			&item.TotalExpenses,
			&item.NetProfit,
			&item.OperatingMarginPct,
			&item.PlatformFeePaid,
			&growthPct,
			&item.Status,
		); err != nil {
			return nil, fmt.Errorf("scan portfolio revenue leaderboard: %w", err)
		}
		if growthPct.Valid {
			item.GrowthPct = &growthPct.Float64
		}
		items = append(items, item)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate portfolio revenue leaderboard: %w", err)
	}
	for i := range items {
		items[i].Rank = i + 1
	}
	return items, nil
}

// ListBillingRecords returns billing statements stored in the platform database.
func (s *Service) ListBillingRecords(ctx context.Context, status string) ([]BrandBillingRecord, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}

	query := `
		SELECT id, store_id, store_name, store_slug, invoice_number, billing_cycle,
		       base_fee, revenue_share_percentage, revenue_share_amount, hosting_allocation,
		       total_due, currency, status, due_date::text, paid_at, created_at
		FROM brand_billing_records
	`
	var args []interface{}
	if status != "" {
		query += " WHERE status = $1"
		args = append(args, status)
	}
	query += " ORDER BY due_date DESC"

	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query billing records: %w", err)
	}
	defer rows.Close()

	records := make([]BrandBillingRecord, 0)
	for rows.Next() {
		var record BrandBillingRecord
		var paidAt sql.NullTime
		if err := rows.Scan(
			&record.ID,
			&record.StoreID,
			&record.StoreName,
			&record.StoreSlug,
			&record.InvoiceNumber,
			&record.BillingCycle,
			&record.BaseFee,
			&record.RevenueSharePercentage,
			&record.RevenueShareAmount,
			&record.HostingAllocation,
			&record.TotalDue,
			&record.Currency,
			&record.Status,
			&record.DueDate,
			&paidAt,
			&record.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan billing record: %w", err)
		}
		if paidAt.Valid {
			record.PaidAt = &paidAt.Time
		}
		records = append(records, record)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate billing records: %w", err)
	}
	return records, nil
}

// UpdateBillingStatus marks a stored billing invoice as PAID or INVOICED.
func (s *Service) UpdateBillingStatus(ctx context.Context, id string, status string) error {
	if err := s.requireDB(); err != nil {
		return err
	}
	if status != "PAID" && status != "INVOICED" {
		return fmt.Errorf("unsupported billing status %q", status)
	}

	var paidAt *time.Time
	if status == "PAID" {
		now := time.Now().UTC()
		paidAt = &now
	}
	result, err := s.db.ExecContext(ctx,
		"UPDATE brand_billing_records SET status = $1, paid_at = $2 WHERE id = $3",
		status, paidAt, id,
	)
	if err != nil {
		return fmt.Errorf("update billing status: %w", err)
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("read billing update result: %w", err)
	}
	if rowsAffected == 0 {
		return fmt.Errorf("billing record %q not found", id)
	}
	return nil
}

// GetGatewayAllocations returns stored payment-gateway analytics.
// The platform schema has no gateway analytics table, so no metrics are fabricated.
func (s *Service) GetGatewayAllocations(ctx context.Context) ([]GatewayCostAllocation, error) {
	if err := s.requireDB(); err != nil {
		return nil, err
	}
	return []GatewayCostAllocation{}, nil
}
