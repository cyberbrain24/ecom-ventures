// Package store manages shared tenant-level operations and tenant context propagation.
package store

import (
	"context"
	"fmt"
)

// contextKey is a private type to avoid context collisions across packages.
type contextKey struct{}

var tenantCtxKey = contextKey{}

// TenantContext encapsulates the tenant isolation parameters for an active request.
type TenantContext struct {
	StoreID   string
	StoreSlug string
	DBName    string
	DBHost    string
	DBPort    int
}

// WithTenantContext attaches verified tenant metadata to the request context.
// Inputs:
//   - ctx: Parent request context
//   - tc: Verified TenantContext
//
// Outputs:
//   - context.Context: Enriched context containing tenant isolation parameters
//
// Tenant Isolation:
//   - Ensures downstream handlers operate strictly within the bounds of this verified tenant.
func WithTenantContext(ctx context.Context, tc TenantContext) context.Context {
	return context.WithValue(ctx, tenantCtxKey, tc)
}

// FromContext extracts the TenantContext from the context.
// Inputs:
//   - ctx: Active request context
//
// Outputs:
//   - TenantContext: Extracted tenant context
//   - error: Wrapped error if tenant context was not populated
//
// Tenant Isolation:
//   - Critical guardrail: All tenant store endpoints must verify presence before database queries.
func FromContext(ctx context.Context) (TenantContext, error) {
	val := ctx.Value(tenantCtxKey)
	if val == nil {
		return TenantContext{}, fmt.Errorf("store: tenant context missing from execution request")
	}

	tc, ok := val.(TenantContext)
	if !ok {
		return TenantContext{}, fmt.Errorf("store: context value is not of type TenantContext")
	}

	return tc, nil
}
