// Package marketing provides domain logic, database operations, and HTTP APIs
// for managing brand tracking configurations, Meta Pixel, Meta CAPI, and Google Analytics.
package marketing

import (
	"time"
)

// MarketingConfig represents store-level marketing credentials stored in the tenant DB.
type MarketingConfig struct {
	ID               string    `json:"id"`
	MetaPixelID      string    `json:"meta_pixel_id"`
	MetaCAPIToken    string    `json:"meta_capi_token"` // Encrypted at rest
	MetaTestCode     string    `json:"meta_test_code,omitempty"`
	GA4MeasurementID string    `json:"ga4_measurement_id"`
	GTMContainerID   string    `json:"gtm_container_id"`
	GoogleAdsID      string    `json:"google_ads_id,omitempty"`
	IsPixelEnabled   bool      `json:"is_pixel_enabled"`
	IsCAPIEnabled    bool      `json:"is_capi_enabled"`
	IsGA4Enabled     bool      `json:"is_ga4_enabled"`
	IsGTMEnabled     bool      `json:"is_gtm_enabled"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// UpdateMarketingConfigRequest defines payload for store managers to update tracking IDs.
type UpdateMarketingConfigRequest struct {
	MetaPixelID      string `json:"meta_pixel_id"`
	MetaCAPIToken    string `json:"meta_capi_token"`
	MetaTestCode     string `json:"meta_test_code"`
	GA4MeasurementID string `json:"ga4_measurement_id"`
	GTMContainerID   string `json:"gtm_container_id"`
	GoogleAdsID      string `json:"google_ads_id"`
	IsPixelEnabled   bool   `json:"is_pixel_enabled"`
	IsCAPIEnabled    bool   `json:"is_capi_enabled"`
	IsGA4Enabled     bool   `json:"is_ga4_enabled"`
	IsGTMEnabled     bool   `json:"is_gtm_enabled"`
}

// PublicMarketingConfig represents sanitized tracking IDs exposed to storefront client scripts.
type PublicMarketingConfig struct {
	MetaPixelID      string `json:"meta_pixel_id,omitempty"`
	GA4MeasurementID string `json:"ga4_measurement_id,omitempty"`
	GTMContainerID   string `json:"gtm_container_id,omitempty"`
	GoogleAdsID      string `json:"google_ads_id,omitempty"`
	IsPixelEnabled   bool   `json:"is_pixel_enabled"`
	IsGA4Enabled     bool   `json:"is_ga4_enabled"`
	IsGTMEnabled     bool   `json:"is_gtm_enabled"`
}

// CAPIUserData represents hashed customer identifiers according to Meta CAPI specification.
type CAPIUserData struct {
	EmailHash       string `json:"em,omitempty"`                // SHA-256 hashed lowercase trimmed email
	PhoneHash       string `json:"ph,omitempty"`                // SHA-256 hashed digits with country code
	ClientIP        string `json:"client_ip_address,omitempty"` // Customer IP address
	ClientUserAgent string `json:"client_user_agent,omitempty"` // Customer User Agent
	Fbc             string `json:"fbc,omitempty"`               // Facebook Click ID from cookie
	Fbp             string `json:"fbp,omitempty"`               // Facebook Browser ID from cookie
}

// CAPIContentItem represents a single item inside a CAPI event.
type CAPIContentItem struct {
	ID        string  `json:"id"`
	Quantity  int     `json:"quantity"`
	ItemPrice float64 `json:"item_price"`
}

// CAPICustomData represents conversion monetary values and item payloads.
type CAPICustomData struct {
	Value       float64           `json:"value,omitempty"`
	Currency    string            `json:"currency,omitempty"`
	ContentType string            `json:"content_type,omitempty"` // "product"
	Contents    []CAPIContentItem `json:"contents,omitempty"`
	OrderID     string            `json:"order_id,omitempty"`
}

// CAPIEvent defines a single normalized server-side event submitted to Meta Graph API.
type CAPIEvent struct {
	EventName      string          `json:"event_name"` // "Purchase", "InitiateCheckout", "AddToCart", "ViewContent"
	EventTime      int64           `json:"event_time"` // Unix epoch timestamp in seconds
	EventID        string          `json:"event_id"`   // Deduplication key shared with client pixel
	EventSourceURL string          `json:"event_source_url"`
	ActionSource   string          `json:"action_source"` // "website"
	UserData       CAPIUserData    `json:"user_data"`
	CustomData     *CAPICustomData `json:"custom_data,omitempty"`
}

// MetaAttributionScorecard represents the 3-Way Reconciliation Scorecard.
type MetaAttributionScorecard struct {
	Status             string  `json:"status"` // HEALTHY, WARNING, CRITICAL
	DiscrepancyRate    float64 `json:"discrepancy_rate"`
	StorefrontOrders   int     `json:"storefront_orders"`
	TrackedTouchpoints int     `json:"tracked_touchpoints"`
	MetaCAPIReceived   int     `json:"meta_capi_received"`
	IntakeEvents       int     `json:"intake_events"`
	QuarantinedEvents  int     `json:"quarantined_events"`
}

// ExecutiveFinancialMetrics tiles.
type ExecutiveFinancialMetrics struct {
	DeliveredROAS      float64 `json:"delivered_roas"`
	NetContributionBDT float64 `json:"net_contribution_bdt"`
	DeliveredRevenue   float64 `json:"delivered_revenue_bdt"`
	DeliveredOrders    int     `json:"delivered_orders_count"`
	AdSpendBDT         float64 `json:"ad_spend_bdt"`
	AdSpendUSD         float64 `json:"ad_spend_usd"`
}

// CampaignAttributionRow represents a single campaign row in the Attribution Matrix.
type CampaignAttributionRow struct {
	CampaignID       string  `json:"campaign_id"`
	CampaignName     string  `json:"campaign_name"`
	AdSpendBDT       float64 `json:"ad_spend_bdt"`
	AdSpendUSD       float64 `json:"ad_spend_usd"`
	AttributedPlaced int     `json:"attributed_placed_orders"`
	PlacedRevenueBDT float64 `json:"placed_revenue_bdt"`
	DeliveredOrders  int     `json:"delivered_orders"`
	DeliveredRevenue float64 `json:"delivered_revenue_bdt"`
	DeliveryRate     float64 `json:"delivery_rate"`
	COGS             float64 `json:"cogs_bdt"`
	CourierCost      float64 `json:"courier_cost_bdt"`
	ReturnPenalty    float64 `json:"return_penalty_bdt"`
	NetAdProfit      float64 `json:"net_ad_profit_bdt"`
	RealROAS         float64 `json:"real_roas"`
	IsUnprofitable   bool    `json:"is_unprofitable"`
}

// MetaCAPIAuditLogRow represents an audit entry for server-side CAPI dispatch.
type MetaCAPIAuditLogRow struct {
	ID               string    `json:"id"`
	OrderID          *string   `json:"order_id,omitempty"`
	EventName        string    `json:"event_name"`
	EventID          string    `json:"event_id"`
	Status           string    `json:"status"` // SUCCESS, SKIPPED, FAILED, QUARANTINED
	HTTPCode         int       `json:"http_code"`
	AgeHours         float64   `json:"age_hours"`
	IsAgeQuarantined bool      `json:"is_age_quarantined"`
	DispatchedAt     time.Time `json:"dispatched_at"`
}

// MetaAttributionDashboardResponse aggregates all components of the Attribution Platform.
type MetaAttributionDashboardResponse struct {
	Scorecard   MetaAttributionScorecard  `json:"scorecard"`
	Financials  ExecutiveFinancialMetrics `json:"financials"`
	Campaigns   []CampaignAttributionRow  `json:"campaigns"`
	AuditLogs   []MetaCAPIAuditLogRow     `json:"audit_logs"`
	ActiveModel string                    `json:"active_model"` // last_paid_ad, first_touch, linear, position_based
}
