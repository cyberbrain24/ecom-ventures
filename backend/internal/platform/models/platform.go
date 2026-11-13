// Package models defines strongly typed platform entities reflecting the central database schema.
package models

import (
	"encoding/json"
	"time"
)

// PlatformUserRole defines authorized platform administration tiers.
type PlatformUserRole string

const (
	RoleSuperAdmin    PlatformUserRole = "SUPER_ADMIN"
	RolePlatformStaff PlatformUserRole = "PLATFORM_STAFF"
)

// PlatformUserStatus indicates account validity.
type PlatformUserStatus string

const (
	UserStatusActive      PlatformUserStatus = "ACTIVE"
	UserStatusSuspended   PlatformUserStatus = "SUSPENDED"
	UserStatusDeactivated PlatformUserStatus = "DEACTIVATED"
)

// StoreStatus dictates operational state in the portfolio.
type StoreStatus string

const (
	StoreStatusProvisioning StoreStatus = "PROVISIONING"
	StoreStatusActive       StoreStatus = "ACTIVE"
	StoreStatusMaintenance  StoreStatus = "MAINTENANCE"
	StoreStatusSuspended    StoreStatus = "SUSPENDED"
	StoreStatusArchived     StoreStatus = "ARCHIVED"
)

// DomainSSLStatus represents automated certificate resolution status.
type DomainSSLStatus string

const (
	SSLStatusPending DomainSSLStatus = "PENDING"
	SSLStatusActive  DomainSSLStatus = "ACTIVE"
	SSLStatusFailed  DomainSSLStatus = "FAILED"
	SSLStatusRevoked DomainSSLStatus = "REVOKED"
)

// PlatformUser represents a super admin or internal platform operator.
type PlatformUser struct {
	ID           string             `json:"id"`
	Email        string             `json:"email"`
	PasswordHash string             `json:"-"`
	FirstName    string             `json:"first_name"`
	LastName     string             `json:"last_name"`
	Role         PlatformUserRole   `json:"role"`
	Status       PlatformUserStatus `json:"status"`
	LastLoginAt  *time.Time         `json:"last_login_at,omitempty"`
	CreatedAt    time.Time          `json:"created_at"`
	UpdatedAt    time.Time          `json:"updated_at"`
}

// Store holds the platform registry record and tenant database connection coordinates.
type Store struct {
	ID                  string      `json:"id"`
	Name                string      `json:"name"`
	Slug                string      `json:"slug"`
	Description         string      `json:"description,omitempty"`
	LogoURL             string      `json:"logo_url,omitempty"`
	Status              StoreStatus `json:"status"`
	DBHost              string      `json:"db_host"`
	DBPort              int         `json:"db_port"`
	DBName              string      `json:"db_name"`
	DBUser              string      `json:"db_user"`
	DBPasswordEncrypted string      `json:"-"`
	DBSSLMode           string      `json:"db_sslmode"`
	ContactEmail        string      `json:"contact_email"`
	ContactPhone        string      `json:"contact_phone,omitempty"`
	Currency            string      `json:"currency"`
	Timezone            string      `json:"timezone"`
	CreatedAt           time.Time   `json:"created_at"`
	UpdatedAt           time.Time   `json:"updated_at"`
}

// Domain tracks apex brand domains and platform subdomains mapped to a store.
type Domain struct {
	ID                string          `json:"id"`
	StoreID           string          `json:"store_id"`
	Domain            string          `json:"domain"`
	IsPrimary         bool            `json:"is_primary"`
	IsCustom          bool            `json:"is_custom"`
	SSLStatus         DomainSSLStatus `json:"ssl_status"`
	VerificationToken string          `json:"verification_token,omitempty"`
	VerifiedAt        *time.Time      `json:"verified_at,omitempty"`
	CreatedAt         time.Time       `json:"created_at"`
	UpdatedAt         time.Time       `json:"updated_at"`
}

// Theme defines reusable layout blueprints registered in the Master Admin.
type Theme struct {
	ID              string          `json:"id"`
	Name            string          `json:"name"`
	Slug            string          `json:"slug"`
	Description     string          `json:"description,omitempty"`
	Version         string          `json:"version"`
	PreviewImageURL string          `json:"preview_image_url,omitempty"`
	ConfigSchema    json.RawMessage `json:"config_schema"`
	IsActive        bool            `json:"is_active"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}

// StoreTheme records the active theme and custom brand overrides for a store.
type StoreTheme struct {
	ID           string          `json:"id"`
	StoreID      string          `json:"store_id"`
	ThemeID      string          `json:"theme_id"`
	CustomConfig json.RawMessage `json:"custom_config"`
	IsActive     bool            `json:"is_active"`
	ActivatedAt  time.Time       `json:"activated_at"`
	CreatedAt    time.Time       `json:"created_at"`
	UpdatedAt    time.Time       `json:"updated_at"`
}

// StoreProvisioningLog stores audit records for automated store creation steps.
type StoreProvisioningLog struct {
	ID           string          `json:"id"`
	StoreID      string          `json:"store_id"`
	Step         string          `json:"step"`
	StepOrder    int             `json:"step_order"`
	Status       string          `json:"status"`
	Details      json.RawMessage `json:"details"`
	ErrorMessage string          `json:"error_message,omitempty"`
	StartedAt    time.Time       `json:"started_at"`
	CompletedAt  *time.Time      `json:"completed_at,omitempty"`
}

// AuditLog records security-relevant administrative actions across the platform.
type AuditLog struct {
	ID            string          `json:"id"`
	UserID        *string         `json:"user_id,omitempty"`
	UserEmail     string          `json:"user_email,omitempty"`
	Action        string          `json:"action"`
	ResourceType  string          `json:"resource_type"`
	ResourceID    string          `json:"resource_id"`
	StoreID       *string         `json:"store_id,omitempty"`
	PayloadBefore json.RawMessage `json:"payload_before,omitempty"`
	PayloadAfter  json.RawMessage `json:"payload_after,omitempty"`
	ClientIP      string          `json:"client_ip"`
	UserAgent     string          `json:"user_agent,omitempty"`
	CreatedAt     time.Time       `json:"created_at"`
}
