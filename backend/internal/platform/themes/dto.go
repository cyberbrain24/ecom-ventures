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

// UpdateThemeRequest is the body of PATCH /platform/themes/{id}. Every field is optional and
// an absent field is left unchanged. The slug is immutable and is not accepted.
type UpdateThemeRequest struct {
	Name            *string         `json:"name"`
	Description     *string         `json:"description"`
	Version         *string         `json:"version"`
	PreviewImageURL *string         `json:"preview_image_url"`
	ConfigSchema    json.RawMessage `json:"config_schema"`
	IsActive        *bool           `json:"is_active"`
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
// The top-level fields are kept for existing readers; Theme carries the design configuration.
type StoreThemeResponse struct {
	ThemeID      string               `json:"theme_id"`
	ThemeName    string               `json:"theme_name"`
	ThemeSlug    string               `json:"theme_slug"`
	Version      string               `json:"version"`
	CustomConfig json.RawMessage      `json:"custom_config"`
	ActivatedAt  time.Time            `json:"activated_at"`
	Theme        StoreThemeDescriptor `json:"theme"`
}

// StoreThemeDescriptor is the theme object the storefront renders from: its slug, display name
// and the theme's config_schema (design tokens) as stored on the platform.
type StoreThemeDescriptor struct {
	Slug   string          `json:"slug"`
	Name   string          `json:"name"`
	Config json.RawMessage `json:"config"`
}
