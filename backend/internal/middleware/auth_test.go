package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"ecom-ventures/backend/internal/platform/models"
	storeCtx "ecom-ventures/backend/internal/store/context"
	pkgAuth "ecom-ventures/backend/pkg/auth"
)

func TestRequireStoreRoleCrossTenantRejection(t *testing.T) {
	handler := RequireStoreRole("STORE_ADMIN")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// Context belongs to Store 1 (e.g. Mior)
	sc := &storeCtx.StoreContext{
		Store: &models.Store{ID: "store-001", Slug: "mior"},
	}

	// Caller presents token from Store 2 (e.g. Branda)
	claims := &pkgAuth.Claims{
		UserID:   "user-999",
		UserType: pkgAuth.UserTypeStore,
		StoreID:  "store-002", // DIFFERENT STORE!
		Role:     "STORE_ADMIN",
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/store/mior/orders", nil)
	ctx := storeCtx.WithStoreContext(req.Context(), sc)
	ctx = context.WithValue(ctx, AuthClaimsKey, claims)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req.WithContext(ctx))

	// Must be rejected with 403 Forbidden!
	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected 403 Forbidden on cross-tenant token, got: %d", rr.Code)
	}
}

func TestRequireStoreRoleSameTenantSuccess(t *testing.T) {
	handler := RequireStoreRole("STORE_ADMIN")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	sc := &storeCtx.StoreContext{
		Store: &models.Store{ID: "store-001", Slug: "mior"},
	}

	claims := &pkgAuth.Claims{
		UserID:   "user-111",
		UserType: pkgAuth.UserTypeStore,
		StoreID:  "store-001", // MATCHING STORE!
		Role:     "STORE_ADMIN",
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/store/mior/orders", nil)
	ctx := storeCtx.WithStoreContext(req.Context(), sc)
	ctx = context.WithValue(ctx, AuthClaimsKey, claims)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req.WithContext(ctx))

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for matching store token, got: %d", rr.Code)
	}
}

func TestSuperAdminStoreOverride(t *testing.T) {
	handler := RequireStoreRole("STORE_ADMIN")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	sc := &storeCtx.StoreContext{
		Store: &models.Store{ID: "store-001", Slug: "mior"},
	}

	claims := &pkgAuth.Claims{
		UserID:   "superadmin-1",
		UserType: pkgAuth.UserTypePlatform,
		Role:     string(models.RoleSuperAdmin),
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/store/mior/orders", nil)
	ctx := storeCtx.WithStoreContext(req.Context(), sc)
	ctx = context.WithValue(ctx, AuthClaimsKey, claims)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req.WithContext(ctx))

	if rr.Code != http.StatusOK {
		t.Fatalf("expected 200 OK for SuperAdmin on store route, got: %d", rr.Code)
	}
}

func TestRequirePlatformRole(t *testing.T) {
	handler := RequirePlatformRole(models.RolePlatformStaff)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	// Case 1: Store user trying to access platform route -> 403
	storeClaims := &pkgAuth.Claims{
		UserID:   "store-user-1",
		UserType: pkgAuth.UserTypeStore,
		Role:     "STORE_ADMIN",
	}
	req1 := httptest.NewRequest(http.MethodGet, "/api/v1/platform/me", nil)
	ctx1 := context.WithValue(req1.Context(), AuthClaimsKey, storeClaims)
	rr1 := httptest.NewRecorder()
	handler.ServeHTTP(rr1, req1.WithContext(ctx1))
	if rr1.Code != http.StatusForbidden {
		t.Errorf("expected 403 Forbidden for store user on platform route, got: %d", rr1.Code)
	}

	// Case 2: Platform user with required role -> 200
	platClaims := &pkgAuth.Claims{
		UserID:   "plat-staff-1",
		UserType: pkgAuth.UserTypePlatform,
		Role:     string(models.RolePlatformStaff),
	}
	req2 := httptest.NewRequest(http.MethodGet, "/api/v1/platform/me", nil)
	ctx2 := context.WithValue(req2.Context(), AuthClaimsKey, platClaims)
	rr2 := httptest.NewRecorder()
	handler.ServeHTTP(rr2, req2.WithContext(ctx2))
	if rr2.Code != http.StatusOK {
		t.Errorf("expected 200 OK for platform staff, got: %d", rr2.Code)
	}
}
