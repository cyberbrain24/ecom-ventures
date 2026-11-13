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
