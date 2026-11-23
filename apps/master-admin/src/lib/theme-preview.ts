/**
 * Reads the design tokens that a theme record defines for itself.
 * The values come from the theme's config_schema returned by GET /platform/themes, using the shared
 * theme contract: { variant, colors: {...}, fonts: { heading, body }, radius, density, hero }.
 * Nothing is inferred from the theme slug or name.
 */

/** One named colour token from config_schema.colors, in declaration order. */
export interface ThemeColorToken {
  key: string;
  value: string;
}

/** Design tokens a theme defines for itself. Each field is null or empty when the theme does not set it. */
export interface ThemePreview {
  /** Variant identifier such as "fashion", or null when not configured. */
  variant: string | null;
  /** Hex colour tokens defined by the theme. Empty when none are configured. */
  colors: ThemeColorToken[];
  /** Heading font family defined by the theme, or null when not configured. */
  headingFont: string | null;
  /** Body font family defined by the theme, or null when not configured. */
  bodyFont: string | null;
  /** Corner radius token ("none" to "full"), or null when not configured. */
  radius: string | null;
  /** Layout density token ("airy" or "compact"), or null when not configured. */
  density: string | null;
  /** Hero layout token, or null when not configured. */
  hero: string | null;
}

const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;

/**
 * Returns a trimmed non-empty string, or null.
 *
 * @param value - Any value from the config_schema
 * @returns The trimmed string, or null when the value is not a non-empty string
 */
function readText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/**
 * Extracts the design tokens from a theme's config_schema.
 *
 * @param configSchema - The theme record's config_schema object (may be undefined)
 * @returns The theme's own tokens; null or empty where the theme does not define them
 */
export function readThemePreview(configSchema: Record<string, unknown> | undefined | null): ThemePreview {
  const colors: ThemeColorToken[] = [];
  const colorBlock = configSchema?.colors;
  if (colorBlock && typeof colorBlock === 'object') {
    for (const [key, value] of Object.entries(colorBlock as Record<string, unknown>)) {
      const hex = readText(value);
      if (hex && HEX_COLOR.test(hex)) {
        colors.push({ key, value: hex });
      }
    }
  }

  let headingFont: string | null = null;
  let bodyFont: string | null = null;
  const fontBlock = configSchema?.fonts;
  if (fontBlock && typeof fontBlock === 'object') {
    const fonts = fontBlock as Record<string, unknown>;
    headingFont = readText(fonts.heading);
    bodyFont = readText(fonts.body);
  }

  return {
    variant: readText(configSchema?.variant),
    colors,
    headingFont,
    bodyFont,
    radius: readText(configSchema?.radius),
    density: readText(configSchema?.density),
    hero: readText(configSchema?.hero),
  };
}

/**
 * Returns the hex value of one named colour token, or undefined when the theme does not define it.
 *
 * @param preview - Result of readThemePreview
 * @param key - Token name such as "primary" or "background"
 * @returns The hex colour, or undefined
 */
export function themeColor(preview: ThemePreview, key: string): string | undefined {
  return preview.colors.find((c) => c.key === key)?.value;
}

/**
 * Converts a radius token to a CSS border-radius value.
 *
 * @param radius - Radius token from config_schema, or null
 * @returns A CSS length, or undefined when the token is missing or unknown
 */
export function radiusToCss(radius: string | null): string {
  switch (radius) {
    case 'none':
      return '0px';
    case 'sm':
      return '4px';
    case 'md':
      return '8px';
    case 'lg':
      return '14px';
    case 'xl':
      return '20px';
    case 'full':
      return '9999px';
    default:
      return '8px';
  }
}

/**
 * Turns a variant identifier into a display label.
 *
 * @param variant - Variant identifier from config_schema, or null
 * @returns A readable label, or null when no variant is set
 */
export function variantLabel(variant: string | null): string | null {
  if (!variant) return null;
  const labels: Record<string, string> = {
    fashion: 'Fashion',
    artisan: 'Artisan Craft',
    streetculture: 'Streetwear',
    urban: 'Streetwear',
    innerwear: 'Inner Wear',
    'inner-fashion': 'Inner Fashion',
    jewelry: 'Fine Jewelry',
    gadget: 'Electronics & Tech',
    'traditional-fashion': 'Traditional Heritage',
  };
  return labels[variant.toLowerCase()] ?? variant.replace(/-/g, ' ');
}

/**
 * Infers an appropriate storefront style variant from the theme's slug when no variant token is configured.
 */
export function inferVariantFromSlug(slug: string): string {
  const s = slug.toLowerCase();
  if (s.includes('minimal') || s.includes('fashion')) return 'Fashion';
  if (s.includes('boutique') || s.includes('artisan') || s.includes('leather')) return 'Artisan Craft';
  if (s.includes('street') || s.includes('urban')) return 'Streetwear';
  if (s.includes('jewelry')) return 'Fine Jewelry';
  if (s.includes('gadget') || s.includes('tech')) return 'Electronics & Tech';
  if (s.includes('inner')) return 'Luxury Innerwear';
  if (s.includes('traditional')) return 'Traditional Heritage';
  return 'Modern Retail';
}
