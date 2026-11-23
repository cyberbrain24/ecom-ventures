package store_mgmt

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"

	"ecom-ventures/backend/internal/platform/models"
	"ecom-ventures/backend/internal/platform/provisioner"
	storeDB "ecom-ventures/backend/internal/store/database"
	"ecom-ventures/backend/internal/store/resolver"
	"ecom-ventures/backend/pkg/hasher"
)

var (
	ErrStoreNotFound         = errors.New("store_mgmt: store not found")
	ErrSlugAlreadyExists     = errors.New("store_mgmt: store slug already taken")
	ErrDomainConflict        = errors.New("store_mgmt: domain already mapped to another store")
	ErrThemeNotFound         = errors.New("store_mgmt: requested theme not registered in platform")
	ErrThemeRequired         = errors.New("store_mgmt: theme_slug is required")
	ErrThemeInactive         = errors.New("store_mgmt: requested theme is deactivated and cannot be assigned")
	ErrPrimaryDomainRequired = errors.New("store_mgmt: primary_domain is required outside development")
	ErrInvalidStatus         = errors.New("store_mgmt: invalid store status transition")
)

var slugRegex = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)

var uuidRegex = regexp.MustCompile(`^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$`)

// localhostSuffix marks local development hostnames. It is honoured only in development mode.
const localhostSuffix = ".localhost"

// Service orchestrates the Store Creator pipeline and lifecycle management.
type Service struct {
	platformDB    *sql.DB
	provisioner   *provisioner.Provisioner
	resolver      *resolver.StoreResolver
	tenantPool    *storeDB.TenantPoolManager
	isDevelopment bool
}

// NewService instantiates the Store Creator management service.
// isDevelopment must be true only when APP_ENV is "development"; it allows the
// .localhost primary domain default and marks that domain verified at creation.
func NewService(
	platformDB *sql.DB,
	provisioner *provisioner.Provisioner,
	resolver *resolver.StoreResolver,
	tenantPool *storeDB.TenantPoolManager,
	isDevelopment bool,
) *Service {
	return &Service{
		platformDB:    platformDB,
		provisioner:   provisioner,
		resolver:      resolver,
		tenantPool:    tenantPool,
		isDevelopment: isDevelopment,
	}
}

