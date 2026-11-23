import React, { useEffect, useState } from 'react';
import { Package, ShoppingBag, Users, Tag, Truck, CreditCard, ArrowUpRight } from 'lucide-react';
import { StoreBrand, StoreTab } from '../types/store';
import { ApiError, DashboardOverview, fetchDashboardOverview } from '../lib/api';
import { NotConnectedNotice } from './StoreStatusNotices';

/** Props for the dashboard overview. */
interface DashboardViewProps {
  currentStore: StoreBrand;
  onNavigateTab: (tab: StoreTab) => void;
}

/** Sales figures the dashboard will show once the orders and reporting endpoints are connected. */
const PENDING_METRICS: string[] = ['Revenue', 'Orders', 'Pending orders', 'Active products', 'Low stock', 'Customers', 'Average order value'];

/** Shortcut tiles that open the sections of the workspace. */
const SHORTCUTS: { tab: StoreTab; label: string; icon: React.ReactNode }[] = [
  { tab: 'orders', label: 'Orders & Pipeline', icon: <ShoppingBag size={16} /> },
  { tab: 'catalog', label: 'Products & Matrix', icon: <Package size={16} /> },
  { tab: 'customers', label: 'Customer Directory', icon: <Users size={16} /> },
  { tab: 'promotions', label: 'Promotions & Coupons', icon: <Tag size={16} /> },
  { tab: 'logistics', label: 'Courier Logistics', icon: <Truck size={16} /> },
  { tab: 'payments', label: 'Gateways & Ledger', icon: <CreditCard size={16} /> },
];

/** Load state of the overview request. */
type OverviewState =
  | { kind: 'loading' }
  | { kind: 'loaded'; overview: DashboardOverview }
  | { kind: 'failed'; message: string };

/**
 * Store dashboard. It shows the store identity returned by the overview endpoint and a shortcut to each section.
 * Sales figures are not shown because no endpoint supplies them yet.
 */
export const DashboardView: React.FC<DashboardViewProps> = ({ currentStore, onNavigateTab }) => {
  const [state, setState] = useState<OverviewState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState<number>(0);

  useEffect(() => {
    let active = true;
    setState({ kind: 'loading' });
    fetchDashboardOverview()
      .then((overview) => {
        if (active) setState({ kind: 'loaded', overview });
      })
      .catch((err: unknown) => {
        if (!active) return;
        // A 401 ends the session; the workspace then shows the sign-in screen.
        if (err instanceof ApiError && err.status === 401) return;
        setState({ kind: 'failed', message: err instanceof ApiError ? err.detail : String(err) });
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div>
        <h1 style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text-main)', margin: 0 }}>
          {currentStore.name}
        </h1>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>
          Store workspace for <span style={{ fontFamily: 'var(--font-mono)' }}>{currentStore.slug}</span>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Store overview</div>
        </div>
        <div style={{ padding: '16px 20px' }}>
          {state.kind === 'loading' && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Loading from the server...</div>}
          {state.kind === 'failed' && (
            <div>
              <div className="notice notice-error" role="alert" style={{ marginBottom: '10px' }}>
                The overview could not be loaded: {state.message}
              </div>
              <button className="btn btn-secondary btn-sm" onClick={() => setAttempt((n) => n + 1)}>
                Try again
              </button>
            </div>
          )}
          {state.kind === 'loaded' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              <div>
                <div className="stat-label">Store</div>
                <div className="stat-val" style={{ fontSize: '1rem' }}>{state.overview.store_name}</div>
              </div>
              <div>
                <div className="stat-label">Signed in as</div>
                <div className="stat-val" style={{ fontSize: '1rem' }}>{state.overview.staff_user}</div>
              </div>
              <div>
                <div className="stat-label">Role</div>
                <div className="stat-val" style={{ fontSize: '1rem' }}>{state.overview.role}</div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Sales figures</div>
        </div>
        <div style={{ padding: '16px 20px' }}>
          <NotConnectedNotice what="Sales figures" />
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Not shown yet: {PENDING_METRICS.join(', ')}.
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title">Sections</div>
        </div>
        <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
          {SHORTCUTS.map((shortcut) => (
            <button
              key={shortcut.tab}
              className="btn btn-secondary"
              onClick={() => onNavigateTab(shortcut.tab)}
              style={{ justifyContent: 'space-between' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {shortcut.icon}
                {shortcut.label}
              </span>
              <ArrowUpRight size={14} />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
