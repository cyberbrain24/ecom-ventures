import { authorizedRequest } from './api';
import { MarketingConfig, MetaAttributionDashboardResponse } from '../types/store';

export interface AdminMarketingConfigDTO {
  id: string;
  meta_pixel_id: string;
  meta_capi_token: string;
  ga4_measurement_id: string;
  gtm_container_id: string;
  is_pixel_enabled: boolean;
  is_capi_enabled: boolean;
  is_ga4_enabled: boolean;
  is_gtm_enabled: boolean;
}

export interface MetaAdAccountEntity {
  id: number;
  name: string;
  meta_account_id: string;
  currency: string;
  timezone: string;
  daily_spend_cap: number;
  is_active: boolean;
  is_token_stored: boolean;
  last_synced_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ConnectMetaAdAccountInput {
  name: string;
  meta_account_id: string;
  access_token: string;
  currency: string;
  timezone: string;
  daily_spend_cap: number;
  is_active: boolean;
}

export interface GraphAPIExplorerRequestDTO {
  ad_account_id: string;
  method: 'GET' | 'POST';
  endpoint: string;
  body?: string;
}

export interface GraphAPIExplorerResponseDTO {
  http_status: number;
  endpoint_called: string;
  execution_ms: number;
  payload: Record<string, any>;
  error_message?: string;
}

export async function fetchMarketingConfig(): Promise<MarketingConfig | null> {
  try {
    const res = await authorizedRequest<any>('/settings/marketing');
    const data: AdminMarketingConfigDTO = res?.data ?? res;
    if (!data) return null;
    return {
      metaPixelId: data.meta_pixel_id || '',
      metaCapiToken: data.meta_capi_token || '',
      ga4MeasurementId: data.ga4_measurement_id || '',
      gtmContainerId: data.gtm_container_id || '',
      trackPageView: data.is_pixel_enabled,
      trackAddToCart: data.is_capi_enabled,
      trackPurchase: data.is_ga4_enabled,
    };
  } catch (err) {
    console.error('Failed to load marketing settings:', err);
    return null;
  }
}

export async function saveMarketingConfig(payload: {
  meta_pixel_id: string;
  meta_capi_token: string;
  ga4_measurement_id: string;
  gtm_container_id: string;
  is_pixel_enabled: boolean;
  is_capi_enabled: boolean;
  is_ga4_enabled: boolean;
  is_gtm_enabled: boolean;
}): Promise<void> {
  await authorizedRequest<void>('/settings/marketing', {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function fetchMetaAttributionDashboard(
  model: 'last_paid_ad' | 'first_touch' | 'linear' | 'position_based' = 'last_paid_ad'
): Promise<MetaAttributionDashboardResponse> {
  const res = await authorizedRequest<any>(`/marketing/meta-attribution?model=${encodeURIComponent(model)}`);
  return res?.data ?? res;
}

// -------------------------------------------------------------
// Meta Ad Accounts & Graph API Explorer Endpoints
// -------------------------------------------------------------

export async function fetchMetaAdAccounts(): Promise<MetaAdAccountEntity[]> {
  const res = await authorizedRequest<any>('/marketing/meta-accounts');
  return res?.data ?? res ?? [];
}

export async function connectMetaAdAccount(input: ConnectMetaAdAccountInput): Promise<MetaAdAccountEntity> {
  const res = await authorizedRequest<any>('/marketing/meta-accounts', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res?.data ?? res;
}

export async function deleteMetaAdAccount(id: number): Promise<void> {
  await authorizedRequest<void>(`/marketing/meta-accounts/${id}`, {
    method: 'DELETE',
  });
}

export async function syncMetaAdAccount(id: number): Promise<void> {
  await authorizedRequest<void>(`/marketing/meta-accounts/${id}/sync`, {
    method: 'POST',
  });
}

export async function testGraphAPIExplorer(
  input: GraphAPIExplorerRequestDTO
): Promise<GraphAPIExplorerResponseDTO> {
  const res = await authorizedRequest<any>('/marketing/meta-explorer/test', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return res?.data ?? res;
}
