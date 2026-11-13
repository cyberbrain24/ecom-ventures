package main

import (
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"ecom-ventures/backend/internal/config"
	"ecom-ventures/backend/internal/platform/domains"
	"ecom-ventures/backend/internal/platform/store_mgmt"
	"ecom-ventures/backend/internal/platform/themes"
	"ecom-ventures/backend/internal/security"
	"ecom-ventures/backend/internal/store/catalog"
	"ecom-ventures/backend/internal/store/customers"
	"ecom-ventures/backend/internal/store/inventory"
	"ecom-ventures/backend/internal/store/logistics"
	"ecom-ventures/backend/internal/store/marketing"
	"ecom-ventures/backend/internal/store/orders"
	"ecom-ventures/backend/internal/store/payments"
	"ecom-ventures/backend/internal/store/promotions"
	"ecom-ventures/backend/internal/store/settings"
	storefrontCart "ecom-ventures/backend/internal/storefront/cart"
	storefrontCatalog "ecom-ventures/backend/internal/storefront/catalog"
	storefrontCheckout "ecom-ventures/backend/internal/storefront/checkout"
	pkgAuth "ecom-ventures/backend/pkg/auth"
	"ecom-ventures/backend/pkg/response"
)

func TestRouterBaseHealthCheck(t *testing.T) {
	cfg := &config.Config{
		AppEnv: "test",
		Port:   "8080",
		Routing: config.RoutingConfig{
			MasterAdminDomain: "master.dropiobd.localhost",
			StoreAdminDomain:  "store.dropiobd.localhost",
		},
	}

	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	router := buildRouter(cfg, logger, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200, got %d", rr.Code)
	}

	var env response.SuccessEnvelope
	if err := json.NewDecoder(rr.Body).Decode(&env); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if !env.Success {
		t.Errorf("expected success true")
	}
}

func TestStorefrontWithoutResolverConfigured(t *testing.T) {
	cfg := &config.Config{
		AppEnv: "test",
		Port:   "8080",
	}

	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	router := buildRouter(cfg, logger, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/storefront/config", nil)
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	// Since resolver is nil in this test, panic recoverer should catch and return 500 RFC 7807 problem details
	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("expected status 500 when resolver is uninitialized, got: %d", rr.Code)
	}
}

