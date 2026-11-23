package domains

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"ecom-ventures/backend/internal/platform/audit"
	"ecom-ventures/backend/internal/platform/models"
	"ecom-ventures/backend/internal/platform/validation"

	"github.com/go-chi/chi/v5"
	"github.com/lib/pq"
)

func sp(s string) *string { return &s }
func bp(b bool) *bool     { return &b }

func TestNormalizeUpdateDomain(t *testing.T) {
	req := UpdateDomainRequest{Domain: sp("  Shop.Mior.COM ")}
	if err := normalizeUpdateDomain(&req); err != nil {
		t.Fatalf("expected valid, got %v", err)
	}
	if *req.Domain != "shop.mior.com" {
		t.Errorf("domain not normalized: %q", *req.Domain)
	}

	bad := map[string]UpdateDomainRequest{
		"url":      {Domain: sp("http://mior.com")},
		"no tld":   {Domain: sp("mior")},
		"nothing":  {},
		"only ssl": {SSLStatus: sp("ACTIVE")},
	}
	for name, r := range bad {
		r := r
		var ve *validation.Error
		if err := normalizeUpdateDomain(&r); !errors.As(err, &ve) {
			t.Errorf("%s: expected validation error, got %v", name, err)
		}
	}
}

func verifiedRow() *domainRow {
	return &domainRow{Domain: "mior.com", IsCustom: true, SSLStatus: models.SSLStatusActive}
}

func TestPlanRenameResetsVerification(t *testing.T) {
	s := &Service{}
	p, err := s.planDomainUpdate(verifiedRow(), &UpdateDomainRequest{Domain: sp("new.mior.com")})
	if err != nil {
		t.Fatal(err)
	}
	if !p.Renamed || p.SSLStatus != models.SSLStatusPending || p.Verified {
		t.Errorf("rename must reset to PENDING, got %+v", p)
	}
}

func TestPlanRenameSameNameIsNoRename(t *testing.T) {
	s := &Service{}
	p, err := s.planDomainUpdate(verifiedRow(), &UpdateDomainRequest{Domain: sp("mior.com"), IsCustom: bp(false)})
	if err != nil {
		t.Fatal(err)
	}
	if p.Renamed || p.SSLStatus != models.SSLStatusActive || p.IsCustom {
		t.Errorf("unexpected plan %+v", p)
	}
}

func TestPlanRenameLocalhostVerifiedOnlyInDevelopment(t *testing.T) {
	dev := &Service{isDevelopment: true}
	p, err := dev.planDomainUpdate(verifiedRow(), &UpdateDomainRequest{Domain: sp("x.localhost")})
	if err != nil || !p.Verified || p.SSLStatus != models.SSLStatusActive {
		t.Errorf("development localhost should verify at once: %+v %v", p, err)
	}
	prod := &Service{}
	p, err = prod.planDomainUpdate(verifiedRow(), &UpdateDomainRequest{Domain: sp("x.localhost")})
	if err != nil || p.Verified || p.SSLStatus != models.SSLStatusPending {
		t.Errorf("non-development localhost must stay PENDING: %+v %v", p, err)
	}
}

func TestPlanPrimaryInvariant(t *testing.T) {
	s := &Service{}

	primary := verifiedRow()
	primary.IsPrimary = true
	if _, err := s.planDomainUpdate(primary, &UpdateDomainRequest{IsPrimary: bp(false)}); !errors.Is(err, ErrCannotDemotePrimary) {
		t.Errorf("expected ErrCannotDemotePrimary, got %v", err)
	}

	pending := &domainRow{Domain: "p.com", SSLStatus: models.SSLStatusPending}
	if _, err := s.planDomainUpdate(pending, &UpdateDomainRequest{IsPrimary: bp(true)}); !errors.Is(err, ErrDomainNotVerified) {
		t.Errorf("expected ErrDomainNotVerified, got %v", err)
	}

	p, err := s.planDomainUpdate(verifiedRow(), &UpdateDomainRequest{IsPrimary: bp(true)})
	if err != nil || !p.Promote || !p.IsPrimary {
		t.Errorf("verified domain must be promotable: %+v %v", p, err)
	}

	// Renaming and promoting together fails because the renamed host is unverified.
	if _, err := s.planDomainUpdate(verifiedRow(), &UpdateDomainRequest{Domain: sp("n.mior.com"), IsPrimary: bp(true)}); !errors.Is(err, ErrDomainNotVerified) {
		t.Errorf("expected ErrDomainNotVerified for rename+promote, got %v", err)
	}

	// Renaming the primary keeps it primary.
	p, err = s.planDomainUpdate(primary, &UpdateDomainRequest{Domain: sp("n.mior.com")})
	if err != nil || !p.IsPrimary || p.Promote {
		t.Errorf("renamed primary must stay primary: %+v %v", p, err)
	}
}

