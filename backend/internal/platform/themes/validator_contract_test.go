package themes

import (
	"encoding/json"
	"errors"
	"strings"
	"testing"
)

// contractDoc returns a valid storefront theme contract document, for mutation in tests.
func contractDoc(t *testing.T) map[string]any {
	t.Helper()
	raw := `{
		"variant": "streetculture",
		"colors": {"primary":"#0a0a0a","secondary":"#facc15","accent":"#ef4444","background":"#111111","surface":"#1c1c1c","text":"#f5f5f5","muted":"#a3a3a3"},
		"fonts": {"heading":"Bebas Neue","body":"Space Grotesk"},
		"radius": "none",
		"density": "compact",
		"hero": "bold-streetwear"
	}`
	var doc map[string]any
	if err := json.Unmarshal([]byte(raw), &doc); err != nil {
		t.Fatalf("fixture is not valid JSON: %v", err)
	}
	return doc
}

func mustJSON(t *testing.T, v any) json.RawMessage {
	t.Helper()
	b, err := json.Marshal(v)
	if err != nil {
		t.Fatalf("marshal fixture: %v", err)
	}
	return b
}

func TestThemeSchemaValidContract(t *testing.T) {
	v := NewThemeConfigValidator()
	if err := v.ValidateThemeSchema(mustJSON(t, contractDoc(t))); err != nil {
		t.Fatalf("valid contract rejected: %v", err)
	}
	for _, variant := range []string{"fashion", "streetculture", "innerwear", "jewelry"} {
		doc := contractDoc(t)
		doc["variant"] = variant
		if err := v.ValidateThemeSchema(mustJSON(t, doc)); err != nil {
			t.Errorf("variant %s rejected: %v", variant, err)
		}
	}
}

func TestThemeSchemaRejectsInvalidContract(t *testing.T) {
	v := NewThemeConfigValidator()
	cases := map[string]func(d map[string]any){
		"invalid hex":           func(d map[string]any) { d["colors"].(map[string]any)["primary"] = "#abc" },
		"hex without hash":      func(d map[string]any) { d["colors"].(map[string]any)["accent"] = "ef4444" },
		"eight digit hex":       func(d map[string]any) { d["colors"].(map[string]any)["text"] = "#f5f5f5ff" },
		"unknown variant":       func(d map[string]any) { d["variant"] = "sportswear" },
		"missing colour":        func(d map[string]any) { delete(d["colors"].(map[string]any), "muted") },
		"missing colours block": func(d map[string]any) { delete(d, "colors") },
		"missing heading font":  func(d map[string]any) { delete(d["fonts"].(map[string]any), "heading") },
		"empty body font":       func(d map[string]any) { d["fonts"].(map[string]any)["body"] = "  " },
		"bad radius":            func(d map[string]any) { d["radius"] = "huge" },
		"bad density":           func(d map[string]any) { d["density"] = "dense" },
		"bad hero":              func(d map[string]any) { d["hero"] = "carousel" },
		"non-string colour":     func(d map[string]any) { d["colors"].(map[string]any)["surface"] = 16 },
	}
	for name, mutate := range cases {
		doc := contractDoc(t)
		mutate(doc)
		if err := v.ValidateThemeSchema(mustJSON(t, doc)); err == nil {
			t.Errorf("%s: expected validation error, got nil", name)
		}
	}
}

func TestThemeSchemaUnknownVariantIsSentinelFree(t *testing.T) {
	doc := contractDoc(t)
	doc["variant"] = "unknown"
	err := NewThemeConfigValidator().ValidateThemeSchema(mustJSON(t, doc))
	if err == nil || !strings.Contains(err.Error(), "variant") {
		t.Fatalf("expected a variant error, got %v", err)
	}
}

func TestThemeSchemaLegacyDocumentStillValidates(t *testing.T) {
	v := NewThemeConfigValidator()
	legacy := json.RawMessage(`{"colors":{"primary":"#0d9488"},"typography":{"headingFont":"Inter"}}`)
	if err := v.ValidateThemeSchema(legacy); err != nil {
		t.Fatalf("legacy document must keep passing the existing rules: %v", err)
	}
	if err := v.ValidateThemeSchema(json.RawMessage(`{"colors":{"primary":"red"}}`)); err == nil {
		t.Fatal("legacy document with an invalid colour must still fail")
	}
	if err := v.ValidateThemeSchema(json.RawMessage(`{}`)); err != nil {
		t.Fatalf("empty schema must pass, got %v", err)
	}
}

func TestThemeAssignableError(t *testing.T) {
	if err := themeAssignableError(true, true); err != nil {
		t.Fatalf("active theme must be assignable, got %v", err)
	}
	if err := themeAssignableError(true, false); !errors.Is(err, ErrThemeInactive) {
		t.Fatalf("deactivated theme must yield ErrThemeInactive, got %v", err)
	}
	if err := themeAssignableError(false, false); !errors.Is(err, ErrThemeNotFound) {
		t.Fatalf("missing theme must yield ErrThemeNotFound, got %v", err)
	}
}