func TestRouterRFC7807NotFound(t *testing.T) {
	cfg := &config.Config{
		AppEnv: "test",
		Port:   "8080",
	}

	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	router := buildRouter(cfg, logger, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/non-existent-endpoint", nil)
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusNotFound {
		t.Fatalf("expected status 404, got %d", rr.Code)
	}

	if contentType := rr.Header().Get("Content-Type"); contentType != "application/problem+json; charset=utf-8" {
		t.Errorf("expected RFC 7807 problem+json header, got %s", contentType)
	}

	var problem response.ProblemDetails
	if err := json.NewDecoder(rr.Body).Decode(&problem); err != nil {
		t.Fatalf("failed to decode problem details: %v", err)
	}

	if problem.Code != "NOT_FOUND" {
		t.Errorf("expected code NOT_FOUND, got %s", problem.Code)
	}
}

func TestRouterMethodNotAllowed(t *testing.T) {
	cfg := &config.Config{
		AppEnv: "test",
		Port:   "8080",
	}

	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	router := buildRouter(cfg, logger, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	req := httptest.NewRequest(http.MethodPost, "/healthz", nil)
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusMethodNotAllowed {
		t.Fatalf("expected status 405, got %d", rr.Code)
	}

	if contentType := rr.Header().Get("Content-Type"); contentType != "application/problem+json; charset=utf-8" {
		t.Errorf("expected RFC 7807 problem+json header, got %s", contentType)
	}
}

func TestPlatformProtectedWithoutAuth(t *testing.T) {
	cfg := &config.Config{
		AppEnv: "test",
		Port:   "8080",
	}

	tm, _ := pkgAuth.NewTokenManager("test_secret_key_with_at_least_32_characters!", 2, 7)
	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	router := buildRouter(cfg, logger, nil, tm, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/platform/me", nil)
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401 Unauthorized without token, got: %d", rr.Code)
	}
}

func TestPlatformProtectedWithAuth(t *testing.T) {
	cfg := &config.Config{
		AppEnv: "test",
		Port:   "8080",
	}

	tm, _ := pkgAuth.NewTokenManager("test_secret_key_with_at_least_32_characters!", 2, 7)
	pair, err := tm.GeneratePlatformTokenPair("admin-1", "superadmin@dropiobd.com", "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("failed to generate token: %v", err)
	}

	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	router := buildRouter(cfg, logger, nil, tm, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/platform/me", nil)
	req.Header.Set("Authorization", "Bearer "+pair.AccessToken)
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200 OK with valid superadmin token, got: %d", rr.Code)
	}
}

func TestStoreRoutesUnauthorized(t *testing.T) {
	cfg := &config.Config{
		AppEnv: "test",
		Port:   "8080",
	}

	tm, _ := pkgAuth.NewTokenManager("test_secret_key_with_at_least_32_characters!", 2, 7)
	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	storeHandler := store_mgmt.NewHandler(&store_mgmt.Service{})
	router := buildRouter(cfg, logger, nil, tm, nil, nil, storeHandler, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	// 1. GET /api/v1/platform/stores without token -> 401
	{
		req := httptest.NewRequest(http.MethodGet, "/api/v1/platform/stores", nil)
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)
		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected 401 Unauthorized for unauthenticated GET /stores, got: %d", rr.Code)
		}
	}

	// 2. POST /api/v1/platform/stores without token -> 401
	{
		req := httptest.NewRequest(http.MethodPost, "/api/v1/platform/stores", strings.NewReader(`{"name":"Mior Fashion","slug":"mior"}`))
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)
		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected 401 Unauthorized for unauthenticated POST /stores, got: %d", rr.Code)
		}
	}

	// 3. PATCH /api/v1/platform/stores/xyz/status without token -> 401
	{
		req := httptest.NewRequest(http.MethodPatch, "/api/v1/platform/stores/xyz/status", strings.NewReader(`{"status":"SUSPENDED"}`))
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)
		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected 401 Unauthorized for unauthenticated PATCH /stores/xyz/status, got: %d", rr.Code)
		}
	}

	// 4. GET /api/v1/platform/stores/xyz/provisioning-logs without token -> 401
	{
		req := httptest.NewRequest(http.MethodGet, "/api/v1/platform/stores/xyz/provisioning-logs", nil)
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)
		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected 401 Unauthorized for unauthenticated GET /provisioning-logs, got: %d", rr.Code)
		}
	}
}

func TestDomainRoutesUnauthorized(t *testing.T) {
	cfg := &config.Config{
		AppEnv: "test",
		Port:   "8080",
	}

	tm, _ := pkgAuth.NewTokenManager("test_secret_key_with_at_least_32_characters!", 2, 7)
	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	domainHandler := domains.NewHandler(&domains.Service{})
	router := buildRouter(cfg, logger, nil, tm, nil, nil, nil, domainHandler, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	// 1. GET /api/v1/platform/domains without token -> 401
	{
		req := httptest.NewRequest(http.MethodGet, "/api/v1/platform/domains", nil)
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)
		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected 401 Unauthorized for unauthenticated GET /domains, got: %d", rr.Code)
		}
	}

	// 2. POST /api/v1/platform/domains without token -> 401
	{
		req := httptest.NewRequest(http.MethodPost, "/api/v1/platform/domains", strings.NewReader(`{"domain":"mior.com","store_id":"s1"}`))
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)
		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected 401 Unauthorized for unauthenticated POST /domains, got: %d", rr.Code)
		}
	}

	// 3. POST /api/v1/platform/domains/d1/verify without token -> 401
	{
		req := httptest.NewRequest(http.MethodPost, "/api/v1/platform/domains/d1/verify", nil)
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)
		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected 401 Unauthorized for unauthenticated POST /domains/d1/verify, got: %d", rr.Code)
		}
	}

	// 4. PATCH /api/v1/platform/domains/d1/primary without token -> 401
	{
		req := httptest.NewRequest(http.MethodPatch, "/api/v1/platform/domains/d1/primary", nil)
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)
		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected 401 Unauthorized for unauthenticated PATCH /domains/d1/primary, got: %d", rr.Code)
		}
	}

	// 5. DELETE /api/v1/platform/domains/d1 without token -> 401
	{
		req := httptest.NewRequest(http.MethodDelete, "/api/v1/platform/domains/d1", nil)
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)
		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected 401 Unauthorized for unauthenticated DELETE /domains/d1, got: %d", rr.Code)
		}
	}
}

