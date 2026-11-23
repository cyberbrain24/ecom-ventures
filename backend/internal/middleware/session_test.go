package middleware

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	pkgAuth "ecom-ventures/backend/pkg/auth"
)

type fakeSessions struct {
	active bool
	err    error
}

func (f fakeSessions) SessionActive(context.Context, string) (bool, error) { return f.active, f.err }

func runSessionCheck(t *testing.T, s PlatformSessionChecker, userType pkgAuth.UserType) int {
	t.Helper()
	h := RequireActivePlatformSession(s)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))
	req := httptest.NewRequest(http.MethodGet, "/api/v1/platform/me", nil)
	ctx := context.WithValue(req.Context(), AuthClaimsKey, &pkgAuth.Claims{UserID: "u1", UserType: userType})
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, req.WithContext(ctx))
	return rr.Code
}

func TestRequireActivePlatformSessionRevokedGives401(t *testing.T) {
	if got := runSessionCheck(t, fakeSessions{active: false}, pkgAuth.UserTypePlatform); got != http.StatusUnauthorized {
		t.Fatalf("expected 401 for a revoked session, got %d", got)
	}
}

func TestRequireActivePlatformSessionStoreDownGives503(t *testing.T) {
	if got := runSessionCheck(t, fakeSessions{err: errors.New("redis down")}, pkgAuth.UserTypePlatform); got != http.StatusServiceUnavailable {
		t.Fatalf("expected 503 when the session store is unavailable, got %d", got)
	}
}

func TestRequireActivePlatformSessionValidPasses(t *testing.T) {
	if got := runSessionCheck(t, fakeSessions{active: true}, pkgAuth.UserTypePlatform); got != http.StatusOK {
		t.Fatalf("expected 200 for a live session, got %d", got)
	}
}

func TestRequireActivePlatformSessionSkipsStoreTokens(t *testing.T) {
	if got := runSessionCheck(t, fakeSessions{err: errors.New("redis down")}, pkgAuth.UserTypeStore); got != http.StatusOK {
		t.Fatalf("expected store tokens to pass untouched, got %d", got)
	}
}
