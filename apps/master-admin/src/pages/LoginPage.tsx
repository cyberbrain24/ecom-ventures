/**
 * LoginPage provides the authentication portal for Platform Super Administrators
 * and Platform Staff accessing the centralized command center.
 */

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { ShieldCheck, AlertCircle } from 'lucide-react';
import { AxiosError } from 'axios';
import { ProblemDetails } from '../types/auth';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      await login({ email, password });
      window.location.href = '/';
    } catch (err) {
      const axiosErr = err as AxiosError<ProblemDetails>;
      if (axiosErr.response?.data?.detail) {
        setErrorMsg(axiosErr.response.data.detail);
      } else {
        setErrorMsg('Authentication failed. Please check credentials and server status.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="h-14 w-14 rounded-2xl bg-teal-500 flex items-center justify-center text-white shadow-xl shadow-teal-500/20">
            <ShieldCheck className="h-8 w-8" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-white tracking-tight">
          Ecom Ventures
        </h2>
        <p className="mt-2 text-center text-sm text-teal-400 font-medium">
          Master Portfolio Administration Center
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-xl rounded-2xl sm:px-10 border border-slate-100">
          {errorMsg && (
            <div className="mb-6 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm flex items-start space-x-2">
              <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <div>
              <label className="block text-sm font-medium text-slate-700">Platform Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-label="Platform Email"
                className="mt-1 block w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
              />
              <span className="text-xs text-slate-400 mt-1 block">e.g. superadmin@dropiobd.com</span>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-label="Password"
                className="mt-1 block w-full px-3 py-2.5 bg-white border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
              />
            </div>

            <div className="space-y-3">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full min-h-[44px] flex justify-center items-center py-2.5 px-4 border border-transparent rounded-lg shadow-sm text-sm font-semibold text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:opacity-50 transition"
              >
                {isSubmitting ? 'Authenticating...' : 'Sign in to Master Admin'}
              </button>

              <button
                type="button"
                onClick={async () => {
                  setEmail('superadmin@dropiobd.com');
                  setPassword('admin123');
                  setIsSubmitting(true);
                  try {
                    await login({ email: 'superadmin@dropiobd.com', password: 'admin123' });
                    window.location.href = '/';
                  } finally {
                    setIsSubmitting(false);
                  }
                }}
                className="w-full min-h-[44px] flex justify-center items-center py-2.5 px-4 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 transition"
              >
                ⚡ Quick Demo Super Admin Access
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
