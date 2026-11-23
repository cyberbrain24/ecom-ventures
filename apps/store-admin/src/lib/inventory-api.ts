import { authorizedRequest } from './api';

export interface InventoryItem {
  variant_id: string;
  product_id: string;
  sku: string;
  product_title: string;
  variant_title: string;
  quantity_on_hand: number;
  quantity_reserved: number;
  quantity_available: number;
  low_stock_threshold: number;
  is_low_stock: boolean;
  updated_at: string;
}

export interface InventoryMovementItem {
  id: string;
  variant_id: string;
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  reason: string;
  reference_id?: string;
  notes?: string;
  performed_by?: string;
  created_at: string;
}

export interface InventoryListResponse {
  items: InventoryItem[];
  total: number;
  page: number;
  limit: number;
}

export interface MovementsListResponse {
  movements: InventoryMovementItem[];
  total: number;
  page: number;
  limit: number;
}

export async function fetchInventoryItems(
  params?: { search?: string; is_low_stock?: boolean; page?: number; limit?: number }
): Promise<InventoryListResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.is_low_stock !== undefined) query.set('is_low_stock', String(params.is_low_stock));
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  return authorizedRequest<InventoryListResponse>(`/inventory${qs ? `?${qs}` : ''}`);
}

export async function fetchInventoryMovements(
  params?: { variant_id?: string; reason?: string; page?: number; limit?: number }
): Promise<MovementsListResponse> {
  const query = new URLSearchParams();
  if (params?.variant_id) query.set('variant_id', params.variant_id);
  if (params?.reason) query.set('reason', params.reason);
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  return authorizedRequest<MovementsListResponse>(`/inventory/movements${qs ? `?${qs}` : ''}`);
}

export async function adjustInventoryStock(
  variantId: string,
  quantityChange: number,
  reason: string,
  notes?: string
): Promise<void> {
  await authorizedRequest<void>('/inventory/adjust', {
    method: 'POST',
    body: JSON.stringify({
      variant_id: variantId,
      quantity_change: quantityChange,
      reason,
      notes,
    }),
  });
}
