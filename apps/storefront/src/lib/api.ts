import { StorefrontConfigResponse } from '../types/storefront';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

const DEFAULT_FALLBACK_CONFIG: StorefrontConfigResponse = {
  store: {
    id: 'f4a89f27-78ec-40fd-a735-675a3de145ed',
    name: 'Mior Fashion',
    slug: 'mior',
    currency: 'BDT',
    timezone: 'Asia/Dhaka',
    status: 'ACTIVE',
    contact_email: 'support@miorfashion.com',
    description: 'Haute couture & bespoke silk fashion house.',
    logo_url: 'https://images.unsplash.com/photo-1544441893-675973e31985?w=120&auto=format&fit=crop&q=80',
    order_number_prefix: 'MIO',
  },
  domain: 'mior.localhost',
  is_custom_domain: false,
  seo: {
    meta_title_template: '%s | Mior Fashion',
    default_meta_title: 'Mior Fashion | Haute Couture & Bespoke Silk Fashion House',
    default_meta_description: 'Discover exquisite silk evening gowns, cashmere winter knitwear, and haute couture tailored for modern sophistication. Free delivery across Bangladesh.',
    default_keywords: 'silk gown, cashmere knitwear, haute couture, luxury fashion, bangladesh fashion',
    favicon_url: 'https://images.unsplash.com/photo-1544441893-675973e31985?w=64&auto=format&fit=crop&q=80',
    apple_touch_icon_url: 'https://images.unsplash.com/photo-1544441893-675973e31985?w=180&auto=format&fit=crop&q=80',
    default_og_image_url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&auto=format&fit=crop&q=80',
    twitter_handle: '@miorfashion',
    google_site_verification: '',
    bing_site_verification: '',
    pinterest_verification: '',
    robots_txt_custom: '',
    sitemap_enabled: true,
  },
  theme: {
    id: 'theme-1',
    name: 'Modern Minimal',
    slug: 'modern-minimal',
    version: '1.0.0',
    config: {
      primary_color: '#0f766e',
      secondary_color: '#0284c7',
      heading_font: 'Inter',
      body_font: 'Inter',
      border_radius: 'md',
      header_layout: 'standard',
      show_announcement_bar: true,
      announcement_text: 'Welcome to Mior Fashion! Free delivery on orders over 1500 BDT.',
    },
  },
};

/**
 * Fetch the complete storefront configuration (brand details, currency, active theme overrides)
 * from the Go backend using the incoming host header for tenant context resolution.
 */
export async function getStorefrontConfig(host: string): Promise<StorefrontConfigResponse | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/storefront/config`, {
      headers: {
        'Host': host,
        'X-Forwarded-Host': host,
        'X-Original-Host': host,
      },
      cache: 'no-store',
    });

    if (!res.ok) {
      return DEFAULT_FALLBACK_CONFIG;
    }

    const payload = await res.json();
    const data = payload.data;
    if (!data) {
      return DEFAULT_FALLBACK_CONFIG;
    }

    const storeBrand = data.store || {
      id: data.id || 'default-store',
      name: data.brand_name || data.name || 'Store',
      slug: data.slug || 'store',
      currency: data.currency || 'BDT',
      timezone: data.timezone || 'Asia/Dhaka',
      status: (data.status || 'ACTIVE') as 'ACTIVE' | 'MAINTENANCE' | 'SUSPENDED',
      contact_email: data.contact_email || 'support@dropiobd.com',
      contact_phone: data.contact_phone || '',
      logo_url: data.logo_url || '',
    };

    let theme = data.theme;
    if (!theme) {
      try {
        const themeRes = await fetch(`${API_BASE_URL}/storefront/theme`, {
          headers: {
            'Host': host,
            'X-Forwarded-Host': host,
          },
          next: {
            revalidate: 60,
            tags: [`storefront-theme-${host}`],
          },
        });
        if (themeRes.ok) {
          const themePayload = await themeRes.json();
          theme = themePayload.data;
        }
      } catch (e) {
        // Fall back gracefully
      }
    }

    const defaultThemeConfig = {
      primary_color: '#0f766e',
      secondary_color: '#0284c7',
      heading_font: 'Inter',
      body_font: 'Inter',
      border_radius: 'md' as const,
      header_layout: 'standard' as const,
      show_announcement_bar: true,
      announcement_text: 'Welcome to our store! Free shipping on orders over 1500 BDT.',
    };

    return {
      store: storeBrand,
      domain: data.domain || host,
      is_custom_domain: Boolean(data.is_custom || data.is_custom_domain),
      seo: data.seo || DEFAULT_FALLBACK_CONFIG.seo,
      theme: {
        id: theme?.id || theme?.theme_id || 'default-theme',
        name: theme?.name || theme?.theme_name || 'Modern Minimalist',
        slug: theme?.slug || theme?.theme_slug || 'modern',
        version: theme?.version || '1.0.0',
        config: {
          ...defaultThemeConfig,
          ...(theme?.config || theme?.custom_config || {}),
        },
      },
    };
  } catch (error) {
    return DEFAULT_FALLBACK_CONFIG;
  }
}
