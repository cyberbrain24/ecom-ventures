/**
 * Browser-side session persistence for the Store Admin panel.
 * One signed-in staff member of one store is kept under a single localStorage key.
 */

/** Staff member as returned by the store auth endpoints. */
export interface SessionStaff {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

/** Store identity as returned by the store auth endpoints. */
export interface SessionStore {
  id: string;
  name: string;
  slug: string;
  status: string;
  currency: string;
  timezone: string;
  primary_domain: string | null;
}

/** Everything the panel keeps about the signed-in staff member and their store. */
export interface StoreSession {
  slug: string;
  accessToken: string;
  refreshToken: string;
  staff: SessionStaff;
  store: SessionStore;
}

/** Why a session ended. Drives the message shown on the login screen. */
export type SessionEndReason = 'signed_out' | 'expired' | 'store_gone';

/** Result of reading the stored session: the session (if any) and a storage error (if any). */
export interface SessionReadResult {
  session: StoreSession | null;
  error: string | null;
}

/** The single localStorage key that holds the Store Admin session. */
export const SESSION_STORAGE_KEY = 'ecom_store_admin_session';

type SessionEndListener = (reason: SessionEndReason, storageError: string | null) => void;

const listeners = new Set<SessionEndListener>();

function describeError(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isStoreSession(value: unknown): value is StoreSession {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  const staff = v.staff as Record<string, unknown> | null | undefined;
  const store = v.store as Record<string, unknown> | null | undefined;
  return (
    isNonEmptyString(v.slug) &&
    isNonEmptyString(v.accessToken) &&
    typeof v.refreshToken === 'string' &&
    typeof staff === 'object' &&
    staff !== null &&
    isNonEmptyString(staff.id) &&
    typeof staff.email === 'string' &&
    typeof store === 'object' &&
    store !== null &&
    isNonEmptyString(store.id) &&
    isNonEmptyString(store.slug) &&
    typeof store.name === 'string' &&
    isNonEmptyString(store.currency) &&
    isNonEmptyString(store.timezone)
  );
}

/**
 * Reads the stored session. Returns a null session when nothing is stored or the
 * stored value is unusable; in the second case `error` explains why.
 */
export function readSession(): SessionReadResult {
  let raw: string | null;
  try {
    raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
  } catch (err) {
    return { session: null, error: `Browser storage is unavailable: ${describeError(err)}` };
  }
  if (raw === null) return { session: null, error: null };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    return { session: null, error: `The saved session could not be read: ${describeError(err)}` };
  }
  if (!isStoreSession(parsed)) {
    return { session: null, error: 'The saved session is incomplete. Please sign in again.' };
  }
  return { session: parsed, error: null };
}

/**
 * Persists the session. Returns null on success or an error message when the
 * browser refused to store it (the caller must show that message).
 */
export function writeSession(session: StoreSession): string | null {
  try {
    window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    return null;
  } catch (err) {
    return `The session could not be saved in this browser: ${describeError(err)}`;
  }
}

/**
 * Removes the stored session and tells every subscriber why it ended, so the
 * app can show the login screen with the right message.
 */
export function clearSession(reason: SessionEndReason): void {
  let storageError: string | null = null;
  try {
    window.localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (err) {
    storageError = `The saved session could not be removed from this browser: ${describeError(err)}`;
  }
  listeners.forEach((listener) => listener(reason, storageError));
}

/**
 * Subscribes to session-ended events (sign out, expired token, deleted store).
 * Returns the unsubscribe function.
 */
export function subscribeSessionEnd(listener: SessionEndListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
