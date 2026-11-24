/**
 * Sidebar component providing persistent portfolio navigation, branding,
 * and cluster health status.
 */

import React from 'react';
import {
  LayoutDashboard,
  Store,
  Palette,
  Globe,
  Users,
  ShieldAlert,
  ShieldCheck,
  Settings,
  ChevronRight,
  LogOut,
  DollarSign,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  activePath: string;
  onNavigate: (path: string) => void;
  mobileMenuOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePath,
  onNavigate,
  mobileMenuOpen = false,
  onCloseMobile,
}) => {
  const { user, logout } = useAuth();

  const navItems = [
    { label: 'Dashboard', path: '/', icon: LayoutDashboard },
    { label: 'Store Portfolio', path: '/stores', icon: Store },
    { label: 'Portfolio Accounts', path: '/accounts', icon: DollarSign },
    { label: 'Theme Registry', path: '/themes', icon: Palette },
    { label: 'Domain Network', path: '/domains', icon: Globe },
    { label: 'Platform Staff', path: '/admins', icon: Users },
    { label: 'Audit Logs', path: '/audit-logs', icon: ShieldAlert },
    { label: 'Security & Compliance', path: '/security', icon: ShieldCheck },
    { label: 'System Settings', path: '/settings', icon: Settings },
  ];

  const handleNavClick = (path: string) => {
    onNavigate(path);
    if (onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-50 w-72 sm:w-80 lg:w-64 bg-slate-900 text-slate-300 flex flex-col h-screen transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
        mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      } lg:sticky lg:top-0 lg:h-screen lg:self-start border-r border-slate-800 select-none flex-shrink-0`}
    >
      {/* Brand Header */}
      <div className="h-16 py-3 flex items-center justify-between px-4 border-b border-slate-800 bg-slate-950 flex-shrink-0">
        <div className="flex items-center space-x-2.5">
          <div className="h-7 w-7 rounded bg-teal-500 flex items-center justify-center text-white font-black text-sm shadow-sm">
            E
          </div>
          <div>
            <span className="font-bold text-white tracking-wide text-sm block leading-none">ECOM VENTURES</span>
            <span className="block text-[10px] text-teal-400 font-mono mt-0.5 uppercase tracking-wider">MASTER ADMIN</span>
          </div>
        </div>

        {/* Mobile/Tablet Close Button */}
        <button
          onClick={onCloseMobile}
          className="lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-slate-400 hover:text-white rounded-lg focus:outline-none"
          aria-label="Close Navigation Drawer"
        >
          <ChevronRight className="h-5 w-5 rotate-180" />
        </button>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 px-2.5 py-3 space-y-1.5 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activePath === item.path;
          return (
            <button
              key={item.path}
              onClick={() => handleNavClick(item.path)}
              className={`w-full min-h-[44px] flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition ${
                isActive
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-400 hover:bg-slate-800/80 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center space-x-2.5">
                <Icon className={`h-4 w-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </div>
              {isActive && <ChevronRight className="h-3.5 w-3.5 text-teal-200 flex-shrink-0" />}
            </button>
          );
        })}
      </nav>

      {/* Operator Profile Footer */}
      <div className="border-t border-slate-800 bg-slate-950 flex-shrink-0">
        <div className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="h-8 w-8 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-300 font-bold text-xs flex-shrink-0">
                {user?.first_name ? user.first_name[0] : (user?.email ? user.email[0].toUpperCase() : '?')}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-200 truncate leading-tight">
                  {(user?.first_name || user?.last_name)
                    ? `${user.first_name || ''} ${user.last_name || ''}`.trim()
                    : user?.email || 'Signed in operator'}
                </p>
                {user?.role && (
                  <p className="text-[10px] text-teal-400 font-mono leading-tight mt-0.5">{user.role}</p>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-1 flex-shrink-0">
              <button
                onClick={logout}
                title="Sign Out"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg transition"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </aside>
  );
};
