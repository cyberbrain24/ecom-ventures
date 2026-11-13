package accounts

import "time"

// PortfolioFinancialSummary represents consolidated high-level financial health across all brand stores.
type PortfolioFinancialSummary struct {
	TotalGMV                float64            `json:"total_gmv"`
	TotalNetCashFlow        float64            `json:"total_net_cash_flow"`
	TotalPlatformFeesEarned float64            `json:"total_platform_fees_earned"`
	TotalActiveStores       int                `json:"total_active_stores"`
	TotalOrdersProcessed    int                `json:"total_orders_processed"`
	AverageOrderValue       float64            `json:"average_order_value"`
	Currency                string             `json:"currency"`
	RevenueByStore          map[string]float64 `json:"revenue_by_store"`
	UpdatedTimestamp        time.Time          `json:"updated_timestamp"`
}

// BrandRevenueLeaderboardItem compares sales, AOV, order volume, and profitability margins across brands.
type BrandRevenueLeaderboardItem struct {
	Rank               int     `json:"rank"`
	StoreID            string  `json:"store_id"`
	StoreName          string  `json:"store_name"`
	StoreSlug          string  `json:"store_slug"`
	GrossSales         float64 `json:"gross_sales"`
	NetRevenue         float64 `json:"net_revenue"`
	OrderCount         int     `json:"order_count"`
	AOV                float64 `json:"aov"`
	COGS               float64 `json:"cogs"`
	TotalExpenses      float64 `json:"total_expenses"`
	NetProfit          float64 `json:"net_profit"`
	OperatingMarginPct float64 `json:"operating_margin_pct"`
	PlatformFeePaid    float64 `json:"platform_fee_paid"`
	GrowthPct          float64 `json:"growth_pct"`
	Status             string  `json:"status"` // ACTIVE, PROVISIONING, etc.
}

// BrandBillingRecord tracks platform usage fees, hosting cost allocations, and revenue sharing per brand.
type BrandBillingRecord struct {
	ID                     string     `json:"id"`
	StoreID                string     `json:"store_id"`
	StoreName              string     `json:"store_name"`
	StoreSlug              string     `json:"store_slug"`
	InvoiceNumber          string     `json:"invoice_number"`
	BillingCycle           string     `json:"billing_cycle"` // MONTHLY, QUARTERLY, ANNUAL
	BaseFee                float64    `json:"base_fee"`
	RevenueSharePercentage float64    `json:"revenue_share_percentage"`
	RevenueShareAmount     float64    `json:"revenue_share_amount"`
	HostingAllocation      float64    `json:"hosting_allocation"`
	TotalDue               float64    `json:"total_due"`
	Currency               string     `json:"currency"`
	Status                 string     `json:"status"` // PAID, INVOICED, OVERDUE
	DueDate                string     `json:"due_date"`
	PaidAt                 *time.Time `json:"paid_at,omitempty"`
	CreatedAt              time.Time  `json:"created_at"`
}

// GatewayCostAllocation gives insight into commission structures and marketing overhead distribution.
type GatewayCostAllocation struct {
	GatewayName      string  `json:"gateway_name"`
	TotalVolume      float64 `json:"total_volume"`
	EffectiveFeeRate float64 `json:"effective_fee_rate"` // e.g. 1.85%
	TotalCommissions float64 `json:"total_commissions"`
	ActiveBrandCount int     `json:"active_brand_count"`
	SettlementSpeed  string  `json:"settlement_speed"` // e.g. T+1, T+2
}
