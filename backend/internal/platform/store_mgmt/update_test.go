package store_mgmt

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"ecom-ventures/backend/internal/platform/audit"
	"ecom-ventures/backend/internal/platform/validation"

	"github.com/go-chi/chi/v5"
)

func strPtr(s string) *string { return &s }

func TestNormalizeUpdateStoreAcceptsAndNormalizes(t *testing.T) {
	req := UpdateStoreRequest{
		Name:           strPtr("  Mior Fashion  "),
		ContactEmail:   strPtr("Owner@Mior.COM"),
		ContactPhone:   strPtr("+880 1711-000000"),
		Currency:       strPtr("bdt"),
		Timezone:       strPtr("Asia/Dhaka"),
		OwnerEmail:     strPtr("Owner@Mior.COM"),
		OwnerPassword:  strPtr("NewPassword2026!"),
		OwnerFirstName: strPtr("  John  "),
		OwnerLastName:  strPtr("  Doe  "),
	}
	if err := normalizeUpdateStore(&req); err != nil {
		t.Fatalf("expected valid request, got %v", err)
	}
	if *req.Name != "Mior Fashion" || *req.ContactEmail != "owner@mior.com" || *req.Currency != "BDT" || *req.OwnerEmail != "owner@mior.com" || *req.OwnerFirstName != "John" || *req.OwnerLastName != "Doe" {
		t.Errorf("fields were not normalized: %q %q %q %q %q %q", *req.Name, *req.ContactEmail, *req.Currency, *req.OwnerEmail, *req.OwnerFirstName, *req.OwnerLastName)
	}
}

func TestNormalizeUpdateStoreRejectsBadInput(t *testing.T) {
	cases := map[string]UpdateStoreRequest{
		"empty name":    {Name: strPtr("   ")},
		"long name":     {Name: strPtr(strings.Repeat("a", 101))},
		"bad email":     {ContactEmail: strPtr("not-an-email")},
		"display name":  {ContactEmail: strPtr("Bob <bob@example.com>")},
		"bad phone":     {ContactPhone: strPtr("call me")},
		"bad currency":  {Currency: strPtr("TAKA")},
		"bad timezone":  {Timezone: strPtr("Dhaka time")},
		"no edit field": {},
		"echo only":     {Slug: strPtr("mior")},
	}
	for name, req := range cases {
		req := req
		err := normalizeUpdateStore(&req)
		var ve *validation.Error
		if !errors.As(err, &ve) {
			t.Errorf("%s: expected validation error, got %v", name, err)
		}
	}
}

func TestNormalizeUpdateStoreAllowsClearingPhone(t *testing.T) {
	req := UpdateStoreRequest{ContactPhone: strPtr("")}
	if err := normalizeUpdateStore(&req); err != nil {
		t.Fatalf("clearing phone must be allowed, got %v", err)
	}
}

func TestCheckImmutableStoreFields(t *testing.T) {
	cur := &storeEditSnapshot{Slug: "mior", Status: "ACTIVE", PrimaryDomain: "mior.localhost", ActiveTheme: "Nordic"}

	same := UpdateStoreRequest{Slug: strPtr("mior"), Status: strPtr("active"), PrimaryDomain: strPtr("MIOR.localhost"), ActiveTheme: strPtr("Nordic")}
	if err := checkImmutableStoreFields(&same, cur); err != nil {
		t.Fatalf("echoing stored values must pass, got %v", err)
	}

	changed := UpdateStoreRequest{Slug: strPtr("other"), Status: strPtr("SUSPENDED"), PrimaryDomain: strPtr("x.com"), ActiveTheme: strPtr("Other")}
	err := checkImmutableStoreFields(&changed, cur)
	var ve *validation.Error
	if !errors.As(err, &ve) || len(ve.Fields) != 2 {
		t.Fatalf("expected 2 rejected fields (slug and status), got %v", err)
	}
}

func TestApplyStoreEditLeavesAbsentFieldsAlone(t *testing.T) {
	cur := storeEditSnapshot{Name: "A", ContactEmail: "a@x.com", Currency: "BDT", Timezone: "Asia/Dhaka", Slug: "a", Status: "ACTIVE"}
	next := applyStoreEdit(cur, &UpdateStoreRequest{Name: strPtr("B")})
	if next.Name != "B" || next.ContactEmail != "a@x.com" || next.Slug != "a" || next.Status != "ACTIVE" {
		t.Errorf("unexpected result: %+v", next)
	}
}

func TestUpdateStoreServiceGuards(t *testing.T) {
	s := &Service{}
	ctx := context.Background()
	actor := audit.Actor{UserID: "u1"}

	if _, err := s.UpdateStore(ctx, "00000000-0000-0000-0000-000000000001", UpdateStoreRequest{Name: strPtr("")}, actor); err == nil {
		t.Fatal("expected validation error")
	}
	if _, err := s.UpdateStore(ctx, "not-a-uuid", UpdateStoreRequest{Name: strPtr("X")}, actor); !errors.Is(err, ErrStoreNotFound) {
		t.Fatalf("expected ErrStoreNotFound for malformed id, got %v", err)
	}
	if _, err := s.UpdateStore(ctx, "00000000-0000-0000-0000-000000000001", UpdateStoreRequest{Name: strPtr("X")}, actor); err == nil {
		t.Fatal("expected error for nil platform database")
	}
}

func newUpdateRouter() http.Handler {
	h := NewHandler(&Service{})
	r := chi.NewRouter()
	r.Patch("/stores/{id}", h.Update)
	return r
}

func TestUpdateHandlerStatusCodes(t *testing.T) {
	router := newUpdateRouter()
	cases := []struct {
		name, path, body string
		want             int
	}{
		{"bad json", "/stores/00000000-0000-0000-0000-000000000001", "{", http.StatusBadRequest},
		{"validation", "/stores/00000000-0000-0000-0000-000000000001", `{"name":""}`, http.StatusUnprocessableEntity},
		{"no fields", "/stores/00000000-0000-0000-0000-000000000001", `{}`, http.StatusUnprocessableEntity},
		{"missing store", "/stores/not-a-uuid", `{"name":"X"}`, http.StatusNotFound},
		{"db unavailable", "/stores/00000000-0000-0000-0000-000000000001", `{"name":"X"}`, http.StatusInternalServerError},
	}
	for _, tc := range cases {
		req := httptest.NewRequest(http.MethodPatch, tc.path, strings.NewReader(tc.body))
		rr := httptest.NewRecorder()
		router.ServeHTTP(rr, req)
		if rr.Code != tc.want {
			t.Errorf("%s: expected %d, got %d (%s)", tc.name, tc.want, rr.Code, rr.Body.String())
		}
	}
}
