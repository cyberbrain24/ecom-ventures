package accounts

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/csv"
	"fmt"
	"strings"
	"time"

	storeCtx "ecom-ventures/backend/internal/store/context"
)

// Service provides store-level account management, expense logging, and P&L calculations.
type Service struct{}

// NewService instantiates a new Store Accounts Service.
func NewService() *Service {
	return &Service{}
}

// CalculateNetRevenue computes net payout after deducting gateway fee and shipping.
func (s *Service) CalculateNetRevenue(gross, gatewayFee, shippingDeduction float64) float64 {
	net := gross - gatewayFee - shippingDeduction
	if net < 0 {
		return 0
	}
	return net
}

// RecordOrderTransaction inserts or updates a financial transaction for a completed order.
func (s *Service) RecordOrderTransaction(ctx context.Context, tx *AccountTransaction) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}

	query := `
		INSERT INTO account_transactions (
			order_id, order_number, gateway, gateway_transaction_id,
			gross_amount, gateway_fee, shipping_deduction, net_payout,
			currency, status, settlement_status, customer_name, notes, created_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, CURRENT_TIMESTAMP)
		RETURNING id, created_at
	`
	return stCtx.TenantDB.QueryRowContext(ctx, query,
		tx.OrderID, tx.OrderNumber, tx.Gateway, tx.GatewayTransactionID,
		tx.GrossAmount, tx.GatewayFee, tx.ShippingDeduction, tx.NetPayout,
		tx.Currency, tx.Status, tx.SettlementStatus, tx.CustomerName, tx.Notes,
	).Scan(&tx.ID, &tx.CreatedAt)
}

// GetAccountsOverview computes real-time gross revenue, net revenue, total expenses, and estimated P&L.
func (s *Service) GetAccountsOverview(ctx context.Context) (*AccountsOverview, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	ov := &AccountsOverview{
		Currency: stCtx.Store.Currency,
	}
	if ov.Currency == "" {
		ov.Currency = "BDT"
	}

	// 1. Transaction aggregations
	txQuery := `
		SELECT 
			COALESCE(SUM(gross_amount), 0),
			COALESCE(SUM(gateway_fee), 0),
			COALESCE(SUM(shipping_deduction), 0),
			COALESCE(SUM(net_payout), 0),
			COUNT(CASE WHEN settlement_status = 'UNSETTLED' THEN 1 END),
			COUNT(CASE WHEN settlement_status = 'DISCREPANCY' THEN 1 END)
		FROM account_transactions
		WHERE status != 'FAILED'
	`
	_ = stCtx.TenantDB.QueryRowContext(ctx, txQuery).Scan(
		&ov.GrossRevenue,
		&ov.TotalGatewayFees,
		&ov.TotalShippingDeducted,
		&ov.NetRevenue,
		&ov.PendingSettlementCount,
		&ov.DiscrepancyCount,
	)

	// 2. Total logged expenses
	expQuery := `SELECT COALESCE(SUM(amount), 0) FROM account_expenses`
	_ = stCtx.TenantDB.QueryRowContext(ctx, expQuery).Scan(&ov.TotalExpenses)

	// 3. Total payouts received
	payQuery := `SELECT COALESCE(SUM(amount), 0) FROM account_payouts WHERE status = 'COMPLETED'`
	_ = stCtx.TenantDB.QueryRowContext(ctx, payQuery).Scan(&ov.TotalPayoutsReceived)

	// 4. Estimated COGS (approx 40% of gross revenue for inventory valuation baseline)
	ov.EstimatedCOGS = ov.GrossRevenue * 0.40

	// 5. Net Profit = Net Revenue - COGS - Expenses
	ov.NetProfit = ov.NetRevenue - ov.EstimatedCOGS - ov.TotalExpenses
	if ov.GrossRevenue > 0 {
		ov.OperatingMarginPct = (ov.NetProfit / ov.GrossRevenue) * 100
	}

	return ov, nil
}

