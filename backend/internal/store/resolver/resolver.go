// Package resolver provides domain and slug resolution backed by Redis caching
// and the Central Platform Database to instantiate StoreContext models.
package resolver

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"ecom-ventures/backend/internal/platform/models"
	storeCtx "ecom-ventures/backend/internal/store/context"
	storeDB "ecom-ventures/backend/internal/store/database"
	"ecom-ventures/backend/pkg/crypto"
	"github.com/redis/go-redis/v9"
)

var (
	ErrStoreNotFound  = errors.New("resolver: store not found")
	ErrStoreSuspended = errors.New("resolver: store is currently suspended")
	ErrStoreArchived  = errors.New("resolver: store is archived")
)

const (
	cachePrefixDomain = "resolve:domain:"
	cachePrefixSlug   = "resolve:slug:"
	defaultCacheTTL   = 10 * time.Minute
)

// StoreResolver resolves tenant metadata and database pools for incoming requests.
type StoreResolver struct {
	platformDB    *sql.DB
	redisClient   *redis.Client
	tenantPool    *storeDB.TenantPoolManager
	encryptionKey []byte
	cacheTTL      time.Duration
}

// NewStoreResolver instantiates the tenant resolution service.
func NewStoreResolver(
	platformDB *sql.DB,
	redisClient *redis.Client,
	tenantPool *storeDB.TenantPoolManager,
	encryptionKey []byte,
) (*StoreResolver, error) {
	if len(encryptionKey) != 32 {
		return nil, crypto.ErrInvalidKeySize
	}

	return &StoreResolver{
		platformDB:    platformDB,
		redisClient:   redisClient,
		tenantPool:    tenantPool,
		encryptionKey: encryptionKey,
		cacheTTL:      defaultCacheTTL,
	}, nil
}

type cachedStoreRecord struct {
	Store               models.Store `json:"store"`
	DBPasswordEncrypted string       `json:"db_password_encrypted"`
	Domain              string       `json:"domain"`
	IsCustom            bool         `json:"is_custom"`
}

// ResolveByDomain resolves a store using an incoming Host or custom domain (e.g. mior.com, mior.localhost).
func (r *StoreResolver) ResolveByDomain(ctx context.Context, rawHost string) (*storeCtx.StoreContext, error) {
	cleanHost := cleanHostString(rawHost)
	if cleanHost == "localhost" || cleanHost == "127.0.0.1" {
		// When directly probing localhost without subdomain, default to pilot brand mior
		return r.ResolveBySlug(ctx, "mior")
	}

	cacheKey := cachePrefixDomain + cleanHost

	// 1. Attempt Redis cache lookup
	if r.redisClient != nil {
		cachedData, err := r.redisClient.Get(ctx, cacheKey).Bytes()
		if err == nil {
			var record cachedStoreRecord
			if jsonErr := json.Unmarshal(cachedData, &record); jsonErr == nil && record.DBPasswordEncrypted != "" {
				record.Store.DBPasswordEncrypted = record.DBPasswordEncrypted
				return r.buildStoreContext(ctx, &record.Store, cleanHost, record.IsCustom)
			}
		}
	}

	if r.platformDB == nil {
		return nil, fmt.Errorf("resolver: platform database connection handle is nil")
	}

	// 2. Query Central Platform Database for domain mapping
	query := `
		SELECT s.id, s.name, s.slug, COALESCE(s.description, ''), COALESCE(s.logo_url, ''), s.status,
		       s.db_host, s.db_port, s.db_name, s.db_user, s.db_password_encrypted, s.db_sslmode,
		       s.contact_email, COALESCE(s.contact_phone, ''), s.currency, s.timezone, s.created_at, s.updated_at,
		       d.is_custom
		FROM domains d
		JOIN stores s ON s.id = d.store_id
		WHERE d.domain = $1
		LIMIT 1;`

	var store models.Store
	var isCustom bool

	err := r.platformDB.QueryRowContext(ctx, query, cleanHost).Scan(
		&store.ID, &store.Name, &store.Slug, &store.Description, &store.LogoURL, &store.Status,
		&store.DBHost, &store.DBPort, &store.DBName, &store.DBUser, &store.DBPasswordEncrypted, &store.DBSSLMode,
		&store.ContactEmail, &store.ContactPhone, &store.Currency, &store.Timezone, &store.CreatedAt, &store.UpdatedAt,
		&isCustom,
	)

	if err == sql.ErrNoRows {
		// Fallback: check if cleanHost matches a store slug subdomain directly (e.g., mior.localhost)
		subdomain := extractSubdomain(cleanHost)
		if subdomain != "" {
			return r.ResolveBySlug(ctx, subdomain)
		}
		return nil, ErrStoreNotFound
	} else if err != nil {
		return nil, fmt.Errorf("resolver: database error resolving domain %s: %w", cleanHost, err)
	}

	// 3. Cache resolved store record in Redis
	r.cacheStoreRecord(ctx, cacheKey, &store, cleanHost, isCustom)

	return r.buildStoreContext(ctx, &store, cleanHost, isCustom)
}

