package store_mgmt

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"

	"ecom-ventures/backend/internal/platform/models"
	"ecom-ventures/backend/internal/platform/provisioner"
	storeDB "ecom-ventures/backend/internal/store/database"
	"ecom-ventures/backend/internal/store/resolver"
	"ecom-ventures/backend/pkg/hasher"
)

var (
	ErrStoreNotFound     = errors.New("store_mgmt: store not found")
	ErrSlugAlreadyExists = errors.New("store_mgmt: store slug already taken")
	ErrDomainConflict    = errors.New("store_mgmt: domain already mapped to another store")
	ErrThemeNotFound     = errors.New("store_mgmt: requested theme not registered in platform")
	ErrInvalidStatus     = errors.New("store_mgmt: invalid store status transition")
)

var slugRegex = regexp.MustCompile(`^[a-z0-9]+(-[a-z0-9]+)*$`)

// Service orchestrates the Store Creator pipeline and lifecycle management.
type Service struct {
	platformDB  *sql.DB
	provisioner *provisioner.Provisioner
	resolver    *resolver.StoreResolver
	tenantPool  *storeDB.TenantPoolManager
}

// NewService instantiates the Store Creator management service.
func NewService(
	platformDB *sql.DB,
	provisioner *provisioner.Provisioner,
	resolver *resolver.StoreResolver,
	tenantPool *storeDB.TenantPoolManager,
) *Service {
	return &Service{
		platformDB:  platformDB,
		provisioner: provisioner,
		resolver:    resolver,
		tenantPool:  tenantPool,
	}
}

