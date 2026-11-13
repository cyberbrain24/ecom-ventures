import React, { useState } from 'react';
import { Menu, X, Activity } from 'lucide-react';
import { Sidebar } from './Sidebar';

interface AdminLayoutProps {
  children: React.ReactNode;
  activePath: string;
  onNavigate: (path: string) => void;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ children, activePath, onNavigate }) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-[#EAEEF2] flex flex-col md:flex-row overflow-x-hidden">
      {/* Mobile Header Top Bar (Viewports < 768px) */}
      <header className="md:hidden h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between sticky top-0 z-40 shadow-xs flex-shrink-0">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 transition"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
          <div className="flex items-center space-x-2">
            <div className="h-7 w-7 rounded bg-teal-600 flex items-center justify-center text-white font-black text-sm shadow-xs">
              E
            </div>
            <div>
              <span className="font-bold text-slate-900 text-sm tracking-tight leading-none block">
                ECOM VENTURES
              </span>
              <span className="text-[10px] text-teal-600 font-mono font-semibold uppercase tracking-wider block">
                MASTER ADMIN
              </span>
            </div>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center space-x-2">
          <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5"></span>
            PG Cluster OK
          </span>
        </div>
      </header>

      {/* Responsive Navigation Sidebar / Drawer */}
      <Sidebar
        activePath={activePath}
        onNavigate={onNavigate}
        mobileMenuOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="fixed inset-0 bg-slate-950/60 z-40 md:hidden backdrop-blur-sm transition-opacity"
          aria-hidden="true"
        />
      )}

      {/* Main Content Area (Right-Side Page Area) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-x-hidden min-h-screen bg-[#EAEEF2]">
        <main className="flex-1 p-3.5 sm:p-5 lg:p-6 overflow-y-auto w-full bg-[#EAEEF2]">
          <div className="w-full max-w-[1920px] mx-auto min-w-0">{children}</div>
        </main>
      </div>
    </div>
  );
};