// CreateStore executes the automated store provisioning pipeline.
// The theme must be named explicitly and must be an active platform theme; an unknown
// theme fails the request instead of being replaced. The primary domain is registered as
// PENDING and is marked verified only in development for a .localhost host.
func (s *Service) CreateStore(ctx context.Context, req *CreateStoreRequest, creatorUserID ...string) (*StoreDetailResponse, error) {
	userID := "system"
	if len(creatorUserID) > 0 && creatorUserID[0] != "" {
		userID = creatorUserID[0]
	}

	// Step 1: Input Validation
	req.Slug = strings.ToLower(strings.TrimSpace(req.Slug))
	if !slugRegex.MatchString(req.Slug) {
		return nil, fmt.Errorf("invalid slug format: must contain lowercase alphanumeric characters and single hyphens")
	}
	if req.Name == "" || req.ContactEmail == "" || req.InitialOwner.Email == "" || req.InitialOwner.Password == "" {
		return nil, fmt.Errorf("name, contact_email, and initial_owner credentials are required")
	}
	if strings.TrimSpace(req.ThemeSlug) == "" {
		return nil, ErrThemeRequired
	}

	if s.platformDB == nil {
		return nil, fmt.Errorf("store_mgmt: platform database connection handle is nil")
	}

	// Verify Slug and Domain Uniqueness
	var slugExists bool
	if err := s.platformDB.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM stores WHERE slug = $1);", req.Slug).Scan(&slugExists); err != nil {
		return nil, fmt.Errorf("checking store slug uniqueness: %w", err)
	}
	if slugExists {
		return nil, ErrSlugAlreadyExists
	}

	cleanDomain := strings.ToLower(strings.TrimSpace(req.PrimaryDomain))
	if cleanDomain == "" {
		if !s.isDevelopment {
			return nil, ErrPrimaryDomainRequired
		}
		cleanDomain = fmt.Sprintf("%s%s", req.Slug, localhostSuffix)
	}
	var domainExists bool
	if err := s.platformDB.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM domains WHERE domain = $1);", cleanDomain).Scan(&domainExists); err != nil {
		return nil, fmt.Errorf("checking primary domain uniqueness: %w", err)
	}
	if domainExists {
		return nil, ErrDomainConflict
	}

	// Step 2: Theme Existence Verification (explicit theme only, no substitution)
	themeSlug := strings.ToLower(strings.TrimSpace(req.ThemeSlug))
	var theme models.Theme
	err := s.platformDB.QueryRowContext(ctx, `
		SELECT id, name, slug, version, is_active FROM themes WHERE slug = $1;`,
		themeSlug,
	).Scan(&theme.ID, &theme.Name, &theme.Slug, &theme.Version, &theme.IsActive)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrThemeNotFound
	} else if err != nil {
		return nil, fmt.Errorf("failed to query theme registry: %w", err)
	}
	if !theme.IsActive {
		return nil, ErrThemeInactive
	}

	// Step 3: Insert Base Store Record (Status: PROVISIONING)
	currency := req.Currency
	if currency == "" {
		currency = "BDT"
	}
	timezone := req.Timezone
	if timezone == "" {
		timezone = "Asia/Dhaka"
	}

	dbSuffix, err := randomHex(4)
	if err != nil {
		return nil, fmt.Errorf("generating store database name: %w", err)
	}
	generatedDBName := fmt.Sprintf("store_%s_%s", req.Slug, dbSuffix)
	// The password is 32 lowercase hex characters; the provisioner validates this format
	// before inlining it into CREATE ROLE.
	rawDBPassword, err := randomHex(16)
	if err != nil {
		return nil, fmt.Errorf("generating store database password: %w", err)
	}
	// Each store gets its own login role that owns its database.
	dbRole, err := provisioner.NewTenantRoleName(req.Slug)
	if err != nil {
		return nil, fmt.Errorf("generating store database role: %w", err)
	}

	targetDBHost := os.Getenv("PLATFORM_DB_HOST")
	if targetDBHost == "" {
		targetDBHost = "localhost"
	}
	targetDBPort := 5432
	if pStr := os.Getenv("PLATFORM_DB_PORT"); pStr != "" {
		if pInt, err := strconv.Atoi(pStr); err == nil && pInt > 0 {
			targetDBPort = pInt
		}
	}

	store := &models.Store{
		Name:         req.Name,
		Slug:         req.Slug,
		Description:  req.Description,
		Status:       models.StoreStatusProvisioning,
		DBHost:       targetDBHost,
		DBPort:       targetDBPort,
		DBName:       generatedDBName,
		DBUser:       dbRole,
		DBSSLMode:    "disable",
		ContactEmail: req.ContactEmail,
		ContactPhone: req.ContactPhone,
		Currency:     currency,
		Timezone:     timezone,
	}

	insertStoreSQL := `
		INSERT INTO stores (name, slug, description, status, db_host, db_port, db_name, db_user, db_password_encrypted, db_sslmode, contact_email, contact_phone, currency, timezone)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'TEMPORARY_HOLD', $9, $10, $11, $12, $13)
		RETURNING id, created_at, updated_at;`

	err = s.platformDB.QueryRowContext(ctx, insertStoreSQL,
		store.Name, store.Slug, store.Description, store.Status,
		store.DBHost, store.DBPort, store.DBName, store.DBUser, store.DBSSLMode,
		store.ContactEmail, store.ContactPhone, store.Currency, store.Timezone,
	).Scan(&store.ID, &store.CreatedAt, &store.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("failed to insert initial store registry record: %w", err)
	}

	// Step 4 & 5: Provision Physical PostgreSQL DB and Apply Baseline Migrations
	// If this step fails, provisioner automatically drops the orphaned DB.
	if s.provisioner == nil {
		s.cleanupFailedStoreLogged(ctx, store.ID, store.DBName, store.DBUser)
		return nil, fmt.Errorf("store_mgmt: provisioner service is nil")
	}

	err = s.provisioner.ProvisionStoreDatabase(ctx, store, rawDBPassword)
	if err != nil {
		s.cleanupFailedStoreLogged(ctx, store.ID, store.DBName, store.DBUser)
		return nil, fmt.Errorf("database provisioning pipeline failed: %w", err)
	}

	// Update store record with the encrypted password generated by provisioner
	_, err = s.platformDB.ExecContext(ctx, `
		UPDATE stores SET db_password_encrypted = $1 WHERE id = $2;`,
		store.DBPasswordEncrypted, store.ID)
	if err != nil {
		s.cleanupFailedStoreLogged(ctx, store.ID, store.DBName, store.DBUser)
		return nil, fmt.Errorf("failed to persist encrypted database credentials: %w", err)
	}

	// Step 6: Seed Initial Store Owner into Tenant Database
	err = s.seedInitialStoreOwner(ctx, store, rawDBPassword, &req.InitialOwner)
	if err != nil {
		s.cleanupFailedStoreLogged(ctx, store.ID, store.DBName, store.DBUser)
		return nil, fmt.Errorf("failed to seed initial store administrator: %w", err)
	}

	// Step 7: Assign Theme in Central Platform DB
	assignThemeSQL := `
		INSERT INTO store_themes (store_id, theme_id, custom_config, is_active)
		VALUES ($1, $2, '{}'::jsonb, TRUE);`
	if _, err := s.platformDB.ExecContext(ctx, assignThemeSQL, store.ID, theme.ID); err != nil {
		s.cleanupFailedStoreLogged(ctx, store.ID, store.DBName, store.DBUser)
		return nil, fmt.Errorf("failed to bind store theme: %w", err)
	}

	// Step 8: Register Primary Domain in Platform DB.
	// The domain is PENDING until DNS and edge verification succeed. The development-only
	// .localhost shortcut is the single exception and only when APP_ENV is "development".
	primarySSL := models.SSLStatusPending
	var primaryVerifiedAt *time.Time
	if s.isDevelopment && strings.HasSuffix(cleanDomain, localhostSuffix) {
		primarySSL = models.SSLStatusActive
		now := time.Now().UTC()
		primaryVerifiedAt = &now
	}
	insertDomainSQL := `
		INSERT INTO domains (store_id, domain, is_primary, is_custom, ssl_status, verified_at)
		VALUES ($1, $2, TRUE, TRUE, $3, $4);`
	if _, err := s.platformDB.ExecContext(ctx, insertDomainSQL, store.ID, cleanDomain, primarySSL, primaryVerifiedAt); err != nil {
		s.cleanupFailedStoreLogged(ctx, store.ID, store.DBName, store.DBUser)
		return nil, fmt.Errorf("failed to register primary store domain: %w", err)
	}

	// Step 9: Transition Store to ACTIVE
	updateStatusSQL := `UPDATE stores SET status = 'ACTIVE' WHERE id = $1;`
	if _, err := s.platformDB.ExecContext(ctx, updateStatusSQL, store.ID); err != nil {
		return nil, fmt.Errorf("failed to transition store status to ACTIVE: %w", err)
	}
	store.Status = models.StoreStatusActive

	// Step 10: Invalidate Cache and Prime Resolver
	if s.resolver != nil {
		s.resolver.InvalidateCache(ctx, cleanDomain, store.Slug)
	}

	// Log Master Audit Record
	s.logPlatformAudit(ctx, userID, "STORE_CREATE", "stores", store.ID, map[string]interface{}{
		"slug": store.Slug, "db_name": store.DBName, "theme": theme.Slug,
	})

	return &StoreDetailResponse{
		Store: *store,
		Domains: []models.Domain{
			{StoreID: store.ID, Domain: cleanDomain, IsPrimary: true, IsCustom: true, SSLStatus: primarySSL},
		},
		ActiveTheme: &theme,
	}, nil
}

