package accounts

import "time"

// AccountTransaction represents an order payment transaction with gateway fees and deductions.
type AccountTransaction struct {
	ID                   string     `json:"id"`
	OrderID              *string    `json:"order_id,omitempty"`
	OrderNumber          string     `json:"order_number"`
	Gateway              string     `json:"gateway"` // BKASH, SSLCOMMERZ, STRIPE, COD
	GatewayTransactionID string     `json:"gateway_transaction_id"`
	GrossAmount          float64    `json:"gross_amount"`
	GatewayFee           float64    `json:"gateway_fee"`
	ShippingDeduction    float64    `json:"shipping_deduction"`
	NetPayout            float64    `json:"net_payout"`
	Currency             string     `json:"currency"`
	Status               string     `json:"status"`            // PAID, REFUNDED, FAILED, PENDING
	SettlementStatus     string     `json:"settlement_status"` // SETTLED, UNSETTLED, DISCREPANCY
	CustomerName         string     `json:"customer_name"`
	Notes                string     `json:"notes,omitempty"`
	CreatedAt            time.Time  `json:"created_at"`
	SettledAt            *time.Time `json:"settled_at,omitempty"`
}

// AccountExpense represents a logged operational expense for a store brand.
type AccountExpense struct {
	ID          string    `json:"id"`
	Category    string    `json:"category"` // PACKAGING, META_ADS, COURIER_HANDLING, STUDIO_PHOTO, OPERATIONS, INVENTORY_LOGISTICS, OTHER
	Title       string    `json:"title"`
	Amount      float64   `json:"amount"`
	Currency    string    `json:"currency"`
	ReceiptURL  string    `json:"receipt_url,omitempty"`
	LoggedBy    string    `json:"logged_by"`
	ExpenseDate string    `json:"expense_date"` // YYYY-MM-DD
	Notes       string    `json:"notes,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
}

// CreateExpenseRequest payload for logging a new operational expense.
type CreateExpenseRequest struct {
	Category    string  `json:"category"`
	Title       string  `json:"title"`
	Amount      float64 `json:"amount"`
	ExpenseDate string  `json:"expense_date"`
	ReceiptURL  string  `json:"receipt_url,omitempty"`
	Notes       string  `json:"notes,omitempty"`
}

// AccountPayout records merchant settlements transferred to brand owner's bank account.
type AccountPayout struct {
	ID                string    `json:"id"`
	PayoutReference   string    `json:"payout_reference"`
	Amount            float64   `json:"amount"`
	Currency          string    `json:"currency"`
	Gateway           string    `json:"gateway"`
	DestinationBank   string    `json:"destination_bank"`
	AccountNumberMask string    `json:"account_number_mask"`
	Status            string    `json:"status"` // COMPLETED, PENDING, FAILED
	PeriodStart       string    `json:"period_start,omitempty"`
	PeriodEnd         string    `json:"period_end,omitempty"`
	ProcessedAt       time.Time `json:"processed_at"`
	Notes             string    `json:"notes,omitempty"`
}

// AccountsOverview aggregates store cash flow and key financial metrics.
type AccountsOverview struct {
	GrossRevenue           float64 `json:"gross_revenue"`
	TotalGatewayFees       float64 `json:"total_gateway_fees"`
	TotalShippingDeducted  float64 `json:"total_shipping_deducted"`
	NetRevenue             float64 `json:"net_revenue"`
	TotalExpenses          float64 `json:"total_expenses"`
	TotalPayoutsReceived   float64 `json:"total_payouts_received"`
	EstimatedCOGS          float64 `json:"estimated_cogs"`
	NetProfit              float64 `json:"net_profit"`
	OperatingMarginPct     float64 `json:"operating_margin_pct"`
	Currency               string  `json:"currency"`
	PendingSettlementCount int     `json:"pending_settlement_count"`
	DiscrepancyCount       int     `json:"discrepancy_count"`
}

// PaymentReconciliationItem cross-references gateway notifications and orders.
type PaymentReconciliationItem struct {
	OrderNumber       string    `json:"order_number"`
	CustomerName      string    `json:"customer_name"`
	Gateway           string    `json:"gateway"`
	GatewayStatus     string    `json:"gateway_status"`     // e.g. PAID, CAPTURED
	StoreOrderStatus  string    `json:"store_order_status"` // e.g. CONFIRMED, PENDING, DELIVERED
	ExpectedAmount    float64   `json:"expected_amount"`
	ReceivedAmount    float64   `json:"received_amount"`
	DiscrepancyAmount float64   `json:"discrepancy_amount"`
	Reconciled        bool      `json:"reconciled"`
	IssueReason       string    `json:"issue_reason,omitempty"`
	Timestamp         time.Time `json:"timestamp"`
}

// ProfitLossReport represents monthly P&L calculation: Net Revenue - COGS - Expenses = Net Profit.
type ProfitLossReport struct {
	Period              string             `json:"period"` // e.g. "November 2026"
	GrossSales          float64            `json:"gross_sales"`
	DiscountsAndReturns float64            `json:"discounts_and_returns"`
	GatewayFees         float64            `json:"gateway_fees"`
	ShippingCosts       float64            `json:"shipping_costs"`
	NetRevenue          float64            `json:"net_revenue"`
	CostOfGoodsSold     float64            `json:"cost_of_goods_sold"`
	GrossProfit         float64            `json:"gross_profit"`
	GrossMarginPct      float64            `json:"gross_margin_pct"`
	ExpensesByCategory  map[string]float64 `json:"expenses_by_category"`
	TotalExpenses       float64            `json:"total_expenses"`
	NetProfit           float64            `json:"net_profit"`
	NetMarginPct        float64            `json:"net_margin_pct"`
	Currency            string             `json:"currency"`
}
