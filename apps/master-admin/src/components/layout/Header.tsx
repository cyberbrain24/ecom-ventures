/**
 * Header component for the Master Admin panel.
 * Displays breadcrumb trail, notifications, user identity, and sign-out actions.
 */

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { LogOut, User, Bell } from 'lucide-react';

export const Header: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <header className="h-16 bg-white border-b border-slate-200 fixed top-0 right-0 left-64 z-20 flex items-center justify-between px-8">
      <div className="flex items-center space-x-2 text-sm text-slate-500">
        <span>Portfolio Operations</span>
        <span>/</span>
        <span className="font-semibold text-slate-800">Overview</span>
      </div>

      <div className="flex items-center space-x-6">
        <button className="text-slate-400 hover:text-slate-600 relative">
          <Bell className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 h-2 w-2 bg-teal-500 rounded-full"></span>
        </button>

        <div className="flex items-center space-x-3 border-l border-slate-200 pl-6">
          <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-300 flex items-center justify-center text-slate-600">
            <User className="h-4 w-4" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-800 leading-none">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-xs text-slate-500 mt-0.5">{user?.role}</p>
          </div>
          <button
            onClick={logout}
            title="Sign Out"
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition ml-2"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
