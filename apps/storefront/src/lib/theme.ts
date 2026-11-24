/**
 * Theme contract for the shared storefront. A platform theme's config is a JSON object with a
 * variant (which design family to render), colours, fonts, radius, density and hero style.
 * Everything here is pure: it validates raw config, resolves it against the neutral fallback and
 * builds the CSS custom properties. Business logic never reads these values.
 */

export const THEME_VARIANTS = ['fashion', 'streetculture', 'innerwear', 'jewelry', 'gadget', 'inner-fashion', 'traditional-fashion'] as const;
export type ThemeVariant = (typeof THEME_VARIANTS)[number];

export const THEME_HEROES = ['editorial', 'bold-streetwear', 'soft-minimal', 'luxe-showcase', 'tech-matrix', 'sensual-couture', 'royal-heritage'] as const;
export type ThemeHero = (typeof THEME_HEROES)[number];

export const THEME_RADII = ['none', 'sm', 'md', 'lg', 'xl', 'full'] as const;
export type ThemeRadius = (typeof THEME_RADII)[number];

export const THEME_DENSITIES = ['airy', 'compact'] as const;
export type ThemeDensity = (typeof THEME_DENSITIES)[number];

/** Colour tokens. Every value is a hex colour. */
export interface ThemeColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
}

/** Font family names. Only names in FONT_WEIGHTS reach the Google Fonts URL. */
export interface ThemeFonts {
  heading: string;
  body: string;
}

/** Resolved theme configuration used by every presentation component. */
export interface ThemeConfig {
  variant: ThemeVariant;
  colors: ThemeColors;
  fonts: ThemeFonts;
  radius: ThemeRadius;
  density: ThemeDensity;
  hero: ThemeHero;
  /** Optional announcement bar text, read from the store configuration when present. */
  show_announcement_bar?: boolean;
  announcement_text?: string;
}

/** Result of resolving raw config. `source` says whether the store's own config was used. */
export interface ResolvedTheme {
  config: ThemeConfig;
  source: 'configured' | 'fallback';
  /** Why the fallback was used, in plain words. Null when the store config was used. */
  fallbackReason: string | null;
  /** Field names whose stored value was present but invalid, so the variant default was used for them. */
  invalidFields: string[];
}

/** Google Fonts families and the weights requested for each one. Unlisted names use the neutral default. */
export const FONT_WEIGHTS: Record<string, string> = {
  Inter: '400;500;600;700;800',
  Montserrat: '400;500;600;700;800',
  'Playfair Display': '400;600;700;800',
  Cinzel: '400;600;700;800',
  'Cormorant Garamond': '400;500;600;700',
  'Bebas Neue': '400',
  'Space Grotesk': '400;500;600;700',
  'Nunito Sans': '400;600;700;800',
  Lato: '400;700',
  Poppins: '400;500;600;700',
  Roboto: '400;500;700',
  'Open Sans': '400;600;700',
  Nunito: '400;600;700;800',
  Raleway: '400;600;700;800',
  Merriweather: '400;700',
  Lora: '400;600;700',
  Oswald: '400;500;600;700',
  'Source Sans 3': '400;600;700',
  'DM Sans': '400;500;700',
  'Work Sans': '400;500;600;700',
  'Noto Sans Bengali': '400;500;600;700',
  'Hind Siliguri': '400;500;600;700',
};

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const RADIUS_VALUES: Record<ThemeRadius, string> = {
  none: '0px',
  sm: '0.25rem',
  md: '0.5rem',
  lg: '1rem',
  xl: '1.5rem',
  full: '9999px',
};

