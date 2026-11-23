import React, { useState } from 'react';
import { Menu, X, LogOut, ChevronRight } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { useAuth } from '../../context/AuthContext';

interface AdminLayoutProps {
  children: React.ReactNode;
  activePath: string;
  onNavigate: (path: string) => void;
}

const SECTION_TITLES: Record<string, string> = {
  '/': 'Portfolio Overview',
  '/stores': 'Store Portfolio',
  '/accounts': 'Portfolio Accounts',
  '/themes': 'Theme Registry',
  '/domains': 'Domain Network',
  '/admins': 'Platform Staff',
  '/audit-logs': 'Audit Logs',
  '/security': 'Security & Compliance',
  '/settings': 'System Settings',
};

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, activePath, onNavigate }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();

  const currentSection = SECTION_TITLES[activePath] || 'Master Admin';

  return (
    <div className="min-h-screen bg-[#EAEEF2] flex flex-col lg:flex-row overflow-x-hidden">
      {/* Mobile/Tablet Header Top Bar (Viewports < 1024px) */}
      <header className="lg:hidden h-16 bg-white border-b border-slate-200 px-3.5 sm:px-5 flex items-center justify-between sticky top-0 z-40 shadow-xs flex-shrink-0">
        <div className="flex items-center space-x-2.5 sm:space-x-3 min-w-0">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          
          <div className="flex items-center space-x-2 min-w-0">
            <div className="h-7 w-7 rounded bg-teal-600 flex items-center justify-center text-white font-black text-sm shadow-xs flex-shrink-0">
              E
            </div>
            <div className="min-w-0">
              <span className="font-bold text-slate-900 text-xs sm:text-sm tracking-tight leading-none block truncate">
                {currentSection}
              </span>
              <span className="text-[10px] text-teal-600 font-mono font-semibold uppercase tracking-wider block mt-0.5">
                ECOM VENTURES
              </span>
            </div>
          </div>
        </div>

        {/* Quick User & Actions */}
        <div className="flex items-center space-x-2 flex-shrink-0">
          <div className="h-8 w-8 rounded-full bg-teal-100 border border-teal-200 flex items-center justify-center text-teal-800 font-bold text-xs" title={user?.email}>
            {user?.first_name ? user.first_name[0] : (user?.email ? user.email[0].toUpperCase() : 'A')}
          </div>
          <button
            onClick={logout}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
            title="Sign Out"
            aria-label="Sign Out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Responsive Navigation Sidebar / Drawer */}
      <Sidebar
        activePath={activePath}
        onNavigate={onNavigate}
        mobileMenuOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Mobile/Tablet Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/60 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Main Content Area (Right-Side Page Area) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden min-h-screen bg-[#EAEEF2]">
        <main className="flex-1 p-3 sm:p-5 lg:p-6 overflow-y-auto w-full bg-[#EAEEF2]">
          <div className="w-full max-w-[1920px] mx-auto min-w-0">{children}</div>
        </main>
      </div>
    </div>
  );
};

