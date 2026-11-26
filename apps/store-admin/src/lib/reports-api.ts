import { apiRequest } from './api';

export interface SalesSnapshot {
  orders_qty: number;
  product_qty: number;
  total_amount: number;
  aov: number;
  product_costing: number;
  meta_ads_usd: number;
  usd_rate: number;
  meta_ads_costing: number;
  fixed_expense: number;
  total_profit: number;
}

export interface StatusBreakdown {
  key: string;
  name: string;
  orders: number;
  products: number;
  percentage: number;
  value: number;
  costing: number;
  default_active: boolean;
}

export interface SalesReportResponse {
  preset: string;
  date_from: string;
  date_to: string;
  timezone: string;
  currency: string;
  snapshot: SalesSnapshot;
  status_report: Record<string, StatusBreakdown>;
}

export type SalesReportPreset =
  | 'today'
  | 'yesterday'
  | 'last_7_days'
  | 'last_30_days'
  | 'this_month'
  | 'custom';

export async function fetchSalesReport(params: {
  preset: SalesReportPreset;
  date_from?: string;
  date_to?: string;
}): Promise<SalesReportResponse> {
  const qs = new URLSearchParams();
  qs.set('preset', params.preset);
  if (params.preset === 'custom' && params.date_from && params.date_to) {
    qs.set('date_from', params.date_from);
    qs.set('date_to', params.date_to);
  }
  return apiRequest<SalesReportResponse>(`/reports/sales?${qs.toString()}`);
}

export async function updateUsdExchangeRate(usdRate: number): Promise<{ usd_rate: number }> {
  return apiRequest<{ usd_rate: number }>('/reports/settings/usd-rate', {
    method: 'POST',
    body: JSON.stringify({ usd_rate: usdRate }),
  });
}
