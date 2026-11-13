/**
 * StoreDetailDrawer renders a deep-inspection slide-over panel displaying
 * dedicated database connection parameters, domain mappings, and operational controls.
 */

import React, { useEffect, useState } from 'react';
import { X, Database, Globe, Palette } from 'lucide-react';
import { StoreDetailResponse, StoreStatus } from '../../types/store';
import { StatusBadge } from '../ui/StatusBadge';
import { api } from '../../lib/api';

interface StoreDetailDrawerProps {
  storeId: string;
  onClose: () => void;
  onStatusUpdated: () => void;
}

export const StoreDetailDrawer: React.FC<StoreDetailDrawerProps> = ({
  storeId,
  onClose,
  onStatusUpdated,
}) => {
  const [data, setData] = useState<StoreDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await api.get<{ data: StoreDetailResponse }>(`/platform/stores/${storeId}`);
        const fetched = (res.data as unknown as { data: StoreDetailResponse }).data || (res.data as unknown as StoreDetailResponse);
        setData(fetched);
      } catch (err) {
        console.error('Failed to load store details', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchDetails();
  }, [storeId]);

  const handleUpdateStatus = async (newStatus: StoreStatus) => {
    if (!window.confirm(`Are you sure you want to transition this store to ${newStatus}?`)) {
      return;
    }

    setIsUpdatingStatus(true);
    try {
      await api.patch(`/platform/stores/${storeId}/status`, {
        status: newStatus,
        reason: 'Super Admin administrative action via Master Admin Panel',
      });
      onStatusUpdated();
      onClose();
    } catch (err) {
      console.error('Failed to update status', err);
      alert('Failed to update status. Check logs.');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/50 backdrop-blur-sm flex justify-end">
      <div className="w-full sm:w-[540px] md:max-w-xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto">
        {/* Drawer Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50 sticky top-0 z-10">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate max-w-[240px] sm:max-w-xs">
              {data?.store.name || 'Store Inspection'}
            </h3>
            <span className="text-xs font-mono text-slate-500">ID: {storeId}</span>
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200 transition"
            aria-label="Close Inspection Drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer Content */}
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Loading store details...</div>
        ) : data ? (
          <div className="p-4 sm:p-6 space-y-6 sm:space-y-8 flex-1">
            {/* Status & Quick Overview */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border">
              <div>
                <span className="text-xs text-slate-500 block">Operational Status</span>
                <div className="mt-1">
                  <StatusBadge status={data.store.status} />
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-500 block">Currency / Timezone</span>
                <span className="text-xs font-semibold text-slate-800">
                  {data.store.currency} ({data.store.timezone})
                </span>
              </div>
            </div>

            {/* Dedicated PostgreSQL Architecture Card */}
            <div>
              <div className="flex items-center space-x-2 text-sm font-bold text-slate-900 mb-3">
                <Database className="h-4 w-4 text-teal-600" />
                <span>Dedicated PostgreSQL Database (Isolated)</span>
              </div>
              <div className="bg-slate-900 text-slate-200 p-4 rounded-xl text-xs font-mono space-y-2 border border-slate-800">
                <div className="flex justify-between">
                  <span className="text-slate-400">Database Name:</span>
                  <span className="text-emerald-400 font-bold">{data.store.db_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Host Endpoint:</span>
                  <span>{data.store.db_host}:{data.store.db_port}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Database User:</span>
                  <span>{data.store.db_user}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Password Storage:</span>
                  <span className="text-teal-400">AES-256-GCM Encrypted at Rest</span>
                </div>
              </div>
            </div>

            {/* Domain Network */}
            <div>
              <div className="flex items-center space-x-2 text-sm font-bold text-slate-900 mb-3">
                <Globe className="h-4 w-4 text-teal-600" />
                <span>Registered Domains ({data.domains.length})</span>
              </div>
              <div className="space-y-2">
                {data.domains.map((dom) => (
                  <div
                    key={dom.id}
                    className="flex items-center justify-between p-3 border rounded-lg text-xs"
                  >
                    <div>
                      <span className="font-mono font-semibold text-slate-800">{dom.domain}</span>
                      {dom.is_primary && (
                        <span className="ml-2 text-[10px] bg-teal-50 text-teal-700 font-bold px-1.5 py-0.5 rounded border border-teal-200">
                          PRIMARY
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-emerald-600 font-semibold">{dom.ssl_status}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Active Theme Blueprint */}
            <div>
              <div className="flex items-center space-x-2 text-sm font-bold text-slate-900 mb-3">
                <Palette className="h-4 w-4 text-teal-600" />
                <span>Active Theme Blueprint</span>
              </div>
              <div className="p-4 bg-slate-50 border rounded-xl flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-900 text-sm block">
                    {data.active_theme?.name || 'Default Blueprint'}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    Slug: {data.active_theme?.slug} (v{data.active_theme?.version})
                  </span>
                </div>
                <button
                  onClick={() => alert('Theme reassignment will be enabled in future releases')}
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition"
                >
                  Change Theme
                </button>
              </div>
            </div>

            {/* Lifecycle State Controls */}
            <div className="border-t pt-6">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-3">
                Store Lifecycle Control Actions
              </span>
              <div className="grid grid-cols-2 gap-3">
                {data.store.status !== 'ACTIVE' && (
                  <button
                    disabled={isUpdatingStatus}
                    onClick={() => handleUpdateStatus('ACTIVE')}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition"
                  >
                    Activate Store
                  </button>
                )}
                {data.store.status !== 'MAINTENANCE' && (
                  <button
                    disabled={isUpdatingStatus}
                    onClick={() => handleUpdateStatus('MAINTENANCE')}
                    className="min-h-[44px] px-4 py-2.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition flex items-center justify-center"
                  >
                    Maintenance Mode
                  </button>
                )}
                {data.store.status !== 'SUSPENDED' && (
                  <button
                    disabled={isUpdatingStatus}
                    onClick={() => handleUpdateStatus('SUSPENDED')}
                    className="min-h-[44px] px-4 py-2.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition flex items-center justify-center"
                  >
                    Suspend Store
                  </button>
                )}
                {data.store.status !== 'ARCHIVED' && (
                  <button
                    disabled={isUpdatingStatus}
                    onClick={() => handleUpdateStatus('ARCHIVED')}
                    className="min-h-[44px] px-4 py-2.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 transition flex items-center justify-center"
                  >
                    Archive Store
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : null}

        {/* Drawer Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end sticky bottom-0 z-10">
          <button
            onClick={onClose}
            className="min-h-[44px] px-5 py-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-100 transition shadow-xs"
          >
            Close Panel
          </button>
        </div>
      </div>
    </div>
  );
};
