import { authorizedRequest } from './api';
import { ThemeCustomizerConfig, ThemePaletteColors, ThemeTypographyConfig } from '../types/store';

export async function fetchCurrentThemeConfig(): Promise<ThemeCustomizerConfig | null> {
  try {
    const res = await authorizedRequest<any>('/theme/current');
    const data = res?.data ?? res;
    if (!data) return null;
    const colors = data.colors || {};
    const fonts = data.fonts || {};
    const primaryColor = colors.primary || data.primary_color || '#0f172a';
    const secondaryColor = colors.secondary || data.secondary_color || '#3b82f6';
    const headingFont = fonts.heading || data.heading_font || 'Inter';
    const bodyFont = fonts.body || data.body_font || 'Inter';

    return {
      themeName: data.theme_name || 'Storefront Theme',
      themeSlug: data.theme_slug || 'fashion',
      primaryColor,
      secondaryColor,
      headingFont,
      bodyFont,
      borderRadius: data.border_radius || 'sm',
      headerLayout: data.header_layout || 'standard',
      showAnnouncement: Boolean(data.show_announcement),
      announcementText: data.announcement_text || '',
      colors: {
        primary: primaryColor,
        secondary: secondaryColor,
        accent: colors.accent || '#f59e0b',
        background: colors.background || '#ffffff',
        surface: colors.surface || '#f8fafc',
        text: colors.text || '#0f172a',
        muted: colors.muted || '#64748b',
      },
      typography: {
        heading: headingFont,
        body: bodyFont,
        headingWeight: (fonts.heading_weight as any) || '700',
        letterSpacing: (fonts.letter_spacing as any) || 'normal',
        textTransform: (fonts.text_transform as any) || 'none',
        fontSizeScale: (fonts.font_size_scale as any) || 'standard',
      },
    };
  } catch (err) {
    console.error('Failed to load theme config:', err);
    return null;
  }
}

export async function updateThemeTokens(payload: {
  colors: ThemePaletteColors;
  typography: ThemeTypographyConfig;
  borderRadius?: 'none' | 'sm' | 'md' | 'lg' | 'full';
  density?: 'compact' | 'airy';
  showAnnouncement?: boolean;
  announcementText?: string;
}): Promise<void> {
  await authorizedRequest<void>('/theme/current', {
    method: 'PUT',
    body: JSON.stringify({
      colors: payload.colors,
      fonts: {
        heading: payload.typography.heading,
        body: payload.typography.body,
        heading_weight: payload.typography.headingWeight,
        letter_spacing: payload.typography.letterSpacing,
        text_transform: payload.typography.textTransform,
        font_size_scale: payload.typography.fontSizeScale,
      },
      radius: payload.borderRadius,
      density: payload.density,
      show_announcement_bar: payload.showAnnouncement,
      announcement_text: payload.announcementText,
    }),
  });
}
