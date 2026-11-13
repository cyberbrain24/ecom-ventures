package middleware

import (
	"bytes"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestRequestIDMiddleware(t *testing.T) {
	handler := RequestID(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		reqID := GetRequestID(r.Context())
		if reqID == "unknown" || reqID == "" {
			t.Errorf("expected valid request ID in context, got: %s", reqID)
		}
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if respID := rr.Header().Get("X-Request-ID"); respID == "" {
		t.Errorf("expected X-Request-ID header in response")
	}
}

func TestRecovererMiddleware(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	panicHandler := Recoverer(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		panic("critical database connection failure simulation")
	}))

	req := httptest.NewRequest(http.MethodGet, "/panic-route", nil)
	rr := httptest.NewRecorder()

	panicHandler.ServeHTTP(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("expected status 500 after panic recovery, got: %d", rr.Code)
	}

	if contentType := rr.Header().Get("Content-Type"); contentType != "application/problem+json; charset=utf-8" {
		t.Errorf("expected problem+json content type, got: %s", contentType)
	}

	if !bytes.Contains(buf.Bytes(), []byte("critical database connection failure simulation")) {
		t.Errorf("expected panic message in structured log buffer")
	}
}

func TestStructuredLogger(t *testing.T) {
	var buf bytes.Buffer
	logger := slog.New(slog.NewJSONHandler(&buf, nil))

	handler := StructuredLogger(logger)(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("ok"))
	}))

	req := httptest.NewRequest(http.MethodGet, "/logged-endpoint", nil)
	rr := httptest.NewRecorder()

	handler.ServeHTTP(rr, req)

	if rr.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rr.Code)
	}

	if !bytes.Contains(buf.Bytes(), []byte("HTTP request handled")) {
		t.Errorf("expected 'HTTP request handled' log message, got: %s", buf.String())
	}
}

func TestCORSConfig(t *testing.T) {
	corsHandler := CORSConfig("master.dropiobd.localhost", "store.dropiobd.localhost")(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodOptions, "/api/v1/test", nil)
	req.Header.Set("Origin", "http://master.dropiobd.localhost")
	req.Header.Set("Access-Control-Request-Method", "GET")
	rr := httptest.NewRecorder()

	corsHandler.ServeHTTP(rr, req)

	if allowedOrigin := rr.Header().Get("Access-Control-Allow-Origin"); allowedOrigin != "http://master.dropiobd.localhost" {
		t.Errorf("expected allowed origin 'http://master.dropiobd.localhost', got %q", allowedOrigin)
	}
}
