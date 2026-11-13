// Package database provides dynamic connection pooling across dedicated tenant databases.
// It maintains, manages, and verifies *sql.DB handles dynamically to avoid connection leaks.
package database

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"sync"
	"time"

	"ecom-ventures/backend/internal/platform/models"
	_ "github.com/lib/pq"
)

// TenantPoolManager manages dynamic connection pools mapped by store ID.
type TenantPoolManager struct {
	mu           sync.RWMutex
	pools        map[string]*sql.DB
	maxOpenConns int
	maxIdleConns int
	connLifetime time.Duration
}

// NewTenantPoolManager constructs a thread-safe connection pool manager for tenant databases.
func NewTenantPoolManager(maxOpen, maxIdle int, lifetime time.Duration) *TenantPoolManager {
	return &TenantPoolManager{
		pools:        make(map[string]*sql.DB),
		maxOpenConns: maxOpen,
		maxIdleConns: maxIdle,
		connLifetime: lifetime,
	}
}

// GetOrOpen acquires an existing active connection pool for a store or opens a new one dynamically.
func (m *TenantPoolManager) GetOrOpen(ctx context.Context, store *models.Store, decryptedPassword string) (*sql.DB, error) {
	if store == nil || store.ID == "" {
		return nil, fmt.Errorf("tenant_pool: store record or ID cannot be nil")
	}

	m.mu.RLock()
	existingDB, exists := m.pools[store.ID]
	m.mu.RUnlock()

	if exists {
		// Verify active connection health before returning
		if err := existingDB.PingContext(ctx); err == nil {
			return existingDB, nil
		}
		log.Printf("tenant_pool: store connection %s ping failed, re-establishing pool", store.Slug)
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	// Double-check after acquiring write lock
	if existingDB, exists := m.pools[store.ID]; exists {
		if err := existingDB.PingContext(ctx); err == nil {
			return existingDB, nil
		}
		_ = existingDB.Close()
		delete(m.pools, store.ID)
	}

	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		store.DBHost, store.DBPort, store.DBUser, decryptedPassword, store.DBName, store.DBSSLMode,
	)

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("tenant_pool: failed to open postgres connection for store %s: %w", store.Slug, err)
	}

	db.SetMaxOpenConns(m.maxOpenConns)
	db.SetMaxIdleConns(m.maxIdleConns)
	db.SetConnMaxLifetime(m.connLifetime)

	pingCtx, cancel := context.WithTimeout(ctx, 4*time.Second)
	defer cancel()

	if err := db.PingContext(pingCtx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("tenant_pool: ping failed for newly opened pool %s (%s): %w", store.Slug, store.DBName, err)
	}

	m.pools[store.ID] = db
	log.Printf("tenant_pool: established dynamic pool for tenant: %s (store_id: %s, db: %s)", store.Slug, store.ID, store.DBName)

	return db, nil
}

// GetPool acquires or initializes a connection pool for a tenant given explicit database coordinates.
func (m *TenantPoolManager) GetPool(storeID, host string, port int, dbName, user, password, sslMode string) (*sql.DB, error) {
	if storeID == "" {
		return nil, fmt.Errorf("tenant_pool: storeID cannot be empty")
	}

	m.mu.RLock()
	existingDB, exists := m.pools[storeID]
	m.mu.RUnlock()

	if exists {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		if err := existingDB.PingContext(ctx); err == nil {
			return existingDB, nil
		}
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	if existingDB, exists := m.pools[storeID]; exists {
		ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
		defer cancel()
		if err := existingDB.PingContext(ctx); err == nil {
			return existingDB, nil
		}
		_ = existingDB.Close()
		delete(m.pools, storeID)
	}

	if sslMode == "" {
		sslMode = "disable"
	}

	dsn := fmt.Sprintf(
		"host=%s port=%d user=%s password=%s dbname=%s sslmode=%s",
		host, port, user, password, dbName, sslMode,
	)

	db, err := sql.Open("postgres", dsn)
	if err != nil {
		return nil, fmt.Errorf("tenant_pool: failed to open postgres connection for store ID %s: %w", storeID, err)
	}

	db.SetMaxOpenConns(m.maxOpenConns)
	db.SetMaxIdleConns(m.maxIdleConns)
	db.SetConnMaxLifetime(m.connLifetime)

	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Second)
	defer cancel()

	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, fmt.Errorf("tenant_pool: ping failed for newly opened pool %s (%s): %w", storeID, dbName, err)
	}

	m.pools[storeID] = db
	return db, nil
}

// CloseTenant closes and removes a specific tenant's pool (used during store maintenance or suspension).
func (m *TenantPoolManager) CloseTenant(storeID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	db, exists := m.pools[storeID]
	if !exists {
		return nil
	}

	delete(m.pools, storeID)
	log.Printf("tenant_pool: closed connection pool for tenant ID: %s", storeID)
	return db.Close()
}

// CloseAll terminates all tenant pools cleanly during application graceful shutdown.
func (m *TenantPoolManager) CloseAll() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for storeID, db := range m.pools {
		if err := db.Close(); err != nil {
			log.Printf("tenant_pool: error closing tenant pool %s: %v", storeID, err)
		}
	}
	m.pools = make(map[string]*sql.DB)
	log.Println("tenant_pool: all tenant database connection pools closed successfully.")
}

// ActivePoolsCount returns the number of active tenant connections held in memory.
func (m *TenantPoolManager) ActivePoolsCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.pools)
}
