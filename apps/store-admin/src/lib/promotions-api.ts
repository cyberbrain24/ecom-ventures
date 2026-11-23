import { authorizedRequest } from './api';

export type DiscountType = 'PERCENTAGE' | 'FIXED_AMOUNT' | 'FREE_SHIPPING';

export interface CouponItem {
  id: string;
  code: string;
  description: string;
  discount_type: DiscountType;
  discount_value: number;
  min_subtotal: number;
  max_discount_amount?: number;
  max_uses: number;
  max_uses_per_customer: number;
  times_used: number;
  valid_from: string;
  valid_to: string;
  is_active: boolean;
  applicable_category_ids: string[];
  included_product_ids: string[];
  excluded_product_ids: string[];
  created_at: string;
  updated_at: string;
}

export interface CouponListResponse {
  coupons: CouponItem[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateCouponPayload {
  code: string;
  description?: string;
  discount_type: DiscountType;
  discount_value: number;
  min_subtotal: number;
  max_discount_amount?: number;
  max_uses: number;
  max_uses_per_customer: number;
  valid_from: string;
  valid_to: string;
  is_active: boolean;
  applicable_category_ids: string[];
  included_product_ids: string[];
  excluded_product_ids: string[];
}

export interface UpdateCouponPayload {
  description?: string;
  min_subtotal: number;
  max_discount_amount?: number;
  max_uses: number;
  max_uses_per_customer: number;
  valid_from: string;
  valid_to: string;
  is_active: boolean;
  applicable_category_ids: string[];
  included_product_ids: string[];
  excluded_product_ids: string[];
}

export interface BundleTierItem {
  id: string;
  name: string;
  min_items: number;
  discount_percentage: number;
  free_shipping: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export async function fetchCoupons(
  storeSlug: string,
  params?: { search?: string; is_active?: boolean; page?: number; limit?: number }
): Promise<CouponListResponse> {
  const query = new URLSearchParams();
  if (params?.search) query.set('search', params.search);
  if (params?.is_active !== undefined) query.set('is_active', String(params.is_active));
  if (params?.page) query.set('page', String(params.page));
  if (params?.limit) query.set('limit', String(params.limit));

  const qs = query.toString();
  const endpoint = `/promotions/coupons${qs ? `?${qs}` : ''}`;
  return authorizedRequest<CouponListResponse>(endpoint);
}

export async function createCoupon(
  _storeSlug: string,
  payload: CreateCouponPayload
): Promise<CouponItem> {
  return authorizedRequest<CouponItem>(`/promotions/coupons`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateCoupon(
  _storeSlug: string,
  id: string,
  payload: UpdateCouponPayload
): Promise<CouponItem> {
  return authorizedRequest<CouponItem>(`/promotions/coupons/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function toggleCouponStatus(
  _storeSlug: string,
  id: string,
  isActive: boolean
): Promise<{ success: boolean; is_active: boolean }> {
  return authorizedRequest<{ success: boolean; is_active: boolean }>(
    `/promotions/coupons/${id}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive }),
    }
  );
}

export async function deleteCoupon(_storeSlug: string, id: string): Promise<void> {
  await authorizedRequest<void>(`/promotions/coupons/${id}`, {
    method: 'DELETE',
  });
}

export async function fetchBundleTiers(_storeSlug: string): Promise<BundleTierItem[]> {
  return authorizedRequest<BundleTierItem[]>(`/promotions/bundle-tiers`);
}
