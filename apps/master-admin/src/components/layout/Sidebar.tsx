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
  Bell,
  LogOut,
  User,
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
      className={`fixed inset-y-0 left-0 z-50 w-64 md:w-60 lg:w-64 bg-slate-900 text-slate-300 flex flex-col h-screen transform transition-transform duration-300 ease-in-out md:translate-x-0 ${
        mobileMenuOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
      } md:sticky md:top-0 border-r border-slate-800 select-none flex-shrink-0`}
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

        {/* Mobile Close Button */}
        <button
          onClick={onCloseMobile}
          className="md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-slate-400 hover:text-white rounded-lg focus:outline-none"
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
                {user?.first_name ? user.first_name[0] : 'A'}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-slate-200 truncate leading-tight">
                  {user ? `${user.first_name} ${user.last_name}` : 'Platform Admin'}
                </p>
                <p className="text-[10px] text-teal-400 font-mono leading-tight mt-0.5">
                  {user?.role || 'SUPER_ADMIN'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-1 flex-shrink-0">
              <button
                title="Notifications"
                className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition relative"
              >
                <Bell className="h-4 w-4" />
                <span className="absolute top-2.5 right-2.5 h-1.5 w-1.5 bg-teal-400 rounded-full"></span>
              </button>

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

        {/* Cluster Status Line */}
        <div className="px-3 py-2 bg-slate-950/90 border-t border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between font-mono">
          <span className="flex items-center">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse mr-1.5"></span>
            PG Cluster: OK
          </span>
          <span className="text-slate-500">v1.0</span>
        </div>
      </div>
    </aside>
  );
};
