import { authorizedRequest } from './api';
import { StoreSettings, StoreStaff } from '../types/store';

export interface UpdateStoreSettingsPayload {
  store_name?: string;
  legal_business_name?: string;
  support_email?: string;
  contact_phone?: string;
  order_number_prefix?: string;
  default_shipping_fee?: number;
  tax_rate_percent?: number;
  prices_include_tax?: boolean;
  whatsapp_phone?: string;
  facebook_url?: string;
  instagram_url?: string;
  meta_title_template?: string;
  default_meta_title?: string;
  default_meta_description?: string;
  default_keywords?: string;
  favicon_url?: string;
  apple_touch_icon_url?: string;
  default_og_image_url?: string;
  twitter_handle?: string;
  google_site_verification?: string;
  bing_site_verification?: string;
  pinterest_verification?: string;
  robots_txt_custom?: string;
  sitemap_enabled?: boolean;
  logo_url?: string;
  desktop_hero_banner_url?: string;
  mobile_hero_banner_url?: string;
  site_description?: string;
  footer_content?: string;
  primary_color?: string;
  secondary_color?: string;
  font_heading?: string;
  font_body?: string;
}

export async function fetchStoreSettings(): Promise<StoreSettings | null> {
  try {
    const res = await authorizedRequest<any>('/settings');
    const data = res?.data ?? res;
    if (!data) return null;
    return {
      brandName: data.store_name || '',
      legalBusinessName: data.legal_business_name || '',
      contactEmail: data.contact_email || data.support_email || '',
      contactPhone: data.contact_phone || '',
      currency: data.currency || 'BDT',
      timezone: data.timezone || 'Asia/Dhaka',
      shippingInsideDhaka: Number(data.default_shipping_fee) || 60,
      shippingOutsideDhaka: Number(data.shipping_outside_dhaka) || 120,
      orderPrefix: data.order_number_prefix || 'ORD-',
      returnPolicyDays: Number(data.return_policy_days) || 7,
      taxRatePercent: Number(data.tax_rate_percent) || 0,
      pricesIncludeTax: Boolean(data.prices_include_tax),
      // Visual Branding & Media
      logoUrl: data.logo_url || '',
      desktopHeroBannerUrl: data.desktop_hero_banner_url || '',
      mobileHeroBannerUrl: data.mobile_hero_banner_url || '',
      siteDescription: data.site_description || '',
      footerContent: data.footer_content || '',
      primaryColor: data.primary_color || '',
      secondaryColor: data.secondary_color || '',
      fontHeading: data.font_heading || '',
      fontBody: data.font_body || '',
      // Social Channels
      whatsappPhone: data.whatsapp_phone || '',
      facebookUrl: data.facebook_url || '',
      instagramUrl: data.instagram_url || '',
      // Comprehensive SEO & Webmaster
      metaTitleTemplate: data.meta_title_template || '',
      defaultMetaTitle: data.default_meta_title || '',
      defaultMetaDescription: data.default_meta_description || '',
      defaultKeywords: data.default_keywords || '',
      faviconUrl: data.favicon_url || '',
      appleTouchIconUrl: data.apple_touch_icon_url || '',
      defaultOgImageUrl: data.default_og_image_url || '',
      twitterHandle: data.twitter_handle || '',
      googleSiteVerification: data.google_site_verification || '',
      bingSiteVerification: data.bing_site_verification || '',
      pinterestVerification: data.pinterest_verification || '',
      robotsTxtCustom: data.robots_txt_custom || '',
      sitemapEnabled: data.sitemap_enabled !== undefined ? Boolean(data.sitemap_enabled) : true,
    };
  } catch (err) {
    console.error('Failed to load store settings:', err);
    return null;
  }
}

export async function updateStoreSettings(payload: UpdateStoreSettingsPayload): Promise<void> {
  await authorizedRequest<void>('/settings', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export interface CreateStaffInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: 'STORE_ADMIN' | 'STORE_STAFF';
}

export interface UpdateStaffInput {
  firstName: string;
  lastName: string;
  role: 'STORE_OWNER' | 'STORE_ADMIN' | 'STORE_STAFF';
  isActive: boolean;
}

export async function fetchStaffList(): Promise<StoreStaff[]> {
  try {
    const res = await authorizedRequest<any>('/staff');
    const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
    return list.map((item: any) => ({
      id: item.id,
      name: `${item.first_name || ''} ${item.last_name || ''}`.trim() || item.email,
      firstName: item.first_name || '',
      lastName: item.last_name || '',
      email: item.email,
      role: item.role,
      isActive: Boolean(item.is_active),
      createdAt: item.created_at,
    }));
  } catch (err) {
    console.error('Failed to load staff list:', err);
    return [];
  }
}

export async function createStaffMember(input: CreateStaffInput): Promise<StoreStaff> {
  const res = await authorizedRequest<any>('/staff', {
    method: 'POST',
    body: JSON.stringify({
      email: input.email.trim(),
      password: input.password,
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      role: input.role,
    }),
  });
  const data = res?.data ?? res;
  return {
    id: data.id,
    name: `${data.first_name || ''} ${data.last_name || ''}`.trim() || data.email,
    firstName: data.first_name || '',
    lastName: data.last_name || '',
    email: data.email,
    role: data.role,
    isActive: Boolean(data.is_active),
    createdAt: data.created_at,
  };
}

export async function updateStaffMember(id: string, input: UpdateStaffInput): Promise<StoreStaff> {
  const res = await authorizedRequest<any>(`/staff/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      first_name: input.firstName.trim(),
      last_name: input.lastName.trim(),
      role: input.role,
      is_active: input.isActive,
    }),
  });
  const data = res?.data ?? res;
  return {
    id: data.id,
    name: `${data.first_name || ''} ${data.last_name || ''}`.trim() || data.email,
    firstName: data.first_name || '',
    lastName: data.last_name || '',
    email: data.email,
    role: data.role,
    isActive: Boolean(data.is_active),
    createdAt: data.created_at,
  };
}

export async function deleteStaffMember(id: string): Promise<void> {
  await authorizedRequest<void>(`/staff/${id}`, {
    method: 'DELETE',
  });
}