// ListStores returns a paginated list of stores with applied filters.
func (s *Service) ListStores(ctx context.Context, params StoreFilterParams) ([]StoreSummaryResponse, int, error) {
	if params.Page <= 0 {
		params.Page = 1
	}
	if params.Limit <= 0 || params.Limit > 100 {
		params.Limit = 20
	}
	offset := (params.Page - 1) * params.Limit

	var whereClauses []string
	var args []interface{}
	argIdx := 1

	if params.Status != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("s.status = $%d", argIdx))
		args = append(args, params.Status)
		argIdx++
	}

	if params.Search != "" {
		whereClauses = append(whereClauses, fmt.Sprintf("(s.name ILIKE $%d OR s.slug ILIKE $%d)", argIdx, argIdx))
		args = append(args, "%"+params.Search+"%")
		argIdx++
	}

	whereSQL := ""
	if len(whereClauses) > 0 {
		whereSQL = "WHERE " + strings.Join(whereClauses, " AND ")
	}

	if s.platformDB == nil {
		return nil, 0, fmt.Errorf("store_mgmt: platform database connection handle is nil")
	}

	// Count query
	countSQL := fmt.Sprintf("SELECT COUNT(*) FROM stores s %s;", whereSQL)
	var total int
	if err := s.platformDB.QueryRowContext(ctx, countSQL, args...).Scan(&total); err != nil {
		return nil, 0, fmt.Errorf("failed to count stores: %w", err)
	}

	// Fetch query
	query := fmt.Sprintf(`
		SELECT s.id, s.name, s.slug, s.status, s.contact_email, s.currency, s.created_at, s.updated_at,
		       COALESCE(d.domain, '') as primary_domain,
		       COALESCE(t.name, '') as active_theme
		FROM stores s
		LEFT JOIN domains d ON d.store_id = s.id AND d.is_primary = TRUE
		LEFT JOIN store_themes st ON st.store_id = s.id AND st.is_active = TRUE
		LEFT JOIN themes t ON t.id = st.theme_id
		%s
		ORDER BY s.created_at DESC
		LIMIT $%d OFFSET $%d;`, whereSQL, argIdx, argIdx+1)

	args = append(args, params.Limit, offset)

	rows, err := s.platformDB.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to query stores: %w", err)
	}
	defer rows.Close()

	var results []StoreSummaryResponse
	for rows.Next() {
		var item StoreSummaryResponse
		if err := rows.Scan(
			&item.ID, &item.Name, &item.Slug, &item.Status, &item.ContactEmail, &item.Currency,
			&item.CreatedAt, &item.UpdatedAt, &item.PrimaryDomain, &item.ActiveTheme,
		); err != nil {
			return nil, 0, fmt.Errorf("failed to scan store summary row: %w", err)
		}
		results = append(results, item)
	}
	if err := rows.Err(); err != nil {
		return nil, 0, fmt.Errorf("failed to iterate store summary rows: %w", err)
	}

	return results, total, nil
}

