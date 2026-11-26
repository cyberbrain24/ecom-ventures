package reports

// SalesReportResponse is the executive sales and P&L report returned to Store Admin.
type SalesReportResponse struct {
	Preset       string                     `json:"preset"`
	DateFrom     string                     `json:"date_from"`
	DateTo       string                     `json:"date_to"`
	Timezone     string                     `json:"timezone"`
	Currency     string                     `json:"currency"`
	Snapshot     SalesSnapshot              `json:"snapshot"`
	StatusReport map[string]StatusBreakdown `json:"status_report"`
}

// SalesSnapshot contains aggregated KPIs and P&L metrics across active statuses.
type SalesSnapshot struct {
	OrdersQty      int     `json:"orders_qty"`
	ProductQty     int     `json:"product_qty"`
	TotalAmount    float64 `json:"total_amount"`
	AOV            float64 `json:"aov"`
	ProductCosting float64 `json:"product_costing"`
	MetaAdsUSD     float64 `json:"meta_ads_usd"`
	USDRate        float64 `json:"usd_rate"`
	MetaAdsCosting float64 `json:"meta_ads_costing"`
	FixedExpense   float64 `json:"fixed_expense"`
	TotalProfit    float64 `json:"total_profit"`
}

// StatusBreakdown represents order, item, revenue, and COGS totals for a single order status.
type StatusBreakdown struct {
	Key           string  `json:"key"`
	Name          string  `json:"name"`
	Orders        int     `json:"orders"`
	Products      int     `json:"products"`
	Percentage    float64 `json:"percentage"`
	Value         float64 `json:"value"`
	Costing       float64 `json:"costing"`
	DefaultActive bool    `json:"default_active"`
}

// UpdateUSDRateRequest updates the tenant's USD-to-local-currency conversion rate.
type UpdateUSDRateRequest struct {
	USDRate float64 `json:"usd_rate"`
}
