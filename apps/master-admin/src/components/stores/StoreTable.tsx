/**
 * StoreTable renders a responsive 5-column portfolio card grid with brand identity,
 * active theme, primary domain, lifecycle badges, and CRUD/inspection actions.
 */

import React from 'react';
import { StoreSummary } from '../../types/store';
import { StatusBadge } from '../ui/StatusBadge';
import { Calendar, ExternalLink, Eye, Globe, Mail, Palette, Pencil, Trash2 } from 'lucide-react';
import { storefrontUrl } from '../../lib/storefront-url';

interface StoreTableProps {
  stores: StoreSummary[];
  isLoading: boolean;
  onSelectStore: (storeId: string) => void;
  onEditStore?: (store: StoreSummary) => void;
  /** When set, the Edit buttons are disabled and this text is shown as their tooltip. */
  editDisabledReason?: string;
  onDeleteStore?: (store: StoreSummary) => void;
}

/**
 * StoreTable renders the store portfolio registry in a 5-column desktop grid layout.
 * Edit actions are shown disabled, with the reason, when the server has no update endpoint.
 *
 * @param props - Store items, loading flag, and card action handlers
 * @returns The responsive 5-column store card grid
 */
export const StoreTable: React.FC<StoreTableProps> = ({
  stores,
  isLoading,
  onSelectStore,
  onEditStore,
  editDisabledReason,
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
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5 p-3.5 sm:p-4 bg-slate-50/40">
      {stores.map((store) => {
        const liveUrl = storefrontUrl(store.primary_domain);
        const initial = store.name ? store.name.trim().charAt(0).toUpperCase() : 'S';

        return (
          <article
            key={store.id}
            className="group bg-white rounded-xl border border-slate-200 shadow-xs hover:shadow-md hover:border-teal-300 transition-all duration-200 flex flex-col justify-between overflow-hidden min-w-0"
          >
            <div>
              {/* Brand Header */}
              <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-teal-950 px-3 py-2.5 text-white">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-7 w-7 rounded-lg bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300 font-black text-xs flex-shrink-0">
                      {initial}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-xs text-white truncate leading-tight" title={store.name}>
                        {store.name}
                      </h3>
                      <span className="font-mono text-[10px] text-teal-300/90 block truncate mt-0.5">
                        /{store.slug}
                      </span>
                    </div>
                  </div>
                  <div className="flex-shrink-0 scale-90 origin-top-right">
                    <StatusBadge status={store.status} />
                  </div>
                </div>
              </div>

              {/* Store Details */}
              <div className="p-3 space-y-2 text-[11px]">
                <div className="flex items-start gap-1.5 min-w-0">
                  <Globe className="h-3.5 w-3.5 text-teal-600 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block leading-none">
                      Primary Domain
                    </span>
                    <span
                      className="font-mono text-slate-800 font-medium truncate block mt-0.5"
                      title={store.primary_domain || 'Not set'}
                    >
                      {store.primary_domain || '—'}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-1.5 min-w-0">
                  <Palette className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold block leading-none">
                      Active Theme
                    </span>
                    <span className="text-slate-800 font-semibold truncate block mt-0.5" title={store.active_theme}>
                      {store.active_theme}
                    </span>
                  </div>
                </div>

                <div className="flex items-start gap-1.5 min-w-0">
                  <Mail className="h-3.5 w-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-500 truncate block" title={store.contact_email}>
                    {store.contact_email || '—'}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-1.5 border-t border-slate-100 text-[10px] text-slate-500">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-slate-400" />
                    {new Date(store.created_at).toLocaleDateString()}
                  </span>
                  {store.currency && (
                    <span className="font-mono font-semibold text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded">
                      {store.currency}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Card Footer Actions */}
            <div className="px-2.5 py-2 bg-slate-50/90 border-t border-slate-100 flex items-center justify-between gap-1">
              <button
                type="button"
                onClick={() => onSelectStore(store.id)}
                className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-teal-700 hover:bg-teal-50 rounded-md transition"
                title="Inspect Store"
                aria-label={`Inspect ${store.name}`}
              >
                <Eye className="h-3.5 w-3.5" />
                <span>Inspect</span>
              </button>

              <div className="flex items-center gap-0.5">
                {onEditStore && (
                  <button
                    type="button"
                    onClick={() => onEditStore(store)}
                    disabled={!!editDisabledReason}
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-md transition disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-500"
                    title={editDisabledReason ?? 'Edit Store'}
                    aria-label={`Edit ${store.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                {onDeleteStore && (
                  <button
                    type="button"
                    onClick={() => onDeleteStore(store)}
                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition"
                    title="Delete Store"
                    aria-label={`Delete ${store.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                {liveUrl && (
                  <a
                    href={liveUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200/70 rounded-md transition"
                    title="Open Storefront"
                    aria-label={`Open storefront for ${store.name}`}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
};