// GetStoreDetails fetches full store record, domain list, and theme details.
func (s *Service) GetStoreDetails(ctx context.Context, storeID string) (*StoreDetailResponse, error) {
	if s.platformDB == nil {
		return nil, fmt.Errorf("store_mgmt: platform database connection handle is nil")
	}

	queryStore := `
		SELECT id, name, slug, COALESCE(description, ''), COALESCE(logo_url, ''), status,
		       db_host, db_port, db_name, db_user, db_password_encrypted, db_sslmode,
		       contact_email, COALESCE(contact_phone, ''), currency, timezone, created_at, updated_at
		FROM stores WHERE id = $1;`

	var store models.Store
	err := s.platformDB.QueryRowContext(ctx, queryStore, storeID).Scan(
		&store.ID, &store.Name, &store.Slug, &store.Description, &store.LogoURL, &store.Status,
		&store.DBHost, &store.DBPort, &store.DBName, &store.DBUser, &store.DBPasswordEncrypted, &store.DBSSLMode,
		&store.ContactEmail, &store.ContactPhone, &store.Currency, &store.Timezone, &store.CreatedAt, &store.UpdatedAt,
	)
	if err == sql.ErrNoRows {
		return nil, ErrStoreNotFound
	} else if err != nil {
		return nil, fmt.Errorf("failed to query store details: %w", err)
	}

	// Fetch domains
	domainRows, err := s.platformDB.QueryContext(ctx, `
		SELECT id, store_id, domain, is_primary, is_custom, ssl_status, created_at, updated_at
		FROM domains WHERE store_id = $1 ORDER BY is_primary DESC, created_at ASC;`, store.ID)
	if err != nil {
		return nil, fmt.Errorf("failed to query domains for store: %w", err)
	}
	defer domainRows.Close()

	var domains []models.Domain
	for domainRows.Next() {
		var d models.Domain
		if err := domainRows.Scan(&d.ID, &d.StoreID, &d.Domain, &d.IsPrimary, &d.IsCustom, &d.SSLStatus, &d.CreatedAt, &d.UpdatedAt); err != nil {
			return nil, fmt.Errorf("failed to scan store domain row: %w", err)
		}
		domains = append(domains, d)
	}
	if err := domainRows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate store domain rows: %w", err)
	}

	// Fetch Active Theme; a store without an active theme is a valid state.
	var theme models.Theme
	var activeThemePtr *models.Theme
	err = s.platformDB.QueryRowContext(ctx, `
		SELECT t.id, t.name, t.slug, COALESCE(t.description, ''), t.version, COALESCE(t.preview_image_url, ''), t.config_schema, t.is_active
		FROM themes t
		JOIN store_themes st ON st.theme_id = t.id
		WHERE st.store_id = $1 AND st.is_active = TRUE
		LIMIT 1;`, store.ID).Scan(
		&theme.ID, &theme.Name, &theme.Slug, &theme.Description, &theme.Version,
		&theme.PreviewImageURL, &theme.ConfigSchema, &theme.IsActive,
	)
	if err == nil {
		activeThemePtr = &theme
	} else if !errors.Is(err, sql.ErrNoRows) {
		return nil, fmt.Errorf("failed to query active theme for store: %w", err)
	}

	// Fetch Owner from tenant database if resolver is available
	var ownerResp *OwnerSummaryResponse
	if s.resolver != nil {
		if stCtx, rErr := s.resolver.ResolveBySlug(ctx, store.Slug); rErr == nil && stCtx != nil && stCtx.TenantDB != nil {
			var o OwnerSummaryResponse
			oErr := stCtx.TenantDB.QueryRowContext(ctx, `
				SELECT id, email, first_name, last_name
				FROM store_staff
				WHERE role = 'STORE_OWNER' AND is_active = TRUE
				LIMIT 1;
			`).Scan(&o.ID, &o.Email, &o.FirstName, &o.LastName)
			if oErr == nil {
				ownerResp = &o
			}
		}
	}

	return &StoreDetailResponse{
		Store:       store,
		Domains:     domains,
		ActiveTheme: activeThemePtr,
		Owner:       ownerResp,
	}, nil
}

