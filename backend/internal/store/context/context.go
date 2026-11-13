// Package context provides strongly typed tenant context models and injection utilities
// for the Ecom Ventures multi-tenant architecture.
package context

import (
	"context"
	"database/sql"
	"errors"

	"ecom-ventures/backend/internal/platform/models"
)

type tenantContextKey struct{}

var (
	// ErrStoreContextNotFound indicates an operation was attempted without a resolved tenant context.
	ErrStoreContextNotFound = errors.New("tenant: store context not found in request context")
	// ErrNilStore indicates the store model within the context is unexpectedly nil.
	ErrNilStore = errors.New("tenant: store record is nil")
	// ErrNilTenantDB indicates the tenant database connection handle is uninitialized.
	ErrNilTenantDB = errors.New("tenant: tenant database connection handle is nil")
)

// StoreContext encapsulates the resolved tenant identity, configuration metadata,
// and the isolated database connection pool for the active request.
type StoreContext struct {
	Store    *models.Store
	TenantDB *sql.DB
	Domain   string
	IsCustom bool
}

// WithStoreContext returns a new context containing the provided StoreContext.
func WithStoreContext(parent context.Context, sc *StoreContext) context.Context {
	return context.WithValue(parent, tenantContextKey{}, sc)
}

// GetStoreContext retrieves the StoreContext from context, returning an error if missing.
func GetStoreContext(ctx context.Context) (*StoreContext, error) {
	if ctx == nil {
		return nil, ErrStoreContextNotFound
	}

	val := ctx.Value(tenantContextKey{})
	if val == nil {
		return nil, ErrStoreContextNotFound
	}

	sc, ok := val.(*StoreContext)
	if !ok || sc == nil {
		return nil, ErrStoreContextNotFound
	}

	if sc.Store == nil {
		return nil, ErrNilStore
	}

	return sc, nil
}

// FromContext retrieves the StoreContext from context (alias for GetStoreContext).
func FromContext(ctx context.Context) (*StoreContext, error) {
	return GetStoreContext(ctx)
}

// MustGetStoreContext retrieves the StoreContext from context or panics if not present.
// Should only be utilized in handlers strictly guarded by RequireTenantContext middleware.
func MustGetStoreContext(ctx context.Context) *StoreContext {
	sc, err := GetStoreContext(ctx)
	if err != nil {
		panic(err)
	}
	return sc
}

// GetTenantDB returns the isolated tenant *sql.DB connection pool from the request context.
func GetTenantDB(ctx context.Context) (*sql.DB, error) {
	sc, err := GetStoreContext(ctx)
	if err != nil {
		return nil, err
	}

	if sc.TenantDB == nil {
		return nil, ErrNilTenantDB
	}

	return sc.TenantDB, nil
}

// GetStoreID returns the resolved store UUID string.
func GetStoreID(ctx context.Context) (string, error) {
	sc, err := GetStoreContext(ctx)
	if err != nil {
		return "", err
	}
	return sc.Store.ID, nil
}

// GetStoreSlug returns the unique URL slug of the resolved store.
func GetStoreSlug(ctx context.Context) (string, error) {
	sc, err := GetStoreContext(ctx)
	if err != nil {
		return "", err
	}
	return sc.Store.Slug, nil
}
