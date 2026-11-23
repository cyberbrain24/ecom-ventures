package system

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"ecom-ventures/backend/internal/platform/audit"
	platformAuth "ecom-ventures/backend/internal/platform/auth"
	"ecom-ventures/backend/internal/platform/models"
	"ecom-ventures/backend/internal/platform/validation"

	"github.com/go-chi/chi/v5"
)

type fakeRevoker struct {
	err     error
	revoked []string
}

func (f *fakeRevoker) RevokeSession(_ context.Context, userID string) error {
	if f.err != nil {
		return f.err
	}
	f.revoked = append(f.revoked, userID)
	return nil
}

func sp(s string) *string { return &s }

func TestNormalizeUpdateAdmin(t *testing.T) {
	req := UpdateAdminRequest{
		FirstName: sp(" Ada "), Email: sp("Ada@Example.com"), Role: sp("platform_staff"), Status: sp("active"), Password: sp("longenough1"),
	}
	if err := normalizeUpdateAdmin(&req); err != nil {
		t.Fatalf("expected valid, got %v", err)
	}
	if *req.FirstName != "Ada" || *req.Email != "ada@example.com" || *req.Role != "PLATFORM_STAFF" || *req.Status != "ACTIVE" {
		t.Errorf("not normalized: %q %q %q %q", *req.FirstName, *req.Email, *req.Role, *req.Status)
	}

	bad := map[string]UpdateAdminRequest{
		"empty first": {FirstName: sp(" ")},
		"bad email":   {Email: sp("nope")},
		"bad role":    {Role: sp("OWNER")},
		"bad status":  {Status: sp("GONE")},
		"short pw":    {Password: sp("short")},
		"nothing":     {},
	}
	for name, r := range bad {
		r := r
		var ve *validation.Error
		if err := normalizeUpdateAdmin(&r); !errors.As(err, &ve) {
			t.Errorf("%s: expected validation error, got %v", name, err)
		}
	}
}

func TestGuardLastSuperAdmin(t *testing.T) {
	super := &adminRow{role: "SUPER_ADMIN", status: "ACTIVE"}
	staff := &adminRow{role: "PLATFORM_STAFF", status: "ACTIVE"}
	suspendedSuper := &adminRow{role: "SUPER_ADMIN", status: "SUSPENDED"}

	cases := []struct {
		name             string
		cur              *adminRow
		nextRole, nextSt string
		others           int
		wantErr          bool
	}{
		{"demote last", super, "PLATFORM_STAFF", "ACTIVE", 0, true},
		{"deactivate last", super, "SUPER_ADMIN", "DEACTIVATED", 0, true},
		{"suspend last", super, "SUPER_ADMIN", "SUSPENDED", 0, true},
		{"delete last", super, "", "", 0, true},
		{"demote with another", super, "PLATFORM_STAFF", "ACTIVE", 1, false},
		{"delete with another", super, "", "", 2, false},
		{"rename last", super, "SUPER_ADMIN", "ACTIVE", 0, false},
		{"delete staff", staff, "", "", 0, false},
		{"delete suspended super", suspendedSuper, "", "", 0, false},
		{"promote staff", staff, "SUPER_ADMIN", "ACTIVE", 0, false},
	}
	for _, tc := range cases {
		err := guardLastSuperAdmin(tc.cur, tc.nextRole, tc.nextSt, tc.others)
		if tc.wantErr != errors.Is(err, ErrLastSuperAdmin) {
			t.Errorf("%s: wantErr=%v got %v", tc.name, tc.wantErr, err)
		}
	}
}

func TestNeedsSessionRevocation(t *testing.T) {
	cur := &adminRow{role: "PLATFORM_STAFF", status: "ACTIVE"}
	if needsSessionRevocation(cur, "PLATFORM_STAFF", "ACTIVE", false) {
		t.Error("a name-only edit must not revoke sessions")
	}
	if !needsSessionRevocation(cur, "SUPER_ADMIN", "ACTIVE", false) {
		t.Error("role change must revoke sessions")
	}
	if !needsSessionRevocation(cur, "PLATFORM_STAFF", "SUSPENDED", false) {
		t.Error("suspension must revoke sessions")
	}
	if !needsSessionRevocation(cur, "PLATFORM_STAFF", "ACTIVE", true) {
		t.Error("password change must revoke sessions")
	}
	suspended := &adminRow{role: "PLATFORM_STAFF", status: "SUSPENDED"}
	if needsSessionRevocation(suspended, "PLATFORM_STAFF", "ACTIVE", false) {
		t.Error("reactivation alone must not revoke sessions")
	}
}

func TestRevokeSessionsFailsClosed(t *testing.T) {
	ctx := context.Background()

	s := &Service{}
	if err := s.revokeSessions(ctx, "u1"); !errors.Is(err, platformAuth.ErrSessionStoreUnavailable) {
		t.Errorf("no session store must surface ErrSessionStoreUnavailable, got %v", err)
	}

	s = &Service{sessions: platformAuth.NewSessionManager(nil)}
	if err := s.revokeSessions(ctx, "u1"); !errors.Is(err, platformAuth.ErrSessionStoreUnavailable) {
		t.Errorf("session manager without Redis must surface ErrSessionStoreUnavailable, got %v", err)
	}

	boom := errors.New("redis down")
	s = &Service{sessions: &fakeRevoker{err: boom}}
	if err := s.revokeSessions(ctx, "u1"); !errors.Is(err, boom) {
		t.Errorf("revoker error must be wrapped and returned, got %v", err)
	}

	f := &fakeRevoker{}
	s = &Service{sessions: f}
	if err := s.revokeSessions(ctx, "u1"); err != nil || len(f.revoked) != 1 || f.revoked[0] != "u1" {
		t.Errorf("expected one revocation for u1, got %v %v", f.revoked, err)
	}
}

