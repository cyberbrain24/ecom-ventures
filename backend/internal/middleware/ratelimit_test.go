package middleware

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestExtractClientIP(t *testing.T) {
	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Forwarded-For", "203.0.113.195, 70.41.3.18")

	ip := extractClientIP(req)
	if ip != "203.0.113.195" {
		t.Fatalf("expected 203.0.113.195, got %s", ip)
	}

	req2 := httptest.NewRequest(http.MethodGet, "/", nil)
	req2.Header.Set("X-Real-IP", "198.51.100.1")
	ip2 := extractClientIP(req2)
	if ip2 != "198.51.100.1" {
		t.Fatalf("expected 198.51.100.1, got %s", ip2)
	}
}

func TestRateLimiterNilRedisFailsOpen(t *testing.T) {
	limiter := NewRateLimiter(nil)
	cfg := RateLimiterConfig{MaxRequests: 5, Window: time.Minute, TierName: "TEST"}

	handler := limiter.Limit(cfg)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("expected fail open status 200, got %d", rr.Code)
	}
}
