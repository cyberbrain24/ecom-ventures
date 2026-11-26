import React, { useEffect, useState, Suspense, lazy } from 'react';
import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingBag,
  Users,
  Tag,
  Truck,
  CreditCard,
  BarChart3,
  Settings,
  Headphones,
  CheckSquare,
  ExternalLink,
  Store,
  Palette,
  Menu,
  X,
  DollarSign,
  FileText,
  MapPin,
  TrendingUp,
  LogOut,
  FileBarChart2,
} from 'lucide-react';

import { StoreTab } from './types/store';
import { ApiError, fetchCurrentSession } from './lib/api';
import {
  SessionEndReason,
  StoreSession,
  clearSession,
  readSession,
  subscribeSessionEnd,
  writeSession,
} from './lib/session';
import { getStorefrontUrl, toStoreBrand } from './lib/storefront';
import { LoginScreen } from './components/LoginScreen';

// Code-split dynamic view imports
const DashboardView = lazy(() => import('./components/DashboardView').then((m) => ({ default: m.DashboardView })));
const CatalogView = lazy(() => import('./components/CatalogView').then((m) => ({ default: m.CatalogView })));
const InventoryView = lazy(() => import('./components/InventoryView').then((m) => ({ default: m.InventoryView })));
const OrdersView = lazy(() => import('./components/OrdersView').then((m) => ({ default: m.OrdersView })));
const TasksWorkstation = lazy(() => import('./components/TasksWorkstation').then((m) => ({ default: m.TasksWorkstation })));
const BusinessAnalyticsView = lazy(() => import('./components/BusinessAnalyticsView').then((m) => ({ default: m.BusinessAnalyticsView })));
const SalesReportsView = lazy(() => import('./components/SalesReportsView').then((m) => ({ default: m.SalesReportsView })));
const MetaAdsModule = lazy(() => import('./components/MetaAdsModule').then((m) => ({ default: m.MetaAdsModule })));
const CustomersView = lazy(() => import('./components/CustomersView').then((m) => ({ default: m.CustomersView })));
const PromotionsView = lazy(() => import('./components/PromotionsView').then((m) => ({ default: m.PromotionsView })));
const BlogView = lazy(() => import('./components/BlogView').then((m) => ({ default: m.BlogView })));
const LogisticsView = lazy(() => import('./components/LogisticsView').then((m) => ({ default: m.LogisticsView })));
const ShippingZonesView = lazy(() => import('./components/ShippingZonesView').then((m) => ({ default: m.ShippingZonesView })));
const PaymentsView = lazy(() => import('./components/PaymentsView').then((m) => ({ default: m.PaymentsView })));
const AccountsView = lazy(() => import('./components/AccountsView').then((m) => ({ default: m.AccountsView })));
const MarketingView = lazy(() => import('./components/MarketingView').then((m) => ({ default: m.MarketingView })));
const ThemeView = lazy(() => import('./components/ThemeView').then((m) => ({ default: m.ThemeView })));
const MusicModule = lazy(() => import('./components/MusicModule').then((m) => ({ default: m.MusicModule })));
const SettingsView = lazy(() => import('./components/SettingsView').then((m) => ({ default: m.SettingsView })));

