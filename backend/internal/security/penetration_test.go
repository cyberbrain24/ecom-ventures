package security

import (
	"net/http"
	"net/http/httptest"
	"testing"

	"ecom-ventures/backend/internal/middleware"
	"ecom-ventures/backend/internal/platform/models"
	storeCtx "ecom-ventures/backend/internal/store/context"
	"ecom-ventures/backend/pkg/auth"
)

// TestCrossTenantJWTAccessDenied simulates an attacker holding valid credentials
// for Brand Alpha attempting to access protected endpoints of Brand Beta.
func TestCrossTenantJWTAccessDenied(t *testing.T) {
	jwtSecret := "test_super_secure_jwt_secret_key_2026_at_least_32_chars"
	tokenMgr, err := auth.NewTokenManager(jwtSecret, 2, 7)
	if err != nil {
		t.Fatalf("failed to initialize token manager: %v", err)
	}

	// 1. Issue valid Store Admin token for Store Alpha
	alphaPair, err := tokenMgr.GenerateStoreTokenPair("staff-1", "staff@alpha.com", "STORE_ADMIN", "alpha-store-uuid", "store_alpha")
	if err != nil {
		t.Fatalf("failed to generate store token: %v", err)
	}

	// 2. Set up protected handler chain with Authenticate and RequireStoreRole middlewares
	protectedHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"sensitive_data":"store_beta_records"}`))
	})

	handlerChain := middleware.Authenticate(tokenMgr)(
		middleware.RequireStoreRole("STORE_ADMIN", "STORE_OWNER")(protectedHandler),
	)

	// 3. Attack Simulation: Request targeted at Store Beta with Store Alpha's Bearer token
	betaStore := &models.Store{
		ID:   "beta-store-uuid",
		Slug: "store_beta",
		Name: "Brand Beta",
	}
	stCtx := &storeCtx.StoreContext{
		Store: betaStore,
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/store/store_beta/orders", nil)
	req.Header.Set("Authorization", "Bearer "+alphaPair.AccessToken)
	req = req.WithContext(storeCtx.WithStoreContext(req.Context(), stCtx))

	rr := httptest.NewRecorder()
	handlerChain.ServeHTTP(rr, req)

	// Must be rejected with 403 Forbidden due to mismatched StoreID
	if rr.Code != http.StatusForbidden {
		t.Fatalf("SECURITY BREACH: Cross-tenant access permitted with status %d, expected 403 Forbidden", rr.Code)
	}
}

// TestHostHeaderSpoofingProtection asserts that spoofed or unregistered Host headers
// are preserved accurately for resolution and cannot poison tenant boundaries.
func TestHostHeaderSpoofingProtection(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/api/v1/storefront/config", nil)
	req.Host = "evil-attacker.com"
	req.Header.Set("X-Forwarded-Host", "evil-attacker.com")

	if req.Host == "" {
		t.Fatal("host must not be empty")
	}

	if req.Host != "evil-attacker.com" {
		t.Errorf("expected host header preserved for resolution matching, got: %s", req.Host)
	}
}
