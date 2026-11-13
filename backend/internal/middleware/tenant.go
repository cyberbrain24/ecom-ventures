// Package middleware provides HTTP pipeline handlers for request tracing,
// contextual logging, multi-tenant CORS policies, and crash recovery.
package middleware

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"ecom-ventures/backend/internal/platform"
	"ecom-ventures/backend/internal/store"
	storeCtx "ecom-ventures/backend/internal/store/context"
	"ecom-ventures/backend/internal/store/resolver"
	"ecom-ventures/backend/pkg/response"
	"github.com/go-chi/chi/v5"
)

// StorefrontTenantResolver resolves the store context from the incoming Host header or X-Original-Host.
func StorefrontTenantResolver(res *resolver.StoreResolver) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			// Prefer Nginx forwarded host if present to respect the original client domain
			targetHost := r.Header.Get("X-Original-Host")
			if targetHost == "" {
				targetHost = r.Header.Get("X-Forwarded-Host")
			}
			if targetHost == "" {
				targetHost = r.Host
			}

			sc, err := res.ResolveByDomain(r.Context(), targetHost)
			if err != nil {
				handleResolverError(w, r, err, targetHost)
				return
			}

			// Inject verified store context and proceed
			ctx := storeCtx.WithStoreContext(r.Context(), sc)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// StoreAdminTenantResolver resolves the store context for administrative routes from URL params or headers.
// Inspects Chi URL parameter {store_slug} or the fallback 'X-Store-Slug' header.
func StoreAdminTenantResolver(res *resolver.StoreResolver) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			slug := chi.URLParam(r, "store_slug")
			if slug == "" {
				slug = r.Header.Get("X-Store-Slug")
			}

			if slug == "" {
				response.BadRequest(w, r, "Missing mandatory store identifier in path or X-Store-Slug header.")
				return
			}

			sc, err := res.ResolveBySlug(r.Context(), slug)
			if err != nil {
				handleResolverError(w, r, err, slug)
				return
			}

			ctx := storeCtx.WithStoreContext(r.Context(), sc)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequireTenantContext is a security guard ensuring downstream handlers only execute if StoreContext exists.
func RequireTenantContext(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, err := storeCtx.GetStoreContext(r.Context())
		if err != nil {
			response.Problem(w, r, http.StatusForbidden, "TENANT_CONTEXT_REQUIRED", "Access Denied", "A validated store context is required to access this endpoint.")
			return
		}
		next.ServeHTTP(w, r)
	})
}

// TenantResolver provides legacy in-memory registry resolution for platform integration tests.
func TenantResolver(reg platform.Registry) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			slug := r.Header.Get("X-Store-Slug")
			host := r.Host
			if colonIdx := strings.Index(host, ":"); colonIdx != -1 {
				host = host[:colonIdx]
			}

			var matchedStore *platform.Store
			var err error

			if slug != "" {
				matchedStore, err = reg.GetBySlug(r.Context(), slug)
			} else {
				matchedStore, err = reg.GetByDomain(r.Context(), host)
			}

			if err != nil {
				response.WriteProblem(w, r, http.StatusNotFound, "Tenant Not Found",
					fmt.Sprintf("Unable to resolve tenant for host %q or slug %q: %v", host, slug, err))
				return
			}

			if matchedStore.Status != "active" {
				response.WriteProblem(w, r, http.StatusForbidden, "Tenant Inactive",
					fmt.Sprintf("Store %q is currently %s", matchedStore.Slug, matchedStore.Status))
				return
			}

			tCtx := store.TenantContext{
				StoreID:   matchedStore.ID,
				StoreSlug: matchedStore.Slug,
				DBName:    matchedStore.DBName,
				DBHost:    matchedStore.DBHost,
				DBPort:    matchedStore.DBPort,
			}

			ctx := store.WithTenantContext(r.Context(), tCtx)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func handleResolverError(w http.ResponseWriter, r *http.Request, err error, identifier string) {
	if errors.Is(err, resolver.ErrStoreNotFound) {
		response.NotFound(w, r, "The requested store brand '"+identifier+"' could not be found.")
		return
	}
	if errors.Is(err, resolver.ErrStoreSuspended) {
		response.Problem(w, r, http.StatusForbidden, "STORE_SUSPENDED", "Store Suspended", "This store has been temporarily suspended by platform administration.")
		return
	}
	if errors.Is(err, resolver.ErrStoreArchived) {
		response.Problem(w, r, http.StatusGone, "STORE_ARCHIVED", "Store Archived", "This store has been archived and is no longer operational.")
		return
	}

	// Unexpected infrastructure or decryption error
	slog.Default().Error("Storefront tenant resolution failed", slog.String("identifier", identifier), slog.String("error", err.Error()))
	response.InternalServerError(w, r)
}
