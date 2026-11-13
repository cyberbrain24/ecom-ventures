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

export interface ThemeCustomConfig {
  primary_color: string;
  secondary_color: string;
  heading_font: string;
  body_font: string;
  border_radius?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  header_layout?: 'standard' | 'centered' | 'minimal';
  show_announcement_bar?: boolean;
  announcement_text?: string;
}

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