const ViewSkeleton: React.FC = () => (
  <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
    <div style={{ height: '32px', width: '220px', background: '#e2e8f0', borderRadius: '8px' }} />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
      <div style={{ height: '96px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
      <div style={{ height: '96px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
      <div style={{ height: '96px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
    </div>
    <div style={{ height: '420px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
  </div>
);

/**
 * The panel's authentication state. Only `ready` renders the store workspace, and only
 * after the server confirmed the saved session.
 */
type AuthPhase =
  | { kind: 'checking' }
  | { kind: 'signed_out'; notice: string | null }
  | { kind: 'unavailable'; message: string }
  | { kind: 'ready'; session: StoreSession };

/** Explains why a session ended, for the sign-in screen. Returns null when no message is needed. */
function describeSessionEnd(reason: SessionEndReason, storageError: string | null): string | null {
  const parts: string[] = [];
  if (reason === 'expired') parts.push('Your session has expired. Sign in again.');
  if (reason === 'store_gone') parts.push('This store is no longer available.');
  if (storageError !== null) parts.push(storageError);
  return parts.length > 0 ? parts.join(' ') : null;
}

/** Describes an unexpected thrown value in plain words. */
function describeFailure(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Two-letter initials for the signed-in staff member, taken from the name or the email. */
function initialsOf(session: StoreSession): string {
  const name = `${session.staff.first_name} ${session.staff.last_name}`.trim();
  const source = name !== '' ? name : session.staff.email;
  return source
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

/** Display name for the signed-in staff member. */
function staffDisplayName(session: StoreSession): string {
  const name = `${session.staff.first_name} ${session.staff.last_name}`.trim();
  return name !== '' ? name : session.staff.email;
}

export const App: React.FC = () => {
  const [phase, setPhase] = useState<AuthPhase>({ kind: 'checking' });
  const [attempt, setAttempt] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<StoreTab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Restore and verify the saved session. Nothing is shown as signed in until the server confirms it.
  useEffect(() => {
    let active = true;
    const unsubscribe = subscribeSessionEnd((reason, storageError) => {
      if (!active) return;
      setPhase({ kind: 'signed_out', notice: describeSessionEnd(reason, storageError) });
    });

    const stored = readSession();
    if (stored.session === null) {
      setPhase({ kind: 'signed_out', notice: stored.error });
    } else {
      const saved = stored.session;
      setPhase({ kind: 'checking' });
      fetchCurrentSession()
        .then((identity) => {
          if (!active) return;
          const confirmed: StoreSession = {
            ...saved,
            slug: identity.store.slug,
            staff: identity.staff,
            store: identity.store,
          };
          const storageError = writeSession(confirmed);
          if (storageError !== null) {
            setPhase({ kind: 'unavailable', message: storageError });
            return;
          }
          setPhase({ kind: 'ready', session: confirmed });
        })
        .catch((err: unknown) => {
          if (!active) return;
          // A 401 has already ended the session and the subscriber shows the sign-in screen.
          if (err instanceof ApiError && err.status === 401) return;
          setPhase({
            kind: 'unavailable',
            message: err instanceof ApiError ? err.detail : describeFailure(err),
          });
        });
    }

    return () => {
      active = false;
      unsubscribe();
    };
  }, [attempt]);

  if (phase.kind === 'checking') {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' }}>Checking your session with the server...</p>
        </div>
      </div>
    );
  }

  if (phase.kind === 'signed_out') {
    return (
      <LoginScreen
        notice={phase.notice}
        initialSlug={new URLSearchParams(window.location.search).get('store') ?? ''}
        onSignedIn={(session) => {
          setActiveTab('dashboard');
          setPhase({ kind: 'ready', session });
        }}
      />
    );
  }

  if (phase.kind === 'unavailable') {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <div style={{ fontWeight: 800, fontSize: '1.02rem', marginBottom: '12px' }}>Store workspace unavailable</div>
          <div className="notice notice-error" role="alert" style={{ marginBottom: '16px' }}>
            {phase.message}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-primary" onClick={() => setAttempt((n) => n + 1)}>
              Try again
            </button>
            <button className="btn btn-secondary" onClick={() => clearSession('signed_out')}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <StoreWorkspace session={phase.session} onSignOut={() => clearSession('signed_out')} activeTab={activeTab} setActiveTab={setActiveTab} mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />;
};

/** Props for the store workspace shell. */
interface StoreWorkspaceProps {
  session: StoreSession;
  onSignOut: () => void;
  activeTab: StoreTab;
  setActiveTab: (tab: StoreTab) => void;
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
}

/**
 * Store workspace shell: navigation, identity of the signed-in staff member and store, and the active view.
 * Views receive the store from the session. Records are not loaded from the server yet, so lists are empty
 * and actions that need an endpoint are disabled inside each view.
 */
const StoreWorkspace: React.FC<StoreWorkspaceProps> = ({
  session,
  onSignOut,
  activeTab,
  setActiveTab,
  mobileMenuOpen,
  setMobileMenuOpen,
}) => {
  const currentStore = toStoreBrand(session.store);
  const storefrontUrl = getStorefrontUrl(currentStore);

  const handleTabSelect = (tab: StoreTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  const storefrontLink =
    storefrontUrl === null ? (
      <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Storefront domain not set</span>
    ) : (
      <a
        href={storefrontUrl}
        target="_blank"
        rel="noreferrer"
        style={{
          marginTop: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '6px',
          padding: '7px 12px',
          backgroundColor: '#131b2e',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: 'var(--radius-sm)',
          color: '#38bdf8',
          fontSize: '0.78rem',
          fontWeight: 600,
          textDecoration: 'none',
        }}
      >
        <span>Open storefront</span>
        <ExternalLink size={13} />
      </a>
    );

  return (
    <div className="app-container">
      {/* Mobile/Tablet Top Navigation Bar (< 1024px Viewports) */}
      <header className="mobile-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="mobile-hamburger-btn"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
            <div className="brand-icon-box" style={{ width: '28px', height: '28px', fontSize: '0.82rem', flexShrink: 0 }}>
              {currentStore.name.substring(0, 1)}
            </div>
            <div style={{ lineHeight: 1.15, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#ffffff', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentStore.name}
              </div>
              <div style={{ fontSize: '0.66rem', color: '#94a3b8', fontWeight: 600 }}>{currentStore.slug}</div>
            </div>
          </div>
        </div>

        {/* Right side mobile actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {storefrontUrl && (
            <a
              href={storefrontUrl}
              target="_blank"
              rel="noreferrer"
              className="mobile-storefront-btn"
              title="Open Live Storefront"
              aria-label="Open Live Storefront"
            >
              <ExternalLink size={16} />
            </a>
          )}
          <div
            className="brand-icon-box"
            style={{
              width: '32px',
              height: '32px',
              background: '#1e293b',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#38bdf8',
              fontSize: '0.75rem',
              fontWeight: 800,
            }}
            title={staffDisplayName(session)}
          >
            {initialsOf(session)}
          </div>
          <button
            onClick={onSignOut}
            className="mobile-hamburger-btn"
            style={{ width: '34px', height: '34px', minWidth: '34px', minHeight: '34px' }}
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && <div onClick={() => setMobileMenuOpen(false)} className="mobile-sidebar-backdrop" aria-hidden="true" />}

      {/* Left Sidebar / Off-Canvas Drawer */}
      <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand-section">
          <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'stretch', justifyContent: 'space-between' }}>
            <div className="brand-badge">
              <div className="brand-icon-box">{currentStore.name.substring(0, 1)}</div>
              <div>
                <div className="brand-title">{currentStore.name}</div>
                <div className="brand-subtitle">
                  <Store size={12} /> {currentStore.slug}
                </div>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button onClick={() => setMobileMenuOpen(false)} className="mobile-sidebar-close-btn" aria-label="Close navigation">
              <X size={18} />
            </button>
          </div>

          {storefrontLink}
        </div>

        {/* Navigation Sections */}
        <nav className="sidebar-nav">
          <div className="nav-section-title">Overview</div>
          <button onClick={() => handleTabSelect('dashboard')} className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}>
            <div className="nav-item-inner">
              <LayoutDashboard size={14} />
              <span>Dashboard</span>
            </div>
          </button>

          <div className="nav-section-title">Store Catalog</div>
          <button onClick={() => handleTabSelect('catalog')} className={`nav-item ${activeTab === 'catalog' ? 'active' : ''}`}>
            <div className="nav-item-inner">
              <Package size={14} />
              <span>Products & Matrix</span>
            </div>
          </button>

          <button onClick={() => handleTabSelect('inventory')} className={`nav-item ${activeTab === 'inventory' ? 'active' : ''}`}>
            <div className="nav-item-inner">
              <Boxes size={14} />
              <span>Inventory & Stocks</span>
            </div>
          </button>

          <div className="nav-section-title">Sales & Orders</div>
          <button onClick={() => handleTabSelect('orders')} className={`nav-item ${activeTab === 'orders' ? 'active' : ''}`}>
            <div className="nav-item-inner">
              <ShoppingBag size={14} />
              <span>Orders & Pipeline</span>
            </div>
          </button>

          <button onClick={() => handleTabSelect('tasks')} className={`nav-item ${activeTab === 'tasks' ? 'active' : ''}`}>
            <div className="nav-item-inner">
              <CheckSquare size={14} />
              <span>Tasks & Operations</span>
            </div>
          </button>

          <button onClick={() => handleTabSelect('sales-reports')} className={`nav-item ${activeTab === 'sales-reports' ? 'active' : ''}`}>
            <div className="nav-item-inner">
              <FileBarChart2 size={14} />
              <span>Sales Reports</span>
            </div>
          </button>

          <button onClick={() => handleTabSelect('analytics')} className={`nav-item ${activeTab === 'analytics' ? 'active' : ''}`}>
            <div className="nav-item-inner">
              <BarChart3 size={14} />
              <span>Business Analytics</span>
            </div>
          </button>

          <button onClick={() => handleTabSelect('meta-ads')} className={`nav-item ${activeTab === 'meta-ads' ? 'active' : ''}`}>
            <div className="nav-item-inner">
              <TrendingUp size={14} />
              <span>Meta Ads & CDP</span>
            </div>
          </button>

          <button onClick={() => handleTabSelect('customers')} className={`nav-item ${activeTab === 'customers' ? 'active' : ''}`}>
            <div className="nav-item-inner">
              <Users size={14} />
              <span>Customer Directory</span>
            </div>
          </button>

          <div className="nav-section-title">Growth & Automation</div>
          <button onClick={() => handleTabSelect('promotions')} className={`nav-item ${activeTab === 'promotions' ? 'active' : ''}`}>
            <div className="nav-item-inner">
              <Tag size={14} />
              <span>Promotions & Coupons</span>
            </div>
          </button>

          <button onClick={() => handleTabSelect('accounts')} className={`nav-item ${activeTab === 'accounts' ? 'active' : ''}`}>
            <div className="nav-item-inner">
              <DollarSign size={14} />
              <span>Accounts & P&L</span>
            </div>
          </button>

          <button onClick={() => handleTabSelect('blog')} className={`nav-item ${activeTab === 'blog' ? 'active' : ''}`}>
            <div className="nav-item-inner">
              <FileText size={14} />
              <span>Blog & SEO Hub</span>
            </div>
          </button>

          <div className="nav-section-title">API & Integrations</div>
          <button onClick={() => handleTabSelect('logistics')} className={`nav-item ${activeTab === 'logistics' ? 'active' : ''}`}>
            <div className="nav-item-inner">
              <Truck size={14} />
              <span>Courier Logistics</span>
            </div>
          </button>

          <button onClick={() => handleTabSelect('shipping')} className={`nav-item ${activeTab === 'shipping' ? 'active' : ''}`}>
            <div className="nav-item-inner">
              <MapPin size={14} />
              <span>Locations & Delivery Zones</span>
            </div>
          </button>

          <button onClick={() => handleTabSelect('payments')} className={`nav-item ${activeTab === 'payments' ? 'active' : ''}`}>
            <div className="nav-item-inner">
              <CreditCard size={14} />
              <span>Payment Gateways & Ledger</span>
            </div>
          </button>

          <button onClick={() => handleTabSelect('marketing')} className={`nav-item ${activeTab === 'marketing' ? 'active' : ''}`}>
            <div className="nav-item-inner">
              <BarChart3 size={14} />
              <span>Marketing Telemetry & Pixels</span>
            </div>
          </button>

          <div className="nav-section-title">Branding & System</div>
          <button onClick={() => handleTabSelect('music')} className={`nav-item ${activeTab === 'music' ? 'active' : ''}`}>
            <div className="nav-item-inner">
              <Headphones size={14} />
              <span>Music & Soundscape</span>
            </div>
          </button>

          <button onClick={() => handleTabSelect('theme')} className={`nav-item ${activeTab === 'theme' ? 'active' : ''}`}>
            <div className="nav-item-inner">
              <Palette size={14} />
              <span>Theme Appearance</span>
            </div>
          </button>

          <button onClick={() => handleTabSelect('settings')} className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}>
            <div className="nav-item-inner">
              <Settings size={14} />
              <span>Store Settings & Staff</span>
            </div>
          </button>
        </nav>

        {/* Signed-in staff member and store status (from the server session) */}
        <div className="sidebar-footer" style={{ padding: '14px 16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', backgroundColor: '#060911' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#059669',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.8rem',
                flexShrink: 0,
              }}
            >
              {initialsOf(session)}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {staffDisplayName(session)}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#10b981', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {session.staff.role}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.74rem', color: '#94a3b8', borderTop: '1px solid rgba(255, 255, 255, 0.06)', paddingTop: '8px', fontFamily: 'var(--font-mono)' }}>
            <span>Store status</span>
            <span style={{ color: session.store.status === 'ACTIVE' ? '#10b981' : '#fbbf24', fontWeight: 700 }}>{session.store.status}</span>
          </div>

          <button
            onClick={onSignOut}
            className="btn btn-secondary btn-sm"
            style={{ width: '100%', marginTop: '10px' }}
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="main-content" style={{ backgroundColor: '#EAEEF2' }}>
        <div className="content-body" style={{ backgroundColor: '#EAEEF2' }}>
          <Suspense fallback={<ViewSkeleton />}>
            {activeTab === 'dashboard' && <DashboardView currentStore={currentStore} onNavigateTab={(tab) => setActiveTab(tab)} />}

            {activeTab === 'catalog' && <CatalogView currentStore={currentStore} />}

            {activeTab === 'inventory' && <InventoryView currentStore={currentStore} products={[]} movements={[]} />}

            {activeTab === 'orders' && <OrdersView currentStore={currentStore} orders={[]} />}

            {activeTab === 'tasks' && (
              <TasksWorkstation
                currentStore={currentStore}
                currentUserId={session.staff.id}
                userRole={session.staff.role}
              />
            )}

            {activeTab === 'sales-reports' && <SalesReportsView currentStore={currentStore} />}

            {activeTab === 'analytics' && <BusinessAnalyticsView currentStore={currentStore} />}

            {activeTab === 'meta-ads' && <MetaAdsModule currentStore={currentStore} />}

            {activeTab === 'customers' && <CustomersView currentStore={currentStore} customers={[]} products={[]} reviews={[]} />}

            {activeTab === 'promotions' && <PromotionsView currentStore={currentStore} coupons={[]} bundleTiers={[]} />}

            {activeTab === 'logistics' && <LogisticsView currentStore={currentStore} couriers={[]} shipments={[]} />}

            {activeTab === 'shipping' && <ShippingZonesView currentStore={currentStore} role={session.staff.role} />}

            {activeTab === 'payments' && <PaymentsView currentStore={currentStore} gateways={[]} transactions={[]} />}

            {activeTab === 'accounts' && (
              <AccountsView currentStore={currentStore} transactions={[]} expenses={[]} payouts={[]} reconciliations={[]} />
            )}

            {activeTab === 'marketing' && <MarketingView currentStore={currentStore} marketing={null} />}

            {activeTab === 'blog' && <BlogView currentStore={currentStore} posts={[]} categories={[]} />}

            {activeTab === 'theme' && <ThemeView currentStore={currentStore} themeConfig={null} />}

            {activeTab === 'music' && <MusicModule currentStore={currentStore} />}

            {activeTab === 'settings' && <SettingsView currentStore={currentStore} settings={null} />}
          </Suspense>
        </div>
      </main>
    </div>
  );
};

export default App;
