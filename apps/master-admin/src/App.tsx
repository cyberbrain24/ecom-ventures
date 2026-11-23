/**
 * Root Application coordinator for Master Admin panel.
 * Handles client-side view state transitions between Dashboard, Store Portfolio,
 * Domain Network management, and Theme Marketplace.
 */

import React, { useState, Suspense, lazy } from 'react';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AdminLayout } from './components/layout/AdminLayout';

// Dynamic code-split page imports
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const StoresPage = lazy(() => import('./pages/StoresPage').then((m) => ({ default: m.StoresPage })));
const DomainsPage = lazy(() => import('./pages/DomainsPage').then((m) => ({ default: m.DomainsPage })));
const ThemesPage = lazy(() => import('./pages/ThemesPage').then((m) => ({ default: m.ThemesPage })));
const AdminsPage = lazy(() => import('./pages/AdminsPage').then((m) => ({ default: m.AdminsPage })));
const AuditLogsPage = lazy(() => import('./pages/AuditLogsPage').then((m) => ({ default: m.AuditLogsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const SecurityAuditPage = lazy(() => import('./pages/SecurityAuditPage').then((m) => ({ default: m.SecurityAuditPage })));
const AccountsPage = lazy(() => import('./pages/AccountsPage').then((m) => ({ default: m.AccountsPage })));

const PageSkeleton: React.FC = () => (
  <div className="space-y-6 animate-pulse p-2">
    <div className="h-8 bg-slate-200 rounded w-1/4"></div>
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="h-28 bg-white rounded-xl border border-slate-200"></div>
      <div className="h-28 bg-white rounded-xl border border-slate-200"></div>
      <div className="h-28 bg-white rounded-xl border border-slate-200"></div>
      <div className="h-28 bg-white rounded-xl border border-slate-200"></div>
    </div>
    <div className="h-96 bg-white rounded-xl border border-slate-200"></div>
  </div>
);

export const AppContent: React.FC = () => {
  const [currentPath, setCurrentPath] = useState<string>(window.location.pathname);

  React.useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleNavigate = (path: string) => {
    if (path !== currentPath) {
      window.history.pushState({}, '', path);
      setCurrentPath(path);
    }
  };

  if (currentPath === '/login') {
    return (
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">Loading...</div>}>
        <LoginPage />
      </Suspense>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'PLATFORM_STAFF']}>
      <AdminLayout activePath={currentPath} onNavigate={handleNavigate}>
        <Suspense fallback={<PageSkeleton />}>
          {currentPath === '/' && (
            <DashboardPage onNavigateToCreateStore={() => setCurrentPath('/stores/create')} />
          )}
          {currentPath === '/stores' && <StoresPage />}
          {currentPath === '/stores/create' && <StoresPage initialCreating={true} />}
          {currentPath === '/accounts' && <AccountsPage />}
          {currentPath === '/domains' && <DomainsPage />}
          {currentPath === '/themes' && <ThemesPage />}
          {currentPath === '/admins' && <AdminsPage />}
          {currentPath === '/audit-logs' && <AuditLogsPage />}
          {currentPath === '/security' && <SecurityAuditPage />}
          {currentPath === '/settings' && <SettingsPage />}
          {currentPath !== '/' &&
            currentPath !== '/stores' &&
            currentPath !== '/stores/create' &&
            currentPath !== '/accounts' &&
            currentPath !== '/domains' &&
            currentPath !== '/themes' &&
            currentPath !== '/admins' &&
            currentPath !== '/audit-logs' &&
            currentPath !== '/security' &&
            currentPath !== '/settings' && (
              <div className="bg-white p-8 rounded-xl border border-slate-200">
                <h2 className="text-xl font-bold text-slate-900 mb-2">Module Not Found</h2>
                <p className="text-slate-600 text-sm">Target route: {currentPath}</p>
              </div>
            )}
        </Suspense>
      </AdminLayout>
    </ProtectedRoute>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

export default App;
