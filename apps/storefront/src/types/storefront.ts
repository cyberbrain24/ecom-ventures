/**
 * Package types defines data contracts for the shared storefront Next.js application,
 * matching payloads returned by the Go backend `/api/v1/storefront/*` APIs.
 */

export interface StorefrontBrand {
  id: string;
  name: string;
  slug: string;
  currency: string;
  timezone: string;
  status: 'ACTIVE' | 'MAINTENANCE' | 'SUSPENDED';
  contact_email: string;
  contact_phone?: string;
  support_email?: string;
  description?: string;
  logo_url?: string;
  order_number_prefix?: string;
  whatsapp_phone?: string;
  facebook_url?: string;
  instagram_url?: string;
}

export interface ThemeColors {
  primary: string;
  secondary: string;
  accent?: string;
  background?: string;
  surface?: string;
  text?: string;
}

export interface ThemeTypography {
  heading_font: string; // e.g. "Inter", "Playfair Display", "Cinzel", "Montserrat"
  body_font: string;
}

/**
 * Raw theme config as stored by the platform. It is validated by resolveTheme in src/lib/theme.ts
 * before any component reads it, so this type stays loose.
 */
export type ThemeCustomConfig = Record<string, unknown>;

export interface StorefrontTheme {
  id: string;
  name: string;
  slug: string;
  version: string;
  config: ThemeCustomConfig;
}

export interface StorefrontSEOSettings {
  meta_title_template: string;
  default_meta_title: string;
  default_meta_description: string;
  default_keywords: string;
  favicon_url: string;
  apple_touch_icon_url: string;
  default_og_image_url: string;
  twitter_handle: string;
  google_site_verification: string;
  bing_site_verification: string;
  pinterest_verification: string;
  robots_txt_custom: string;
  sitemap_enabled: boolean;
}

export interface StorefrontConfigResponse {
  store: StorefrontBrand;
  domain: string;
  is_custom_domain: boolean;
  theme: StorefrontTheme;
  seo?: StorefrontSEOSettings;
}

export interface NavLink {
  label: string;
  href: string;
}
