// Package customers provides domain logic, database operations, and HTTP APIs
// for managing customer accounts, address books, and lifetime value analytics.
package customers

import (
	"time"

	storeModels "ecom-ventures/backend/internal/store/models"
)

// CreateCustomerRequest defines payload to register a new customer profile.
type CreateCustomerRequest struct {
	Email     string  `json:"email"`
	FirstName string  `json:"first_name"`
	LastName  string  `json:"last_name"`
	Phone     *string `json:"phone,omitempty"`
	Password  *string `json:"password,omitempty"` // Optional when created manually by store admin
}

// UpdateCustomerRequest defines payload to update mutable customer details.
type UpdateCustomerRequest struct {
	FirstName string  `json:"first_name"`
	LastName  string  `json:"last_name"`
	Phone     *string `json:"phone,omitempty"`
	IsActive  bool    `json:"is_active"`
}

// AddressRequest defines payload to add or update an address in the customer's book.
type AddressRequest struct {
	Label             string  `json:"label"` // Home, Office, Default
	RecipientName     string  `json:"recipient_name"`
	Phone             string  `json:"phone"`
	StreetAddress     string  `json:"street_address"`
	ApartmentSuite    *string `json:"apartment_suite,omitempty"`
	City              string  `json:"city"`
	StateProvince     *string `json:"state_province,omitempty"`
	PostalCode        *string `json:"postal_code,omitempty"`
	Country           string  `json:"country"`
	IsDefaultShipping bool    `json:"is_default_shipping"`
	IsDefaultBilling  bool    `json:"is_default_billing"`
}

// CustomerMetrics summarizes commercial engagement and lifetime spending.
type CustomerMetrics struct {
	TotalOrders       int        `json:"total_orders"`
	LifetimeValue     float64    `json:"lifetime_value"`
	AverageOrderValue float64    `json:"average_order_value"`
	LastOrderDate     *time.Time `json:"last_order_date,omitempty"`
}

// CustomerSummary represents high-level metrics for customer registry tables.
type CustomerSummary struct {
	ID        string          `json:"id"`
	Email     string          `json:"email"`
	FirstName string          `json:"first_name"`
	LastName  string          `json:"last_name"`
	Phone     *string         `json:"phone,omitempty"`
	IsActive  bool            `json:"is_active"`
	Metrics   CustomerMetrics `json:"metrics"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

// CustomerDetailResponse provides complete metadata including saved addresses and LTV metrics.
type CustomerDetailResponse struct {
	storeModels.Customer
	Metrics   CustomerMetrics               `json:"metrics"`
	Addresses []storeModels.CustomerAddress `json:"addresses"`
}

// CustomerFilterParams defines query parameters for searching and paginating customer records.
type CustomerFilterParams struct {
	Search   string
	IsActive *bool
	Page     int
	Limit    int
}

// PaginatedCustomersResponse wraps listed customers with pagination metadata.
type PaginatedCustomersResponse struct {
	Customers []CustomerSummary `json:"customers"`
	Total     int               `json:"total"`
	Page      int               `json:"page"`
	Limit     int               `json:"limit"`
}
