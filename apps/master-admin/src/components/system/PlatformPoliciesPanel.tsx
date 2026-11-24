import React, { useCallback, useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, RefreshCw, Save, Shield } from 'lucide-react';
import { PlatformPolicies, UpdatePlatformPoliciesPayload } from '../../types/system';
import { api, apiErrorMessage } from '../../lib/api';

/**
 * PlatformPoliciesPanel manages platform-wide governance, provisioning defaults,
 * session limits, and maintenance mode backed by GET/PUT /platform/system/policies.
 */
export const PlatformPoliciesPanel: React.FC = () => {
  const [policies, setPolicies] = useState<PlatformPolicies | null>(null);
  const [form, setForm] = useState<UpdatePlatformPoliciesPayload | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadPolicies = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: PlatformPolicies }>('/platform/system/policies');
      const data = res.data.data;
      setPolicies(data);
      setForm({
        maintenance_mode: data.maintenance_mode,
        allow_new_store_provisioning: data.allow_new_store_provisioning,
        enforce_custom_domain_ssl: data.enforce_custom_domain_ssl,
        default_store_currency: data.default_store_currency,
        default_store_timezone: data.default_store_timezone,
        max_stores_per_account: data.max_stores_per_account,
        session_ttl_minutes: data.session_ttl_minutes,
        audit_log_retention_days: data.audit_log_retention_days,
        api_rate_limit_per_min: data.api_rate_limit_per_min,
        support_contact_email: data.support_contact_email,
      });
    } catch (loadError) {
      setError(apiErrorMessage(loadError, 'Could not load platform policies.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPolicies();
  }, [loadPolicies]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setIsSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await api.put<{ data: PlatformPolicies }>('/platform/system/policies', form);
      const updated = res.data.data;
      setPolicies(updated);
      setSuccess('Platform policy settings saved and audit-logged.');
    } catch (saveError) {
      setError(apiErrorMessage(saveError, 'Failed to save platform policies.'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <p className="text-xs text-slate-500">Loading platform policy configuration...</p>;
  }

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 whitespace-pre-line">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div role="status" className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {form && (
        <form onSubmit={handleSave} className="rounded-lg border border-slate-200 bg-white p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-teal-600" />
              <div>
                <h2 className="text-sm font-bold text-slate-900">Platform Governance & Defaults</h2>
                <p className="text-[11px] text-slate-500">
                  Persisted in <span className="font-mono">platform_policies</span> and recorded in audit logs on every update.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadPolicies()}
              disabled={isLoading || isSaving}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Reload
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={form.maintenance_mode}
                onChange={(e) => setForm({ ...form, maintenance_mode: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <div>
                <span className="block text-xs font-semibold text-slate-900">Maintenance Mode</span>
                <span className="block text-[11px] text-slate-500">Flags platform maintenance in system telemetry.</span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={form.allow_new_store_provisioning}
                onChange={(e) => setForm({ ...form, allow_new_store_provisioning: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <div>
                <span className="block text-xs font-semibold text-slate-900">Allow Store Provisioning</span>
                <span className="block text-[11px] text-slate-500">Permit launching new isolated tenant databases.</span>
              </div>
            </label>

            <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 p-3 cursor-pointer hover:bg-slate-50">
              <input
                type="checkbox"
                checked={form.enforce_custom_domain_ssl}
                onChange={(e) => setForm({ ...form, enforce_custom_domain_ssl: e.target.checked })}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
              />
              <div>
                <span className="block text-xs font-semibold text-slate-900">Enforce Custom Domain SSL</span>
                <span className="block text-[11px] text-slate-500">Require HTTPS verification for custom domains.</span>
              </div>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Default Store Currency</label>
              <input
                type="text"
                value={form.default_store_currency}
                onChange={(e) => setForm({ ...form, default_store_currency: e.target.value.toUpperCase() })}
                maxLength={10}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Default Store Timezone</label>
              <input
                type="text"
                value={form.default_store_timezone}
                onChange={(e) => setForm({ ...form, default_store_timezone: e.target.value })}
                maxLength={64}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Support Contact Email</label>
              <input
                type="email"
                value={form.support_contact_email}
                onChange={(e) => setForm({ ...form, support_contact_email: e.target.value })}
                maxLength={255}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Max Stores Per Account</label>
              <input
                type="number"
                min={1}
                max={1000}
                value={form.max_stores_per_account}
                onChange={(e) => setForm({ ...form, max_stores_per_account: Number(e.target.value) })}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Session TTL (Minutes)</label>
              <input
                type="number"
                min={15}
                max={43200}
                value={form.session_ttl_minutes}
                onChange={(e) => setForm({ ...form, session_ttl_minutes: Number(e.target.value) })}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Audit Log Retention (Days)</label>
              <input
                type="number"
                min={7}
                max={3650}
                value={form.audit_log_retention_days}
                onChange={(e) => setForm({ ...form, audit_log_retention_days: Number(e.target.value) })}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono focus:border-teal-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">API Rate Limit (Req / Min)</label>
              <input
                type="number"
                min={10}
                max={100000}
                value={form.api_rate_limit_per_min}
                onChange={(e) => setForm({ ...form, api_rate_limit_per_min: Number(e.target.value) })}
                required
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-xs font-mono focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
            <p className="text-[11px] text-slate-500">
              {policies?.updated_at
                ? `Last updated ${new Date(policies.updated_at).toLocaleString()}${policies.updated_by ? ` by ${policies.updated_by}` : ''}`
                : 'Loaded from platform database'}
            </p>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-1.5 rounded-md bg-teal-600 px-4 py-2 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              {isSaving ? 'Saving...' : 'Save Policies'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
