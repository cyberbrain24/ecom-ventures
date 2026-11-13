package themes

import (
	"encoding/json"
	"testing"
)

func TestThemeConfigValidator(t *testing.T) {
	validator := NewThemeConfigValidator()

	// 1. Valid Hex colors configuration
	validConfig := json.RawMessage(`{
		"colors": {
			"primary": "#0d9488",
			"secondary": "#14b8a6",
			"accent": "#f59e0b"
		},
		"typography": {
			"headingFont": "Playfair Display",
			"bodyFont": "Inter"
		}
	}`)

	if err := validator.ValidateCustomConfig(validConfig); err != nil {
		t.Fatalf("expected valid config, got error: %v", err)
	}

	// 2. Invalid Hex color
	invalidColorConfig := json.RawMessage(`{
		"colors": {
			"primary": "not-a-hex-color"
		}
	}`)

	if err := validator.ValidateCustomConfig(invalidColorConfig); err == nil {
		t.Fatalf("expected validation error on non-hex color, got nil")
	}

	// 3. Empty configuration is allowed
	if err := validator.ValidateCustomConfig(json.RawMessage(`{}`)); err != nil {
		t.Fatalf("expected empty config to pass, got error: %v", err)
	}

	// 4. Nil configuration is allowed
	if err := validator.ValidateCustomConfig(nil); err != nil {
		t.Fatalf("expected nil config to pass, got error: %v", err)
	}
}
