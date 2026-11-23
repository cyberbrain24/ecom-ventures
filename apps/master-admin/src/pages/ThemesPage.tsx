import React, { useEffect, useState } from 'react';
import { Palette, PlusCircle, CheckCircle2 } from 'lucide-react';
import { MetricCard } from '../components/ui/MetricCard';
import { ThemeItem } from '../types/theme';
import { StoreSummary, PaginatedStoresResponse } from '../types/store';
import { ThemeCard } from '../components/themes/ThemeCard';
import { AssignThemeModal } from '../components/themes/AssignThemeModal';
import { RegisterThemeModal } from '../components/themes/RegisterThemeModal';
import { EditThemeModal } from '../components/themes/EditThemeModal';
import { DeactivateThemeModal } from '../components/themes/DeactivateThemeModal';
import { api, apiErrorMessage } from '../lib/api';

/**
 * ThemesPage lists the theme registry from GET /platform/themes and handles registration,
 * assignment, editing and activation. Themes are never deleted: a theme can only be deactivated,
 * which asks for confirmation first and keeps existing storefronts unchanged.
 *
 * @returns The theme registry page
 */
export const ThemesPage: React.FC = () => {
  const [themes, setThemes] = useState<ThemeItem[]>([]);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [activeAssignTheme, setActiveAssignTheme] = useState<ThemeItem | null>(null);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [editingTheme, setEditingTheme] = useState<ThemeItem | null>(null);

  const [togglingThemeId, setTogglingThemeId] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);
  const [deactivatingTheme, setDeactivatingTheme] = useState<ThemeItem | null>(null);
  const [deactivateError, setDeactivateError] = useState<string | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    setDataError(null);
    try {
      const [themeRes, storeRes] = await Promise.all([
        api.get<{ data: ThemeItem[] }>('/platform/themes'),
        api.get<PaginatedStoresResponse>('/platform/stores?page=1&limit=100'),
      ]);
      setThemes(themeRes.data.data || []);
      setStores(storeRes.data.data || []);
    } catch (error) {
      setThemes([]);
      setStores([]);
      setDataError(apiErrorMessage(error, 'Could not load themes.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleUpdateTheme = async (updated: ThemeItem): Promise<void> => {
    await api.patch(`/platform/themes/${updated.id}`, {
      name: updated.name,
      description: updated.description,
      version: updated.version,
      preview_image_url: updated.preview_image_url,
      config_schema: updated.config_schema,
      is_active: updated.is_active,
    });
    await fetchData();
    setEditingTheme(null);
  };

  /**
   * Sets a theme's active flag through PATCH /platform/themes/{id}. Throws the server error so the
   * caller can show it inline.
   *
   * @param theme - Theme to change
   * @param isActive - Target active state
   */
  const setThemeActive = async (theme: ThemeItem, isActive: boolean): Promise<void> => {
    await api.patch(`/platform/themes/${theme.id}`, { is_active: isActive });
  };

  const handleActivate = async (theme: ThemeItem) => {
    setTogglingThemeId(theme.id);
    setToggleError(null);
    try {
      await setThemeActive(theme, true);
      setNotice(`Theme "${theme.name}" was activated. Stores can now choose it.`);
      await fetchData();
    } catch (error) {
      setToggleError(apiErrorMessage(error, `Could not activate theme "${theme.name}".`));
    } finally {
      setTogglingThemeId(null);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivatingTheme) return;
    const target = deactivatingTheme;
    setTogglingThemeId(target.id);
    setDeactivateError(null);
    try {
      await setThemeActive(target, false);
      setDeactivatingTheme(null);
      setNotice(`Theme "${target.name}" was deactivated. Existing storefronts keep their look.`);
      await fetchData();
    } catch (error) {
      setDeactivateError(apiErrorMessage(error, `Could not deactivate theme "${target.name}".`));
    } finally {
      setTogglingThemeId(null);
    }
  };

  const activeThemeCount = themes.filter((t) => t.is_active).length;

  return (
    <div className="space-y-3.5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Theme Registry & Marketplace</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage reusable presentation blueprints and assign them to portfolio storefronts. Themes can be deactivated but never deleted.
          </p>
        </div>

        <button
          onClick={() => setIsRegisterModalOpen(true)}
          className="inline-flex items-center px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-md shadow-sm transition space-x-2"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Register New Theme</span>
        </button>
      </div>

      {dataError && (
        <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 whitespace-pre-line">
          {dataError}
        </div>
      )}

      {toggleError && (
        <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 whitespace-pre-line">
          {toggleError}
        </div>
      )}

      {notice && (
        <div role="status" className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <span className="flex items-center space-x-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>{notice}</span>
          </span>
          <button onClick={() => setNotice(null)} className="font-semibold hover:underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Theme metrics: counts computed from the complete theme registry response */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <MetricCard
          title="Theme Blueprints"
          value={isLoading ? 'Loading' : themes.length}
          subtitle="Registered in the registry"
          icon={Palette}
        />
        <MetricCard
          title="Active Themes"
          value={isLoading ? 'Loading' : activeThemeCount}
          subtitle="Available for store creation and assignment"
          icon={CheckCircle2}
        />
      </div>

      {/* Theme Cards Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-500 text-xs">Loading theme blueprints...</div>
      ) : themes.length === 0 ? (
        <div className="p-12 bg-white rounded-xl border text-center text-slate-500">
          <Palette className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="font-semibold text-slate-700 text-xs">
            {dataError ? 'Themes could not be loaded.' : 'No themes registered.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5 items-stretch">
          {themes.map((theme) => (
            <ThemeCard
              key={theme.id}
              theme={theme}
              onAssignClick={(t) => setActiveAssignTheme(t)}
              onEditClick={(t) => setEditingTheme(t)}
              onToggleActiveClick={(t) => {
                if (t.is_active) {
                  setDeactivateError(null);
                  setDeactivatingTheme(t);
                } else {
                  handleActivate(t);
                }
              }}
              isToggling={togglingThemeId === theme.id}
            />
          ))}
        </div>
      )}

      {/* Edit Theme Modal */}
      {editingTheme && (
        <EditThemeModal
          theme={editingTheme}
          onClose={() => setEditingTheme(null)}
          onSave={handleUpdateTheme}
        />
      )}

      {/* Deactivate Confirmation Modal */}
      {deactivatingTheme && (
        <DeactivateThemeModal
          theme={deactivatingTheme}
          storeCount={
            typeof deactivatingTheme.active_stores_count === 'number' ? deactivatingTheme.active_stores_count : null
          }
          isSubmitting={togglingThemeId === deactivatingTheme.id}
          errorMessage={deactivateError}
          onConfirm={handleConfirmDeactivate}
          onClose={() => {
            setDeactivateError(null);
            setDeactivatingTheme(null);
          }}
        />
      )}

      {/* Assign Theme Modal */}
      {activeAssignTheme && (
        <AssignThemeModal
          theme={activeAssignTheme}
          stores={stores}
          onClose={() => setActiveAssignTheme(null)}
          onSuccess={(message) => {
            setNotice(message);
            fetchData();
          }}
        />
      )}

      {/* Register Theme Modal */}
      {isRegisterModalOpen && (
        <RegisterThemeModal
          onClose={() => setIsRegisterModalOpen(false)}
          onRegistered={() => fetchData()}
        />
      )}
    </div>
  );
};
