/**
 * ProtectedRoute component enforces role-based access control (RBAC) and authentication
 * state verification for administrative routes.
 */

import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { PlatformUserRole } from '../../types/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: PlatformUserRole[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
    return null;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-100 p-4">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Access Denied</h1>
          <p className="text-slate-600 mb-6">
            Your role ({user.role}) does not have permission to access this administrative view.
          </p>
          <button
            onClick={() => (window.location.href = '/')}
            className="px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700 transition"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
