import { authorizedRequest } from './api';
import {
  PaginatedAbandonedResponse,
  AbandonedCheckoutStatus,
} from '../types/store';

/**
 * Fetches the paginated list of abandoned checkouts with operational metrics.
 */
export async function fetchAbandonedCheckouts(
  status = 'ALL',
  page = 1,
  limit = 20
): Promise<PaginatedAbandonedResponse> {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (status && status !== 'ALL') {
    query.set('status', status.toLowerCase());
  }

  return authorizedRequest<PaginatedAbandonedResponse>(
    `/orders/abandoned?${query.toString()}`,
    { method: 'GET' }
  );
}

/**
 * Updates tele-sales outreach status and notes.
 */
export async function updateAbandonedStatus(
  dropId: string,
  payload: {
    status: AbandonedCheckoutStatus;
    call_notes: string;
    scheduled_callback_at?: string;
  }
): Promise<{ status: string; message: string }> {
  return authorizedRequest<{ status: string; message: string }>(
    `/orders/abandoned/${encodeURIComponent(dropId)}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }
  );
}

/**
 * Executes 1-click order genesis from tele-sales.
 */
export async function convertAbandonedToOrder(
  dropId: string,
  payload: {
    customer_name?: string;
    phone?: string;
    customer_email?: string;
    district?: string;
    thana?: string;
    address?: string;
    payment_method?: string;
    notes?: string;
  } = {}
): Promise<any> {
  return authorizedRequest<any>(
    `/orders/abandoned/${encodeURIComponent(dropId)}/convert`,
    {
      method: 'POST',
      body: JSON.stringify(payload),
    }
  );
}
