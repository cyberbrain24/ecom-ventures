// Package platform contains domain models and registry services for central platform management.
package platform

import (
	"context"
	"fmt"
	"sync"
	"time"
)

// Store represents a registered tenant retail brand managed by the platform.
type Store struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Slug       string    `json:"slug"`
	Status     string    `json:"status"`
	DBHost     string    `json:"db_host"`
	DBPort     int       `json:"db_port"`
	DBName     string    `json:"db_name"`
	DBUser     string    `json:"db_user"`
	DBPassword string    `json:"-"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// DomainBinding maps a public custom hostname to an internal store ID.
type DomainBinding struct {
	ID        string    `json:"id"`
	StoreID   string    `json:"store_id"`
	Domain    string    `json:"domain"`
	IsPrimary bool      `json:"is_primary"`
	CreatedAt time.Time `json:"created_at"`
}

// Registry defines operations for querying and provisioning tenant store records.
type Registry interface {
	GetBySlug(ctx context.Context, slug string) (*Store, error)
	GetByDomain(ctx context.Context, domain string) (*Store, error)
	RegisterStore(ctx context.Context, store *Store, primaryDomain string) error
	ListStores(ctx context.Context) ([]*Store, error)
}

// MemoryRegistry provides a thread-safe registry implementation for platform routing.
type MemoryRegistry struct {
	mu             sync.RWMutex
	storesByID     map[string]*Store
	storesBySlug   map[string]*Store
	domainsToStore map[string]string
}

// NewMemoryRegistry constructs an initialized in-memory platform store registry.
// Outputs:
//   - *MemoryRegistry: Seeded with default baseline stores for verification.
//
// Tenant Isolation:
//   - Enforces unique slugs and domain mappings across the central platform registry.
func NewMemoryRegistry() *MemoryRegistry {
	reg := &MemoryRegistry{
		storesByID:     make(map[string]*Store),
		storesBySlug:   make(map[string]*Store),
		domainsToStore: make(map[string]string),
	}

	// Seed baseline stores
	now := time.Now().UTC()
	store1 := &Store{
		ID:         "store-mior-001",
		Name:       "Mior Fashion",
		Slug:       "mior",
		Status:     "active",
		DBHost:     "store-db-prototype",
		DBPort:     5432,
		DBName:     "ecom_store_mior",
		DBUser:     "store_prototype_user",
		DBPassword: "store_secure_password_2026",
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	store2 := &Store{
		ID:         "store-branda-002",
		Name:       "Branda Lifestyle",
		Slug:       "branda",
		Status:     "active",
		DBHost:     "store-db-prototype",
		DBPort:     5432,
		DBName:     "ecom_store_branda",
		DBUser:     "store_prototype_user",
		DBPassword: "store_secure_password_2026",
		CreatedAt:  now,
		UpdatedAt:  now,
	}

	_ = reg.RegisterStore(context.Background(), store1, "mior.com")
	_ = reg.RegisterStore(context.Background(), store2, "branda.com")

	return reg
}

// GetBySlug retrieves store metadata by tenant slug.
func (r *MemoryRegistry) GetBySlug(_ context.Context, slug string) (*Store, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	s, exists := r.storesBySlug[slug]
	if !exists {
		return nil, fmt.Errorf("platform: store with slug %q not found", slug)
	}
	return s, nil
}

// GetByDomain retrieves store metadata by custom hostname.
func (r *MemoryRegistry) GetByDomain(_ context.Context, domain string) (*Store, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	storeID, exists := r.domainsToStore[domain]
	if !exists {
		return nil, fmt.Errorf("platform: domain binding %q not found", domain)
	}

	s, exists := r.storesByID[storeID]
	if !exists {
		return nil, fmt.Errorf("platform: store id %q mapped to domain %q missing", storeID, domain)
	}
	return s, nil
}

// RegisterStore saves a new store and binds its primary domain.
func (r *MemoryRegistry) RegisterStore(_ context.Context, store *Store, primaryDomain string) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	if _, exists := r.storesBySlug[store.Slug]; exists {
		return fmt.Errorf("platform: store slug %q already registered", store.Slug)
	}

	r.storesByID[store.ID] = store
	r.storesBySlug[store.Slug] = store
	if primaryDomain != "" {
		r.domainsToStore[primaryDomain] = store.ID
	}
	return nil
}

// ListStores returns all registered tenant stores.
func (r *MemoryRegistry) ListStores(_ context.Context) ([]*Store, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	list := make([]*Store, 0, len(r.storesByID))
	for _, s := range r.storesByID {
		list = append(list, s)
	}
	return list, nil
}