// ResolveBySlug resolves a store using a unique store identifier (used for store admin paths).
func (r *StoreResolver) ResolveBySlug(ctx context.Context, slug string) (*storeCtx.StoreContext, error) {
	cleanSlug := strings.ToLower(strings.TrimSpace(slug))
	if cleanSlug == "" {
		return nil, ErrStoreNotFound
	}

	cacheKey := cachePrefixSlug + cleanSlug

	// 1. Attempt Redis cache lookup
	if r.redisClient != nil {
		cachedData, err := r.redisClient.Get(ctx, cacheKey).Bytes()
		if err == nil {
			var record cachedStoreRecord
			if jsonErr := json.Unmarshal(cachedData, &record); jsonErr == nil && record.DBPasswordEncrypted != "" {
				record.Store.DBPasswordEncrypted = record.DBPasswordEncrypted
				return r.buildStoreContext(ctx, &record.Store, "", false)
			}
		}
	}

	if r.platformDB == nil {
		return nil, fmt.Errorf("resolver: platform database connection handle is nil")
	}

	// 2. Query Central Platform Database by slug
	query := `
		SELECT id, name, slug, COALESCE(description, ''), COALESCE(logo_url, ''), status,
		       db_host, db_port, db_name, db_user, db_password_encrypted, db_sslmode,
		       contact_email, COALESCE(contact_phone, ''), currency, timezone, created_at, updated_at
		FROM stores
		WHERE slug = $1
		LIMIT 1;`

	var store models.Store
	err := r.platformDB.QueryRowContext(ctx, query, cleanSlug).Scan(
		&store.ID, &store.Name, &store.Slug, &store.Description, &store.LogoURL, &store.Status,
		&store.DBHost, &store.DBPort, &store.DBName, &store.DBUser, &store.DBPasswordEncrypted, &store.DBSSLMode,
		&store.ContactEmail, &store.ContactPhone, &store.Currency, &store.Timezone, &store.CreatedAt, &store.UpdatedAt,
	)

	if err == sql.ErrNoRows {
		return nil, ErrStoreNotFound
	} else if err != nil {
		return nil, fmt.Errorf("resolver: database error resolving slug %s: %w", cleanSlug, err)
	}

	// 3. Cache resolved store record in Redis
	r.cacheStoreRecord(ctx, cacheKey, &store, "", false)

	return r.buildStoreContext(ctx, &store, "", false)
}

// InvalidateCache purges Redis cache keys for a given store domain and slug.
func (r *StoreResolver) InvalidateCache(ctx context.Context, domain, slug string) {
	if r.redisClient == nil {
		return
	}
	var keys []string
	if domain != "" {
		keys = append(keys, cachePrefixDomain+cleanHostString(domain))
	}
	if slug != "" {
		keys = append(keys, cachePrefixSlug+strings.ToLower(strings.TrimSpace(slug)))
	}
	if len(keys) > 0 {
		_ = r.redisClient.Del(ctx, keys...).Err()
	}
}

// buildStoreContext decrypts DB credentials, verifies status, and secures the tenant pool handle.
func (r *StoreResolver) buildStoreContext(ctx context.Context, store *models.Store, domain string, isCustom bool) (*storeCtx.StoreContext, error) {
	// Guard against inactive or suspended stores
	if store.Status == models.StoreStatusSuspended {
		return nil, ErrStoreSuspended
	}
	if store.Status == models.StoreStatusArchived {
		return nil, ErrStoreArchived
	}

	// Decrypt tenant database password
	decryptedPassword, err := crypto.Decrypt(store.DBPasswordEncrypted, r.encryptionKey)
	if err != nil {
		return nil, fmt.Errorf("resolver: failed to decrypt database credentials for %s: %w", store.Slug, err)
	}

	if r.tenantPool == nil {
		return nil, fmt.Errorf("resolver: tenant connection pool manager is nil")
	}

	// Retrieve or open pooled connection to the tenant database
	tenantDB, err := r.tenantPool.GetOrOpen(ctx, store, decryptedPassword)
	if err != nil {
		return nil, fmt.Errorf("resolver: failed to acquire tenant DB pool for %s: %w", store.Slug, err)
	}

	return &storeCtx.StoreContext{
		Store:    store,
		TenantDB: tenantDB,
		Domain:   domain,
		IsCustom: isCustom,
	}, nil
}

func (r *StoreResolver) cacheStoreRecord(ctx context.Context, key string, store *models.Store, domain string, isCustom bool) {
	if r.redisClient == nil {
		return
	}
	record := cachedStoreRecord{
		Store:               *store,
		DBPasswordEncrypted: store.DBPasswordEncrypted,
		Domain:              domain,
		IsCustom:            isCustom,
	}
	data, err := json.Marshal(record)
	if err == nil {
		_ = r.redisClient.Set(ctx, key, data, r.cacheTTL).Err()
	}
}

func cleanHostString(host string) string {
	h := strings.ToLower(strings.TrimSpace(host))
	if idx := strings.Index(h, ":"); idx != -1 {
		h = h[:idx] // Strip port if present
	}
	return h
}

func extractSubdomain(host string) string {
	parts := strings.Split(host, ".")
	if len(parts) >= 2 {
		// e.g. "mior.localhost" -> "mior"
		return parts[0]
	}
	return ""
}
