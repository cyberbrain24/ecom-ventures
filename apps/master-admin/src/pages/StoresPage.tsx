/**
 * StoresPage provides the portfolio management view integrating live search,
 * status filtering, paginated data grid, wizard launch modal, and deep-inspection drawer.
 */

import React, { useEffect, useState } from 'react';
import { StoreTable } from '../components/stores/StoreTable';
import { StoreCreatorWizard } from '../components/stores/StoreCreatorWizard';
import { StoreDetailDrawer } from '../components/stores/StoreDetailDrawer';
import { EditStoreModal, StoreEditPayload } from '../components/stores/EditStoreModal';
import { ConfirmDeleteModal } from '../components/ui/ConfirmDeleteModal';
import { StoreSummary, PaginatedStoresResponse } from '../types/store';
import { PlusCircle, Search, Filter, Store, CheckCircle2, Layers } from 'lucide-react';
import { MetricCard } from '../components/ui/MetricCard';
import { api, apiErrorMessage } from '../lib/api';
import { fetchStoreTotal } from '../lib/store-totals';

interface StoresPageProps {
  initialCreating?: boolean;
}

/**
 * Renders the store registry: API-reported totals, a filtered paginated table, and the
 * create, edit, delete and inspect flows.
 *
 * @param props - Optional flag to open the creation wizard immediately
 * @returns The store portfolio page
 */
