/**
 * StoreTable renders a paginated portfolio data grid with active theme, domain,
 * lifecycle badges, and inspection actions.
 */

import React from 'react';
import { StoreSummary } from '../../types/store';
import { StatusBadge } from '../ui/StatusBadge';
import { ExternalLink, Eye, Pencil, Trash2 } from 'lucide-react';

interface StoreTableProps {
  stores: StoreSummary[];
  isLoading: boolean;
  onSelectStore: (storeId: string) => void;
  onEditStore?: (store: StoreSummary) => void;
  onDeleteStore?: (store: StoreSummary) => void;
}

export const StoreTable: React.FC<StoreTableProps> = ({
  stores,
  isLoading,
  onSelectStore,
  onEditStore,
  onDeleteStore,
}) => {
  if (isLoading) {
    return <div className="p-12 text-center text-slate-500 text-sm">Loading portfolio registry...</div>;
  }

  if (stores.length === 0) {
    return (
      <div className="p-12 text-center text-slate-500 text-sm">
        No stores found matching the active search or status criteria.
      </div>
    );
  }

  return (
    <>
      {/* Mobile Card Stack View (< 768px Viewports) */}
      <div className="block md:hidden space-y-3.5 p-3 sm:p-4">
        {stores.map((store) => (
          <div
            key={store.id}
            className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3 transition hover:border-slate-300"
          >
            {/* Header: Brand Name & Status Badge */}
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <span className="font-bold text-slate-900 text-sm block truncate">
                  {store.name}
                </span>
                <span className="text-xs text-slate-400 block truncate mt-0.5">
                  {store.contact_email}
                </span>
              </div>
              <div className="flex-shrink-0">
                <StatusBadge status={store.status} />
              </div>
            </div>

            {/* Metadata Grid */}
            <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-slate-100">
              <div>
                <span className="text-[11px] text-slate-400 font-medium block">Store Slug</span>
                <span className="font-mono text-slate-700 truncate block mt-0.5">
                  {store.slug}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-slate-400 font-medium block">Assigned Theme</span>
                <span className="text-slate-800 font-semibold truncate block mt-0.5">
                  {store.active_theme}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-[11px] text-slate-400 font-medium block">Primary Domain</span>
                <span className="font-mono text-slate-700 truncate block mt-0.5">
                  {store.primary_domain || 'None (Using default route)'}
                </span>
              </div>
            </div>

            {/* Action Bar with min 44x44px touch targets */}
            <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
              <span className="text-[11px] text-slate-400">
                {new Date(store.created_at).toLocaleDateString()}
              </span>

              <div className="flex items-center space-x-1">
                <button
                  onClick={() => onSelectStore(store.id)}
                  className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-slate-600 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition"
                  title="Inspect Store"
                  aria-label={`Inspect ${store.name}`}
                >
                  <Eye className="h-4 w-4" />
                </button>
                {onEditStore && (
                  <button
                    onClick={() => onEditStore(store)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    title="Edit Store"
                    aria-label={`Edit ${store.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
                {onDeleteStore && (
                  <button
                    onClick={() => onDeleteStore(store)}
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                    title="Delete Store"
                    aria-label={`Delete ${store.name}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
                {store.primary_domain && (
                  <a
                    href={`http://${store.primary_domain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                    title="Open Storefront"
                    aria-label={`Open storefront for ${store.name}`}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Standard Desktop Table View (>= 768px Viewports) */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-xs font-bold tracking-wider">
            <tr>
              <th className="px-3.5 py-2.5">Brand & Identity</th>
              <th className="px-3.5 py-2.5">Identifier (Slug)</th>
              <th className="px-3.5 py-2.5">Status</th>
              <th className="px-3.5 py-2.5">Primary Domain</th>
              <th className="px-3.5 py-2.5">Assigned Theme</th>
              <th className="px-3.5 py-2.5">Created Date</th>
              <th className="px-3.5 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {stores.map((store) => (
              <tr key={store.id} className="hover:bg-slate-50/80 transition">
                <td className="px-3.5 py-2.5">
                  <span className="font-bold text-slate-900 text-sm block leading-tight">{store.name}</span>
                  <span className="text-xs text-slate-400 block leading-tight mt-0.5">{store.contact_email}</span>
                </td>
                <td className="px-3.5 py-2.5 font-mono text-xs text-slate-600">{store.slug}</td>
                <td className="px-3.5 py-2.5">
                  <StatusBadge status={store.status} />
                </td>
                <td className="px-3.5 py-2.5 font-mono text-xs text-slate-700">{store.primary_domain || '—'}</td>
                <td className="px-3.5 py-2.5 text-slate-700 text-xs font-medium">{store.active_theme}</td>
                <td className="px-3.5 py-2.5 text-slate-500 text-xs">
                  {new Date(store.created_at).toLocaleDateString()}
                </td>
                <td className="px-3.5 py-2.5 text-right">
                  <div className="inline-flex items-center space-x-1">
                    <button
                      onClick={() => onSelectStore(store.id)}
                      className="p-1.5 text-slate-500 hover:text-teal-600 hover:bg-teal-50 rounded transition"
                      title="Inspect Store"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    {onEditStore && (
                      <button
                        onClick={() => onEditStore(store)}
                        className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                        title="Edit Store"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {onDeleteStore && (
                      <button
                        onClick={() => onDeleteStore(store)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                        title="Delete Store"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                    <a
                      href={`http://${store.primary_domain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded transition"
                      title="Open Storefront"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
};
