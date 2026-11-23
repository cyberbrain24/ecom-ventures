import { StorefrontConfigResponse } from '../types/storefront';

/*
 * NEXT_PUBLIC_API_URL is inlined at build time. Production builds must provide it
 * (passed as a Docker build argument), so a build without it fails instead of
 * shipping a bundle that calls the shopper's own localhost. The localhost value
 * is a development-only default.
 */
// Base API URL with dynamic resolution supporting server-side container-to-host networking
function resolveApiBaseUrl(): string {
  if (typeof window === 'undefined') {
    const internal = process.env.INTERNAL_API_URL;
    if (internal) {
      const clean = internal.replace(/\/+$/, '');
      return clean.endsWith('/api/v1') ? clean : `${clean}/api/v1`;
    }
    return 'http://host.docker.internal:5000/api/v1';
  }
  const configured = process.env.NEXT_PUBLIC_API_URL || '';
  if (configured) {
    const clean = configured.replace(/\/+$/, '');
    return clean.endsWith('/api/v1') ? clean : `${clean}/api/v1`;
  }
  return 'https://api.dropiobd.com/api/v1';
}

const API_BASE_URL = resolveApiBaseUrl();

type StorefrontRequestInit = RequestInit & {
  next?: {
    revalidate?: number;
    tags?: string[];
  };
};

/** Error returned when the tenant API fails or sends an invalid response. */
export class StorefrontApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'StorefrontApiError';
  }
}

/**
 * Fetches tenant data from the backend and forwards the request host for tenant resolution.
 * API failures are thrown so pages never render another store's or fabricated data.
 */
export async function fetchStorefrontData<T>(
  host: string,
  path: string,
  init: StorefrontRequestInit = {}
): Promise<T> {
  let response: Response;
  try {
    const headers = new Headers(init.headers);
    headers.set('X-Forwarded-Host', host);
    headers.set('X-Original-Host', host);
    headers.set('Accept', 'application/json');
    response = await fetch(`${resolveApiBaseUrl()}${path}`, { ...init, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new StorefrontApiError(`Could not reach the store API: ${message}`, 0);
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new StorefrontApiError(
      response.ok ? 'The store API returned invalid JSON.' : `The store API returned HTTP ${response.status}.`,
      response.status
    );
  }

  const record = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : null;
  if (!response.ok) {
    const detail =
      record && typeof record.detail === 'string'
        ? record.detail
        : record && typeof record.title === 'string'
          ? record.title
          : `The store API returned HTTP ${response.status}.`;
    throw new StorefrontApiError(detail, response.status);
  }

  if (!record || record.success !== true || !('data' in record)) {
    throw new StorefrontApiError('The store API returned an unexpected response.', response.status);
  }
  return record.data as T;
}

/**
 * Loads the store-specific public configuration. A 404 means the requested host
 * has no registered active store; other failures propagate to the Next.js error boundary.
 */
export async function getStorefrontConfig(host: string): Promise<StorefrontConfigResponse | null> {
  // An empty host cannot identify a store, so it is treated as not registered.
  if (!host) return null;
  try {
    const data = await fetchStorefrontData<Record<string, unknown>>(host, '/storefront/config', {
      cache: 'no-store',
    });
    const store = data.store;
    const theme = data.theme;
    if (!store || !theme || typeof store !== 'object' || typeof theme !== 'object') {
      throw new StorefrontApiError('Store configuration is missing its store or assigned theme.', 502);
    }

    return {
      store: store as StorefrontConfigResponse['store'],
      domain: typeof data.domain === 'string' ? data.domain : host,
      is_custom_domain: Boolean(data.is_custom_domain),
      theme: theme as StorefrontConfigResponse['theme'],
      seo: data.seo as StorefrontConfigResponse['seo'],
    };
  } catch (error) {
    if (error instanceof StorefrontApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