export const StoresPage: React.FC<StoresPageProps> = ({ initialCreating = false }) => {
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [activeTotal, setActiveTotal] = useState<number | null>(null);
  const [provisioningTotal, setProvisioningTotal] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Filter & Search states
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Modal / Drawer states
  const [isCreatingStore, setIsCreatingStore] = useState(initialCreating);
  const [inspectedStoreId, setInspectedStoreId] = useState<string | null>(null);
  const [editingStore, setEditingStore] = useState<StoreSummary | null>(null);
  const [deletingStore, setDeletingStore] = useState<StoreSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const fetchStores = async (): Promise<void> => {
    setIsLoading(true);
    setDataError(null);
    try {
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('limit', '10');
      if (search) params.append('search', search);
      if (statusFilter) params.append('status', statusFilter);

      const res = await api.get<PaginatedStoresResponse>(`/platform/stores?${params.toString()}`);
      const pageTotal = res.data.meta?.total;
      if (typeof pageTotal !== 'number') {
        throw new Error('The server did not return a store total.');
      }
      setStores(res.data.data || []);
      setTotal(pageTotal);
    } catch (error) {
      setStores([]);
      setTotal(null);
      setDataError(apiErrorMessage(error, 'Could not load stores.'));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPortfolioTotals = async (): Promise<void> => {
    try {
      const [all, active, provisioning] = await Promise.all([
        fetchStoreTotal(),
        fetchStoreTotal('ACTIVE'),
        fetchStoreTotal('PROVISIONING'),
      ]);
      setTotal(all);
      setActiveTotal(active);
      setProvisioningTotal(provisioning);
    } catch (error) {
      setTotal(null);
      setActiveTotal(null);
      setProvisioningTotal(null);
      setDataError(apiErrorMessage(error, 'Could not load portfolio totals.'));
    }
  };

  useEffect(() => {
    fetchStores();
  }, [currentPage, statusFilter]);

  useEffect(() => {
    fetchPortfolioTotals();
  }, []);

  const refreshAll = async () => {
    await Promise.all([fetchStores(), fetchPortfolioTotals()]);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchStores();
  };

  const handleUpdateStore = async (storeId: string, changes: StoreEditPayload): Promise<void> => {
    await api.patch(`/platform/stores/${storeId}`, changes);
    await refreshAll();
    setEditingStore(null);
  };

  const handleDeleteStore = async () => {
    if (!deletingStore) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/platform/stores/${deletingStore.id}`);
      setDeletingStore(null);
      await refreshAll();
    } catch (error) {
      setDeleteError(apiErrorMessage(error, 'Failed to delete store and its database.'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Store Portfolio Registry</h1>
          <p className="text-xs text-slate-500 mt-1">
            Oversee and provision brand tenants, each with its own database.
          </p>
        </div>

        {!isCreatingStore && (
          <button
            onClick={() => setIsCreatingStore(true)}
            className="inline-flex items-center px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-md shadow-sm transition space-x-2"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Launch New Brand</span>
          </button>
        )}
      </div>

      {/* Stores Overview Metrics: totals reported by the API */}
      {!isCreatingStore && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <MetricCard
            title="Total Brands"
            value={total ?? 'Not available'}
            subtitle="Tenant registry total"
            icon={Store}
          />
          <MetricCard
            title="Active Stores"
            value={activeTotal ?? 'Not available'}
            subtitle="Status ACTIVE"
            icon={CheckCircle2}
          />
          <MetricCard
            title="Provisioning"
            value={provisioningTotal ?? 'Not available'}
            subtitle="Status PROVISIONING"
            icon={Layers}
          />
        </div>
      )}

      {dataError && (
        <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 whitespace-pre-line">
          {dataError}
        </div>
      )}

      {/* Creation Wizard Mode */}
      {isCreatingStore ? (
        <StoreCreatorWizard
          onCancel={() => setIsCreatingStore(false)}
          onSuccess={(newId) => {
            setIsCreatingStore(false);
            setInspectedStoreId(newId);
            refreshAll();
          }}
        />
      ) : (
        /* Data Grid & Filter Toolbar Mode */
        <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
          {/* Toolbar */}
          <div className="p-3 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-50/50">
            <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-80">
              <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                aria-label="Search by brand name or slug"
                placeholder="Search by brand name or slug..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border rounded-md text-xs bg-white outline-none focus:ring-1 focus:ring-teal-500"
              />
            </form>

            <div className="flex items-center space-x-2 w-full sm:w-auto">
              <div className="flex items-center space-x-1.5">
                <Filter className="h-4 w-4 text-slate-400" />
                <span className="text-xs font-medium text-slate-600">Status:</span>
              </div>
              <select
                aria-label="Filter stores by status"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="border rounded-md text-xs px-3 py-1.5 bg-white outline-none focus:ring-1 focus:ring-teal-500 font-medium"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="PROVISIONING">PROVISIONING</option>
                <option value="MAINTENANCE">MAINTENANCE</option>
                <option value="SUSPENDED">SUSPENDED</option>
                <option value="ARCHIVED">ARCHIVED</option>
              </select>
            </div>
          </div>

          {/* Table */}
          <StoreTable
            stores={stores}
            isLoading={isLoading}
            onSelectStore={(id) => setInspectedStoreId(id)}
            onEditStore={(store) => setEditingStore(store)}
            onDeleteStore={(store) => setDeletingStore(store)}
          />

          {/* Pagination */}
          <div className="px-4 py-2.5 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>
              Showing {stores.length} of {total ?? 'an unknown number of'} registered brands
            </span>
            <div className="space-x-2">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="px-3 py-1.5 border rounded text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                disabled={total === null || stores.length < 10 || currentPage * 10 >= total}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="px-3 py-1.5 border rounded text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Store Modal */}
      {editingStore && (
        <EditStoreModal
          store={editingStore}
          onClose={() => setEditingStore(null)}
          onSave={handleUpdateStore}
        />
      )}

      {/* Delete Approval Confirmation Modal */}
      {deletingStore && (
        <ConfirmDeleteModal
          isOpen={!!deletingStore}
          title="Delete Store Tenant"
          itemName={`${deletingStore.name} (${deletingStore.slug})`}
          itemType="Store Tenant"
          warningMessage="Are you sure you want to permanently delete this brand store tenant? This will decommission database linkages, domain routing, and tenant configurations."
          isDeleting={isDeleting}
          errorMessage={deleteError}
          onConfirm={handleDeleteStore}
          onClose={() => {
            setDeleteError(null);
            setDeletingStore(null);
          }}
        />
      )}

      {/* Inspection Slide-over Drawer */}
      {inspectedStoreId && (
        <StoreDetailDrawer
          storeId={inspectedStoreId}
          onClose={() => setInspectedStoreId(null)}
          onStatusUpdated={() => refreshAll()}
        />
      )}
    </div>
  );
};
