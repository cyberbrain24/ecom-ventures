// Package customers provides domain logic, database operations, and HTTP APIs
// for managing customer accounts, address books, and lifetime value analytics.
package customers

import (
	"time"

	storeModels "ecom-ventures/backend/internal/store/models"
)

// CreateCustomerRequest defines payload to register a new customer profile.
type CreateCustomerRequest struct {
	Email          string                     `json:"email"`
	FirstName      string                     `json:"first_name"`
	LastName       string                     `json:"last_name"`
	Phone          *string                    `json:"phone,omitempty"`
	Password       *string                    `json:"password,omitempty"` // Optional when created manually by store admin
	MembershipTier storeModels.MembershipTier `json:"membership_tier,omitempty"`
	DateOfBirth    *string                    `json:"date_of_birth,omitempty"`
	CRMNotes       string                     `json:"crm_notes,omitempty"`
}

// UpdateCustomerRequest defines payload to update mutable customer details.
type UpdateCustomerRequest struct {
	FirstName      string                     `json:"first_name"`
	LastName       string                     `json:"last_name"`
	Phone          *string                    `json:"phone,omitempty"`
	MembershipTier storeModels.MembershipTier `json:"membership_tier"`
	DateOfBirth    *string                    `json:"date_of_birth,omitempty"`
	CRMNotes       string                     `json:"crm_notes"`
	IsActive       bool                       `json:"is_active"`
}

// UpdateCRMProfileRequest updates CRM-specific operational notes and membership tier.
type UpdateCRMProfileRequest struct {
	MembershipTier storeModels.MembershipTier `json:"membership_tier"`
	DateOfBirth    *string                    `json:"date_of_birth,omitempty"`
	CRMNotes       string                     `json:"crm_notes"`
}

// ToggleBlacklistRequest enables or disables account blacklisting.
type ToggleBlacklistRequest struct {
	IsBlacklisted bool   `json:"is_blacklisted"`
	Reason        string `json:"reason"`
}

// AddressRequest defines payload to add or update an address in the customer's book.
type AddressRequest struct {
	Label             string  `json:"label"` // Home, Office, Default
	RecipientName     string  `json:"recipient_name"`
	Phone             string  `json:"phone"`
	StreetAddress     string  `json:"street_address"`
	ApartmentSuite    *string `json:"apartment_suite,omitempty"`
	City              string  `json:"city"`
	District          string  `json:"district"`
	Thana             string  `json:"thana"`
	StateProvince     *string `json:"state_province,omitempty"`
	PostalCode        *string `json:"postal_code,omitempty"`
	Country           string  `json:"country"`
	IsDefaultShipping bool    `json:"is_default_shipping"`
	IsDefaultBilling  bool    `json:"is_default_billing"`
}

// CustomerMetrics summarizes commercial engagement and lifetime spending.
type CustomerMetrics struct {
	TotalOrders       int        `json:"total_orders"`
	DeliveredOrders   int        `json:"delivered_orders"`
	CancelledOrders   int        `json:"cancelled_orders"`
	RtoOrders         int        `json:"rto_orders"`
	ReliabilityScore  float64    `json:"reliability_score"` // Percentage: Delivered / (Delivered + Cancelled + RTO) * 100
	RtoRate           float64    `json:"rto_rate"`          // Percentage: (Cancelled + RTO) / TotalOrders * 100
	LifetimeValue     float64    `json:"lifetime_value"`    // Paid orders spend
	AverageOrderValue float64    `json:"average_order_value"`
	LastOrderDate     *time.Time `json:"last_order_date,omitempty"`
}

// CustomerSummary represents high-level metrics for customer registry tables.
type CustomerSummary struct {
	ID              string                     `json:"id"`
	Email           string                     `json:"email"`
	FirstName       string                     `json:"first_name"`
	LastName        string                     `json:"last_name"`
	Phone           *string                    `json:"phone,omitempty"`
	MembershipTier  storeModels.MembershipTier `json:"membership_tier"`
	IsActive        bool                       `json:"is_active"`
	IsBlacklisted   bool                       `json:"is_blacklisted"`
	BlacklistReason string                     `json:"blacklist_reason"`
	City            string                     `json:"city"`
	District        string                     `json:"district"`
	Thana           string                     `json:"thana"`
	Metrics         CustomerMetrics            `json:"metrics"`
	CreatedAt       time.Time                  `json:"created_at"`
	UpdatedAt       time.Time                  `json:"updated_at"`
}

// CustomerOrderSummary represents a brief order row for the customer detail view.
type CustomerOrderSummary struct {
	ID            string    `json:"id"`
	OrderNumber   string    `json:"order_number"`
	Status        string    `json:"status"`
	PaymentStatus string    `json:"payment_status"`
	TotalAmount   float64   `json:"total_amount"`
	ItemCount     int       `json:"item_count"`
	CreatedAt     time.Time `json:"created_at"`
}

// CustomerDetailResponse provides complete metadata including saved addresses and LTV metrics.
type CustomerDetailResponse struct {
	storeModels.Customer
	Metrics      CustomerMetrics               `json:"metrics"`
	Addresses    []storeModels.CustomerAddress `json:"addresses"`
	RecentOrders []CustomerOrderSummary        `json:"recent_orders"`
}

// CustomerFilterParams defines query parameters for searching and paginating customer records.
type CustomerFilterParams struct {
	Search         string
	MembershipTier string
	IsActive       *bool
	IsBlacklisted  *bool
	Page           int
	Limit          int
}

// PaginatedCustomersResponse wraps listed customers with pagination metadata.
type PaginatedCustomersResponse struct {
	Customers []CustomerSummary `json:"customers"`
	Total     int               `json:"total"`
	Page      int               `json:"page"`
	Limit     int               `json:"limit"`
}

// ImpersonateResponse carries the time-scoped storefront JWT token.
type ImpersonateResponse struct {
	CustomerToken string `json:"customer_token"`
	ExpiresIn     int    `json:"expires_in_seconds"`
	RedirectURL   string `json:"redirect_url"`
}
