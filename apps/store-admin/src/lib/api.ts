/**
 * Fetch-based client for the store-scoped backend API (/api/v1/store/{slug}/...).
 * Vite proxies /api to the Go API in development.
 */
import { clearSession, readSession, SessionStaff, SessionStore, StoreSession } from './session';

/** Base path shared by every backend endpoint. */
export const API_BASE_PATH = '/api/v1';

/** Error thrown for every failed API call. Carries the RFC 7807 fields the backend sent. */
export class ApiError extends Error {
  /** HTTP status, or 0 when the request never reached the server. */
  readonly status: number;
  /** Machine-readable code from the problem JSON; empty when the server sent none. */
  readonly code: string;
  /** Human-readable explanation, safe to show to the user. */
  readonly detail: string;
  /** True when the response body was a problem JSON written by the backend itself. */
  readonly isProblem: boolean;

  constructor(status: number, code: string, detail: string, isProblem: boolean) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.isProblem = isProblem;
  }
}

/** Payload of GET /store/{slug}/auth/me. */
export interface SessionIdentity {
  staff: SessionStaff;
  store: SessionStore;
}

interface TokenPair {
  access_token: string;
  refresh_token: string;
  expires_at: string;
}

interface LoginPayload extends SessionIdentity {
  tokens: TokenPair;
}

function storePath(slug: string, path: string): string {
  return `${API_BASE_PATH}/store/${encodeURIComponent(slug)}${path}`;
}

async function send(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new ApiError(0, 'NETWORK_ERROR', `Could not reach the server: ${reason}`, false);
  }
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text.trim() === '') return null;
  try {
    return JSON.parse(text);
  } catch (err) {
    if (response.ok) {
      const reason = err instanceof Error ? err.message : String(err);
      throw new ApiError(response.status, 'INVALID_RESPONSE', `The server sent a response that is not valid JSON: ${reason}`, false);
    }
    // A non-JSON error body (for example a proxy error page) is reported by status below.
    return null;
  }
}

async function parseEnvelope<T>(response: Response): Promise<T> {
  const body = await readBody(response);
  const record = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : null;

  if (!response.ok) {
    const code = record && typeof record.code === 'string' ? record.code : '';
    const problemDetail = record && typeof record.detail === 'string' ? record.detail : '';
    const title = record && typeof record.title === 'string' ? record.title : '';
    const detail = problemDetail || title || `The server answered with status ${response.status} ${response.statusText}`.trim();
    throw new ApiError(response.status, code, detail, code !== '' || problemDetail !== '');
  }

  if (!record || record.success !== true) {
    throw new ApiError(response.status, 'INVALID_RESPONSE', 'The server sent a response in an unexpected format.', false);
  }
  return record.data as T;
}

function requireIdentity(data: SessionIdentity | null | undefined, status: number): SessionIdentity {
  if (!data || !data.staff || !data.store || !data.store.slug || !data.store.id || !data.store.currency || !data.store.timezone) {
    throw new ApiError(status, 'INVALID_RESPONSE', 'The server response did not include the staff and store details.', false);
  }
  return data;
}

/**
 * Signs a staff member in to one store. Resolves with the session to persist.
 * Throws ApiError: 401 wrong credentials, 403 inactive account or suspended store,
 * 404 unknown store, 410 archived store.
 */
export async function login(slug: string, email: string, password: string): Promise<StoreSession> {
  const response = await send(storePath(slug, '/auth/login'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  const data = await parseEnvelope<LoginPayload>(response);
  const identity = requireIdentity(data, response.status);
  if (!data.tokens || !data.tokens.access_token) {
    throw new ApiError(response.status, 'INVALID_RESPONSE', 'The server response did not include an access token.', false);
  }
  return {
    slug: identity.store.slug,
    accessToken: data.tokens.access_token,
    refreshToken: data.tokens.refresh_token || '',
    staff: identity.staff,
    store: identity.store,
  };
}

/**
 * Calls a store endpoint with the signed-in staff member's Bearer token and
 * returns the `data` of the success envelope. `path` is relative to
 * /api/v1/store/{slug} and starts with a slash. A 401 ends the session
 * (store staff have no refresh endpoint) before the ApiError is thrown.
 */
export async function authorizedRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { session, error } = readSession();
  if (!session) {
    clearSession('expired');
    throw new ApiError(401, 'NO_SESSION', error || 'You are not signed in.', false);
  }

  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${session.accessToken}`);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined && init.body !== null && !(init.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await send(storePath(session.slug, path), { ...init, headers });
  if (response.status === 401) {
    clearSession('expired');
  }
  return parseEnvelope<T>(response);
}

export interface UploadedMediaResult {
  url: string;
  key?: string;
  size?: number;
}

/**
 * Uploads an image/media file for the active store to Cloudflare R2 (or configured storage).
 */
export async function uploadStoreMedia(
  file: File,
  module: 'categories' | 'products' | 'brand' | 'reviews' | 'blog' | 'general' = 'general',
  subPath = '',
): Promise<UploadedMediaResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('module', module);
  if (subPath) {
    formData.append('sub_path', subPath);
  }
  return authorizedRequest<UploadedMediaResult>('/media/upload', {
    method: 'POST',
    body: formData,
  });
}

/**
 * Deletes an uploaded store media file by storage key (e.g., when cancelling an unsaved product).
 */
export async function deleteStoreMedia(key: string): Promise<void> {
  if (!key) return;
  await authorizedRequest<{ deleted_key: string }>(`/media?key=${encodeURIComponent(key)}`, {
    method: 'DELETE',
  });
}

/**
 * Fetches the current staff member and store for the stored session.
 * Throws ApiError: 401 invalid or expired token, 404 or 410 store no longer available.
 */
export async function fetchCurrentSession(): Promise<SessionIdentity> {
  const data = await authorizedRequest<SessionIdentity>('/auth/me', { method: 'GET' });
  return requireIdentity(data, 200);
}

/** Payload of GET /store/{slug}/dashboard/overview. The server reports only these fields. */
export interface DashboardOverview {
  store_id: string;
  store_name: string;
  staff_user: string;
  role: string;
}

/**
 * Fetches the dashboard overview for the signed-in store. The endpoint currently returns
 * the store and caller identity only; no sales figures are shown because the server does not send them.
 */
export async function fetchDashboardOverview(): Promise<DashboardOverview> {
  const data = await authorizedRequest<DashboardOverview>('/dashboard/overview', { method: 'GET' });
  if (!data || typeof data.store_id !== 'string' || typeof data.store_name !== 'string') {
    throw new ApiError(200, 'INVALID_RESPONSE', 'The dashboard response did not include the store details.', false);
  }
  return data;
}
