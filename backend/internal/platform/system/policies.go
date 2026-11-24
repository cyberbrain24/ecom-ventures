package system

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"ecom-ventures/backend/internal/platform/audit"
	"ecom-ventures/backend/pkg/response"
)

const singletonPoliciesID = "00000000-0000-0000-0000-000000000001"

// PlatformPolicies represents the singleton platform-wide governance and operational configuration.
type PlatformPolicies struct {
	ID                        string    `json:"id"`
	MaintenanceMode           bool      `json:"maintenance_mode"`
	AllowNewStoreProvisioning bool      `json:"allow_new_store_provisioning"`
	EnforceCustomDomainSSL    bool      `json:"enforce_custom_domain_ssl"`
	DefaultStoreCurrency      string    `json:"default_store_currency"`
	DefaultStoreTimezone      string    `json:"default_store_timezone"`
	MaxStoresPerAccount       int       `json:"max_stores_per_account"`
	SessionTTLMinutes         int       `json:"session_ttl_minutes"`
	AuditLogRetentionDays     int       `json:"audit_log_retention_days"`
	APIRateLimitPerMin        int       `json:"api_rate_limit_per_min"`
	SupportContactEmail       string    `json:"support_contact_email"`
	UpdatedBy                 string    `json:"updated_by"`
	UpdatedAt                 time.Time `json:"updated_at"`
}

// UpdatePlatformPoliciesRequest defines the payload for updating platform policies.
type UpdatePlatformPoliciesRequest struct {
	MaintenanceMode           bool   `json:"maintenance_mode"`
	AllowNewStoreProvisioning bool   `json:"allow_new_store_provisioning"`
	EnforceCustomDomainSSL    bool   `json:"enforce_custom_domain_ssl"`
	DefaultStoreCurrency      string `json:"default_store_currency"`
	DefaultStoreTimezone      string `json:"default_store_timezone"`
	MaxStoresPerAccount       int    `json:"max_stores_per_account"`
	SessionTTLMinutes         int    `json:"session_ttl_minutes"`
	AuditLogRetentionDays     int    `json:"audit_log_retention_days"`
	APIRateLimitPerMin        int    `json:"api_rate_limit_per_min"`
	SupportContactEmail       string `json:"support_contact_email"`
}

var (
	// ErrInvalidPolicyInput is returned when policy update parameters fail validation.
	ErrInvalidPolicyInput = errors.New("system: invalid platform policy configuration")
)

// GetPolicies retrieves the singleton platform policy configuration from PostgreSQL.
func (s *Service) GetPolicies(ctx context.Context) (*PlatformPolicies, error) {
	if s.platformDB == nil {
		return nil, fmt.Errorf("platform database connection is nil")
	}

	const query = `
		SELECT id::text, maintenance_mode, allow_new_store_provisioning, enforce_custom_domain_ssl,
		       default_store_currency, default_store_timezone, max_stores_per_account,
		       session_ttl_minutes, audit_log_retention_days, api_rate_limit_per_min,
		       support_contact_email, updated_by, updated_at
		FROM platform_policies
		WHERE id = $1;`

	var p PlatformPolicies
	err := s.platformDB.QueryRowContext(ctx, query, singletonPoliciesID).Scan(
		&p.ID,
		&p.MaintenanceMode,
		&p.AllowNewStoreProvisioning,
		&p.EnforceCustomDomainSSL,
		&p.DefaultStoreCurrency,
		&p.DefaultStoreTimezone,
		&p.MaxStoresPerAccount,
		&p.SessionTTLMinutes,
		&p.AuditLogRetentionDays,
		&p.APIRateLimitPerMin,
		&p.SupportContactEmail,
		&p.UpdatedBy,
		&p.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, fmt.Errorf("platform_policies singleton row is missing; run platform migrations")
	}
	if err != nil {
		return nil, fmt.Errorf("query platform policies: %w", err)
	}
	return &p, nil
}

