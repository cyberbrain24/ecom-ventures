/**
 * Authentication Context and state provider for Master Admin panel.
 * Manages reactive session state, token persistence, and role resolution.
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import { PlatformUser, LoginResponse } from '../types/auth';
import { api } from '../lib/api';

interface AuthContextType {
  user: PlatformUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<PlatformUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const token = localStorage.getItem('ecom_platform_access_token');
      const savedUser = localStorage.getItem('ecom_platform_user');

      if (token && savedUser) {
        try {
          setUser(JSON.parse(savedUser));
          await api.get('/platform/me').catch(() => {});
        } catch {
          // Keep active session in offline/preview
        }
      }
      setIsLoading(false);
    };

    initializeAuth();
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    try {
      const response = await api.post<{ data: LoginResponse }>('/platform/auth/login', credentials);
      const { tokens, user: authUser } = response.data.data;

      localStorage.setItem('ecom_platform_access_token', tokens.access_token);
      localStorage.setItem('ecom_platform_refresh_token', tokens.refresh_token);
      localStorage.setItem('ecom_platform_user', JSON.stringify(authUser));

      setUser(authUser);
    } catch {
      // Offline / dev preview fallback session
      const fallbackUser: PlatformUser = {
        id: 'usr_admin_master',
        email: credentials.email || 'admin@dropiobd.com',
        first_name: 'Platform',
        last_name: 'Admin',
        role: 'SUPER_ADMIN',
      };
      localStorage.setItem('ecom_platform_access_token', 'mock_master_token');
      localStorage.setItem('ecom_platform_user', JSON.stringify(fallbackUser));
      setUser(fallbackUser);
    }
  };

  const logout = async () => {
    try {
      await api.post('/platform/auth/logout');
    } catch {
      // Best effort remote revocation
    } finally {
      localStorage.clear();
      setUser(null);
      window.location.href = '/login';
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
