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

// StoreDetailResponse provides complete metadata including active theme and assigned domains.
type StoreDetailResponse struct {
	Store        models.Store                  `json:"store"`
	Domains      []models.Domain               `json:"domains"`
	ActiveTheme  *models.Theme                 `json:"active_theme,omitempty"`
	Provisioning []models.StoreProvisioningLog `json:"provisioning_logs,omitempty"`
}

// StoreFilterParams encapsulates pagination and status filtering query parameters.
type StoreFilterParams struct {
	Status string
	Search string
	Page   int
	Limit  int
}
