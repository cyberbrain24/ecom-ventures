// Package types provides frontend contracts for Theme Management.

export interface ThemeColorsConfig {
  primary: string;
  secondary: string;
  accent?: string;
  background?: string;
}

export interface ThemeTypographyConfig {
  headingFont: string;
  bodyFont: string;
}

export interface ThemeCustomConfig {
  colors?: ThemeColorsConfig;
  typography?: ThemeTypographyConfig;
  features?: {
    enableStickyHeader?: boolean;
    enableQuickView?: boolean;
    heroBannerLayout?: 'full-width' | 'split' | 'boxed';
  };
}

export interface ThemeItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  version: string;
  preview_image_url?: string;
  config_schema: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  active_stores_count: number;
}

export interface ThemeBlueprint {
  id: string;
  name: string;
  slug: string;
  description: string;
  version: string;
  preview_image_url?: string;
  config_schema?: Record<string, unknown>;
  is_active: boolean;
}

export interface AssignThemePayload {
  theme_id: string;
  custom_config: ThemeCustomConfig;
}
