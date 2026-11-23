/**
 * Fetches portfolio totals from the platform API. Counts come from the `meta.total`
 * field of the store list endpoint, never from the rows currently loaded on a page.
 */

import { api } from './api';
import { PaginatedStoresResponse, StoreStatus } from '../types/store';

/**
 * Returns the number of stores matching an optional status, as reported by the API.
 * Throws when the response does not contain a total, so callers show an error instead of a guess.
 *
 * @param status - Optional lifecycle status filter; omit for all stores
 * @returns Total number of matching stores
 */
export async function fetchStoreTotal(status?: StoreStatus): Promise<number> {
  const params = new URLSearchParams({ page: '1', limit: '1' });
  if (status) {
    params.append('status', status);
  }
  const res = await api.get<PaginatedStoresResponse>(`/platform/stores?${params.toString()}`);
  const total = res.data?.meta?.total;
  if (typeof total !== 'number') {
    throw new Error('The server did not return a store total.');
  }
  return total;
}
