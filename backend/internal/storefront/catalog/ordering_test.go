package catalog

import (
	"strings"
	"testing"
)

func TestStorefrontOrderBy(t *testing.T) {
	tests := []struct {
		name       string
		filter     StorefrontFilterParams
		wantPrefix string
	}{
		{"default follows merchant order", StorefrontFilterParams{}, "p.sort_order ASC"},
		{"featured only follows featured order", StorefrontFilterParams{FeaturedOnly: true}, "p.featured_order ASC"},
		{"featured only wins over price sort", StorefrontFilterParams{FeaturedOnly: true, Sort: "price_asc"}, "p.featured_order ASC"},
		{"price ascending", StorefrontFilterParams{Sort: "price_asc"}, "p.base_price ASC"},
		{"price descending", StorefrontFilterParams{Sort: "price_desc"}, "p.base_price DESC"},
		{"newest", StorefrontFilterParams{Sort: "newest"}, "p.created_at DESC"},
		{"featured first", StorefrontFilterParams{Sort: "featured"}, "p.is_featured DESC, p.featured_order ASC"},
		{"unknown sort is ignored", StorefrontFilterParams{Sort: "'; DROP TABLE products;--"}, "p.sort_order ASC"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			f := tt.filter
			got := storefrontOrderBy(&f)
			if !strings.HasPrefix(got, tt.wantPrefix) {
				t.Errorf("storefrontOrderBy = %q, want prefix %q", got, tt.wantPrefix)
			}
			if !strings.HasSuffix(got, "p.id ASC") {
				t.Errorf("storefrontOrderBy = %q, want a unique final tie-breaker", got)
			}
			if strings.Contains(got, "DROP") {
				t.Errorf("storefrontOrderBy must never include request text, got %q", got)
			}
		})
	}
}