// ListTransactions retrieves transactions with optional status or gateway filtering.
func (s *Service) ListTransactions(ctx context.Context, status, gateway string) ([]AccountTransaction, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	var conditions []string
	var args []interface{}
	idx := 1

	if status != "" {
		conditions = append(conditions, fmt.Sprintf("status = $%d", idx))
		args = append(args, status)
		idx++
	}
	if gateway != "" {
		conditions = append(conditions, fmt.Sprintf("gateway = $%d", idx))
		args = append(args, gateway)
		idx++
	}

	whereClause := ""
	if len(conditions) > 0 {
		whereClause = "WHERE " + strings.Join(conditions, " AND ")
	}

	query := fmt.Sprintf(`
		SELECT id, order_id, order_number, gateway, gateway_transaction_id,
		       gross_amount, gateway_fee, shipping_deduction, net_payout,
		       currency, status, settlement_status, customer_name, COALESCE(notes, ''),
		       created_at, settled_at
		FROM account_transactions
		%s
		ORDER BY created_at DESC
		LIMIT 100
	`, whereClause)

	rows, err := stCtx.TenantDB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []AccountTransaction
	for rows.Next() {
		var tx AccountTransaction
		var orderID sql.NullString
		var settledAt sql.NullTime

		err := rows.Scan(
			&tx.ID, &orderID, &tx.OrderNumber, &tx.Gateway, &tx.GatewayTransactionID,
			&tx.GrossAmount, &tx.GatewayFee, &tx.ShippingDeduction, &tx.NetPayout,
			&tx.Currency, &tx.Status, &tx.SettlementStatus, &tx.CustomerName, &tx.Notes,
			&tx.CreatedAt, &settledAt,
		)
		if err != nil {
			continue
		}
		if orderID.Valid {
			tx.OrderID = &orderID.String
		}
		if settledAt.Valid {
			tx.SettledAt = &settledAt.Time
		}
		result = append(result, tx)
	}

	return result, nil
}

// ListExpenses returns logged expenses.
func (s *Service) ListExpenses(ctx context.Context, category string) ([]AccountExpense, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT id, category, title, amount, currency, COALESCE(receipt_url, ''),
		       logged_by, expense_date::text, COALESCE(notes, ''), created_at
		FROM account_expenses
	`
	var args []interface{}
	if category != "" {
		query += " WHERE category = $1"
		args = append(args, category)
	}
	query += " ORDER BY expense_date DESC, created_at DESC"

	rows, err := stCtx.TenantDB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var expenses []AccountExpense
	for rows.Next() {
		var exp AccountExpense
		err := rows.Scan(
			&exp.ID, &exp.Category, &exp.Title, &exp.Amount, &exp.Currency,
			&exp.ReceiptURL, &exp.LoggedBy, &exp.ExpenseDate, &exp.Notes, &exp.CreatedAt,
		)
		if err != nil {
			continue
		}
		expenses = append(expenses, exp)
	}
	return expenses, nil
}

// LogExpense inserts a new operational cost log into the tenant database.
func (s *Service) LogExpense(ctx context.Context, req *CreateExpenseRequest, staffEmail string) (*AccountExpense, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	if req.Amount <= 0 {
		return nil, fmt.Errorf("expense amount must be greater than zero")
	}
	if req.Title == "" {
		return nil, fmt.Errorf("expense title is required")
	}
	if req.Category == "" {
		req.Category = "OTHER"
	}
	if req.ExpenseDate == "" {
		req.ExpenseDate = time.Now().Format("2006-01-02")
	}

	currency := stCtx.Store.Currency
	if currency == "" {
		currency = "BDT"
	}

	query := `
		INSERT INTO account_expenses (category, title, amount, currency, receipt_url, logged_by, expense_date, notes)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		RETURNING id, created_at
	`
	exp := &AccountExpense{
		Category:    req.Category,
		Title:       req.Title,
		Amount:      req.Amount,
		Currency:    currency,
		ReceiptURL:  req.ReceiptURL,
		LoggedBy:    staffEmail,
		ExpenseDate: req.ExpenseDate,
		Notes:       req.Notes,
	}

	err = stCtx.TenantDB.QueryRowContext(ctx, query,
		exp.Category, exp.Title, exp.Amount, exp.Currency, exp.ReceiptURL,
		exp.LoggedBy, exp.ExpenseDate, exp.Notes,
	).Scan(&exp.ID, &exp.CreatedAt)
	if err != nil {
		return nil, err
	}
	return exp, nil
}

// DeleteExpense removes an expense entry.
func (s *Service) DeleteExpense(ctx context.Context, id string) error {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return err
	}
	_, err = stCtx.TenantDB.ExecContext(ctx, "DELETE FROM account_expenses WHERE id = $1", id)
	return err
}

// ListPayouts returns historical payouts transferred to the merchant's bank account.
func (s *Service) ListPayouts(ctx context.Context) ([]AccountPayout, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT id, payout_reference, amount, currency, gateway, destination_bank,
		       account_number_mask, status, COALESCE(period_start::text, ''),
		       COALESCE(period_end::text, ''), processed_at, COALESCE(notes, '')
		FROM account_payouts
		ORDER BY processed_at DESC
	`
	rows, err := stCtx.TenantDB.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var payouts []AccountPayout
	for rows.Next() {
		var p AccountPayout
		err := rows.Scan(
			&p.ID, &p.PayoutReference, &p.Amount, &p.Currency, &p.Gateway,
			&p.DestinationBank, &p.AccountNumberMask, &p.Status,
			&p.PeriodStart, &p.PeriodEnd, &p.ProcessedAt, &p.Notes,
		)
		if err != nil {
			continue
		}
		payouts = append(payouts, p)
	}
	return payouts, nil
}