func TestPlanRejectsSSLStatusChange(t *testing.T) {
	s := &Service{}
	if _, err := s.planDomainUpdate(verifiedRow(), &UpdateDomainRequest{SSLStatus: sp("PENDING")}); err == nil {
		t.Error("expected validation error for ssl_status change")
	}
	if _, err := s.planDomainUpdate(verifiedRow(), &UpdateDomainRequest{SSLStatus: sp("active"), IsCustom: bp(true)}); err != nil {
		t.Errorf("echoing the stored ssl_status must pass, got %v", err)
	}
}

func TestUpdateDomainServiceGuards(t *testing.T) {
	s := &Service{}
	ctx := context.Background()
	if _, err := s.UpdateDomain(ctx, "nope", UpdateDomainRequest{IsCustom: bp(true)}, audit.Actor{}); !errors.Is(err, ErrDomainNotFound) {
		t.Errorf("expected ErrDomainNotFound for malformed id, got %v", err)
	}
	if _, err := s.UpdateDomain(ctx, "00000000-0000-0000-0000-000000000001", UpdateDomainRequest{IsCustom: bp(true)}, audit.Actor{}); err == nil {
		t.Error("expected error for nil database")
	}
}

func TestDomainUpdateHandlerStatusCodes(t *testing.T) {
	h := NewHandler(&Service{})
	r := chi.NewRouter()
	r.Patch("/domains/{id}", h.Update)
	const id = "00000000-0000-0000-0000-000000000001"
	cases := []struct {
		name, path, body string
		want             int
	}{
		{"bad json", "/domains/" + id, "{", http.StatusBadRequest},
		{"invalid domain", "/domains/" + id, `{"domain":"bad domain"}`, http.StatusUnprocessableEntity},
		{"no fields", "/domains/" + id, `{}`, http.StatusUnprocessableEntity},
		{"unknown id", "/domains/nope", `{"is_custom":true}`, http.StatusNotFound},
		{"db unavailable", "/domains/" + id, `{"is_custom":true}`, http.StatusInternalServerError},
	}
	for _, tc := range cases {
		rr := httptest.NewRecorder()
		r.ServeHTTP(rr, httptest.NewRequest(http.MethodPatch, tc.path, strings.NewReader(tc.body)))
		if rr.Code != tc.want {
			t.Errorf("%s: expected %d, got %d (%s)", tc.name, tc.want, rr.Code, rr.Body.String())
		}
	}
}

func TestClassifyDomainWriteError(t *testing.T) {
	cases := []struct {
		name string
		err  error
		want error
	}{
		{"deadlock", &pq.Error{Code: "40P01"}, ErrPrimaryDomainConflict},
		{"serialization", fmt.Errorf("wrapped: %w", &pq.Error{Code: "40001"}), ErrPrimaryDomainConflict},
		{"primary index", &pq.Error{Code: "23505", Constraint: primaryDomainIndex}, ErrPrimaryDomainConflict},
		{"domain name unique", &pq.Error{Code: "23505", Constraint: "domains_domain_key"}, ErrDomainConflict},
		{"other pq error", &pq.Error{Code: "22001"}, nil},
		{"non pq error", errors.New("boom"), nil},
	}
	for _, tc := range cases {
		if got := classifyDomainWriteError(tc.err); !errors.Is(got, tc.want) || (tc.want == nil && got != nil) {
			t.Errorf("%s: expected %v, got %v", tc.name, tc.want, got)
		}
	}
}
