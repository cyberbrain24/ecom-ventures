package themes

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"ecom-ventures/backend/internal/platform/audit"
	"ecom-ventures/backend/internal/platform/validation"

	"github.com/go-chi/chi/v5"
)

func sp(s string) *string { return &s }

func TestNormalizeUpdateThemeValid(t *testing.T) {
	active := false
	req := UpdateThemeRequest{
		Name:            sp("  Nordic  "),
		Description:     sp("Clean layout"),
		Version:         sp("1.2.0"),
		PreviewImageURL: sp("https://cdn.example.com/p.png"),
		ConfigSchema:    json.RawMessage(`{"colors":{"primary":"#0d9488"}}`),
		IsActive:        &active,
	}
	if err := normalizeUpdateTheme(NewThemeConfigValidator(), &req, nil, false); err != nil {
		t.Fatalf("expected valid request, got %v", err)
	}
	if *req.Name != "Nordic" {
		t.Errorf("name not trimmed: %q", *req.Name)
	}
}

func TestNormalizeUpdateThemeRejects(t *testing.T) {
	cases := map[string]UpdateThemeRequest{
		"empty name":    {Name: sp("")},
		"long name":     {Name: sp(strings.Repeat("n", 101))},
		"bad version":   {Version: sp("v 1 !")},
		"bad preview":   {PreviewImageURL: sp("javascript:alert(1)")},
		"bad hex":       {ConfigSchema: json.RawMessage(`{"colors":{"primary":"red"}}`)},
		"array config":  {ConfigSchema: json.RawMessage(`[1,2]`)},
		"string config": {ConfigSchema: json.RawMessage(`"x"`)},
		"nothing":       {},
		"null config":   {ConfigSchema: json.RawMessage(`null`)},
	}
	for name, req := range cases {
		req := req
		err := normalizeUpdateTheme(NewThemeConfigValidator(), &req, nil, false)
		var ve *validation.Error
		if !errors.As(err, &ve) {
			t.Errorf("%s: expected validation error, got %v", name, err)
		}
	}
}

func TestThemeServiceGuards(t *testing.T) {
	s := &Service{validator: NewThemeConfigValidator()}
	ctx := context.Background()
	actor := audit.Actor{}

	if _, err := s.UpdateTheme(ctx, "not-a-uuid", UpdateThemeRequest{Name: sp("X")}, actor); !errors.Is(err, ErrThemeNotFound) {
		t.Errorf("expected ErrThemeNotFound for malformed id, got %v", err)
	}
	const id = "00000000-0000-0000-0000-000000000001"
	if _, err := s.UpdateTheme(ctx, id, UpdateThemeRequest{Name: sp("X")}, actor); err == nil {
		t.Error("expected error for nil database")
	}
}

func TestThemeHandlersStatusCodes(t *testing.T) {
	h := NewHandler(&Service{validator: NewThemeConfigValidator()})
	r := chi.NewRouter()
	r.Patch("/themes/{id}", h.Update)

	const id = "00000000-0000-0000-0000-000000000001"
	cases := []struct {
		name, method, path, body string
		want                     int
	}{
		{"patch bad json", http.MethodPatch, "/themes/" + id, "{", http.StatusBadRequest},
		{"patch unknown id", http.MethodPatch, "/themes/nope", `{"name":"X"}`, http.StatusNotFound},
		{"patch db unavailable", http.MethodPatch, "/themes/" + id, `{"name":"X"}`, http.StatusInternalServerError},
	}
	for _, tc := range cases {
		req := httptest.NewRequest(tc.method, tc.path, strings.NewReader(tc.body))
		rr := httptest.NewRecorder()
		r.ServeHTTP(rr, req)
		if rr.Code != tc.want {
			t.Errorf("%s: expected %d, got %d (%s)", tc.name, tc.want, rr.Code, rr.Body.String())
		}
	}
}

func TestNormalizeUpdateThemeUnchangedEchoNeverFails(t *testing.T) {
	stored := &ThemeSummaryResponse{}
	stored.PreviewImageURL = "themes/legacy.png"
	stored.ConfigSchema = json.RawMessage(`{"legacy":  {"unknown_key": 1}}`)
	req := UpdateThemeRequest{
		Name:            sp("Renamed"),
		PreviewImageURL: sp("themes/legacy.png"),
		ConfigSchema:    json.RawMessage(`{"legacy":{"unknown_key":1}}`),
	}
	if err := normalizeUpdateTheme(NewThemeConfigValidator(), &req, stored, false); err != nil {
		t.Fatalf("unchanged preview and config must not be re-validated, got %v", err)
	}

	changed := UpdateThemeRequest{PreviewImageURL: sp("themes/other.png")}
	if err := normalizeUpdateTheme(NewThemeConfigValidator(), &changed, stored, false); err == nil {
		t.Fatal("a changed invalid preview_image_url must still be rejected")
	}
}
