package themes

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
)

var (
	ErrInvalidJSON     = errors.New("themes: provided configuration is not valid JSON")
	ErrInvalidHexColor = errors.New("themes: color value must be a valid 6 or 8 character hex code (e.g. #0d9488)")
	ErrMissingKeyField = errors.New("themes: configuration is missing mandatory property")
)

var hexColorRegex = regexp.MustCompile(`^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$`)

// ThemeConfigValidator evaluates custom store configs against expected theme tokens.
type ThemeConfigValidator struct{}

// NewThemeConfigValidator instantiates the validator.
func NewThemeConfigValidator() *ThemeConfigValidator {
	return &ThemeConfigValidator{}
}

// ValidateCustomConfig asserts that custom configuration adheres to JSON format and styling boundaries.
func (v *ThemeConfigValidator) ValidateCustomConfig(rawConfig json.RawMessage) error {
	if len(rawConfig) == 0 || string(rawConfig) == "{}" {
		return nil // Empty config fallback is allowed
	}

	var parsed map[string]interface{}
	if err := json.Unmarshal(rawConfig, &parsed); err != nil {
		return ErrInvalidJSON
	}

	// Validate 'colors' sub-object if specified
	if colorsRaw, exists := parsed["colors"]; exists {
		colorsMap, ok := colorsRaw.(map[string]interface{})
		if !ok {
			return errors.New("themes: 'colors' property must be an object of key-value hex strings")
		}

		for key, val := range colorsMap {
			strVal, ok := val.(string)
			if !ok || !hexColorRegex.MatchString(strVal) {
				return fmt.Errorf("%w for key '%s': %v", ErrInvalidHexColor, key, val)
			}
		}
	}

	// Validate 'typography' sub-object if specified
	if typoRaw, exists := parsed["typography"]; exists {
		_, ok := typoRaw.(map[string]interface{})
		if !ok {
			return errors.New("themes: 'typography' property must be a valid key-value configuration object")
		}
	}

	return nil
}
