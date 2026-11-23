package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"

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