func TestThemeRoutesUnauthorized(t *testing.T) {
	cfg := &config.Config{
		AppEnv: "test",
		Port:   "8080",
	}

	tm, _ := pkgAuth.NewTokenManager("test_secret_key_with_at_least_32_characters!", 2, 7)
	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	themeHandler := themes.NewHandler(&themes.Service{})
	router := buildRouter(cfg, logger, nil, tm, nil, nil, nil, nil, themeHandler, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	// 1. GET /api/v1/platform/themes without token -> 401
	{
		req := httptest.NewRequest(http.MethodGet, "/api/v1/platform/themes", nil)
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)
		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected 401 Unauthorized for unauthenticated GET /themes, got: %d", rr.Code)
		}
	}

	// 2. POST /api/v1/platform/themes without token -> 401
	{
		req := httptest.NewRequest(http.MethodPost, "/api/v1/platform/themes", strings.NewReader(`{"name":"Nordic","slug":"nordic"}`))
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)
		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected 401 Unauthorized for unauthenticated POST /themes, got: %d", rr.Code)
		}
	}

	// 3. PUT /api/v1/platform/stores/s1/theme without token -> 401
	{
		req := httptest.NewRequest(http.MethodPut, "/api/v1/platform/stores/s1/theme", strings.NewReader(`{"theme_id":"t1"}`))
		req.Header.Set("Content-Type", "application/json")
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)
		if rr.Code != http.StatusUnauthorized {
			t.Errorf("expected 401 Unauthorized for unauthenticated PUT /stores/s1/theme, got: %d", rr.Code)
		}
	}
}

func TestUploadsStaticFileServing(t *testing.T) {
	cfg := &config.Config{
		AppEnv: "test",
		Port:   "8080",
	}

	_ = os.MkdirAll("./uploads", 0755)
	testFilePath := "./uploads/test-static.txt"
	_ = os.WriteFile(testFilePath, []byte("static file content test"), 0644)
	defer os.Remove(testFilePath)

	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	router := buildRouter(cfg, logger, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/uploads/test-static.txt", nil)
	rr := httptest.NewRecorder()

	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200 for static upload file, got %d", rr.Code)
	}

	body := rr.Body.String()
	if body != "static file content test" {
		t.Errorf("expected content 'static file content test', got '%s'", body)
	}
}

func TestCatalogRoutesUnauthorized(t *testing.T) {
	cfg := &config.Config{
		AppEnv: "test",
		Port:   "8080",
	}

	tm, _ := pkgAuth.NewTokenManager("test_secret_key_with_at_least_32_characters!", 2, 7)
	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	catalogHandler := catalog.NewHandler(&catalog.Service{})
	router := buildRouter(cfg, logger, nil, tm, nil, nil, nil, nil, nil, catalogHandler, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	endpoints := []string{
		"/api/v1/store/mior/catalog/categories",
		"/api/v1/store/mior/catalog/products",
	}

	for _, ep := range endpoints {
		req := httptest.NewRequest(http.MethodGet, ep, nil)
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("endpoint %s: expected status 401 Unauthorized without token, got: %d", ep, rr.Code)
		}

		var problem response.ProblemDetails
		if err := json.NewDecoder(rr.Body).Decode(&problem); err != nil {
			t.Errorf("endpoint %s: failed to decode problem details: %v", ep, err)
		}
		if problem.Status != http.StatusUnauthorized {
			t.Errorf("endpoint %s: expected problem status 401, got %d", ep, problem.Status)
		}
	}
}

