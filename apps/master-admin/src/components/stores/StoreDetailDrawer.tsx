/**
 * StoreDetailDrawer renders a deep-inspection slide-over panel displaying
 * dedicated database connection parameters, domain mappings, and operational controls.
 * Status changes go through the branded confirmation modal; errors are shown inline.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { X, Database, Globe, Palette, AlertCircle, RotateCcw, ShieldCheck, Mail, User, Edit3 } from 'lucide-react';
import { StoreDetailResponse, StoreStatus, StoreSummary } from '../../types/store';
import { ThemeItem } from '../../types/theme';
import { StatusBadge } from '../ui/StatusBadge';
import { ConfirmDeleteModal } from '../ui/ConfirmDeleteModal';
import { AssignThemeModal } from '../themes/AssignThemeModal';
import { EditStoreModal, StoreEditPayload } from './EditStoreModal';
import { api, apiErrorMessage } from '../../lib/api';

interface StoreDetailDrawerProps {
  storeId: string;
  onClose: () => void;
  onStatusUpdated: () => void;
  onEditStore?: (store: StoreSummary) => void;
}

/** Describes what each lifecycle status means for the storefront, shown in the confirmation. */
const STATUS_CONSEQUENCE: Record<StoreStatus, string> = {
  ACTIVE: 'Public storefront traffic will be enabled for this store.',
  PROVISIONING: 'The store will be marked as provisioning.',
  MAINTENANCE: 'The storefront will be put into read-only maintenance mode.',
  SUSPENDED: 'Routing and database access for this store will be blocked.',
  ARCHIVED: 'The store will be archived and moved to cold storage.',
};

/**
 * Loads one store with its domains and active theme, and offers lifecycle and theme actions.
 *
 * @param props - Store id, close handler, and callback after a status change
 * @returns The inspection drawer
 */
