package catalog

import (
	"context"
	"errors"
	"strings"
	"testing"
)

const (
	idA = "11111111-1111-1111-1111-111111111111"
	idB = "22222222-2222-2222-2222-222222222222"
	idC = "33333333-3333-3333-3333-333333333333"
)

func TestValidateOrderedIDs(t *testing.T) {
	tooMany := make([]string, maxReorderIDs+1)
	for i := range tooMany {
		tooMany[i] = idA
	}

	tests := []struct {
		name    string
		ids     []string
		wantErr string
	}{
		{"valid list", []string{idA, idB, idC}, ""},
		{"single id", []string{idA}, ""},
		{"upper case uuid", []string{strings.ToUpper(idA)}, ""},
		{"nil list", nil, "must not be empty"},
		{"empty list", []string{}, "must not be empty"},
		{"not a uuid", []string{idA, "abc"}, "not a valid id"},
		{"sql in id", []string{idA + "'; DROP TABLE products;--"}, "not a valid id"},
		{"duplicate", []string{idA, idB, idA}, "more than once"},
		{"duplicate differing only in case", []string{idA, strings.ToUpper(idA)}, "more than once"},
		{"too many", tooMany, "at most"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateOrderedIDs(tt.ids)
			if tt.wantErr == "" {
				if err != nil {
					t.Fatalf("expected no error, got %v", err)
				}
				return
			}
			if err == nil {
				t.Fatalf("expected an error containing %q, got nil", tt.wantErr)
			}
			if !errors.Is(err, ErrInvalidReorder) {
				t.Errorf("error should wrap ErrInvalidReorder, got %v", err)
			}
			if !strings.Contains(err.Error(), tt.wantErr) {
				t.Errorf("error %q should contain %q", err.Error(), tt.wantErr)
			}
		})
	}
}

func TestProductOrderBy(t *testing.T) {
	if got := productOrderBy(false); !strings.HasPrefix(got, "sort_order ASC") {
		t.Errorf("main list should order by sort_order first, got %q", got)
	}
	if got := productOrderBy(true); !strings.HasPrefix(got, "featured_order ASC") {
		t.Errorf("featured list should order by featured_order first, got %q", got)
	}
	for _, featured := range []bool{false, true} {
		if got := productOrderBy(featured); !strings.HasSuffix(got, "id ASC") {
			t.Errorf("order for featured=%v needs a unique final tie-breaker, got %q", featured, got)
		}
	}
}

func TestNormalizeOptionalID(t *testing.T) {
	valid := idA
	blank := "   "
	bad := "abc"
	if got, err := normalizeOptionalID("brand_id", nil); err != nil || got != nil {
		t.Fatalf("nil should clear the link, got %v, %v", got, err)
	}
	if got, err := normalizeOptionalID("brand_id", &blank); err != nil || got != nil {
		t.Fatalf("blank should clear the link, got %v, %v", got, err)
	}
	if got, err := normalizeOptionalID("brand_id", &valid); err != nil || got == nil || *got != idA {
		t.Fatalf("valid id should pass through, got %v, %v", got, err)
	}
	if _, err := normalizeOptionalID("brand_id", &bad); !errors.Is(err, ErrInvalidReorder) {
		t.Fatalf("bad id should be rejected, got %v", err)
	}
}

func TestEnsureOrderingSchemaRejectsNilDB(t *testing.T) {
	if err := EnsureOrderingSchema(context.Background(), nil); err == nil {
		t.Fatal("expected an error for a nil database handle")
	}
}

func TestSetProductFeaturedRequiresFlag(t *testing.T) {
	// The service rejects a missing flag before it touches the database, so a request body of {}
	// can never silently un-feature a product.
	err := validateFeaturedRequest(idA, nil)
	if !errors.Is(err, ErrInvalidReorder) {
		t.Fatalf("expected ErrInvalidReorder for a missing flag, got %v", err)
	}
	yes := true
	if err := validateFeaturedRequest(idA, &yes); err != nil {
		t.Fatalf("unexpected error for a valid request: %v", err)
	}
	if err := validateFeaturedRequest("not-a-uuid", &yes); !errors.Is(err, ErrInvalidReorder) {
		t.Fatalf("expected ErrInvalidReorder for a bad id, got %v", err)
	}
}