func TestVariantAndAttributeRoutesUnauthorized(t *testing.T) {
	cfg := &config.Config{
		AppEnv: "test",
		Port:   "8080",
	}

	tm, _ := pkgAuth.NewTokenManager("test_secret_key_with_at_least_32_characters!", 2, 7)
	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	variantsHandler := catalog.NewVariantsHandler(&catalog.VariantsService{})
	router := buildRouter(cfg, logger, nil, tm, nil, nil, nil, nil, nil, nil, variantsHandler, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	endpoints := []string{
		"/api/v1/store/mior/catalog/attributes",
		"/api/v1/store/mior/catalog/products/p1/variants",
	}

	for _, ep := range endpoints {
		req := httptest.NewRequest(http.MethodGet, ep, nil)
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("endpoint %s: expected status 401 Unauthorized without token, got: %d", ep, rr.Code)
		}

		var problem response.ProblemDetails
		if err := json.NewDecoder(rr.Body).Decode(&problem); err != nil {
			t.Errorf("endpoint %s: failed to decode problem details: %v", ep, err)
		}
		if problem.Status != http.StatusUnauthorized {
			t.Errorf("endpoint %s: expected problem status 401, got %d", ep, problem.Status)
		}
	}
}

func TestInventoryRoutesUnauthorized(t *testing.T) {
	cfg := &config.Config{
		AppEnv: "test",
		Port:   "8080",
	}

	tm, _ := pkgAuth.NewTokenManager("test_secret_key_with_at_least_32_characters!", 2, 7)
	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	inventoryHandler := inventory.NewHandler(&inventory.Service{})
	router := buildRouter(cfg, logger, nil, tm, nil, nil, nil, nil, nil, nil, nil, inventoryHandler, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	endpoints := []string{
		"/api/v1/store/mior/inventory",
		"/api/v1/store/mior/inventory/movements",
		"/api/v1/store/mior/inventory/alerts/low-stock",
	}

	for _, ep := range endpoints {
		req := httptest.NewRequest(http.MethodGet, ep, nil)
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("endpoint %s: expected status 401 Unauthorized without token, got: %d", ep, rr.Code)
		}

		var problem response.ProblemDetails
		if err := json.NewDecoder(rr.Body).Decode(&problem); err != nil {
			t.Errorf("endpoint %s: failed to decode problem details: %v", ep, err)
		}
		if problem.Status != http.StatusUnauthorized {
			t.Errorf("endpoint %s: expected problem status 401, got %d", ep, problem.Status)
		}
	}
}

func TestOrderRoutesUnauthorized(t *testing.T) {
	cfg := &config.Config{
		AppEnv: "test",
		Port:   "8080",
	}

	tm, _ := pkgAuth.NewTokenManager("test_secret_key_with_at_least_32_characters!", 2, 7)
	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	ordersHandler := orders.NewHandler(&orders.Service{})
	router := buildRouter(cfg, logger, nil, tm, nil, nil, nil, nil, nil, nil, nil, nil, ordersHandler, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	endpoints := []string{
		"/api/v1/store/mior/orders",
		"/api/v1/store/mior/orders/ord-123",
	}

	for _, ep := range endpoints {
		req := httptest.NewRequest(http.MethodGet, ep, nil)
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("endpoint %s: expected status 401 Unauthorized without token, got: %d", ep, rr.Code)
		}

		var problem response.ProblemDetails
		if err := json.NewDecoder(rr.Body).Decode(&problem); err != nil {
			t.Errorf("endpoint %s: failed to decode problem details: %v", ep, err)
		}
		if problem.Status != http.StatusUnauthorized {
			t.Errorf("endpoint %s: expected problem status 401, got %d", ep, problem.Status)
		}
	}
}

func TestCustomerRoutesUnauthorized(t *testing.T) {
	cfg := &config.Config{
		AppEnv: "test",
		Port:   "8080",
	}

	tm, _ := pkgAuth.NewTokenManager("test_secret_key_with_at_least_32_characters!", 2, 7)
	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	customersHandler := customers.NewHandler(&customers.Service{})
	router := buildRouter(cfg, logger, nil, tm, nil, nil, nil, nil, nil, nil, nil, nil, nil, customersHandler, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	endpoints := []string{
		"/api/v1/store/mior/customers",
		"/api/v1/store/mior/customers/cust-123",
	}

	for _, ep := range endpoints {
		req := httptest.NewRequest(http.MethodGet, ep, nil)
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("endpoint %s: expected status 401 Unauthorized without token, got: %d", ep, rr.Code)
		}

		var problem response.ProblemDetails
		if err := json.NewDecoder(rr.Body).Decode(&problem); err != nil {
			t.Errorf("endpoint %s: failed to decode problem details: %v", ep, err)
		}
		if problem.Status != http.StatusUnauthorized {
			t.Errorf("endpoint %s: expected problem status 401, got %d", ep, problem.Status)
		}
	}
}