// UpdateStoreStatus transitions a brand's operational lifecycle state.
func (s *Service) UpdateStoreStatus(ctx context.Context, storeID string, req UpdateStoreStatusRequest, adminUserID string) error {
	newStatus := models.StoreStatus(strings.ToUpper(req.Status))
	switch newStatus {
	case models.StoreStatusActive, models.StoreStatusMaintenance, models.StoreStatusSuspended, models.StoreStatusArchived:
		// Valid statuses
	default:
		return ErrInvalidStatus
	}

	if s.platformDB == nil {
		return fmt.Errorf("store_mgmt: platform database connection handle is nil")
	}

	var slug string
	err := s.platformDB.QueryRowContext(ctx, "SELECT slug FROM stores WHERE id = $1;", storeID).Scan(&slug)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrStoreNotFound
	} else if err != nil {
		return fmt.Errorf("failed to read store for status update: %w", err)
	}

	_, err = s.platformDB.ExecContext(ctx, `UPDATE stores SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;`, newStatus, storeID)
	if err != nil {
		return fmt.Errorf("failed to update store status: %w", err)
	}

	// If suspended or archived, close cached connection pool immediately
	if (newStatus == models.StoreStatusSuspended || newStatus == models.StoreStatusArchived) && s.tenantPool != nil {
		if closeErr := s.tenantPool.CloseTenant(storeID); closeErr != nil {
			log.Printf("store_mgmt: warning - closing tenant pool for store %s after status change: %v", storeID, closeErr)
		}
	}

	// Invalidate routing cache
	if s.resolver != nil {
		s.resolver.InvalidateCache(ctx, "", slug)
	}

	s.logPlatformAudit(ctx, adminUserID, "STORE_STATUS_UPDATE", "stores", storeID, map[string]interface{}{
		"new_status": newStatus, "reason": req.Reason,
	})

	return nil
}

