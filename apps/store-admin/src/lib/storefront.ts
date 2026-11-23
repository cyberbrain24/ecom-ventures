import { StoreBrand } from '../types/store';
import { SessionStore } from './session';

/**
 * Optional port of the local development storefront, read from VITE_STOREFRONT_DEV_PORT.
 * It is only appended to local development hosts (*.localhost). No default is assumed.
 */
const STOREFRONT_DEV_PORT: string = (import.meta.env.VITE_STOREFRONT_DEV_PORT as string | undefined) || '5200';

/** Builds the store identity used by the views from the session's store record. */
export function toStoreBrand(store: SessionStore): StoreBrand {
  return {
    id: store.id,
    name: store.name,
    slug: store.slug,
    status: store.status,
    primaryDomain: store.primary_domain || '',
    currency: store.currency,
    timezone: store.timezone,
  };
}

/** True when the host is a local development host (exactly localhost or a *.localhost name). */
function isLocalHost(host: string): boolean {
  return host === 'localhost' || host.endsWith('.localhost');
}

/**
 * Public URL of the store's storefront, derived only from the store's primary domain.
 * Returns null when the primary domain is not set, so the caller can show "not set".
 */
export function getStorefrontUrl(store: Pick<StoreBrand, 'primaryDomain'>): string | null {
  const host = store.primaryDomain.trim().toLowerCase();
  if (host === '') return null;
  if (isLocalHost(host)) {
    return STOREFRONT_DEV_PORT ? `http://${host}:${STOREFRONT_DEV_PORT}` : `http://${host}`;
  }
  return `https://${host}`;
}