func TestPromotionRoutesUnauthorized(t *testing.T) {
	cfg := &config.Config{
		AppEnv: "test",
		Port:   "8080",
	}

	tm, _ := pkgAuth.NewTokenManager("test_secret_key_with_at_least_32_characters!", 2, 7)
	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	promotionsHandler := promotions.NewHandler(&promotions.Service{})
	router := buildRouter(cfg, logger, nil, tm, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, promotionsHandler, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	endpoints := []string{
		"/api/v1/store/mior/promotions/coupons",
		"/api/v1/store/mior/promotions/coupons/cpn-123",
	}

	for _, ep := range endpoints {
		req := httptest.NewRequest(http.MethodGet, ep, nil)
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("endpoint %s: expected status 401 Unauthorized without token, got: %d", ep, rr.Code)
		}

		var problem response.ProblemDetails
		if err := json.NewDecoder(rr.Body).Decode(&problem); err != nil {
			t.Errorf("endpoint %s: failed to decode problem details: %v", ep, err)
		}
		if problem.Status != http.StatusUnauthorized {
			t.Errorf("endpoint %s: expected problem status 401, got %d", ep, problem.Status)
		}
	}
}

func TestSettingsRoutesUnauthorized(t *testing.T) {
	cfg := &config.Config{
		AppEnv: "test",
		Port:   "8080",
	}

	tm, _ := pkgAuth.NewTokenManager("test_secret_key_with_at_least_32_characters!", 2, 7)
	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	settingsHandler := settings.NewHandler(&settings.Service{})
	router := buildRouter(cfg, logger, nil, tm, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, settingsHandler, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	endpoints := []string{
		"/api/v1/store/mior/settings",
	}

	for _, ep := range endpoints {
		req := httptest.NewRequest(http.MethodGet, ep, nil)
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("endpoint %s: expected status 401 Unauthorized without token, got: %d", ep, rr.Code)
		}

		var problem response.ProblemDetails
		if err := json.NewDecoder(rr.Body).Decode(&problem); err != nil {
			t.Errorf("endpoint %s: failed to decode problem details: %v", ep, err)
		}
		if problem.Status != http.StatusUnauthorized {
			t.Errorf("endpoint %s: expected problem status 401, got %d", ep, problem.Status)
		}
	}
}

func TestStaffRoutesUnauthorized(t *testing.T) {
	cfg := &config.Config{
		AppEnv: "test",
		Port:   "8080",
	}

	tm, _ := pkgAuth.NewTokenManager("test_secret_key_with_at_least_32_characters!", 2, 7)
	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	settingsHandler := settings.NewHandler(&settings.Service{})
	router := buildRouter(cfg, logger, nil, tm, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, settingsHandler, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	endpoints := []string{
		"/api/v1/store/mior/staff",
		"/api/v1/store/mior/staff/change-password",
	}

	for _, ep := range endpoints {
		req := httptest.NewRequest(http.MethodGet, ep, nil)
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("endpoint %s: expected status 401 Unauthorized without token, got: %d", ep, rr.Code)
		}

		var problem response.ProblemDetails
		if err := json.NewDecoder(rr.Body).Decode(&problem); err != nil {
			t.Errorf("endpoint %s: failed to decode problem details: %v", ep, err)
		}
		if problem.Status != http.StatusUnauthorized {
			t.Errorf("endpoint %s: expected problem status 401, got %d", ep, problem.Status)
		}
	}
}

