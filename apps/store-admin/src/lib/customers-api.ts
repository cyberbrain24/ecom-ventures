import { authorizedRequest } from './api';

export type MembershipTier = 'STANDARD' | 'SILVER' | 'GOLD' | 'VIP_BLACK';

export interface CustomerMetrics {
  total_orders: number;
  delivered_orders: number;
  cancelled_orders: number;
  rto_orders: number;
  reliability_score: number;
  rto_rate: number;
  lifetime_value: number;
  average_order_value: number;
  last_order_date?: string;
}

export interface CustomerSummary {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  membership_tier: MembershipTier;
  is_active: boolean;
  is_blacklisted: boolean;
  blacklist_reason: string;
  city?: string;
  district?: string;
  thana?: string;
  metrics: CustomerMetrics;
  created_at: string;
  updated_at: string;
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  label: string;
  recipient_name: string;
  phone: string;
  street_address: string;
  apartment_suite?: string;
  city: string;
  district: string;
  thana: string;
  state_province?: string;
  postal_code?: string;
  country: string;
  is_default_shipping: boolean;
  is_default_billing: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerOrderSummary {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  total_amount: number;
  item_count: number;
  created_at: string;
}

export interface CustomerDetail {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  membership_tier: MembershipTier;
  date_of_birth?: string;
  crm_notes: string;
  is_blacklisted: boolean;
  blacklist_reason: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  metrics: CustomerMetrics;
  addresses: CustomerAddress[];
  recent_orders: CustomerOrderSummary[];
}

export interface PaginatedCustomersResponse {
  customers: CustomerSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface CustomerFilterParams {
  search?: string;
  membership_tier?: string;
  is_active?: boolean;
  is_blacklisted?: boolean;
  page?: number;
  limit?: number;
}

export interface CreateCustomerPayload {
  first_name: string;
  last_name: string;
  phone?: string;
  email?: string;
  membership_tier?: MembershipTier;
  date_of_birth?: string;
  crm_notes?: string;
}

export interface UpdateCRMProfilePayload {
  membership_tier: MembershipTier;
  date_of_birth?: string;
  crm_notes: string;
}

export interface ToggleBlacklistPayload {
  is_blacklisted: boolean;
  reason: string;
}

export interface ImpersonateCustomerResponse {
  customer_token: string;
  expires_in_seconds: number;
  redirect_url: string;
}

/**
 * Lists customers with search and filters from active tenant DB.
 */
export async function fetchCustomers(filters: CustomerFilterParams = {}): Promise<PaginatedCustomersResponse> {
  const query = new URLSearchParams();
  if (filters.page) query.set('page', String(filters.page));
  if (filters.limit) query.set('limit', String(filters.limit));
  if (filters.search) query.set('search', filters.search);
  if (filters.membership_tier && filters.membership_tier !== 'ALL') {
    query.set('membership_tier', filters.membership_tier);
  }
  if (typeof filters.is_active === 'boolean') {
    query.set('is_active', String(filters.is_active));
  }
  if (typeof filters.is_blacklisted === 'boolean') {
    query.set('is_blacklisted', String(filters.is_blacklisted));
  }

  const endpoint = `/customers${query.toString() ? `?${query.toString()}` : ''}`;
  return authorizedRequest<PaginatedCustomersResponse>(endpoint, { method: 'GET' });
}

/**
 * Retrieves full customer CRM profile with addresses and metrics.
 */
export async function fetchCustomerDetail(customerId: string): Promise<CustomerDetail> {
  return authorizedRequest<CustomerDetail>(`/customers/${customerId}`, { method: 'GET' });
}

/**
 * Creates a new customer account manually.
 */
export async function createCustomer(payload: CreateCustomerPayload): Promise<CustomerDetail> {
  return authorizedRequest<CustomerDetail>('/customers', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Updates customer CRM profile notes, birthdate, and membership tier.
 */
export async function updateCustomerCRM(customerId: string, payload: UpdateCRMProfilePayload): Promise<CustomerDetail> {
  return authorizedRequest<CustomerDetail>(`/customers/${customerId}/crm`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

/**
 * Toggles customer blacklisting / soft deactivation with reason.
 */
export async function toggleCustomerBlacklist(customerId: string, payload: ToggleBlacklistPayload): Promise<void> {
  return authorizedRequest<void>(`/customers/${customerId}/blacklist`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/**
 * Generates storefront impersonation token for 1-click debugging.
 */
export async function impersonateCustomer(customerId: string): Promise<ImpersonateCustomerResponse> {
  return authorizedRequest<ImpersonateCustomerResponse>(`/customers/${customerId}/impersonate`, {
    method: 'POST',
  });
}

/**
 * Deletes customer account. Fails with HTTP 422 if orders exist.
 */
export async function deleteCustomer(customerId: string): Promise<void> {
  return authorizedRequest<void>(`/customers/${customerId}`, {
    method: 'DELETE',
  });
}
