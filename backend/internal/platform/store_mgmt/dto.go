// Package store_mgmt provides data structures and orchestration logic for the Master Admin
// Store Creator engine, automated provisioning pipeline, and portfolio management.
package store_mgmt

import (
	"time"

	"ecom-ventures/backend/internal/platform/models"
)

// CreateStoreRequest contains the required parameters to launch a new brand store.
type CreateStoreRequest struct {
	Name          string           `json:"name"`
	Slug          string           `json:"slug"`
	Description   string           `json:"description"`
	ThemeSlug     string           `json:"theme_slug"`
	ContactEmail  string           `json:"contact_email"`
	ContactPhone  string           `json:"contact_phone"`
	Currency      string           `json:"currency"`
	Timezone      string           `json:"timezone"`
	PrimaryDomain string           `json:"primary_domain"`
	InitialOwner  OwnerCredentials `json:"initial_owner"`
}

// OwnerCredentials defines initial login details for the brand store owner.
type OwnerCredentials struct {
	Email     string `json:"email"`
	Password  string `json:"password"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

// UpdateStoreStatusRequest defines payload to change store lifecycle state.
type UpdateStoreStatusRequest struct {
	Status string `json:"status"` // ACTIVE, MAINTENANCE, SUSPENDED, ARCHIVED
	Reason string `json:"reason,omitempty"`
}

// StoreSummaryResponse represents high-level metrics for brand listings in Master Admin.
type StoreSummaryResponse struct {
	ID            string             `json:"id"`
	Name          string             `json:"name"`
	Slug          string             `json:"slug"`
	Status        models.StoreStatus `json:"status"`
	PrimaryDomain string             `json:"primary_domain"`
	ActiveTheme   string             `json:"active_theme"`
	ContactEmail  string             `json:"contact_email"`
	Currency      string             `json:"currency"`
	CreatedAt     time.Time          `json:"created_at"`
	UpdatedAt     time.Time          `json:"updated_at"`
}

// OwnerSummaryResponse provides basic info about the store's primary owner staff.
type OwnerSummaryResponse struct {
	ID        string `json:"id"`
	Email     string `json:"email"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
}

// StoreDetailResponse provides complete metadata including active theme and assigned domains.
type StoreDetailResponse struct {
	Store        models.Store                  `json:"store"`
	Domains      []models.Domain               `json:"domains"`
	ActiveTheme  *models.Theme                 `json:"active_theme,omitempty"`
	Owner        *OwnerSummaryResponse         `json:"owner,omitempty"`
	Provisioning []models.StoreProvisioningLog `json:"provisioning_logs,omitempty"`
}

// StoreFilterParams encapsulates pagination and status filtering query parameters.
type StoreFilterParams struct {
	Status string
	Search string
	Page   int
	Limit  int
}

// UpdateStoreRequest is the body of PATCH /platform/stores/{id}. Every field is optional;
// an absent field is left unchanged. Slug, Status, PrimaryDomain and ActiveTheme are accepted
// only so the Master Admin edit form can echo the row it loaded: a value that differs from
// the stored one is rejected with 422 because those fields have dedicated endpoints.
// Database coordinates and credentials are never read from this body.
type UpdateStoreRequest struct {
	Name           *string `json:"name"`
	Description    *string `json:"description"`
	ContactEmail   *string `json:"contact_email"`
	ContactPhone   *string `json:"contact_phone"`
	Currency       *string `json:"currency"`
	Timezone       *string `json:"timezone"`
	OwnerEmail     *string `json:"owner_email,omitempty"`
	OwnerPassword  *string `json:"owner_password,omitempty"`
	OwnerFirstName *string `json:"owner_first_name,omitempty"`
	OwnerLastName  *string `json:"owner_last_name,omitempty"`
	Slug           *string `json:"slug"`
	Status         *string `json:"status"`
	PrimaryDomain  *string `json:"primary_domain"`
	ActiveTheme    *string `json:"active_theme"`
}
