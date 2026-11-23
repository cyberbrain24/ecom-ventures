import React, { useEffect, useState } from 'react';
import { PlusCircle, Trash2, CheckCircle2, Pencil, Globe, Server, Link2 } from 'lucide-react';
import { MetricCard } from '../components/ui/MetricCard';
import { DomainItem } from '../types/domain';
import { StoreSummary, PaginatedStoresResponse } from '../types/store';
import { DNSInstructionsModal } from '../components/domains/DNSInstructionsModal';
import { AddDomainModal } from '../components/domains/AddDomainModal';
import { EditDomainModal } from '../components/domains/EditDomainModal';
import { ConfirmDeleteModal } from '../components/ui/ConfirmDeleteModal';
import { api, apiErrorMessage } from '../lib/api';

/**
 * Domain Network page: lists domain routes, handles DNS verification, primary routing, attach and delete.
 *
 * @returns The domains page
 */
export const DomainsPage: React.FC = () => {
  const [domains, setDomains] = useState<DomainItem[]>([]);
  const [stores, setStores] = useState<StoreSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [activeInstructionsDomain, setActiveInstructionsDomain] = useState<DomainItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [editingDomain, setEditingDomain] = useState<DomainItem | null>(null);
  const [deletingDomain, setDeletingDomain] = useState<DomainItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [domRes, storeRes] = await Promise.all([
        api.get<{ data: DomainItem[] }>('/platform/domains'),
        api.get<PaginatedStoresResponse>('/platform/stores?page=1&limit=100'),
      ]);
      setDomains(domRes.data.data || []);
      setStores(storeRes.data.data || []);
    } catch (error) {
      setDomains([]);
      setStores([]);
      setFeedback({ type: 'error', text: apiErrorMessage(error, 'Could not load domains.') });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleVerify = async (domainId: string) => {
    setIsVerifying(true);
    setVerifyError(null);
    try {
      await api.post(`/platform/domains/${domainId}/verify`);
      setFeedback({ type: 'success', text: 'Domain verified successfully.' });
      setActiveInstructionsDomain(null);
      fetchData();
    } catch (err) {
      setVerifyError(apiErrorMessage(err, 'Verification failed. Check the DNS TXT record and try again.'));
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSetPrimary = async (domainId: string) => {
    setFeedback(null);
    try {
      await api.patch(`/platform/domains/${domainId}/primary`);
      setFeedback({ type: 'success', text: 'Primary domain routing updated successfully.' });
      fetchData();
    } catch (err) {
      setFeedback({ type: 'error', text: apiErrorMessage(err, 'Failed to update primary domain routing.') });
    }
  };

  const handleUpdateDomain = async (updated: DomainItem): Promise<void> => {
    await api.patch(`/platform/domains/${updated.id}`, {
      domain: updated.domain,
      is_primary: updated.is_primary,
      is_custom: updated.is_custom,
    });
    await fetchData();
    setEditingDomain(null);
  };

  const handleConfirmDeleteDomain = async () => {
    if (!deletingDomain) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/platform/domains/${deletingDomain.id}`);
      setDeletingDomain(null);
      await fetchData();
    } catch (err) {
      setDeleteError(apiErrorMessage(err, 'Could not delete domain.'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-3.5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Domain Network & Routing</h1>
          <p className="text-xs text-slate-500 mt-1">
            Manage custom apex domains, platform subdomains, DNS verifications, and Cloudflare SSL certificates.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="inline-flex items-center px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-md shadow-sm transition space-x-2"
        >
          <PlusCircle className="h-4 w-4" />
          <span>Attach Domain</span>
        </button>
      </div>

      {/* Domain metrics computed from the domain registry response */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          title="Total Domains"
          value={isLoading ? 'Loading' : domains.length}
          subtitle="All domain routes"
          icon={Globe}
        />
        <MetricCard
          title="Primary Routes"
          value={isLoading ? 'Loading' : domains.filter((d) => d.is_primary).length}
          subtitle="Marked as primary"
          icon={Server}
        />
        <MetricCard
          title="Custom Domains"
          value={isLoading ? 'Loading' : domains.filter((d) => d.is_custom).length}
          subtitle="Brand apex domains"
          icon={Link2}
        />
        <MetricCard
          title="DNS Verified"
          value={isLoading ? 'Loading' : domains.filter((d) => Boolean(d.verified_at)).length}
          subtitle="Verification recorded"
          icon={CheckCircle2}
        />
      </div>

      {/* Feedback Banner */}
      {feedback && (
        <div
          className={`p-3 rounded-lg text-xs font-semibold flex items-center justify-between ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}
        >
          <span>{feedback.text}</span>
          <button
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-2 text-xs"
          >
            ✕
          </button>
        </div>
      )}

      {/* Domain Registry Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-slate-500 text-xs">Loading domain network records...</div>
        ) : domains.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">No custom domains configured.</div>
        ) : (
          <>
            {/* Mobile/Tablet Card Stack View (< 1024px) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:hidden gap-3.5 p-3 sm:p-4">
              {domains.map((dom) => (
                <div
                  key={dom.id}
                  className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5 flex-wrap">
                        <span className="font-mono font-bold text-slate-900 text-xs sm:text-sm break-all">
                          {dom.domain}
                        </span>
                        {dom.is_primary && (
                          <span className="text-[10px] bg-teal-50 text-teal-700 font-bold px-1.5 py-0.5 rounded border border-teal-200">
                            PRIMARY
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-semibold text-slate-700 block mt-1">
                        {dom.store_name} <span className="font-mono text-slate-400 font-normal">/{dom.store_slug}</span>
                      </span>
                    </div>

                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold shrink-0 ${
                        dom.ssl_status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border border-amber-200'
                      }`}
                    >
                      {dom.ssl_status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-100">
                    <span className="text-slate-500 font-medium">
                      {dom.is_custom ? 'Apex Custom' : 'Platform Subdomain'}
                    </span>
                    <div>
                      {dom.verified_at ? (
                        <span className="text-emerald-600 flex items-center space-x-1 font-medium text-xs">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>DNS Verified</span>
                        </span>
                      ) : (
                        <button
                          onClick={() => setActiveInstructionsDomain(dom)}
                          className="text-teal-600 hover:text-teal-800 font-semibold underline text-xs min-h-[36px] inline-flex items-center"
                        >
                          Setup DNS
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Mobile Actions Bar with min 44px touch targets */}
                  <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                    <div>
                      {!dom.is_primary && dom.ssl_status === 'ACTIVE' && (
                        <button
                          onClick={() => handleSetPrimary(dom.id)}
                          className="min-h-[44px] px-3 py-1.5 text-xs border border-slate-300 rounded-lg hover:bg-slate-100 text-slate-700 font-semibold transition"
                        >
                          Set Primary
                        </button>
                      )}
                    </div>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => setEditingDomain(dom)}
                        className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-slate-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition"
                        title="Edit domain route"
                        aria-label={`Edit ${dom.domain}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      {!dom.is_primary && (
                        <button
                          onClick={() => setDeletingDomain(dom)}
                          className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
                          title="Delete Domain Route"
                          aria-label={`Delete ${dom.domain}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View (>= 1024px) */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-xs font-bold tracking-wider">
                  <tr>
                    <th className="px-3.5 py-2.5">Domain Name</th>
                    <th className="px-3.5 py-2.5">Assigned Brand</th>
                    <th className="px-3.5 py-2.5">Routing Tier</th>
                    <th className="px-3.5 py-2.5">Edge SSL Status</th>
                    <th className="px-3.5 py-2.5">DNS Verification</th>
                    <th className="px-3.5 py-2.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {domains.map((dom) => (
                    <tr key={dom.id} className="hover:bg-slate-50/80 transition">
                      <td className="px-3.5 py-2.5">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-slate-900 text-xs">{dom.domain}</span>
                          {dom.is_primary && (
                            <span className="text-[10px] bg-teal-50 text-teal-700 font-bold px-1.5 py-0.5 rounded border border-teal-200">
                              PRIMARY
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span className="font-semibold text-slate-800 text-xs block leading-tight">{dom.store_name}</span>
                        <span className="text-xs font-mono text-slate-400 block leading-tight">/{dom.store_slug}</span>
                      </td>
                      <td className="px-3.5 py-2.5 text-xs font-medium text-slate-600">
                        {dom.is_custom ? 'Apex Custom' : 'Platform Subdomain'}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                            dom.ssl_status === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {dom.ssl_status}
                        </span>
                      </td>
                      <td className="px-3.5 py-2.5 text-xs">
                        {dom.verified_at ? (
                          <span className="text-emerald-600 flex items-center space-x-1.5 font-medium text-xs">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Verified</span>
                          </span>
                        ) : (
                          <button
                            onClick={() => setActiveInstructionsDomain(dom)}
                            className="text-teal-600 hover:text-teal-800 font-semibold underline text-xs"
                          >
                            Setup DNS
                          </button>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        <div className="inline-flex items-center space-x-1.5">
                          {!dom.is_primary && dom.ssl_status === 'ACTIVE' && (
                            <button
                              onClick={() => handleSetPrimary(dom.id)}
                              className="px-2.5 py-1 text-xs border border-slate-300 rounded hover:bg-slate-100 text-slate-700 font-medium"
                            >
                              Set Primary
                            </button>
                          )}
                          <button
                            onClick={() => setEditingDomain(dom)}
                            className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded transition"
                            title="Edit domain route"
                            aria-label={`Edit ${dom.domain}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {!dom.is_primary && (
                            <button
                              onClick={() => setDeletingDomain(dom)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition"
                              title="Delete Domain Route"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Edit Domain Modal */}
      {editingDomain && (
        <EditDomainModal
          domain={editingDomain}
          onClose={() => setEditingDomain(null)}
          onSave={handleUpdateDomain}
        />
      )}

      {/* Delete Approval Confirmation Modal */}
      {deletingDomain && (
        <ConfirmDeleteModal
          isOpen={!!deletingDomain}
          title="Delete Domain Route"
          itemName={deletingDomain.domain}
          itemType="Domain Route"
          warningMessage={`Are you sure you want to permanently dissociate and delete the domain route "${deletingDomain.domain}"? Ingress traffic pointing to this hostname will cease to resolve to ${deletingDomain.store_name}.`}
          isDeleting={isDeleting}
          errorMessage={deleteError}
          onConfirm={handleConfirmDeleteDomain}
          onClose={() => {
            setDeleteError(null);
            setDeletingDomain(null);
          }}
        />
      )}

      {/* Instructions Modal */}
      {activeInstructionsDomain && (
        <DNSInstructionsModal
          domain={activeInstructionsDomain}
          onClose={() => {
            setVerifyError(null);
            setActiveInstructionsDomain(null);
          }}
          onVerify={() => handleVerify(activeInstructionsDomain.id)}
          isVerifying={isVerifying}
          errorMessage={verifyError}
        />
      )}

      {/* Add Domain Modal */}
      {isAddModalOpen && (
        <AddDomainModal
          stores={stores}
          onClose={() => setIsAddModalOpen(false)}
          onAdded={() => fetchData()}
        />
      )}
    </div>
  );
};