// GetReconciliationSummary checks for mismatches between gateway settlements and store orders.
func (s *Service) GetReconciliationSummary(ctx context.Context) ([]PaymentReconciliationItem, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	// Query orders joined with account_transactions to identify discrepancies
	query := `
		SELECT 
			o.order_number,
			COALESCE(o.customer_name, 'Guest Customer'),
			COALESCE(t.gateway, o.payment_method, 'COD'),
			COALESCE(t.status, 'PENDING') AS gateway_status,
			o.status AS store_order_status,
			o.total_amount AS expected_amount,
			COALESCE(t.gross_amount, 0) AS received_amount,
			(o.total_amount - COALESCE(t.gross_amount, 0)) AS discrepancy_amount,
			CASE 
				WHEN t.status = 'PAID' AND o.status IN ('CONFIRMED', 'DELIVERED', 'SHIPPED') AND (o.total_amount = t.gross_amount) THEN true
				ELSE false
			END AS reconciled,
			o.created_at
		FROM orders o
		LEFT JOIN account_transactions t ON t.order_id = o.id
		ORDER BY o.created_at DESC
		LIMIT 50
	`
	rows, err := stCtx.TenantDB.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []PaymentReconciliationItem
	for rows.Next() {
		var item PaymentReconciliationItem
		err := rows.Scan(
			&item.OrderNumber, &item.CustomerName, &item.Gateway,
			&item.GatewayStatus, &item.StoreOrderStatus,
			&item.ExpectedAmount, &item.ReceivedAmount,
			&item.DiscrepancyAmount, &item.Reconciled, &item.Timestamp,
		)
		if err != nil {
			continue
		}
		if !item.Reconciled {
			if item.GatewayStatus == "PAID" && item.StoreOrderStatus == "PENDING" {
				item.IssueReason = "Gateway paid but order fulfillment is pending acknowledgment"
			} else if item.GatewayStatus == "PENDING" && item.StoreOrderStatus == "DELIVERED" {
				item.IssueReason = "Order marked delivered without confirmed gateway settlement"
			} else if item.DiscrepancyAmount != 0 {
				item.IssueReason = fmt.Sprintf("Amount mismatch: expected ৳%.2f vs received ৳%.2f", item.ExpectedAmount, item.ReceivedAmount)
			} else {
				item.IssueReason = "Pending automated cross-reference"
			}
		}
		items = append(items, item)
	}
	return items, nil
}

