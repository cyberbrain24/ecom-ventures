package domains

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestCloudflareClientRequiresCredentials(t *testing.T) {
	client := NewCloudflareClient("", "")
	ctx := context.Background()

	if response, err := client.CreateCustomHostname(ctx, "shop.example.com"); err == nil || response != nil {
		t.Fatalf("expected hostname creation to fail without credentials; response=%+v err=%v", response, err)
	} else if !strings.Contains(err.Error(), "required") {
		t.Fatalf("expected explicit credential error, got %v", err)
	}

	if err := client.DeleteCustomHostname(ctx, "hostname-id"); err == nil {
		t.Fatal("expected hostname deletion to fail without credentials")
	}

	if status, err := client.GetCustomHostnameStatus(ctx, "hostname-id"); err == nil || status != "" {
		t.Fatalf("expected status lookup to fail without credentials; status=%q err=%v", status, err)
	}
}

func newTestCloudflareClient(t *testing.T, status int, body string) *HTTPCloudflareClient {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			t.Errorf("expected DELETE, got %s", r.Method)
		}
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	t.Cleanup(srv.Close)
	c := NewCloudflareClient("token", "zone")
	c.baseURL = srv.URL
	return c
}

func TestDeleteCustomHostnameNotFoundIsSuccess(t *testing.T) {
	c := newTestCloudflareClient(t, http.StatusNotFound, `{"success":false,"errors":[{"code":1409}]}`)
	if err := c.DeleteCustomHostname(context.Background(), "gone"); err != nil {
		t.Fatalf("a hostname that is already gone must count as deleted, got %v", err)
	}
}

func TestDeleteCustomHostnameOutcomes(t *testing.T) {
	if err := newTestCloudflareClient(t, http.StatusOK, `{"success":true}`).DeleteCustomHostname(context.Background(), "id"); err != nil {
		t.Fatalf("expected success, got %v", err)
	}
	if err := newTestCloudflareClient(t, http.StatusInternalServerError, `{}`).DeleteCustomHostname(context.Background(), "id"); err == nil {
		t.Fatal("a 500 must remain an error")
	}
	if err := newTestCloudflareClient(t, http.StatusOK, `{"success":false}`).DeleteCustomHostname(context.Background(), "id"); err == nil {
		t.Fatal("success=false must remain an error")
	}
}
