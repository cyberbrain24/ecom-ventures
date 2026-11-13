import React, { useState } from 'react';
import { X, Globe } from 'lucide-react';
import { StoreSummary } from '../../types/store';
import { api } from '../../lib/api';

interface AddDomainModalProps {
  stores: StoreSummary[];
  onClose: () => void;
  onAdded: () => void;
}

export const AddDomainModal: React.FC<AddDomainModalProps> = ({ stores, onClose, onAdded }) => {
  const [storeId, setStoreId] = useState(stores[0]?.id || '');
  const [domain, setDomain] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);

    try {
      await api.post('/platform/domains', {
        store_id: storeId,
        domain: domain.toLowerCase().trim(),
        is_custom: true,
        is_primary: isPrimary,
      });
      onAdded();
      onClose();
    } catch (err: any) {
      if (err.response?.data?.detail) {
        setErrorMsg(err.response.data.detail);
      } else {
        setErrorMsg('Failed to bind domain. Please check format.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Globe className="h-5 w-5 text-teal-400" />
            <h3 className="text-base font-bold">Attach Custom Domain</h3>
          </div>
          <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-white rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mx-6 mt-4 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-lg">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase">Target Brand Store</label>
            <select
              required
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-teal-500"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.slug})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase">Fully Qualified Domain (FQDN)</label>
            <input
              type="text"
              required
              aria-label="Fully Qualified Domain Name"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="mt-1 w-full px-3 py-2 border rounded-lg text-sm font-mono outline-none focus:ring-2 focus:ring-teal-500"
            />
            <span className="text-[11px] text-slate-400 mt-1 block">Format: mior.com or shop.branda.com</span>
          </div>

          <div className="flex items-center space-x-2 pt-2">
            <input
              type="checkbox"
              id="isPrimary"
              checked={isPrimary}
              onChange={(e) => setIsPrimary(e.target.checked)}
              className="rounded text-teal-600 focus:ring-teal-500"
            />
            <label htmlFor="isPrimary" className="text-xs text-slate-600">
              Promote to primary storefront domain immediately
            </label>
          </div>

          <div className="pt-4 flex justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? 'Registering...' : 'Register Domain'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
