package middleware

import (
	"context"
	"net/http"
	"strings"

	"ecom-ventures/backend/internal/platform/models"
	storeCtx "ecom-ventures/backend/internal/store/context"
	pkgAuth "ecom-ventures/backend/pkg/auth"
	"ecom-ventures/backend/pkg/response"
)

type userContextKey string

const (
	AuthClaimsKey userContextKey = "auth_claims"
)

// Authenticate extracts Bearer JWT tokens, validates signature, and injects claims into context.
func Authenticate(tm *pkgAuth.TokenManager) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
				response.Unauthorized(w, r, "Missing or malformed Authorization header. Bearer token required.")
				return
			}

			tokenString := strings.TrimPrefix(authHeader, "Bearer ")
			claims, err := tm.VerifyToken(tokenString)
			if err != nil {
				response.Unauthorized(w, r, "Invalid or expired authorization token.")
				return
			}

			ctx := context.WithValue(r.Context(), AuthClaimsKey, claims)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RequirePlatformRole guarantees the caller is an authenticated Platform user with the required tier.
func RequirePlatformRole(allowedRoles ...models.PlatformUserRole) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := r.Context().Value(AuthClaimsKey).(*pkgAuth.Claims)
			if !ok || claims == nil || claims.UserType != pkgAuth.UserTypePlatform {
				response.Problem(w, r, http.StatusForbidden, "PLATFORM_ACCESS_DENIED", "Access Denied", "Platform administrator credentials required.")
				return
			}

			// Super Admin automatically bypasses specific role restrictions
			if claims.Role == string(models.RoleSuperAdmin) {
				next.ServeHTTP(w, r)
				return
			}

			hasRole := false
			for _, role := range allowedRoles {
				if claims.Role == string(role) {
					hasRole = true
					break
				}
			}

			if !hasRole {
				response.Problem(w, r, http.StatusForbidden, "INSUFFICIENT_PERMISSIONS", "Forbidden", "You do not possess the required platform role.")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

// RequireStoreRole guarantees the caller is store staff AND that their token belongs to THIS store.
// Enforces zero cross-tenant leakage at the backend layer.
func RequireStoreRole(allowedRoles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			claims, ok := r.Context().Value(AuthClaimsKey).(*pkgAuth.Claims)
			if !ok || claims == nil {
				response.Unauthorized(w, r, "Authentication token required.")
				return
			}

			// Platform Super Admins have universal override access across all store administrative portals
			if claims.UserType == pkgAuth.UserTypePlatform && claims.Role == string(models.RoleSuperAdmin) {
				next.ServeHTTP(w, r)
				return
			}

			// Validate tenant context is resolved
			sc, err := storeCtx.GetStoreContext(r.Context())
			if err != nil {
				response.Problem(w, r, http.StatusForbidden, "TENANT_CONTEXT_MISSING", "Tenant Missing", "Store context is unresolved.")
				return
			}

			// STRICT TENANT ISOLATION CHECK: Ensure token's store_id matches the active store's ID
			if claims.StoreID != sc.Store.ID {
				response.Problem(w, r, http.StatusForbidden, "CROSS_TENANT_ACCESS_DENIED", "Forbidden", "You are not authorized to access or modify data for this store.")
				return
			}

			// Verify specific role permission
			if len(allowedRoles) > 0 {
				hasRole := false
				for _, role := range allowedRoles {
					if claims.Role == role {
						hasRole = true
						break
					}
				}
				if !hasRole {
					response.Problem(w, r, http.StatusForbidden, "INSUFFICIENT_STORE_ROLE", "Forbidden", "Your store staff role lacks authorization for this operation.")
					return
				}
			}

			next.ServeHTTP(w, r)
		})
	}
}
