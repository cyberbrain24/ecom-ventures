package catalog

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func TestNormalizeBrand(t *testing.T) {
	long := strings.Repeat("a", maxBrandNameLen+1)
	tests := []struct {
		name    string
		req     BrandRequest
		wantErr string
		check   func(t *testing.T, b *Brand)
	}{
		{"minimal", BrandRequest{Name: "  Mior Atelier "}, "", func(t *testing.T, b *Brand) {
			if b.Name != "Mior Atelier" || b.Slug != "mior-atelier" || !b.IsActive {
				t.Errorf("unexpected brand %+v", b)
			}
		}},
		{"explicit slug is normalised", BrandRequest{Name: "X", Slug: "My Brand!"}, "", func(t *testing.T, b *Brand) {
			if b.Slug != "my-brand" {
				t.Errorf("slug = %q", b.Slug)
			}
		}},
		{"inactive kept", BrandRequest{Name: "X", IsActive: func() *bool { v := false; return &v }()}, "", func(t *testing.T, b *Brand) {
			if b.IsActive {
				t.Error("brand should be inactive")
			}
		}},
		{"missing name", BrandRequest{Name: "   "}, "name is required", nil},
		{"name too long", BrandRequest{Name: long}, "name is longer", nil},
		{"name without letters", BrandRequest{Name: "!!!"}, "letters or numbers", nil},
		{"bad website", BrandRequest{Name: "X", WebsiteURL: "javascript:alert(1)"}, "website_url", nil},
		{"relative logo", BrandRequest{Name: "X", LogoURL: "/logo.png"}, "logo_url", nil},
		{"good urls", BrandRequest{Name: "X", WebsiteURL: "https://example.com/a", LogoURL: "http://cdn.example.com/l.png"}, "", nil},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			b, err := normalizeBrand(tt.req)
			if tt.wantErr != "" {
				if err == nil || !errors.Is(err, ErrInvalidInput) || !strings.Contains(err.Error(), tt.wantErr) {
					t.Fatalf("want ErrInvalidInput containing %q, got %v", tt.wantErr, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if tt.check != nil {
				tt.check(t, b)
			}
		})
	}
}

func TestNormalizeCareInstruction(t *testing.T) {
	steps := make([]string, maxCareSteps+1)
	for i := range steps {
		steps[i] = "step"
	}
	tests := []struct {
		name    string
		req     CareInstructionRequest
		wantErr string
	}{
		{"valid", CareInstructionRequest{Title: "Silk", Instructions: []string{"Hand wash cold"}, CareSymbols: []string{"wash-30", "No-Bleach"}}, ""},
		{"missing title", CareInstructionRequest{Instructions: []string{"x"}}, "title is required"},
		{"no steps", CareInstructionRequest{Title: "Silk"}, "at least one care step"},
		{"only blank steps", CareInstructionRequest{Title: "Silk", Instructions: []string{"  ", ""}}, "at least one care step"},
		{"too many steps", CareInstructionRequest{Title: "Silk", Instructions: steps}, "at most"},
		{"long step", CareInstructionRequest{Title: "Silk", Instructions: []string{strings.Repeat("x", maxCareStepLen+1)}}, "instruction step"},
		{"bad symbol", CareInstructionRequest{Title: "Silk", Instructions: []string{"x"}, CareSymbols: []string{"wash 30"}}, "care symbol"},
		{"bad symbol hyphen", CareInstructionRequest{Title: "Silk", Instructions: []string{"x"}, CareSymbols: []string{"-wash"}}, "care symbol"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			c, err := normalizeCareInstruction(tt.req)
			if tt.wantErr != "" {
				if err == nil || !errors.Is(err, ErrInvalidInput) || !strings.Contains(err.Error(), tt.wantErr) {
					t.Fatalf("want ErrInvalidInput containing %q, got %v", tt.wantErr, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if c.Instructions == nil || c.CareSymbols == nil {
				t.Error("slices must never be nil, they are stored as NOT NULL arrays")
			}
		})
	}

	t.Run("symbols are lower-cased, trimmed and de-duplicated", func(t *testing.T) {
		c, err := normalizeCareInstruction(CareInstructionRequest{
			Title: "Silk", Instructions: []string{" Hand wash ", ""}, CareSymbols: []string{"Wash-30", " wash-30 ", "iron-low"},
		})
		if err != nil {
			t.Fatal(err)
		}
		if len(c.CareSymbols) != 2 || c.CareSymbols[0] != "wash-30" || c.CareSymbols[1] != "iron-low" {
			t.Errorf("symbols = %v", c.CareSymbols)
		}
		if len(c.Instructions) != 1 || c.Instructions[0] != "Hand wash" {
			t.Errorf("instructions = %v", c.Instructions)
		}
	})
}

func TestEnsureBrandCareSchemaRejectsNilDB(t *testing.T) {
	if err := EnsureBrandCareSchema(context.Background(), nil); err == nil {
		t.Fatal("expected an error for a nil database handle")
	}
}
