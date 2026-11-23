import React, { useCallback, useEffect, useState } from 'react';
import { Activity, AlertCircle, Database, RefreshCw, Settings, Server, Cloud } from 'lucide-react';
import { ClusterOverviewResponse } from '../types/system';
import { api, apiErrorMessage } from '../lib/api';
import { CloudflareR2Settings } from '../components/storage/CloudflareR2Settings';

type SettingsTab = 'storage' | 'cluster' | 'platform' | 'workers';

export const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('storage');
  const [clusterData, setClusterData] = useState<ClusterOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClusterOverview = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.get<{ data: ClusterOverviewResponse }>('/platform/system/overview');
      const data = response.data.data;
      if (!data || !data.platform_db || !data.redis || !Array.isArray(data.tenant_pools)) {
        throw new Error('The system API returned an invalid infrastructure overview.');
      }
      setClusterData(data);
    } catch (loadError) {
      setClusterData(null);
      setError(apiErrorMessage(loadError, 'Could not load infrastructure status.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchClusterOverview();
  }, [fetchClusterOverview]);

  const tabs: Array<{ id: SettingsTab; label: string; icon: typeof Settings }> = [
    { id: 'storage', label: 'Cloudflare R2 Storage', icon: Cloud },
    { id: 'cluster', label: 'Database & Cache', icon: Database },
    { id: 'platform', label: 'Platform Policies', icon: Settings },
    { id: 'workers', label: 'Workers', icon: Activity },
  ];

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-lg font-bold text-slate-900 tracking-tight">System Settings & Infrastructure</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Live infrastructure status and availability of platform controls.
        </p>
      </header>

      <nav className="flex gap-1.5 border-b border-slate-200 pb-2" aria-label="Settings sections">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold ${
              activeTab === id ? 'bg-teal-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </button>
        ))}
      </nav>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 whitespace-pre-line">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {activeTab === 'storage' && (
        <section>
          <CloudflareR2Settings />
        </section>
      )}

      {activeTab === 'platform' && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Platform policy settings are not backed by a configuration API yet. No unsaved or sample values are shown.
        </section>
      )}

      {activeTab === 'cluster' && (
        <section className="space-y-4">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => void fetchClusterOverview()}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
          {isLoading && <p className="text-xs text-slate-500">Loading live infrastructure status...</p>}
          {!isLoading && clusterData && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <Database className="h-4 w-4 text-teal-600" /> Platform database
                  </div>
                  <dl className="mt-3 space-y-1.5 text-xs">
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Database</dt><dd className="font-mono">{clusterData.platform_db.database}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Address</dt><dd className="font-mono">{clusterData.platform_db.host}:{clusterData.platform_db.port}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Status</dt><dd>{clusterData.platform_db.status}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Connections</dt><dd>{clusterData.platform_db.in_use} in use / {clusterData.platform_db.open_conns} open / {clusterData.platform_db.max_open} max</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Idle</dt><dd>{clusterData.platform_db.idle}</dd></div>
                  </dl>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
                    <Server className="h-4 w-4 text-rose-600" /> Redis
                  </div>
                  <dl className="mt-3 space-y-1.5 text-xs">
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Address</dt><dd className="font-mono">{clusterData.redis.host}:{clusterData.redis.port}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Status</dt><dd>{clusterData.redis.status}</dd></div>
                    <div className="flex justify-between gap-3"><dt className="text-slate-500">Streams reported</dt><dd>{clusterData.redis.streams.length}</dd></div>
                  </dl>
                </div>
              </div>

              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-3 py-2">Store</th><th className="px-3 py-2">Database</th>
                      <th className="px-3 py-2">Status</th><th className="px-3 py-2">Active</th><th className="px-3 py-2">Idle</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {clusterData.tenant_pools.map((pool) => (
                      <tr key={pool.slug}>
                        <td className="px-3 py-2 font-semibold">{pool.slug}</td>
                        <td className="px-3 py-2 font-mono">{pool.db_name}</td>
                        <td className="px-3 py-2">{pool.status}</td>
                        <td className="px-3 py-2">{pool.active_conns}</td>
                        <td className="px-3 py-2">{pool.idle_conns}</td>
                      </tr>
                    ))}
                    {clusterData.tenant_pools.length === 0 && (
                      <tr><td className="px-3 py-4 text-center text-slate-500" colSpan={5}>No tenant pools are currently reported.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>

              <p className="text-[11px] text-slate-500">Updated {new Date(clusterData.timestamp).toLocaleString()}</p>
            </>
          )}
        </section>
      )}

      {activeTab === 'workers' && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          Worker health and scheduler telemetry are not exposed by the backend yet. No simulated stream or job status is shown.
        </section>
      )}
    </div>
  );
};
