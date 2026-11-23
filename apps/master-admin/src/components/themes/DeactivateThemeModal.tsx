import React from 'react';
import { AlertTriangle, Ban, X } from 'lucide-react';
import { ThemeItem } from '../../types/theme';

interface DeactivateThemeModalProps {
  theme: ThemeItem;
  /** Stores using the theme, or null when the API did not report a count. */
  storeCount: number | null;
  isSubmitting: boolean;
  /** Server error from the last attempt, shown inside the modal. */
  errorMessage: string | null;
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * DeactivateThemeModal asks for confirmation before a theme is deactivated. It names the theme,
 * states how many stores use it (or that the count is unavailable), and explains that existing
 * storefronts keep their look while no store can newly choose it.
 *
 * @param props - Theme, store count, busy flag, error text and handlers
 * @returns The deactivation confirmation modal
 */
export const DeactivateThemeModal: React.FC<DeactivateThemeModalProps> = ({
  theme,
  storeCount,
  isSubmitting,
  errorMessage,
  onConfirm,
  onClose,
}) => {
  const storeLine =
    storeCount === null
      ? 'The number of stores currently using this theme is unavailable.'
      : `${storeCount} ${storeCount === 1 ? 'store is' : 'stores are'} currently using this theme.`;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden">
        <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-amber-800">
            <div className="h-7 w-7 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 flex-shrink-0">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <h3 className="text-xs font-bold uppercase tracking-wider">Deactivate Theme</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="Close"
            className="p-1 text-slate-400 hover:text-slate-600 rounded transition disabled:opacity-50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <p className="text-xs text-slate-600 leading-relaxed">
            Deactivating this theme removes it from the choices offered when creating a store or assigning a theme.
          </p>

          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">Theme</span>
              <span className="font-mono font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 truncate max-w-[220px]">
                {theme.name} ({theme.slug})
              </span>
            </div>
            <p className="text-slate-700">{storeLine}</p>
          </div>

          <ul className="text-[11px] text-slate-600 space-y-1.5 list-disc pl-4">
            <li>Existing storefronts that use this theme keep their current look.</li>
            <li>No store can newly choose this theme until it is activated again.</li>
          </ul>

          {errorMessage && (
            <div role="alert" className="text-xs text-rose-800 bg-rose-50 border border-rose-200 p-2 rounded whitespace-pre-line">
              {errorMessage}
            </div>
          )}
        </div>

        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end space-x-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-3 py-1.5 border border-slate-300 rounded-md text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 transition disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isSubmitting}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            <Ban className="h-3.5 w-3.5" />
            <span>{isSubmitting ? 'Deactivating...' : 'Deactivate Theme'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
