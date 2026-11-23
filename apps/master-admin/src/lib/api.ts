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

/**
 * Converts any thrown value into text that is safe to show a person.
 * For an API error it returns the RFC 7807 `detail`, followed by one line per field error from
 * `invalid_params` when the server sent them. With no response at all (offline, DNS, timeout,
 * CORS) it returns a clear network message. It never returns axios' generic
 * "Request failed with status code N" text.
 *
 * @param error - The value caught from a failed request
 * @param fallback - Text used when nothing more specific is known
 * @returns Human-readable error text
 */
export function apiErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.'): string {
  if (axios.isAxiosError<Partial<ProblemDetails>>(error)) {
    const response = error.response;
    if (!response) {
      if (error.code === 'ECONNABORTED') {
        return 'The server took too long to answer. Check your connection and try again.';
      }
      return 'Cannot reach the server. Check your network connection and try again.';
    }
    const data = response.data;
    const parts: string[] = [];
    if (data && typeof data.detail === 'string' && data.detail.trim() !== '') {
      parts.push(data.detail.trim());
    }
    if (data && Array.isArray(data.invalid_params)) {
      for (const param of data.invalid_params) {
        parts.push(`${param.field}: ${param.message}`);
      }
    }
    if (parts.length > 0) return parts.join('\n');
    return `The server rejected the request (HTTP ${response.status}).`;
  }
  if (error instanceof Error && error.message && !error.message.startsWith('Request failed with status code')) {
    return error.message;
  }
  return fallback;
}

/**
 * Returns the machine-readable RFC 7807 `code` of an API error (for example THEME_IN_USE),
 * or undefined when the error carries none.
 *
 * @param error - The value caught from a failed request
 * @returns The problem code, if any
 */
export function apiErrorCode(error: unknown): string | undefined {
  if (axios.isAxiosError<Partial<ProblemDetails>>(error)) {
    return error.response?.data?.code;
  }
  return undefined;
}
