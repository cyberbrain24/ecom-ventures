package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"ecom-ventures/backend/internal/platform"
	"ecom-ventures/backend/internal/platform/models"
	storeCtx "ecom-ventures/backend/internal/store/context"
)

func TestRequireTenantContextRejection(t *testing.T) {
	handler := RequireTenantContext(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/api/v1/store/products", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusForbidden {
		t.Fatalf("expected status 403 Forbidden when context is absent, got: %d", rr.Code)
	}
}

func TestRequireTenantContextSuccess(t *testing.T) {
	handler := RequireTenantContext(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	sc := &storeCtx.StoreContext{
		Store: &models.Store{
			ID:   "00000000-0000-0000-0000-000000000001",
			Slug: "mior",
		},
	}

	req := httptest.NewRequest(http.MethodGet, "/api/v1/store/products", nil)
	ctx := storeCtx.WithStoreContext(req.Context(), sc)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req.WithContext(ctx))

	if rr.Code != http.StatusOK {
		t.Fatalf("expected status 200 OK when context is present, got: %d", rr.Code)
	}
}

func TestTenantResolverMiddleware(t *testing.T) {
	reg := platform.NewMemoryRegistry()
	_ = reg.RegisterStore(context.Background(), &platform.Store{
		ID:     "store-1",
		Slug:   "mior",
		Status: "active",
	}, "mior.com")

	resolver := TenantResolver(reg)

	handler := resolver(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	t.Run("Resolves via X-Store-Slug header", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("X-Store-Slug", "mior")
		rr := httptest.NewRecorder()

		handler.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got: %d", rr.Code)
		}
	})

	t.Run("Resolves via Host header", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Host = "mior.com"
		rr := httptest.NewRecorder()

		handler.ServeHTTP(rr, req)
		if rr.Code != http.StatusOK {
			t.Fatalf("expected 200 OK, got: %d", rr.Code)
		}
	})

	t.Run("Rejects unknown tenant with 404 RFC 7807 problem", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("X-Store-Slug", "unknown")
		rr := httptest.NewRecorder()

		handler.ServeHTTP(rr, req)
		if rr.Code != http.StatusNotFound {
			t.Fatalf("expected 404 Not Found, got: %d", rr.Code)
		}
	})
}