func TestStorefrontCatalogRoutes(t *testing.T) {
	cfg := &config.Config{
		AppEnv: "test",
		Port:   "8080",
	}

	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	catHandler := storefrontCatalog.NewHandler(&storefrontCatalog.Service{})
	router := buildRouter(cfg, logger, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, catHandler, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	endpoints := []string{
		"/api/v1/storefront/catalog/categories",
		"/api/v1/storefront/catalog/products",
		"/api/v1/storefront/catalog/products/silk-blouse",
	}

	for _, ep := range endpoints {
		req := httptest.NewRequest(http.MethodGet, ep, nil)
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		// Without a configured resolver, StorefrontTenantResolver panic recoverer returns 500
		if rr.Code != http.StatusInternalServerError {
			t.Errorf("endpoint %s: expected status 500 when resolver is nil, got: %d", ep, rr.Code)
		}
	}
}

func TestStorefrontCartRoutes(t *testing.T) {
	cfg := &config.Config{
		AppEnv: "test",
		Port:   "8080",
	}

	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	cartHandler := storefrontCart.NewHandler(&storefrontCart.Service{})
	router := buildRouter(cfg, logger, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, cartHandler, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	endpoints := []string{
		"/api/v1/storefront/cart",
		"/api/v1/storefront/cart/items",
	}

	for _, ep := range endpoints {
		req := httptest.NewRequest(http.MethodGet, ep, nil)
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		// Without a configured resolver, StorefrontTenantResolver panic recoverer returns 500
		if rr.Code != http.StatusInternalServerError {
			t.Errorf("endpoint %s: expected status 500 when resolver is nil, got: %d", ep, rr.Code)
		}
	}
}

func TestStorefrontCheckoutRoutes(t *testing.T) {
	cfg := &config.Config{
		AppEnv: "test",
		Port:   "8080",
	}

	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	checkoutHandler := storefrontCheckout.NewHandler(&storefrontCheckout.Service{})
	router := buildRouter(cfg, logger, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, checkoutHandler, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	endpoints := []string{
		"/api/v1/storefront/checkout",
		"/api/v1/storefront/orders/ORD-123456-ABC",
	}

	for _, ep := range endpoints {
		req := httptest.NewRequest(http.MethodGet, ep, nil)
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		// Without a configured resolver, StorefrontTenantResolver panic recoverer returns 500
		if rr.Code != http.StatusInternalServerError {
			t.Errorf("endpoint %s: expected status 500 when resolver is nil, got: %d", ep, rr.Code)
		}
	}
}

func TestStorefrontPaymentRoutes(t *testing.T) {
	cfg := &config.Config{
		AppEnv: "test",
		Port:   "8080",
	}

	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	paymentHandler := payments.NewHandler(&payments.Service{})
	router := buildRouter(cfg, logger, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, paymentHandler, nil, nil, nil, nil, nil, nil, nil, nil, nil)

	endpoints := []string{
		"/api/v1/storefront/payments/initiate",
		"/api/v1/storefront/payments/bkash/callback",
		"/api/v1/storefront/payments/bkash/webhook",
	}

	for _, ep := range endpoints {
		req := httptest.NewRequest(http.MethodPost, ep, strings.NewReader(`{}`))
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		// Without a configured resolver, StorefrontTenantResolver panic recoverer returns 500
		if rr.Code != http.StatusInternalServerError {
			t.Errorf("endpoint %s: expected status 500 when resolver is nil, got: %d", ep, rr.Code)
		}
	}
}

func TestStoreLogisticsRoutes(t *testing.T) {
	cfg := &config.Config{
		AppEnv: "test",
		Port:   "8080",
	}

	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	logisticsHandler := logistics.NewHandler(&logistics.Service{})
	router := buildRouter(cfg, logger, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, logisticsHandler, nil, nil, nil, nil, nil, nil, nil, nil)

	endpoints := []string{
		"/api/v1/storefront/logistics/track/TRK123456",
		"/api/v1/storefront/logistics/steadfast/webhook",
	}

	for _, ep := range endpoints {
		req := httptest.NewRequest(http.MethodPost, ep, strings.NewReader(`{}`))
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		// Without a configured resolver, StorefrontTenantResolver panic recoverer returns 500
		if rr.Code != http.StatusInternalServerError {
			t.Errorf("endpoint %s: expected status 500 when resolver is nil, got: %d", ep, rr.Code)
		}
	}
}

func TestStoreMarketingRoutes(t *testing.T) {
	cfg := &config.Config{
		AppEnv: "test",
		Port:   "8080",
	}

	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	marketingHandler := marketing.NewHandler(&marketing.Service{})
	router := buildRouter(cfg, logger, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, marketingHandler, nil, nil, nil, nil, nil, nil, nil)

	// Public storefront marketing config requires tenant resolution; without resolver, returns 500
	req := httptest.NewRequest(http.MethodGet, "/api/v1/storefront/marketing/config", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Errorf("expected status 500 when resolver is nil, got: %d", rr.Code)
	}

	// Store admin marketing endpoints require authentication
	adminEndpoints := []string{
		"/api/v1/store/mior/settings/marketing",
	}

	for _, ep := range adminEndpoints {
		req := httptest.NewRequest(http.MethodGet, ep, nil)
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Errorf("endpoint %s: expected status 401 Unauthorized without token, got: %d", ep, rr.Code)
		}
	}
}

func TestPlatformSecurityAuditRoutes(t *testing.T) {
	cfg := &config.Config{
		AppEnv: "test",
		Port:   "8080",
	}

	tm, _ := pkgAuth.NewTokenManager("test_secret_key_with_at_least_32_characters!", 2, 7)
	logger := slog.New(slog.NewJSONHandler(io.Discard, nil))
	secRunner := security.NewAuditRunner(nil, nil)
	secHandler := security.NewHandler(secRunner)
	router := buildRouter(cfg, logger, nil, tm, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, secHandler, nil, nil, nil, nil, nil, nil)

	// 1. Unauthenticated request to /api/v1/platform/security/audit returns 401 Unauthorized Problem Details
	req := httptest.NewRequest(http.MethodGet, "/api/v1/platform/security/audit", nil)
	rr := httptest.NewRecorder()
	router.ServeHTTP(rr, req)

	if rr.Code != http.StatusUnauthorized {
		t.Fatalf("expected status 401 Unauthorized, got: %d", rr.Code)
	}

	var problem response.ProblemDetails
	if err := json.NewDecoder(rr.Body).Decode(&problem); err != nil {
		t.Fatalf("failed to decode problem details: %v", err)
	}
	if problem.Status != http.StatusUnauthorized {
		t.Errorf("expected problem status 401, got %d", problem.Status)
	}

	// 2. Authenticated request with non-superadmin token returns 403 Forbidden
	staffPair, err := tm.GeneratePlatformTokenPair("staff-1", "staff@platform.local", "PLATFORM_STAFF")
	if err != nil {
		t.Fatalf("failed to generate staff token: %v", err)
	}
	reqForbidden := httptest.NewRequest(http.MethodGet, "/api/v1/platform/security/audit", nil)
	reqForbidden.Header.Set("Authorization", "Bearer "+staffPair.AccessToken)
	rrForbidden := httptest.NewRecorder()
	router.ServeHTTP(rrForbidden, reqForbidden)

	if rrForbidden.Code != http.StatusForbidden {
		t.Fatalf("expected status 403 Forbidden for non-superadmin, got: %d", rrForbidden.Code)
	}

	// 3. Authenticated request with SUPER_ADMIN token returns 200 OK with audit report JSON
	adminPair, err := tm.GeneratePlatformTokenPair("admin-1", "admin@platform.local", "SUPER_ADMIN")
	if err != nil {
		t.Fatalf("failed to generate super admin token: %v", err)
	}
	reqOK := httptest.NewRequest(http.MethodGet, "/api/v1/platform/security/audit", nil)
	reqOK.Header.Set("Authorization", "Bearer "+adminPair.AccessToken)
	rrOK := httptest.NewRecorder()
	router.ServeHTTP(rrOK, reqOK)

	if rrOK.Code != http.StatusOK {
		t.Fatalf("expected status 200 OK for superadmin, got: %d (%s)", rrOK.Code, rrOK.Body.String())
	}

	var res struct {
		Success bool                         `json:"success"`
		Data    security.SecurityAuditReport `json:"data"`
	}
	if err := json.NewDecoder(rrOK.Body).Decode(&res); err != nil {
		t.Fatalf("failed to decode audit report: %v", err)
	}
	if res.Data.ChecksRun == 0 {
		t.Errorf("expected audit checks to run, got 0")
	}
	if res.Data.OverallVerdict != security.StatusPass {
		t.Errorf("expected overall verdict PASS, got %s", res.Data.OverallVerdict)
	}
}