func TestDeleteAdminGuards(t *testing.T) {
	s := &Service{}
	ctx := context.Background()
	const id = "00000000-0000-0000-0000-000000000001"

	if err := s.DeleteAdmin(ctx, "nope", audit.Actor{UserID: "x"}); !errors.Is(err, ErrAdminNotFound) {
		t.Errorf("malformed id: expected ErrAdminNotFound, got %v", err)
	}
	if err := s.DeleteAdmin(ctx, id, audit.Actor{UserID: strings.ToUpper(id)}); !errors.Is(err, ErrCannotDeleteSelf) {
		t.Errorf("self delete: expected ErrCannotDeleteSelf, got %v", err)
	}
	if err := s.DeleteAdmin(ctx, id, audit.Actor{UserID: "00000000-0000-0000-0000-000000000002"}); err == nil {
		t.Error("expected error for nil database")
	}
}

func TestUpdateAdminGuards(t *testing.T) {
	s := &Service{}
	ctx := context.Background()
	if _, err := s.UpdateAdmin(ctx, "nope", UpdateAdminRequest{FirstName: sp("A")}, audit.Actor{}); !errors.Is(err, ErrAdminNotFound) {
		t.Errorf("expected ErrAdminNotFound, got %v", err)
	}
	if _, err := s.UpdateAdmin(ctx, "00000000-0000-0000-0000-000000000001", UpdateAdminRequest{FirstName: sp("A")}, audit.Actor{}); err == nil {
		t.Error("expected error for nil database")
	}
}

func TestAdminHandlersStatusCodes(t *testing.T) {
	h := NewHandler(&Service{})
	r := chi.NewRouter()
	r.Patch("/admins/{id}", h.UpdateAdmin)
	r.Delete("/admins/{id}", h.DeleteAdmin)

	const id = "00000000-0000-0000-0000-000000000001"
	cases := []struct {
		name, method, path, body string
		want                     int
	}{
		{"patch bad json", http.MethodPatch, "/admins/" + id, "{", http.StatusBadRequest},
		{"patch invalid role", http.MethodPatch, "/admins/" + id, `{"role":"OWNER"}`, http.StatusUnprocessableEntity},
		{"patch unknown id", http.MethodPatch, "/admins/nope", `{"first_name":"A"}`, http.StatusNotFound},
		{"delete unknown id", http.MethodDelete, "/admins/nope", "", http.StatusNotFound},
		{"patch db unavailable", http.MethodPatch, "/admins/" + id, `{"first_name":"A"}`, http.StatusInternalServerError},
		{"delete db unavailable", http.MethodDelete, "/admins/" + id, "", http.StatusInternalServerError},
	}
	for _, tc := range cases {
		rr := httptest.NewRecorder()
		r.ServeHTTP(rr, httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body)))
		if rr.Code != tc.want {
			t.Errorf("%s: expected %d, got %d (%s)", tc.name, tc.want, rr.Code, rr.Body.String())
		}
	}
}

func TestWriteAdminErrorMapping(t *testing.T) {
	cases := []struct {
		err  error
		want int
	}{
		{ErrAdminNotFound, http.StatusNotFound},
		{ErrAdminEmailTaken, http.StatusConflict},
		{ErrLastSuperAdmin, http.StatusConflict},
		{ErrCannotDeleteSelf, http.StatusConflict},
		{ErrCannotModifyOwnAccess, http.StatusConflict},
		{platformAuth.ErrSessionStoreUnavailable, http.StatusServiceUnavailable},
		{errors.New("boom"), http.StatusInternalServerError},
	}
	for _, tc := range cases {
		rr := httptest.NewRecorder()
		writeAdminError(rr, httptest.NewRequest(http.MethodDelete, "/x", nil), tc.err, "test")
		if rr.Code != tc.want {
			t.Errorf("%v: expected %d, got %d", tc.err, tc.want, rr.Code)
		}
	}
}

func TestGuardOwnAccess(t *testing.T) {
	const id = "11111111-1111-1111-1111-111111111111"
	super := &adminRow{PlatformUser: models.PlatformUser{ID: id}, role: "SUPER_ADMIN", status: "ACTIVE"}
	cases := []struct {
		name             string
		actor            string
		nextRole, nextSt string
		wantErr          bool
	}{
		{"self demote", id, "PLATFORM_STAFF", "ACTIVE", true},
		{"self suspend", id, "SUPER_ADMIN", "SUSPENDED", true},
		{"self deactivate", id, "SUPER_ADMIN", "DEACTIVATED", true},
		{"self rename keeps access", id, "SUPER_ADMIN", "ACTIVE", false},
		{"other admin demotes", "22222222-2222-2222-2222-222222222222", "PLATFORM_STAFF", "SUSPENDED", false},
	}
	for _, tc := range cases {
		err := guardOwnAccess(tc.actor, super, tc.nextRole, tc.nextSt)
		if tc.wantErr != errors.Is(err, ErrCannotModifyOwnAccess) {
			t.Errorf("%s: unexpected result %v", tc.name, err)
		}
	}
}