// GetProvisioningLogs retrieves the execution audit trail for a store's provisioning.
func (s *Service) GetProvisioningLogs(ctx context.Context, storeID string) ([]models.StoreProvisioningLog, error) {
	if s.platformDB == nil {
		return nil, fmt.Errorf("store_mgmt: platform database connection handle is nil")
	}

	rows, err := s.platformDB.QueryContext(ctx, `
		SELECT id, store_id, step, step_order, status, details, COALESCE(error_message, ''), started_at, completed_at
		FROM store_provisioning_logs
		WHERE store_id = $1
		ORDER BY step_order ASC;`, storeID)
	if err != nil {
		return nil, fmt.Errorf("failed to query provisioning logs: %w", err)
	}
	defer rows.Close()

	var logs []models.StoreProvisioningLog
	for rows.Next() {
		var l models.StoreProvisioningLog
		if err := rows.Scan(&l.ID, &l.StoreID, &l.Step, &l.StepOrder, &l.Status, &l.Details, &l.ErrorMessage, &l.StartedAt, &l.CompletedAt); err != nil {
			return nil, fmt.Errorf("failed to scan provisioning log row: %w", err)
		}
		logs = append(logs, l)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate provisioning log rows: %w", err)
	}
	return logs, nil
}

func (s *Service) seedInitialStoreOwner(ctx context.Context, store *models.Store, rawPassword string, owner *OwnerCredentials) error {
	dsn := fmt.Sprintf("host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		store.DBHost, store.DBPort, store.DBUser, rawPassword, store.DBName, store.DBSSLMode)

	tenantDB, err := sql.Open("postgres", dsn)
	if err != nil {
		return fmt.Errorf("failed to connect to tenant db for owner seed: %w", err)
	}
	defer tenantDB.Close()

	hash, err := hasher.HashPassword(owner.Password)
	if err != nil {
		return fmt.Errorf("failed to hash initial owner password: %w", err)
	}

	insertOwnerSQL := `
		INSERT INTO store_staff (email, password_hash, first_name, last_name, role, is_active)
		VALUES ($1, $2, $3, $4, 'STORE_OWNER', TRUE);`

	_, err = tenantDB.ExecContext(ctx, insertOwnerSQL, strings.ToLower(strings.TrimSpace(owner.Email)), hash, owner.FirstName, owner.LastName)
	if err != nil {
		return fmt.Errorf("failed to insert store_staff record: %w", err)
	}
	return nil
}

// DeleteStore permanently deletes a store, drops its dedicated PostgreSQL database,
// purges associated domain routing, invalidates cache, and removes stored disk assets.
func (s *Service) DeleteStore(ctx context.Context, storeID string, actorUserID ...string) error {
	userID := "system"
	if len(actorUserID) > 0 && actorUserID[0] != "" {
		userID = actorUserID[0]
	}

	if s.platformDB == nil {
		return fmt.Errorf("store_mgmt: platform database handle is nil")
	}

	// 1. Fetch store metadata (name, slug, db_name)
	var slug, dbName, dbRole, storeName string
	err := s.platformDB.QueryRowContext(ctx, `
		SELECT name, slug, db_name, db_user FROM stores WHERE id = $1;`, storeID,
	).Scan(&storeName, &slug, &dbName, &dbRole)
	if err == sql.ErrNoRows {
		return ErrStoreNotFound
	} else if err != nil {
		return fmt.Errorf("failed to query store metadata for deletion: %w", err)
	}

	// 2. Fetch all domains so their routing cache can be purged
	domains, err := s.listStoreDomains(ctx, storeID)
	if err != nil {
		return err
	}

	// 3. Stop routing traffic to the store before its data disappears
	if s.resolver != nil {
		if _, purgeErr := s.resolver.PurgeStoreCache(ctx, storeID, slug, domains); purgeErr != nil {
			return fmt.Errorf("failed to purge store cache before deletion: %w", purgeErr)
		}
	}

	// 4. Close and evict any active connection pool for this tenant
	if s.tenantPool != nil {
		if closeErr := s.tenantPool.CloseTenant(storeID); closeErr != nil {
			log.Printf("store_mgmt: warning - closing tenant pool for store %s: %v", storeID, closeErr)
		}
	}

	// 5. Drop the dedicated PostgreSQL database. This must succeed before the registry row
	//    is removed, otherwise the database would be orphaned with nothing pointing at it.
	//    DROP DATABASE IF EXISTS makes a repeated delete safe. The store's role is dropped
	//    after its database, still before the registry row is removed.
	if dbName != "" {
		if s.provisioner == nil {
			return fmt.Errorf("store_mgmt: cannot delete store %s: database provisioner is unavailable", slug)
		}
		if dropErr := s.provisioner.DropStoreDatabase(ctx, dbName, dbRole); dropErr != nil {
			return fmt.Errorf("failed to drop store database %s (store was not deleted): %w", dbName, dropErr)
		}
	}

	// 6. Delete the store record (cascades to domains, store_themes, store_provisioning_logs,
	//    portfolio_financial_summaries and brand_billing_records)
	result, err := s.platformDB.ExecContext(ctx, `DELETE FROM stores WHERE id = $1;`, storeID)
	if err != nil {
		return fmt.Errorf("failed to delete store from platform database: %w", err)
	}
	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return fmt.Errorf("failed to confirm store deletion: %w", err)
	}
	if rowsAffected == 0 {
		return ErrStoreNotFound
	}

	// 7. Purge the cache again: a request that arrived during steps 3 to 6 may have re-cached the store
	if s.resolver != nil {
		if _, purgeErr := s.resolver.PurgeStoreCache(ctx, storeID, slug, domains); purgeErr != nil {
			log.Printf("store_mgmt: warning - final cache purge for deleted store %s: %v", slug, purgeErr)
		}
	}

	// 8. Remove files on disk: uploaded media and database backups
	removedPaths := s.removeStoreFiles(slug, storeID)

	// 9. Audit log deletion
	s.logPlatformAudit(ctx, userID, "STORE_DELETED", "stores", storeID, map[string]interface{}{
		"store_id":      storeID,
		"name":          storeName,
		"slug":          slug,
		"db_name":       dbName,
		"domains":       domains,
		"removed_paths": removedPaths,
		"action":        "hard_delete",
	})

	log.Printf("store_mgmt: store %s (%s, db: %s) successfully and permanently deleted", storeName, slug, dbName)
	return nil
}

