import React, { useState } from 'react';
import { X, Palette, AlertCircle } from 'lucide-react';
import { ThemeItem, ThemeCustomConfig } from '../../types/theme';
import { StoreSummary } from '../../types/store';
import { api, apiErrorMessage } from '../../lib/api';
import { readThemePreview } from '../../lib/theme-preview';

interface AssignThemeModalProps {
  theme: ThemeItem;
  stores: StoreSummary[];
  /** Pre-selects this store when the modal is opened from a store (for example the store drawer). */
  initialStoreId?: string;
  onClose: () => void;
  /** Called after the server confirmed the assignment, with a message for the parent to show. */
  onSuccess: (message: string) => void;
}

/**
 * AssignThemeModal assigns a theme to one store through PUT /platform/stores/{id}/theme.
 * Errors stay inside the modal; success is reported to the parent instead of a browser alert.
 *
 * @param props - Theme, candidate stores, optional preselected store, and close and success handlers
 * @returns The assignment modal
 */
export const AssignThemeModal: React.FC<AssignThemeModalProps> = ({
  theme,
  stores,
  initialStoreId,
  onClose,
  onSuccess,
}) => {
  const preview = readThemePreview(theme.config_schema);
  const defaultPrimary = preview.colors.find((c) => c.key === 'primary')?.value || '#0d9488';
  const defaultSecondary = preview.colors.find((c) => c.key === 'secondary')?.value || '#14b8a6';
  const defaultHeading = preview.headingFont || 'Inter';

  const [selectedStoreId, setSelectedStoreId] = useState(
    initialStoreId && stores.some((s) => s.id === initialStoreId) ? initialStoreId : stores[0]?.id || ''
  );
  const [primaryColor, setPrimaryColor] = useState(defaultPrimary);
  const [secondaryColor, setSecondaryColor] = useState(defaultSecondary);
  const [headingFont, setHeadingFont] = useState(defaultHeading);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!theme.is_active) {
      setErrorMsg('This theme is inactive and cannot be assigned. Activate it in the Theme Registry first.');
      return;
    }
    if (!selectedStoreId) {
      setErrorMsg('Please select a target store.');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);

    const customConfig: ThemeCustomConfig = {
      colors: {
        primary: primaryColor,
        secondary: secondaryColor,
      },
      typography: {
        headingFont,
        bodyFont: 'Inter',
      },
    };

    try {
      await api.put(`/platform/stores/${selectedStoreId}/theme`, {
        theme_id: theme.id,
        custom_config: customConfig,
      });
      const storeName = stores.find((s) => s.id === selectedStoreId)?.name ?? 'the store';
      onSuccess(`Theme "${theme.name}" was assigned to ${storeName}.`);
      onClose();
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Failed to assign theme.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Palette className="h-5 w-5 text-teal-400" />
            <div>
              <h3 className="text-base font-bold">Assign Theme: {theme.name}</h3>
              <p className="text-xs text-slate-400">Hot-swap active storefront theme without redeployment</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {!theme.is_active && (
          <div role="status" className="mx-6 mt-4 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg">
            This theme is inactive. No store can be assigned it until it is activated in the Theme Registry.
          </div>
        )}

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Store Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase">Target Brand Store</label>
            <select
              value={selectedStoreId}
              onChange={(e) => setSelectedStoreId(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-teal-500"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.slug}) — Current: {s.active_theme}
                </option>
              ))}
            </select>
          </div>

          {/* Color Token Customization */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase">Primary Brand Hex</label>
              <div className="flex items-center space-x-2 mt-1">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-8 w-8 rounded border cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  aria-label="Primary Brand Color Hex"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-full px-2 py-1.5 border rounded-lg text-xs font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase">Secondary Accent</label>
              <div className="flex items-center space-x-2 mt-1">
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="h-8 w-8 rounded border cursor-pointer p-0.5"
                />
                <input
                  type="text"
                  aria-label="Secondary Accent Color Hex"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="w-full px-2 py-1.5 border rounded-lg text-xs font-mono"
                />
              </div>
            </div>
          </div>

          {/* Typography Token */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase">Heading Typography</label>
            <select
              value={headingFont}
              onChange={(e) => setHeadingFont(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="Inter">Inter (Modern Clean Sans)</option>
              <option value="Playfair Display">Playfair Display (Luxury Serif)</option>
              <option value="Cinzel">Cinzel (Classic Jewelry Elegance)</option>
              <option value="Montserrat">Montserrat (Contemporary Geometric)</option>
            </select>
          </div>

          {/* Footer Controls */}
          <div className="pt-4 flex justify-end space-x-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !theme.is_active}
              title={theme.is_active ? undefined : 'This theme is inactive'}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? 'Applying Theme...' : 'Confirm Theme Assignment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
