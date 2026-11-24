package themes

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"
)

var (
	ErrInvalidJSON     = errors.New("themes: provided configuration is not valid JSON")
	ErrInvalidHexColor = errors.New("themes: color value must be a valid 6 or 8 character hex code (e.g. #0d9488)")
	ErrMissingKeyField = errors.New("themes: configuration is missing mandatory property")
)

var hexColorRegex = regexp.MustCompile(`^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})$`)

// strictHexColorRegex matches the 6-digit #rrggbb form required by the theme contract.
var strictHexColorRegex = regexp.MustCompile(`^#[A-Fa-f0-9]{6}$`)

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

// themeVariants lists the storefront design variants a platform theme may declare.
var themeVariants = map[string]bool{
	"fashion":             true,
	"streetculture":       true,
	"innerwear":           true,
	"jewelry":             true,
	"gadget":              true,
	"inner-fashion":       true,
	"traditional-fashion": true,
}

// themeColorKeys are the colour tokens every platform theme must define.
var themeColorKeys = []string{"primary", "secondary", "accent", "background", "surface", "text", "muted"}

// themeRadii, themeDensities and themeHeroes are the allowed presentation enum values.
var (
	themeRadii     = map[string]bool{"none": true, "sm": true, "md": true, "lg": true, "xl": true, "full": true}
	themeDensities = map[string]bool{"airy": true, "compact": true}
	themeHeroes    = map[string]bool{
		"editorial":       true,
		"bold-streetwear": true,
		"soft-minimal":    true,
		"luxe-showcase":   true,
		"tech-matrix":     true,
		"sensual-couture": true,
		"royal-heritage":  true,
	}
)

// maxFontNameLength bounds a font family name in a theme config.
const maxFontNameLength = 100

// ValidateThemeSchema validates a platform theme's config_schema. A document that declares a
// "variant" must match the storefront theme contract: one of the four variants, all seven
// colour tokens as 6-digit hex, heading and body font names, and the radius, density and hero
// enums. Any other document falls back to ValidateCustomConfig.
func (v *ThemeConfigValidator) ValidateThemeSchema(rawConfig json.RawMessage) error {
	if len(rawConfig) == 0 {
		return nil
	}
	var parsed map[string]interface{}
	if err := json.Unmarshal(rawConfig, &parsed); err != nil {
		return ErrInvalidJSON
	}
	if _, isContract := parsed["variant"]; !isContract {
		return v.ValidateCustomConfig(rawConfig)
	}
	return validateThemeContract(parsed)
}

// validateThemeContract checks a parsed document against the storefront theme contract.
func validateThemeContract(doc map[string]interface{}) error {
	variant, ok := doc["variant"].(string)
	if !ok || !themeVariants[variant] {
		return errors.New("themes: 'variant' must be one of fashion, streetculture, innerwear, jewelry")
	}

	colors, ok := doc["colors"].(map[string]interface{})
	if !ok {
		return errors.New("themes: 'colors' is required and must be an object")
	}
	for _, key := range themeColorKeys {
		raw, present := colors[key]
		if !present {
			return fmt.Errorf("themes: colors.%s is required", key)
		}
		str, ok := raw.(string)
		if !ok || !strictHexColorRegex.MatchString(str) {
			return fmt.Errorf("%w for key 'colors.%s': %v", ErrInvalidHexColor, key, raw)
		}
	}

	fonts, ok := doc["fonts"].(map[string]interface{})
	if !ok {
		return errors.New("themes: 'fonts' is required and must be an object")
	}
	for _, key := range []string{"heading", "body"} {
		name, ok := fonts[key].(string)
		name = strings.TrimSpace(name)
		if !ok || name == "" || len(name) > maxFontNameLength {
			return fmt.Errorf("themes: fonts.%s is required and must be a font family name of at most %d characters", key, maxFontNameLength)
		}
	}

	if err := requireEnum(doc, "radius", themeRadii); err != nil {
		return err
	}
	if err := requireEnum(doc, "density", themeDensities); err != nil {
		return err
	}
	if err := requireEnum(doc, "hero", themeHeroes); err != nil {
		return err
	}
	return nil
}

// requireEnum checks that doc[key] is a string present in allowed.
func requireEnum(doc map[string]interface{}, key string, allowed map[string]bool) error {
	val, ok := doc[key].(string)
	if !ok || !allowed[val] {
		return fmt.Errorf("themes: '%s' is required and has an unsupported value", key)
	}
	return nil
}