export const StoreDetailDrawer: React.FC<StoreDetailDrawerProps> = ({
  storeId,
  onClose,
  onStatusUpdated,
  onEditStore,
}) => {
  const [data, setData] = useState<StoreDetailResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [pendingStatus, setPendingStatus] = useState<StoreStatus | null>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [isPickingTheme, setIsPickingTheme] = useState(false);
  const [themes, setThemes] = useState<ThemeItem[]>([]);
  const [themesLoading, setThemesLoading] = useState(false);
  const [themesError, setThemesError] = useState<string | null>(null);
  const [assignTheme, setAssignTheme] = useState<ThemeItem | null>(null);
  const [isEditingStore, setIsEditingStore] = useState(false);

  const fetchDetails = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const res = await api.get<{ data: StoreDetailResponse }>(`/platform/stores/${storeId}`);
      if (!res.data?.data?.store) {
        throw new Error('The server returned store details in an unexpected format.');
      }
      setData(res.data.data);
    } catch (err) {
      setData(null);
      setLoadError(apiErrorMessage(err, 'Could not load store details.'));
    } finally {
      setIsLoading(false);
    }
  }, [storeId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const openThemePicker = async () => {
    setIsPickingTheme(true);
    setThemesLoading(true);
    setThemesError(null);
    try {
      const res = await api.get<{ data: ThemeItem[] }>('/platform/themes');
      setThemes(res.data?.data ?? []);
    } catch (err) {
      setThemes([]);
      setThemesError(apiErrorMessage(err, 'Could not load themes.'));
    } finally {
      setThemesLoading(false);
    }
  };

  const handleConfirmStatus = async () => {
    if (!pendingStatus) return;
    setIsUpdatingStatus(true);
    setStatusError(null);
    try {
      await api.patch(`/platform/stores/${storeId}/status`, {
        status: pendingStatus,
        reason: 'Super Admin administrative action via Master Admin Panel',
      });
      setPendingStatus(null);
      setNotice(`Store status changed to ${pendingStatus}.`);
      onStatusUpdated();
      await fetchDetails();
    } catch (err) {
      setStatusError(apiErrorMessage(err, 'Failed to update store status.'));
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  /** Store summary handed to AssignThemeModal so it can target this store. */
  const storeSummary = (detail: StoreDetailResponse): StoreSummary => {
    const primary = detail.domains.find((d) => d.is_primary);
    return {
      id: detail.store.id,
      name: detail.store.name,
      slug: detail.store.slug,
      status: detail.store.status,
      primary_domain: primary?.domain ?? '',
      active_theme: detail.active_theme?.name ?? '',
      contact_email: detail.store.contact_email,
      currency: detail.store.currency,
      created_at: detail.store.created_at,
      updated_at: detail.store.updated_at,
    };
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/50 backdrop-blur-sm flex justify-end">
      <div className="w-full sm:w-[540px] md:max-w-xl bg-white h-full shadow-2xl flex flex-col justify-between overflow-y-auto">
        {/* Drawer Header */}
        <div className="p-4 sm:p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50 sticky top-0 z-10">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-slate-900 truncate max-w-[240px] sm:max-w-xs">
              {data?.store.name || 'Store details'}
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

        {notice && (
          <div role="status" className="mx-4 sm:mx-6 mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            {notice}
          </div>
        )}

        {/* Drawer Content */}
        {isLoading ? (
          <div className="p-12 text-center text-slate-500 text-sm">Loading store details...</div>
        ) : loadError ? (
          <div className="p-6 sm:p-8 space-y-4">
            <div role="alert" className="flex items-start space-x-2 rounded-lg border border-rose-200 bg-rose-50 p-4 text-xs text-rose-800 whitespace-pre-line">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Store details could not be loaded: {loadError}</span>
            </div>
            <button
              type="button"
              onClick={fetchDetails}
              className="inline-flex items-center space-x-1.5 px-3 py-2 border border-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-100"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Retry</span>
            </button>
          </div>
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

            {/* Store Owner Administrator Profile */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2 text-sm font-bold text-slate-900">
                  <ShieldCheck className="h-4 w-4 text-teal-600" />
                  <span>Store Owner Administrator</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingStore(true)}
                  className="inline-flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg border border-teal-200 transition"
                  title="Edit store profile, brand name, owner email and password"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  <span>Edit Store & Owner</span>
                </button>
              </div>
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 flex items-center">
                    <Mail className="h-3.5 w-3.5 mr-1.5 text-slate-400" /> Login Email:
                  </span>
                  <span className="font-mono font-semibold text-slate-800">
                    {data.owner?.email || data.store.contact_email}
                  </span>
                </div>
                {(data.owner?.first_name || data.owner?.last_name) && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500 flex items-center">
                      <User className="h-3.5 w-3.5 mr-1.5 text-slate-400" /> Owner Name:
                    </span>
                    <span className="font-semibold text-slate-800">
                      {`${data.owner.first_name || ''} ${data.owner.last_name || ''}`.trim()}
                    </span>
                  </div>
                )}
                {data.store.contact_phone && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Contact Phone:</span>
                    <span className="font-mono text-slate-700">{data.store.contact_phone}</span>
                  </div>
                )}
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
              </div>
            </div>

            {/* Domain Network */}
            <div>
              <div className="flex items-center space-x-2 text-sm font-bold text-slate-900 mb-3">
                <Globe className="h-4 w-4 text-teal-600" />
                <span>Registered Domains ({data.domains.length})</span>
              </div>
              {data.domains.length === 0 ? (
                <p className="text-xs text-slate-500">No domains are registered for this store.</p>
              ) : (
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
                      <span className="text-[11px] text-slate-600 font-semibold">SSL: {dom.ssl_status}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Active Theme Blueprint */}
            <div>
              <div className="flex items-center space-x-2 text-sm font-bold text-slate-900 mb-3">
                <Palette className="h-4 w-4 text-teal-600" />
                <span>Active Theme</span>
              </div>
              <div className="p-4 bg-slate-50 border rounded-xl flex items-center justify-between gap-3">
                <div>
                  {data.active_theme ? (
                    <>
                      <span className="font-bold text-slate-900 text-sm block">{data.active_theme.name}</span>
                      <span className="text-xs text-slate-500 font-mono">
                        Slug: {data.active_theme.slug} (v{data.active_theme.version})
                      </span>
                    </>
                  ) : (
                    <span className="text-sm text-slate-600">No theme assigned</span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={openThemePicker}
                  className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg hover:bg-slate-100 transition"
                >
                  Change Theme
                </button>
              </div>

              {isPickingTheme && (
                <div className="mt-3 p-4 border rounded-xl space-y-3">
                  <p className="text-xs text-slate-600">Choose an active theme to assign to this store.</p>
                  {themesLoading && <p className="text-xs text-slate-500">Loading themes...</p>}
                  {themesError && (
                    <p role="alert" className="text-xs text-rose-700">Themes could not be loaded: {themesError}</p>
                  )}
                  {!themesLoading && !themesError && themes.length === 0 && (
                    <p className="text-xs text-slate-500">No active themes are registered.</p>
                  )}
                  {themes.map((theme) => (
                    <button
                      key={theme.id}
                      type="button"
                      disabled={!theme.is_active}
                      onClick={() => {
                        if (!theme.is_active) return;
                        setAssignTheme(theme);
                        setIsPickingTheme(false);
                      }}
                      className="w-full text-left px-3 py-2 border rounded-lg text-xs hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-white"
                    >
                      <span className="font-semibold text-slate-900">{theme.name}</span>
                      <span className="ml-2 font-mono text-slate-500">{theme.slug}</span>
                      {!theme.is_active && (
                        <span className="block mt-1 text-[11px] text-amber-800">
                          Inactive: deactivated in the Theme Registry, so it cannot be assigned.
                        </span>
                      )}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setIsPickingTheme(false)}
                    className="text-xs font-semibold text-slate-600 hover:underline"
                  >
                    Cancel
                  </button>
                </div>
              )}
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
                    onClick={() => {
                      setStatusError(null);
                      setPendingStatus('ACTIVE');
                    }}
                    className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
                  >
                    Activate Store
                  </button>
                )}
                {data.store.status !== 'MAINTENANCE' && (
                  <button
                    disabled={isUpdatingStatus}
                    onClick={() => {
                      setStatusError(null);
                      setPendingStatus('MAINTENANCE');
                    }}
                    className="min-h-[44px] px-4 py-2.5 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition flex items-center justify-center disabled:opacity-50"
                  >
                    Maintenance Mode
                  </button>
                )}
                {data.store.status !== 'SUSPENDED' && (
                  <button
                    disabled={isUpdatingStatus}
                    onClick={() => {
                      setStatusError(null);
                      setPendingStatus('SUSPENDED');
                    }}
                    className="min-h-[44px] px-4 py-2.5 bg-rose-600 text-white rounded-lg text-xs font-semibold hover:bg-rose-700 transition flex items-center justify-center disabled:opacity-50"
                  >
                    Suspend Store
                  </button>
                )}
                {data.store.status !== 'ARCHIVED' && (
                  <button
                    disabled={isUpdatingStatus}
                    onClick={() => {
                      setStatusError(null);
                      setPendingStatus('ARCHIVED');
                    }}
                    className="min-h-[44px] px-4 py-2.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-900 transition flex items-center justify-center disabled:opacity-50"
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

      {/* Status change confirmation */}
      {pendingStatus && data && (
        <ConfirmDeleteModal
          isOpen={true}
          title="Change Store Status"
          itemName={`${data.store.name} (${data.store.slug})`}
          itemType="Store"
          warningMessage={`Change this store from ${data.store.status} to ${pendingStatus}? ${STATUS_CONSEQUENCE[pendingStatus]}`}
          confirmButtonText="Confirm Status Change"
          busyButtonText="Updating..."
          isDeleting={isUpdatingStatus}
          errorMessage={statusError}
          onConfirm={handleConfirmStatus}
          onClose={() => {
            setStatusError(null);
            setPendingStatus(null);
          }}
        />
      )}

      {/* Theme assignment for this store */}
      {assignTheme && data && (
        <AssignThemeModal
          theme={assignTheme}
          stores={[storeSummary(data)]}
          initialStoreId={data.store.id}
          onClose={() => setAssignTheme(null)}
          onSuccess={(message) => {
            setNotice(message);
            onStatusUpdated();
            fetchDetails();
          }}
        />
      )}

      {/* Edit Store & Owner Credentials Modal */}
      {isEditingStore && data && (
        <EditStoreModal
          store={storeSummary(data)}
          onClose={() => setIsEditingStore(false)}
          onSave={async (id: string, payload: StoreEditPayload) => {
            await api.patch(`/platform/stores/${id}`, payload);
            setIsEditingStore(false);
            setNotice('Store profile and owner administrator credentials updated successfully.');
            onStatusUpdated();
            await fetchDetails();
          }}
        />
      )}
    </div>
  );
};