// listStoreDomains returns every domain mapped to a store in the platform registry.
func (s *Service) listStoreDomains(ctx context.Context, storeID string) ([]string, error) {
	rows, err := s.platformDB.QueryContext(ctx, `SELECT domain FROM domains WHERE store_id = $1;`, storeID)
	if err != nil {
		return nil, fmt.Errorf("failed to list store domains for deletion: %w", err)
	}
	defer rows.Close()

	var domains []string
	for rows.Next() {
		var d string
		if err := rows.Scan(&d); err != nil {
			return nil, fmt.Errorf("failed to read store domain for deletion: %w", err)
		}
		domains = append(domains, d)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("failed to iterate store domains for deletion: %w", err)
	}
	return domains, nil
}

// storeFileRoots lists the directories, relative to the API working directory, that hold
// one sub-directory per store. Media is written to uploads/stores/<slug>/ by the catalog
// module and backups to backups/<slug>/ by the worker. The bare "uploads" directory is
// deliberately not a root: a store whose slug is "stores" must never be able to remove
// uploads/stores, which holds every store's media.
var storeFileRoots = []string{
	filepath.Join("uploads", "stores"),
	"backups",
}

// removeStoreFiles deletes a store's media and backup directories from disk and returns
// the paths that were actually removed. It refuses any name that is not a valid slug or
// UUID so that an empty or crafted value can never remove a shared parent directory.
func (s *Service) removeStoreFiles(slug, storeID string) []string {
	var names []string
	if slugRegex.MatchString(slug) {
		names = append(names, slug)
	}
	if uuidRegex.MatchString(storeID) {
		names = append(names, storeID)
	}

	removed := []string{}
	for _, root := range storeFileRoots {
		for _, name := range names {
			target := filepath.Join(root, name)
			info, err := os.Stat(target)
			if err != nil {
				if !os.IsNotExist(err) {
					log.Printf("store_mgmt: warning - checking store files at %s: %v", target, err)
				}
				continue
			}
			if !info.IsDir() {
				continue
			}
			if err := os.RemoveAll(target); err != nil {
				log.Printf("store_mgmt: warning - failed to remove store files at %s: %v", target, err)
				continue
			}
			removed = append(removed, filepath.ToSlash(target))
		}
	}
	return removed
}

