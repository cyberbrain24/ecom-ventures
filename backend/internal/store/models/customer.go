package models

import (
	"time"
)

// Customer represents a storefront buyer account inside an isolated brand database.
type Customer struct {
	ID           string            `json:"id"`
	Email        string            `json:"email"`
	PasswordHash string            `json:"-"`
	FirstName    string            `json:"first_name"`
	LastName     string            `json:"last_name"`
	Phone        *string           `json:"phone,omitempty"`
	IsActive     bool              `json:"is_active"`
	Addresses    []CustomerAddress `json:"addresses,omitempty"`
	CreatedAt    time.Time         `json:"created_at"`
	UpdatedAt    time.Time         `json:"updated_at"`
}

// CustomerAddress represents a saved shipping or billing location for a customer.
type CustomerAddress struct {
	ID                string    `json:"id"`
	CustomerID        string    `json:"customer_id"`
	Label             string    `json:"label"` // Home, Office, Default
	RecipientName     string    `json:"recipient_name"`
	Phone             string    `json:"phone"`
	StreetAddress     string    `json:"street_address"`
	ApartmentSuite    *string   `json:"apartment_suite,omitempty"`
	City              string    `json:"city"`
	StateProvince     *string   `json:"state_province,omitempty"`
	PostalCode        *string   `json:"postal_code,omitempty"`
	Country           string    `json:"country"`
	IsDefaultShipping bool      `json:"is_default_shipping"`
	IsDefaultBilling  bool      `json:"is_default_billing"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}
