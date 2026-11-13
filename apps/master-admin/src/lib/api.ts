/**
 * Centralized Axios HTTP client for Master Admin API interactions.
 * Features automated JWT Bearer header injection and seamless token refresh on 401 Unauthorized.
 */

import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import { ProblemDetails } from '../types/auth';

// Base relative API path routed via Nginx reverse proxy
const BASE_URL = '/api/v1';

export const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

// Request Interceptor: Attach Bearer JWT token if stored in local session
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const accessToken = localStorage.getItem('ecom_platform_access_token');
    if (accessToken && config.headers) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Response Interceptor: Seamless token rotation on 401 Unauthorized
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ProblemDetails>) => {
    const originalRequest = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    // Avoid infinite loop on auth endpoints
    if (originalRequest.url?.includes('/platform/auth/')) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshToken = localStorage.getItem('ecom_platform_refresh_token');
      if (!refreshToken) {
        localStorage.removeItem('ecom_platform_access_token');
        localStorage.removeItem('ecom_platform_refresh_token');
        localStorage.removeItem('ecom_platform_user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      try {
        const { data } = await axios.post(`${BASE_URL}/platform/auth/refresh`, {
          refresh_token: refreshToken,
        });

        const newAccessToken = data.data.tokens.access_token;
        const newRefreshToken = data.data.tokens.refresh_token;

        localStorage.setItem('ecom_platform_access_token', newAccessToken);
        localStorage.setItem('ecom_platform_refresh_token', newRefreshToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        }
        processQueue(null, newAccessToken);
        return api(originalRequest);
      } catch (refreshErr) {
        processQueue(refreshErr as Error, null);
        localStorage.removeItem('ecom_platform_access_token');
        localStorage.removeItem('ecom_platform_refresh_token');
        localStorage.removeItem('ecom_platform_user');
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);