// UpdatePolicies validates and persists updated platform policy settings with audit logging.
func (s *Service) UpdatePolicies(ctx context.Context, req UpdatePlatformPoliciesRequest, actor audit.Actor) (*PlatformPolicies, error) {
	currency := strings.ToUpper(strings.TrimSpace(req.DefaultStoreCurrency))
	if len(currency) < 3 || len(currency) > 10 {
		return nil, fmt.Errorf("%w: default_store_currency must be 3-10 characters", ErrInvalidPolicyInput)
	}
	timezone := strings.TrimSpace(req.DefaultStoreTimezone)
	if timezone == "" || len(timezone) > 64 {
		return nil, fmt.Errorf("%w: default_store_timezone is required", ErrInvalidPolicyInput)
	}
	if _, err := time.LoadLocation(timezone); err != nil {
		return nil, fmt.Errorf("%w: invalid timezone %q", ErrInvalidPolicyInput, timezone)
	}
	if req.MaxStoresPerAccount < 1 || req.MaxStoresPerAccount > 1000 {
		return nil, fmt.Errorf("%w: max_stores_per_account must be between 1 and 1000", ErrInvalidPolicyInput)
	}
	if req.SessionTTLMinutes < 15 || req.SessionTTLMinutes > 43200 {
		return nil, fmt.Errorf("%w: session_ttl_minutes must be between 15 and 43200", ErrInvalidPolicyInput)
	}
	if req.AuditLogRetentionDays < 7 || req.AuditLogRetentionDays > 3650 {
		return nil, fmt.Errorf("%w: audit_log_retention_days must be between 7 and 3650", ErrInvalidPolicyInput)
	}
	if req.APIRateLimitPerMin < 10 || req.APIRateLimitPerMin > 100000 {
		return nil, fmt.Errorf("%w: api_rate_limit_per_min must be between 10 and 100000", ErrInvalidPolicyInput)
	}
	supportEmail := strings.TrimSpace(req.SupportContactEmail)
	if supportEmail != "" && !strings.Contains(supportEmail, "@") {
		return nil, fmt.Errorf("%w: support_contact_email must be a valid email address", ErrInvalidPolicyInput)
	}

	before, err := s.GetPolicies(ctx)
	if err != nil {
		return nil, err
	}

	tx, err := s.platformDB.BeginTx(ctx, nil)
	if err != nil {
		return nil, fmt.Errorf("begin policy update tx: %w", err)
	}
	defer tx.Rollback()

	const updateQuery = `
		UPDATE platform_policies
		SET maintenance_mode = $2,
		    allow_new_store_provisioning = $3,
		    enforce_custom_domain_ssl = $4,
		    default_store_currency = $5,
		    default_store_timezone = $6,
		    max_stores_per_account = $7,
		    session_ttl_minutes = $8,
		    audit_log_retention_days = $9,
		    api_rate_limit_per_min = $10,
		    support_contact_email = $11,
		    updated_by = $12,
		    updated_at = CURRENT_TIMESTAMP
		WHERE id = $1
		RETURNING id::text, maintenance_mode, allow_new_store_provisioning, enforce_custom_domain_ssl,
		          default_store_currency, default_store_timezone, max_stores_per_account,
		          session_ttl_minutes, audit_log_retention_days, api_rate_limit_per_min,
		          support_contact_email, updated_by, updated_at;`

	var updated PlatformPolicies
	err = tx.QueryRowContext(
		ctx,
		updateQuery,
		singletonPoliciesID,
		req.MaintenanceMode,
		req.AllowNewStoreProvisioning,
		req.EnforceCustomDomainSSL,
		currency,
		timezone,
		req.MaxStoresPerAccount,
		req.SessionTTLMinutes,
		req.AuditLogRetentionDays,
		req.APIRateLimitPerMin,
		supportEmail,
		actor.Email,
	).Scan(
		&updated.ID,
		&updated.MaintenanceMode,
		&updated.AllowNewStoreProvisioning,
		&updated.EnforceCustomDomainSSL,
		&updated.DefaultStoreCurrency,
		&updated.DefaultStoreTimezone,
		&updated.MaxStoresPerAccount,
		&updated.SessionTTLMinutes,
		&updated.AuditLogRetentionDays,
		&updated.APIRateLimitPerMin,
		&updated.SupportContactEmail,
		&updated.UpdatedBy,
		&updated.UpdatedAt,
	)
	if err != nil {
		return nil, fmt.Errorf("update platform policies: %w", err)
	}

	if err := audit.Record(ctx, tx, actor, "PLATFORM_POLICIES_UPDATED", "platform_policies", singletonPoliciesID, "", before, updated); err != nil {
		return nil, fmt.Errorf("record policy audit log: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return nil, fmt.Errorf("commit policy update: %w", err)
	}
	return &updated, nil
}

// GetPolicies handles GET /api/v1/platform/system/policies.
func (h *Handler) GetPolicies(w http.ResponseWriter, r *http.Request) {
	policies, err := h.service.GetPolicies(r.Context())
	if err != nil {
		response.Problem(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to load platform policies", err.Error())
		return
	}
	response.JSON(w, http.StatusOK, policies)
}

// UpdatePolicies handles PUT /api/v1/platform/system/policies.
func (h *Handler) UpdatePolicies(w http.ResponseWriter, r *http.Request) {
	var req UpdatePlatformPoliciesRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		response.Problem(w, r, http.StatusBadRequest, "INVALID_PAYLOAD", "Invalid request JSON", err.Error())
		return
	}

	updated, err := h.service.UpdatePolicies(r.Context(), req, audit.ActorFromRequest(r))
	if err != nil {
		if errors.Is(err, ErrInvalidPolicyInput) {
			response.Problem(w, r, http.StatusBadRequest, "VALIDATION_ERROR", "Invalid policy settings", err.Error())
			return
		}
		response.Problem(w, r, http.StatusInternalServerError, "INTERNAL_ERROR", "Failed to update platform policies", err.Error())
		return
	}
	response.JSON(w, http.StatusOK, updated)
}