// CreateStore executes the automated 10-step store provisioning pipeline.
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

	if s.platformDB == nil {
		return nil, fmt.Errorf("store_mgmt: platform database connection handle is nil")
	}

	// Verify Slug and Domain Uniqueness
	var slugExists bool
	_ = s.platformDB.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM stores WHERE slug = $1);", req.Slug).Scan(&slugExists)
	if slugExists {
		return nil, ErrSlugAlreadyExists
	}

	cleanDomain := strings.ToLower(strings.TrimSpace(req.PrimaryDomain))
	if cleanDomain == "" {
		cleanDomain = fmt.Sprintf("%s.localhost", req.Slug)
	}
	var domainExists bool
	_ = s.platformDB.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM domains WHERE domain = $1);", cleanDomain).Scan(&domainExists)
	if domainExists {
		return nil, ErrDomainConflict
	}

	// Step 2: Theme Existence Verification
	themeSlug := req.ThemeSlug
	if themeSlug == "" {
		themeSlug = "modern-minimal" // Default fallback theme
	}
	var theme models.Theme
	err := s.platformDB.QueryRowContext(ctx, `
		SELECT id, name, slug, version, is_active FROM themes WHERE slug = $1 AND is_active = TRUE;`,
		themeSlug,
	).Scan(&theme.ID, &theme.Name, &theme.Slug, &theme.Version, &theme.IsActive)
	if err == sql.ErrNoRows {
		// If requested theme not found, fetch the first active platform theme as fallback
		err = s.platformDB.QueryRowContext(ctx, `
			SELECT id, name, slug, version, is_active FROM themes WHERE is_active = TRUE ORDER BY created_at ASC LIMIT 1;`,
		).Scan(&theme.ID, &theme.Name, &theme.Slug, &theme.Version, &theme.IsActive)
		if err == sql.ErrNoRows {
			return nil, ErrThemeNotFound
		}
	} else if err != nil {
		return nil, fmt.Errorf("failed to query theme registry: %w", err)
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

	generatedDBName := fmt.Sprintf("store_%s_%s", req.Slug, randomHex(4))
	generatedDBUser := fmt.Sprintf("user_%s", req.Slug)
	if len(generatedDBUser) > 30 {
		generatedDBUser = generatedDBUser[:30]
	}
	rawDBPassword := randomHex(16)

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
	targetDBUser := os.Getenv("PLATFORM_DB_USER")
	if targetDBUser == "" {
		targetDBUser = "platform_user"
	}

	store := &models.Store{
		Name:         req.Name,
		Slug:         req.Slug,
		Description:  req.Description,
		Status:       models.StoreStatusProvisioning,
		DBHost:       targetDBHost,
		DBPort:       targetDBPort,
		DBName:       generatedDBName,
		DBUser:       targetDBUser,
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
		_ = s.cleanupFailedStore(ctx, store.ID, store.DBName)
		return nil, fmt.Errorf("store_mgmt: provisioner service is nil")
	}

	err = s.provisioner.ProvisionStoreDatabase(ctx, store, rawDBPassword)
	if err != nil {
		_ = s.cleanupFailedStore(ctx, store.ID, store.DBName)
		return nil, fmt.Errorf("database provisioning pipeline failed: %w", err)
	}

	// Update store record with the encrypted password generated by provisioner
	_, err = s.platformDB.ExecContext(ctx, `
		UPDATE stores SET db_password_encrypted = $1 WHERE id = $2;`,
		store.DBPasswordEncrypted, store.ID)
	if err != nil {
		_ = s.cleanupFailedStore(ctx, store.ID, store.DBName)
		return nil, fmt.Errorf("failed to persist encrypted database credentials: %w", err)
	}

	// Step 6: Seed Initial Store Owner into Tenant Database
	err = s.seedInitialStoreOwner(ctx, store, rawDBPassword, &req.InitialOwner)
	if err != nil {
		_ = s.cleanupFailedStore(ctx, store.ID, store.DBName)
		return nil, fmt.Errorf("failed to seed initial store administrator: %w", err)
	}

	// Step 7: Assign Theme in Central Platform DB
	assignThemeSQL := `
		INSERT INTO store_themes (store_id, theme_id, custom_config, is_active)
		VALUES ($1, $2, '{}'::jsonb, TRUE);`
	if _, err := s.platformDB.ExecContext(ctx, assignThemeSQL, store.ID, theme.ID); err != nil {
		_ = s.cleanupFailedStore(ctx, store.ID, store.DBName)
		return nil, fmt.Errorf("failed to bind store theme: %w", err)
	}

	// Step 8: Register Primary Domain in Platform DB
	insertDomainSQL := `
		INSERT INTO domains (store_id, domain, is_primary, is_custom, ssl_status)
		VALUES ($1, $2, TRUE, TRUE, 'ACTIVE');`
	if _, err := s.platformDB.ExecContext(ctx, insertDomainSQL, store.ID, cleanDomain); err != nil {
		_ = s.cleanupFailedStore(ctx, store.ID, store.DBName)
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
			{StoreID: store.ID, Domain: cleanDomain, IsPrimary: true, IsCustom: true, SSLStatus: models.SSLStatusActive},
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
		       COALESCE(t.name, 'Default') as active_theme
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

	return results, total, nil
}

// GetStoreDetails fetches full store record, domain list, and theme details.
func (s *Service) GetStoreDetails(ctx context.Context, storeID string) (*StoreDetailResponse, error) {
	if s.platformDB == nil {
		return nil, fmt.Errorf("store_mgmt: platform database connection handle is nil")
	}

	queryStore := `
		SELECT id, name, slug, description, logo_url, status,
		       db_host, db_port, db_name, db_user, db_password_encrypted, db_sslmode,
		       contact_email, contact_phone, currency, timezone, created_at, updated_at
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
		if err := domainRows.Scan(&d.ID, &d.StoreID, &d.Domain, &d.IsPrimary, &d.IsCustom, &d.SSLStatus, &d.CreatedAt, &d.UpdatedAt); err == nil {
			domains = append(domains, d)
		}
	}

	// Fetch Active Theme
	var theme models.Theme
	err = s.platformDB.QueryRowContext(ctx, `
		SELECT t.id, t.name, t.slug, t.description, t.version, t.preview_image_url, t.config_schema, t.is_active
		FROM themes t
		JOIN store_themes st ON st.theme_id = t.id
		WHERE st.store_id = $1 AND st.is_active = TRUE
		LIMIT 1;`, store.ID).Scan(
		&theme.ID, &theme.Name, &theme.Slug, &theme.Description, &theme.Version,
		&theme.PreviewImageURL, &theme.ConfigSchema, &theme.IsActive,
	)

	var activeThemePtr *models.Theme
	if err == nil {
		activeThemePtr = &theme
	}

	return &StoreDetailResponse{
		Store:       store,
		Domains:     domains,
		ActiveTheme: activeThemePtr,
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
	if err == sql.ErrNoRows {
		return ErrStoreNotFound
	}

	_, err = s.platformDB.ExecContext(ctx, `UPDATE stores SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2;`, newStatus, storeID)
	if err != nil {
		return fmt.Errorf("failed to update store status: %w", err)
	}

	// If suspended or archived, close cached connection pool immediately
	if (newStatus == models.StoreStatusSuspended || newStatus == models.StoreStatusArchived) && s.tenantPool != nil {
		_ = s.tenantPool.CloseTenant(storeID)
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
		if err := rows.Scan(&l.ID, &l.StoreID, &l.Step, &l.StepOrder, &l.Status, &l.Details, &l.ErrorMessage, &l.StartedAt, &l.CompletedAt); err == nil {
			logs = append(logs, l)
		}
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
	var slug, dbName, storeName string
	err := s.platformDB.QueryRowContext(ctx, `
		SELECT name, slug, db_name FROM stores WHERE id = $1;`, storeID,
	).Scan(&storeName, &slug, &dbName)
	if err == sql.ErrNoRows {
		return ErrStoreNotFound
	} else if err != nil {
		return fmt.Errorf("failed to query store metadata for deletion: %w", err)
	}

	// 2. Fetch all domains for cache invalidation
	domainRows, err := s.platformDB.QueryContext(ctx, `SELECT domain FROM domains WHERE store_id = $1;`, storeID)
	var domains []string
	if err == nil {
		for domainRows.Next() {
			var d string
			if scanErr := domainRows.Scan(&d); scanErr == nil {
				domains = append(domains, d)
			}
		}
		domainRows.Close()
	}

	// 3. Invalidate Redis routing and theme cache
	if s.resolver != nil {
		for _, d := range domains {
			s.resolver.InvalidateCache(ctx, d, slug)
		}
		s.resolver.InvalidateCache(ctx, "", slug)
	}

	// 4. Close and evict any active connection pool for this tenant
	if s.tenantPool != nil {
		_ = s.tenantPool.CloseTenant(storeID)
	}

	// 5. Drop dedicated PostgreSQL database (terminates connections + DROP DATABASE ... WITH (FORCE))
	if s.provisioner != nil && dbName != "" {
		if dropErr := s.provisioner.DropStoreDatabase(ctx, dbName); dropErr != nil {
			log.Printf("store_mgmt: warning - failed to drop store database %s: %v", dbName, dropErr)
		}
	}

	// 6. Delete store record from platform database (cascades to domains, store_themes, store_provisioning_logs, etc.)
	result, err := s.platformDB.ExecContext(ctx, `DELETE FROM stores WHERE id = $1;`, storeID)
	if err != nil {
		return fmt.Errorf("failed to delete store from platform database: %w", err)
	}
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return ErrStoreNotFound
	}

	// 7. Clean up disk assets (uploads, backups)
	_ = os.RemoveAll(filepath.Join("uploads", slug))
	_ = os.RemoveAll(filepath.Join("uploads", storeID))
	_ = os.RemoveAll(filepath.Join("backups", slug))

	// 8. Audit log deletion
	s.logPlatformAudit(ctx, userID, "STORE_DELETED", "stores", storeID, map[string]string{
		"store_id": storeID,
		"name":     storeName,
		"slug":     slug,
		"db_name":  dbName,
		"action":   "hard_delete",
	})

	log.Printf("store_mgmt: store %s (%s, db: %s) successfully and permanently deleted", storeName, slug, dbName)
	return nil
}

func (s *Service) cleanupFailedStore(ctx context.Context, storeID, dbName string) error {
	log.Printf("store_mgmt: initiating rollback cleanup for failed store %s (db: %s)", storeID, dbName)
	if s.provisioner != nil {
		_ = s.provisioner.DropStoreDatabase(ctx, dbName)
	}
	if s.platformDB != nil {
		_, err := s.platformDB.ExecContext(ctx, "DELETE FROM stores WHERE id = $1;", storeID)
		return err
	}
	return nil
}

func (s *Service) logPlatformAudit(ctx context.Context, userID, action, resourceType, resourceID string, payload interface{}) {
	if s.platformDB == nil {
		return
	}
	query := `
		INSERT INTO audit_logs (user_id, action, resource_type, resource_id, payload_after, client_ip)
		VALUES ($1, $2, $3, $4, $5, '127.0.0.1');`
	_, _ = s.platformDB.ExecContext(ctx, query, userID, action, resourceType, resourceID, "{}")
}

func randomHex(bytesLen int) string {
	b := make([]byte, bytesLen)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
