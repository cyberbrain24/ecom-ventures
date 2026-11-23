import React, { useState } from 'react';
import { LogIn } from 'lucide-react';
import { ApiError, login } from '../lib/api';
import { StoreSession, writeSession } from '../lib/session';

/** Props for the sign-in screen. */
interface LoginScreenProps {
  /** Message explaining why the panel is showing the sign-in screen (expired session, storage error). */
  notice: string | null;
  /** Store slug to prefill, taken from the ?store= query parameter when present. */
  initialSlug: string;
  /** Called with the saved session once the server accepted the credentials. */
  onSignedIn: (session: StoreSession) => void;
}

/** Describes an unexpected thrown value in plain words. */
function describeFailure(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Sign-in form for one store. It posts the credentials to the store's login endpoint and
 * saves the returned session. Nothing is shown as signed in until the server accepts the login.
 */
export const LoginScreen: React.FC<LoginScreenProps> = ({ notice, initialSlug, onSignedIn }) => {
  const [slug, setSlug] = useState<string>(initialSlug);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const storeSlug = slug.trim().toLowerCase();
    if (storeSlug === '' || email.trim() === '' || password === '') {
      setError('Enter the store slug, email and password.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const session = await login(storeSlug, email.trim(), password);
      const storageError = writeSession(session);
      if (storageError !== null) {
        setError(storageError);
        return;
      }
      onSignedIn(session);
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : describeFailure(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', color: 'var(--text-main)' }}>
          <LogIn size={18} />
          <span style={{ fontWeight: 800, fontSize: '1.05rem' }}>Store sign in</span>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>
          Sign in with a staff account of the store you want to manage.
        </p>

        {notice !== null && (
          <div className="notice notice-warning" role="status" style={{ marginBottom: '14px' }}>
            {notice}
          </div>
        )}
        {error !== null && (
          <div className="notice notice-error" role="alert" style={{ marginBottom: '14px' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-store-slug">Store slug</label>
            <input
              id="login-store-slug"
              className="form-input"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              autoComplete="organization"
              disabled={submitting}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className="form-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              disabled={submitting}
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Password</label>
            <input
              id="login-password"
              className="form-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              disabled={submitting}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
};