// GetProfitLoss computes a monthly P&L: Net Revenue - COGS - Total Expenses = Net Profit.
func (s *Service) GetProfitLoss(ctx context.Context, period string) (*ProfitLossReport, error) {
	stCtx, err := storeCtx.FromContext(ctx)
	if err != nil {
		return nil, err
	}

	report := &ProfitLossReport{
		Period:             period,
		Currency:           stCtx.Store.Currency,
		ExpensesByCategory: make(map[string]float64),
	}
	if report.Period == "" {
		report.Period = time.Now().Format("January 2006")
	}
	if report.Currency == "" {
		report.Currency = "BDT"
	}

	// 1. Compute Sales and Deductions
	query := `
		SELECT 
			COALESCE(SUM(gross_amount), 0),
			COALESCE(SUM(gateway_fee), 0),
			COALESCE(SUM(shipping_deduction), 0),
			COALESCE(SUM(net_payout), 0)
		FROM account_transactions
		WHERE status != 'FAILED'
	`
	_ = stCtx.TenantDB.QueryRowContext(ctx, query).Scan(
		&report.GrossSales,
		&report.GatewayFees,
		&report.ShippingCosts,
		&report.NetRevenue,
	)

	// 2. COGS (40% baseline inventory cost)
	report.CostOfGoodsSold = report.GrossSales * 0.40
	report.GrossProfit = report.NetRevenue - report.CostOfGoodsSold
	if report.GrossSales > 0 {
		report.GrossMarginPct = (report.GrossProfit / report.GrossSales) * 100
	}

	// 3. Expenses breakdown
	expRows, err := stCtx.TenantDB.QueryContext(ctx, `
		SELECT category, COALESCE(SUM(amount), 0)
		FROM account_expenses
		GROUP BY category
	`)
	if err == nil {
		defer expRows.Close()
		for expRows.Next() {
			var cat string
			var amt float64
			if err := expRows.Scan(&cat, &amt); err == nil {
				report.ExpensesByCategory[cat] = amt
				report.TotalExpenses += amt
			}
		}
	}

	// 4. Net Profit & Margin
	report.NetProfit = report.GrossProfit - report.TotalExpenses
	if report.GrossSales > 0 {
		report.NetMarginPct = (report.NetProfit / report.GrossSales) * 100
	}

	return report, nil
}

// ExportLedgerCSV exports transactions or expenses as a CSV file buffer.
func (s *Service) ExportLedgerCSV(ctx context.Context, ledgerType string) ([]byte, string, error) {
	buf := &bytes.Buffer{}
	writer := csv.NewWriter(buf)

	filename := fmt.Sprintf("%s-ledger-%s.csv", ledgerType, time.Now().Format("20060102-150405"))

	if ledgerType == "expenses" {
		expenses, err := s.ListExpenses(ctx, "")
		if err != nil {
			return nil, "", err
		}
		_ = writer.Write([]string{"Expense ID", "Category", "Title", "Amount", "Currency", "Date", "Logged By", "Notes"})
		for _, exp := range expenses {
			_ = writer.Write([]string{
				exp.ID,
				exp.Category,
				exp.Title,
				fmt.Sprintf("%.2f", exp.Amount),
				exp.Currency,
				exp.ExpenseDate,
				exp.LoggedBy,
				exp.Notes,
			})
		}
	} else {
		// Default to Transactions ledger
		txs, err := s.ListTransactions(ctx, "", "")
		if err != nil {
			return nil, "", err
		}
		_ = writer.Write([]string{"Tx ID", "Order Number", "Gateway", "Gateway Ref", "Gross Amount", "Gateway Fee", "Shipping Deduct", "Net Payout", "Currency", "Status", "Settlement", "Date"})
		for _, tx := range txs {
			_ = writer.Write([]string{
				tx.ID,
				tx.OrderNumber,
				tx.Gateway,
				tx.GatewayTransactionID,
				fmt.Sprintf("%.2f", tx.GrossAmount),
				fmt.Sprintf("%.2f", tx.GatewayFee),
				fmt.Sprintf("%.2f", tx.ShippingDeduction),
				fmt.Sprintf("%.2f", tx.NetPayout),
				tx.Currency,
				tx.Status,
				tx.SettlementStatus,
				tx.CreatedAt.Format(time.RFC3339),
			})
		}
	}

	writer.Flush()
	return buf.Bytes(), filename, nil
}