/** Contract values for each variant. The fashion entry is also the neutral fallback design. */
const VARIANT_DEFAULTS: Record<ThemeVariant, ThemeConfig> = {
  fashion: {
    variant: 'fashion',
    colors: {
      primary: '#1f2937',
      secondary: '#b45309',
      accent: '#0f766e',
      background: '#fafaf9',
      surface: '#ffffff',
      text: '#111827',
      muted: '#6b7280',
    },
    fonts: { heading: 'Playfair Display', body: 'Inter' },
    radius: 'md',
    density: 'airy',
    hero: 'editorial',
  },
  streetculture: {
    variant: 'streetculture',
    colors: {
      primary: '#000000',
      secondary: '#000000',
      accent: '#ff2d55',
      background: '#ffffff',
      surface: '#ffffff',
      text: '#0a0a0a',
      muted: '#737373',
    },
    fonts: { heading: 'Bebas Neue', body: 'Space Grotesk' },
    radius: 'none',
    density: 'compact',
    hero: 'bold-streetwear',
  },
  innerwear: {
    variant: 'innerwear',
    colors: {
      primary: '#9d174d',
      secondary: '#fbcfe8',
      accent: '#be185d',
      background: '#fff7fb',
      surface: '#ffffff',
      text: '#3b0a1f',
      muted: '#9f6b84',
    },
    fonts: { heading: 'Cormorant Garamond', body: 'Nunito Sans' },
    radius: 'lg',
    density: 'airy',
    hero: 'soft-minimal',
  },
  jewelry: {
    variant: 'jewelry',
    colors: {
      primary: '#1e1b4b',
      secondary: '#d4af37',
      accent: '#b8860b',
      background: '#ffffff',
      surface: '#ffffff',
      text: '#1e1b4b',
      muted: '#64748b',
    },
    fonts: { heading: 'Cinzel', body: 'Lato' },
    radius: 'sm',
    density: 'airy',
    hero: 'luxe-showcase',
  },
  gadget: {
    variant: 'gadget',
    colors: {
      primary: '#0284c7', // Cyber Cyan / Electric Blue
      secondary: '#06b6d4', // Bright Teal
      accent: '#3b82f6', // Neon Cobalt
      background: '#ffffff', // Crisp White Canvas
      surface: '#ffffff', // Clean White Card Surface
      text: '#0f172a', // Deep Slate Ink
      muted: '#64748b', // Slate Muted
    },
    fonts: { heading: 'Space Grotesk', body: 'Inter' },
    radius: 'md',
    density: 'compact',
    hero: 'tech-matrix',
  },
  'inner-fashion': {
    variant: 'inner-fashion',
    colors: {
      primary: '#4a0e2e', // Deep Burgundy Noir / Mulberry
      secondary: '#e2a7b8', // Dusty Rose Satin
      accent: '#c05c7e', // Rosewood Velvet
      background: '#faf6f7', // Whipped Silk Ivory
      surface: '#ffffff', // Crisp Ivory Card Surface
      text: '#220817', // Midnight Damson Noir
      muted: '#8e6b7b', // Soft Mauve Cashmere
    },
    fonts: { heading: 'Playfair Display', body: 'Montserrat' },
    radius: 'lg',
    density: 'airy',
    hero: 'sensual-couture',
  },
  'traditional-fashion': {
    variant: 'traditional-fashion',
    colors: {
      primary: '#6b1124', // Royal Crimson / Jamdani Maroon
      secondary: '#c59b27', // Antique Zari Gold
      accent: '#1e3d34', // Imperial Emerald / Forest Green
      background: '#faf7f2', // Raw Muslin Cream
      surface: '#ffffff', // Crisp Ivory Weave Surface
      text: '#2a161b', // Deep Espresso Velvet
      muted: '#8a7378', // Rosewood Silk Muted
    },
    fonts: { heading: 'Cinzel', body: 'Hind Siliguri' },
    radius: 'sm',
    density: 'airy',
    hero: 'royal-heritage',
  },
};

/** The neutral design used when a store has no usable theme configuration. It names no store and no brand. */
export const FALLBACK_THEME: ThemeConfig = VARIANT_DEFAULTS.fashion;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function pickHex(value: unknown, fallback: string): string {
  return typeof value === 'string' && HEX_COLOR.test(value) ? value : fallback;
}

function pickFont(value: unknown, fallback: string): string {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(FONT_WEIGHTS, value) ? value : fallback;
}

