/**
 * DashboardPage provides portfolio totals from the platform API and a recent store listings table.
 */

import React, { useEffect, useState } from 'react';
import { Store, CheckCircle2, Layers, PlusCircle, ExternalLink } from 'lucide-react';
import { MetricCard } from '../components/ui/MetricCard';
import { StatusBadge } from '../components/ui/StatusBadge';
import { StoreSummary, PaginatedStoresResponse } from '../types/store';
import { api, apiErrorMessage } from '../lib/api';
import { fetchStoreTotal } from '../lib/store-totals';
import { storefrontUrl } from '../lib/storefront-url';

interface DashboardPageProps {
  onNavigateToCreateStore: () => void;
}

interface PortfolioTotals {
  total: number;
  active: number;
  provisioning: number;
}

/**
 * Renders the portfolio overview: API-reported totals and the five most recent stores.
 *
 * @param props - Navigation callback for the "Launch New Brand" action
 * @returns The dashboard page
 */
export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigateToCreateStore }) => {
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [totals, setTotals] = useState<PortfolioTotals | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchDashboardData = async () => {
      setIsLoading(true);
      setLoadError(null);
      try {
        const [listRes, total, active, provisioning] = await Promise.all([
          api.get<PaginatedStoresResponse>('/platform/stores?page=1&limit=5'),
          fetchStoreTotal(),
          fetchStoreTotal('ACTIVE'),
          fetchStoreTotal('PROVISIONING'),
        ]);
        if (cancelled) return;
        setStores(listRes.data.data || []);
        setTotals({ total, active, provisioning });
      } catch (error) {
        if (cancelled) return;
        setStores([]);
        setTotals(null);
        setLoadError(apiErrorMessage(error, 'Could not load portfolio data.'));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchDashboardData();
    return () => {
      cancelled = true;
    };
  }, []);

  const formatTotal = (value: number | undefined) => {
    if (isLoading) return 'Loading';
    if (value === undefined) return 'Not available';
    return value;
  };

  return (
    <div className="space-y-3.5">
      {/* Top Banner & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Portfolio Overview</h1>
          <p className="text-xs text-slate-500 mt-1">
            Centralized monitoring and store lifecycle management across all brands.
          </p>
        </div>
        <button
          onClick={onNavigateToCreateStore}
          className="inline-flex items-center px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-md shadow-sm transition space-x-2"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Launch New Brand</span>
        </button>
      </div>

      {/* Totals reported by the API */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <MetricCard
          title="Total Brands"
          value={formatTotal(totals?.total)}
          subtitle="Platform registry total"
          icon={Store}
        />
        <MetricCard
          title="Active Stores"
          value={formatTotal(totals?.active)}
          subtitle="Status ACTIVE, from API total"
          icon={CheckCircle2}
        />
        <MetricCard
          title="In Provisioning"
          value={formatTotal(totals?.provisioning)}
          subtitle="Status PROVISIONING, from API total"
          icon={Layers}
        />
      </div>

      {loadError && (
        <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 whitespace-pre-line">
          Could not load dashboard data: {loadError}
        </div>
      )}

      {/* Recent Stores Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900">Recent Brands</h2>
          <span className="text-xs text-slate-500">Newest 5 records</span>
        </div>

        {isLoading ? (
          <div className="p-6 text-center text-slate-500 text-xs">Loading portfolio data...</div>
        ) : stores.length === 0 && !loadError ? (
          <div className="p-8 text-center">
            <Store className="h-8 w-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-600 font-medium text-xs">No stores registered yet.</p>
            <p className="text-slate-400 text-xs mt-1">
              Use the Store Creator to launch your first brand on the unified infrastructure.
            </p>
            <button
              onClick={onNavigateToCreateStore}
              className="mt-3 px-3.5 py-2 bg-slate-900 text-white rounded-md text-xs font-semibold hover:bg-slate-800 transition"
            >
              Launch New Brand
            </button>
          </div>
        ) : stores.length === 0 ? null : (
          <>
            {/* Mobile/Tablet Card View for Recent Stores (< 1024px) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-3 p-3">
              {stores.map((store) => {
                const href = storefrontUrl(store.primary_domain);
                return (
                  <div key={store.id} className="bg-slate-50 p-3.5 rounded-lg border border-slate-200/80 space-y-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-bold text-slate-900 text-sm block">{store.name}</span>
                        <span className="font-mono text-xs text-slate-500 block mt-0.5">{store.slug}</span>
                      </div>
                      <StatusBadge status={store.status} />
                    </div>
                    <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/60">
                      <span className="text-slate-500 font-medium">Theme: {store.active_theme || 'Not assigned'}</span>
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center text-teal-600 hover:text-teal-800 font-semibold space-x-1"
                        >
                          <span>Storefront</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : (
                        <span className="text-slate-400">No primary domain</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (>= 1024px) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-xs font-bold tracking-wider">
                  <tr>
                    <th className="px-3.5 py-2.5">Store Name</th>
                    <th className="px-3.5 py-2.5">Identifier (Slug)</th>
                    <th className="px-3.5 py-2.5">Status</th>
                    <th className="px-3.5 py-2.5">Primary Domain</th>
                    <th className="px-3.5 py-2.5">Active Theme</th>
                    <th className="px-3.5 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stores.map((store) => {
                    const href = storefrontUrl(store.primary_domain);
                    return (
                      <tr key={store.id} className="hover:bg-slate-50/80 transition">
                        <td className="px-3.5 py-2.5 font-bold text-slate-900 text-sm">{store.name}</td>
                        <td className="px-3.5 py-2.5 font-mono text-xs text-slate-600">{store.slug}</td>
                        <td className="px-3.5 py-2.5">
                          <StatusBadge status={store.status} />
                        </td>
                        <td className="px-3.5 py-2.5 text-slate-600 text-xs">{store.primary_domain || '—'}</td>
                        <td className="px-3.5 py-2.5 text-slate-600 text-xs">{store.active_theme || 'Not assigned'}</td>
                        <td className="px-3.5 py-2.5 text-right">
                          {href ? (
                            <a
                              href={href}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center text-teal-600 hover:text-teal-800 font-semibold text-xs space-x-1"
                            >
                              <span>Storefront</span>
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : (
                            <span className="text-slate-400">No primary domain</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
