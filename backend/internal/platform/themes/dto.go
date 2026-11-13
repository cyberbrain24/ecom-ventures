// Package themes provides the business logic and API specifications for the Master Admin
// Theme Management Engine and dynamic storefront theme delivery.
package themes

import (
	"encoding/json"
	"time"

	"ecom-ventures/backend/internal/platform/models"
)

// RegisterThemeRequest contains the payload required to register a new theme blueprint.
type RegisterThemeRequest struct {
	Name            string          `json:"name"`
	Slug            string          `json:"slug"`
	Description     string          `json:"description"`
	Version         string          `json:"version"`
	PreviewImageURL string          `json:"preview_image_url"`
	ConfigSchema    json.RawMessage `json:"config_schema"`
}

// UpdateThemeRequest holds fields permitted for theme updates.
type UpdateThemeRequest struct {
	Name            string          `json:"name"`
	Description     string          `json:"description"`
	Version         string          `json:"version"`
	PreviewImageURL string          `json:"preview_image_url"`
	ConfigSchema    json.RawMessage `json:"config_schema"`
	IsActive        *bool           `json:"is_active,omitempty"`
}

// AssignThemeRequest holds parameters to bind a theme to a store with custom overrides.
type AssignThemeRequest struct {
	ThemeID      string          `json:"theme_id"`
	CustomConfig json.RawMessage `json:"custom_config"`
}

// ThemeSummaryResponse provides theme blueprint metadata and active store adoption count.
type ThemeSummaryResponse struct {
	models.Theme
	ActiveStoresCount int `json:"active_stores_count"`
}

// StoreThemeResponse represents the resolved active theme and custom brand configuration for a storefront.
type StoreThemeResponse struct {
	ThemeID      string          `json:"theme_id"`
	ThemeName    string          `json:"theme_name"`
	ThemeSlug    string          `json:"theme_slug"`
	Version      string          `json:"version"`
	CustomConfig json.RawMessage `json:"custom_config"`
	ActivatedAt  time.Time       `json:"activated_at"`
}