function pickOne<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return typeof value === 'string' && (options as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** True when a stored value is absent or blank, so the next source or the variant default applies silently. */
function isMissing(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

/**
 * Lists the theme fields whose stored value is present but invalid. Missing values are not
 * reported, because the neutral defaults are the intended result for them. Legacy keys are read
 * with the same precedence as resolveTheme.
 */
export function findInvalidThemeFields(raw: Record<string, unknown>): string[] {
  const invalid: string[] = [];
  const check = (field: string, value: unknown, isValid: (v: unknown) => boolean) => {
    if (!isMissing(value) && !isValid(value)) {
      invalid.push(field);
    }
  };
  const isHex = (v: unknown) => typeof v === 'string' && HEX_COLOR.test(v);
  const isFont = (v: unknown) => typeof v === 'string' && Object.prototype.hasOwnProperty.call(FONT_WEIGHTS, v);
  const oneOf = (options: readonly string[]) => (v: unknown) => typeof v === 'string' && options.includes(v);

  check('variant', raw.variant, oneOf(THEME_VARIANTS));
  check('colors', raw.colors, isRecord);
  check('fonts', raw.fonts, isRecord);

  const colorsRaw = isRecord(raw.colors) ? raw.colors : {};
  const fontsRaw = isRecord(raw.fonts) ? raw.fonts : {};

  check('colors.primary', isMissing(colorsRaw.primary) ? raw.primary_color : colorsRaw.primary, isHex);
  check('colors.secondary', isMissing(colorsRaw.secondary) ? raw.secondary_color : colorsRaw.secondary, isHex);
  check('colors.accent', colorsRaw.accent, isHex);
  check('colors.background', colorsRaw.background, isHex);
  check('colors.surface', colorsRaw.surface, isHex);
  check('colors.text', colorsRaw.text, isHex);
  check('colors.muted', colorsRaw.muted, isHex);

  check('fonts.heading', isMissing(fontsRaw.heading) ? raw.heading_font : fontsRaw.heading, isFont);
  check('fonts.body', isMissing(fontsRaw.body) ? raw.body_font : fontsRaw.body, isFont);

  check('radius', isMissing(raw.radius) ? raw.border_radius : raw.radius, oneOf(THEME_RADII));
  check('density', raw.density, oneOf(THEME_DENSITIES));
  check('hero', raw.hero, oneOf(THEME_HEROES));

  return invalid;
}

/**
 * Validates raw theme config from the API and fills every missing or invalid value from the
 * variant's contract defaults. Legacy keys (primary_color, secondary_color, heading_font,
 * body_font, border_radius) are read when the contract keys are absent so existing stores keep
 * their colours. Missing config returns the neutral fallback with a reason.
 */
export function resolveTheme(raw: unknown): ResolvedTheme {
  if (!isRecord(raw)) {
    return {
      config: FALLBACK_THEME,
      source: 'fallback',
      fallbackReason: 'The store has no theme configuration.',
      invalidFields: [],
    };
  }

  const variant = pickOne<ThemeVariant>(raw.variant, THEME_VARIANTS, 'fashion');
  const base = VARIANT_DEFAULTS[variant];
  const colorsRaw = isRecord(raw.colors) ? raw.colors : {};
  const fontsRaw = isRecord(raw.fonts) ? raw.fonts : {};

  const colors: ThemeColors = {
    primary: pickHex(colorsRaw.primary, pickHex(raw.primary_color, base.colors.primary)),
    secondary: pickHex(colorsRaw.secondary, pickHex(raw.secondary_color, base.colors.secondary)),
    accent: pickHex(colorsRaw.accent, base.colors.accent),
    background: pickHex(colorsRaw.background, base.colors.background),
    surface: pickHex(colorsRaw.surface, base.colors.surface),
    text: pickHex(colorsRaw.text, base.colors.text),
    muted: pickHex(colorsRaw.muted, base.colors.muted),
  };

  const config: ThemeConfig = {
    variant,
    colors,
    fonts: {
      heading: pickFont(fontsRaw.heading, pickFont(raw.heading_font, base.fonts.heading)),
      body: pickFont(fontsRaw.body, pickFont(raw.body_font, base.fonts.body)),
    },
    radius: pickOne<ThemeRadius>(raw.radius, THEME_RADII, pickOne<ThemeRadius>(raw.border_radius, THEME_RADII, base.radius)),
    density: pickOne<ThemeDensity>(raw.density, THEME_DENSITIES, base.density),
    hero: pickOne<ThemeHero>(raw.hero, THEME_HEROES, base.hero),
  };

  if (typeof raw.show_announcement_bar === 'boolean') {
    config.show_announcement_bar = raw.show_announcement_bar;
  }
  if (typeof raw.announcement_text === 'string') {
    config.announcement_text = raw.announcement_text;
  }

  return { config, source: 'configured', fallbackReason: null, invalidFields: findInvalidThemeFields(raw) };
}

/** Returns the WCAG relative luminance of a hex colour. */
function luminance(hex: string): number {
  let value = hex.replace('#', '');
  if (value.length === 3) {
    value = value.split('').map((c) => c + c).join('');
  }
  const linear = [0, 2, 4].map((i) => {
    const c = parseInt(value.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/** Returns near-black or white, whichever has the higher contrast on the given background colour. */
export function readableOn(hex: string): string {
  return luminance(hex) > 0.4 ? '#0a0a0a' : '#ffffff';
}

/**
 * Builds the :root custom properties for a resolved theme. Colours and fonts are validated before
 * they reach this function, so the output is safe to place in a style element.
 */
export function buildThemeCss(theme: ThemeConfig): string {
  const { colors, fonts } = theme;
  const density =
    theme.density === 'compact'
      ? { gap: '2.5rem', pad: '0.75rem', section: '2rem' }
      : { gap: '4rem', pad: '1rem', section: '3.5rem' };

  return `:root {
  --brand-primary: ${colors.primary};
  --brand-secondary: ${colors.secondary};
  --t-accent: ${colors.accent};
  --t-bg: ${colors.background};
  --t-surface: ${colors.surface};
  --t-text: ${colors.text};
  --t-muted: ${colors.muted};
  --t-on-primary: ${readableOn(colors.primary)};
  --t-on-secondary: ${readableOn(colors.secondary)};
  --t-on-accent: ${readableOn(colors.accent)};
  --brand-font-heading: "${fonts.heading}", serif;
  --brand-font-body: "${fonts.body}", sans-serif;
  --brand-radius: ${RADIUS_VALUES[theme.radius]};
  --t-density-gap: ${density.gap};
  --t-density-pad: ${density.pad};
  --t-density-section: ${density.section};
}`;
}

/** Builds the Google Fonts stylesheet URL for the heading and body families. */
export function buildFontsUrl(fonts: ThemeFonts): string {
  const families = Array.from(new Set([fonts.heading, fonts.body]))
    .map((name) => `family=${encodeURIComponent(name).replace(/%20/g, '+')}:wght@${FONT_WEIGHTS[name] ?? '400;700'}`)
    .join('&');
  return `https://fonts.googleapis.com/css2?${families}&display=swap`;
}
