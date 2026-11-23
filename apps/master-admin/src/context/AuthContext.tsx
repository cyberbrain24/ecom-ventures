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
  sessionMessage: string | null;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<PlatformUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const initializeAuth = async () => {
      const token = localStorage.getItem('ecom_platform_access_token');
      if (!token) {
        if (active) setIsLoading(false);
        return;
      }

      try {
        const response = await api.get<{ data: any }>('/platform/me');
        if (active) {
          const claims = response.data.data;
          let cached: Partial<PlatformUser> = {};
          try {
            const raw = localStorage.getItem('ecom_platform_user');
            if (raw) cached = JSON.parse(raw);
          } catch {}

          const resolvedUser: PlatformUser = {
            id: claims.user_id || claims.id || cached.id || '',
            email: claims.email || cached.email || '',
            first_name: cached.first_name || claims.first_name || claims.email?.split('@')[0] || 'Platform',
            last_name: cached.last_name || claims.last_name || 'Admin',
            role: claims.role || cached.role || 'SUPER_ADMIN',
          };
          setUser(resolvedUser);
          localStorage.setItem('ecom_platform_user', JSON.stringify(resolvedUser));
        }
      } catch {
        localStorage.removeItem('ecom_platform_access_token');
        localStorage.removeItem('ecom_platform_refresh_token');
        localStorage.removeItem('ecom_platform_user');
        if (active) {
          setUser(null);
          setSessionMessage('Your session could not be verified. Please sign in again.');
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };

    initializeAuth();
    return () => {
      active = false;
    };
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    const response = await api.post<{ data: LoginResponse }>('/platform/auth/login', credentials);
    const { tokens, user: authUser } = response.data.data;

    localStorage.setItem('ecom_platform_access_token', tokens.access_token);
    localStorage.setItem('ecom_platform_refresh_token', tokens.refresh_token);
    localStorage.setItem('ecom_platform_user', JSON.stringify(authUser));
    setSessionMessage(null);
    setUser(authUser);
  };

  const logout = async () => {
    let logoutError: unknown;
    try {
      await api.post('/platform/auth/logout');
    } catch (error) {
      logoutError = error;
    } finally {
      localStorage.removeItem('ecom_platform_access_token');
      localStorage.removeItem('ecom_platform_refresh_token');
      localStorage.removeItem('ecom_platform_user');
      setUser(null);
      window.location.href = '/login';
    }
    if (logoutError) throw logoutError;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        sessionMessage,
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