// cleanupFailedStoreLogged rolls back a partially provisioned store and logs any cleanup failure
// so that orphaned databases are visible to operators.
func (s *Service) cleanupFailedStoreLogged(ctx context.Context, storeID, dbName, dbRole string) {
	if err := s.cleanupFailedStore(ctx, storeID, dbName, dbRole); err != nil {
		log.Printf("store_mgmt: ERROR - rollback of failed store %s (db %s, role %s) did not complete: %v", storeID, dbName, dbRole, err)
	}
}

// cleanupFailedStore drops the provisioned database and its role, then removes the registry row for a failed store.
func (s *Service) cleanupFailedStore(ctx context.Context, storeID, dbName, dbRole string) error {
	log.Printf("store_mgmt: initiating rollback cleanup for failed store %s (db: %s, role: %s)", storeID, dbName, dbRole)
	// The registry row is removed only after the database and its role are gone. If the drop
	// fails, the row stays so the orphaned database remains visible and can be retried.
	if s.provisioner != nil {
		if err := s.provisioner.DropStoreDatabase(ctx, dbName, dbRole); err != nil {
			return fmt.Errorf("dropping database %s (registry row kept for retry): %w", dbName, err)
		}
	}
	if s.platformDB != nil {
		if _, err := s.platformDB.ExecContext(ctx, "DELETE FROM stores WHERE id = $1;", storeID); err != nil {
			return fmt.Errorf("deleting store registry row %s: %w", storeID, err)
		}
	}
	return nil
}

func (s *Service) logPlatformAudit(ctx context.Context, userID, action, resourceType, resourceID string, payload interface{}) {
	if s.platformDB == nil {
		return
	}

	// audit_logs.user_id is a UUID column; non-user actors such as "system" are stored as NULL.
	var actor sql.NullString
	if uuidRegex.MatchString(userID) {
		actor = sql.NullString{String: userID, Valid: true}
	}

	body, err := json.Marshal(payload)
	if err != nil {
		log.Printf("store_mgmt: warning - encoding audit payload for %s %s: %v", action, resourceID, err)
		body = []byte("{}")
	}

	query := `
		INSERT INTO audit_logs (user_id, action, resource_type, resource_id, payload_after, client_ip)
		VALUES ($1, $2, $3, $4, $5::jsonb, 'internal');`
	if _, err := s.platformDB.ExecContext(ctx, query, actor, action, resourceType, resourceID, string(body)); err != nil {
		log.Printf("store_mgmt: warning - writing audit log %s for %s: %v", action, resourceID, err)
	}
}

// randomHex returns 2*bytesLen lowercase hex characters from crypto/rand.
// It returns an error if the system random source fails; it never returns a zero-filled value.
func randomHex(bytesLen int) (string, error) {
	b := make([]byte, bytesLen)
	if _, err := io.ReadFull(rand.Reader, b); err != nil {
		return "", fmt.Errorf("reading crypto/rand: %w", err)
	}
	return hex.EncodeToString(b), nil
}
