// Package settings provides domain logic, database operations, and HTTP APIs
// for managing store operational preferences, tax/currency rules, and staff RBAC.
package settings

import (
	"time"
)

// StoreRole defines staff authorization tiers within a brand tenant.
type StoreRole string

const (
	// RoleStoreOwner holds complete operational, financial, and staff authority.
	RoleStoreOwner StoreRole = "STORE_OWNER"
	// RoleStoreAdmin manages catalog, inventory, orders, and customer records.
	RoleStoreAdmin StoreRole = "STORE_ADMIN"
	// RoleStoreStaff provides order fulfillment and view-only operational access.
	RoleStoreStaff StoreRole = "STORE_STAFF"
)

// StoreSettingsDTO represents comprehensive store preferences and policies.
type StoreSettingsDTO struct {
	StoreName              string    `json:"store_name"`
	LegalBusinessName      string    `json:"legal_business_name"`
	ContactEmail           string    `json:"contact_email"`
	ContactPhone           string    `json:"contact_phone"`
	SupportEmail           string    `json:"support_email"`
	Currency               string    `json:"currency"`
	Timezone               string    `json:"timezone"`
	OrderNumberPrefix      string    `json:"order_number_prefix"`
	TaxRatePercent         float64   `json:"tax_rate_percent"`
	PricesIncludeTax       bool      `json:"prices_include_tax"`
	DefaultShippingFee     float64   `json:"default_shipping_fee"`
	WhatsAppPhone          string    `json:"whatsapp_phone,omitempty"`
	FacebookURL            string    `json:"facebook_url,omitempty"`
	InstagramURL           string    `json:"instagram_url,omitempty"`
	MetaTitleTemplate      string    `json:"meta_title_template,omitempty"`
	DefaultMetaTitle       string    `json:"default_meta_title,omitempty"`
	DefaultMetaDescription string    `json:"default_meta_description,omitempty"`
	DefaultKeywords        string    `json:"default_keywords,omitempty"`
	FaviconURL             string    `json:"favicon_url,omitempty"`
	AppleTouchIconURL      string    `json:"apple_touch_icon_url,omitempty"`
	DefaultOGImageURL      string    `json:"default_og_image_url,omitempty"`
	TwitterHandle          string    `json:"twitter_handle,omitempty"`
	GoogleSiteVerification string    `json:"google_site_verification,omitempty"`
	BingSiteVerification   string    `json:"bing_site_verification,omitempty"`
	PinterestVerification  string    `json:"pinterest_verification,omitempty"`
	RobotsTxtCustom        string    `json:"robots_txt_custom,omitempty"`
	SitemapEnabled         bool      `json:"sitemap_enabled"`
	UpdatedAt              time.Time `json:"updated_at"`
}

// UpdateSettingsRequest defines payload to modify store preferences.
type UpdateSettingsRequest struct {
	LegalBusinessName      string  `json:"legal_business_name"`
	ContactPhone           string  `json:"contact_phone"`
	SupportEmail           string  `json:"support_email"`
	OrderNumberPrefix      string  `json:"order_number_prefix"`
	TaxRatePercent         float64 `json:"tax_rate_percent"`
	PricesIncludeTax       bool    `json:"prices_include_tax"`
	DefaultShippingFee     float64 `json:"default_shipping_fee"`
	WhatsAppPhone          string  `json:"whatsapp_phone,omitempty"`
	FacebookURL            string  `json:"facebook_url,omitempty"`
	InstagramURL           string  `json:"instagram_url,omitempty"`
	MetaTitleTemplate      string  `json:"meta_title_template,omitempty"`
	DefaultMetaTitle       string  `json:"default_meta_title,omitempty"`
	DefaultMetaDescription string  `json:"default_meta_description,omitempty"`
	DefaultKeywords        string  `json:"default_keywords,omitempty"`
	FaviconURL             string  `json:"favicon_url,omitempty"`
	AppleTouchIconURL      string  `json:"apple_touch_icon_url,omitempty"`
	DefaultOGImageURL      string  `json:"default_og_image_url,omitempty"`
	TwitterHandle          string  `json:"twitter_handle,omitempty"`
	GoogleSiteVerification string  `json:"google_site_verification,omitempty"`
	BingSiteVerification   string  `json:"bing_site_verification,omitempty"`
	PinterestVerification  string  `json:"pinterest_verification,omitempty"`
	RobotsTxtCustom        string  `json:"robots_txt_custom,omitempty"`
	SitemapEnabled         *bool   `json:"sitemap_enabled,omitempty"`
}

// StaffMember represents an operational staff account in the store.
type StaffMember struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	FirstName string    `json:"first_name"`
	LastName  string    `json:"last_name"`
	Role      StoreRole `json:"role"`
	IsActive  bool      `json:"is_active"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// CreateStaffRequest defines payload to invite or register a staff member.
type CreateStaffRequest struct {
	Email     string    `json:"email"`
	Password  string    `json:"password"`
	FirstName string    `json:"first_name"`
	LastName  string    `json:"last_name"`
	Role      StoreRole `json:"role"` // STORE_ADMIN or STORE_STAFF
}

// UpdateStaffRequest defines payload to update a staff member's permissions or profile.
type UpdateStaffRequest struct {
	FirstName string    `json:"first_name"`
	LastName  string    `json:"last_name"`
	Role      StoreRole `json:"role"`
	IsActive  bool      `json:"is_active"`
}

// ChangePasswordRequest defines payload for staff to change their own password.
type ChangePasswordRequest struct {
	CurrentPassword string `json:"current_password"`
	NewPassword     string `json:"new_password"`
}
