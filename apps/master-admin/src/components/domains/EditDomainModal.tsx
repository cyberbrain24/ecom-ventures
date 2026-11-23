import React, { useState } from 'react';
import { X, Save, Globe } from 'lucide-react';
import { DomainItem } from '../../types/domain';
import { apiErrorMessage } from '../../lib/api';

interface EditDomainModalProps {
  domain: DomainItem;
  onClose: () => void;
  /** Resolves when the server accepted the change; rejects with a message to show inside the modal. */
  onSave: (updatedDomain: DomainItem) => Promise<void>;
}

/**
 * EditDomainModal edits a domain route. It stays open and shows the server error when saving fails.
 *
 * @param props - Domain to edit, close handler, and async save handler
 * @returns The edit modal
 */
export const EditDomainModal: React.FC<EditDomainModalProps> = ({ domain, onClose, onSave }) => {
  const [domainName, setDomainName] = useState(domain.domain);
  const [isPrimary, setIsPrimary] = useState(domain.is_primary);
  const [isCustom, setIsCustom] = useState(domain.is_custom);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSubmitting(true);
    const updated: DomainItem = {
      ...domain,
      domain: domainName.trim().toLowerCase(),
      is_primary: isPrimary,
      is_custom: isCustom,
      updated_at: new Date().toISOString(),
    };
    try {
      await onSave(updated);
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Could not save domain changes.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="h-6 w-6 rounded bg-teal-500 flex items-center justify-center text-white">
              <Globe className="h-3.5 w-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold leading-none">Edit Domain Route</h3>
              <p className="text-[10px] text-teal-400 font-mono mt-0.5">{domain.store_name} (/{domain.store_slug})</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {errorMsg && (
            <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 whitespace-pre-line">
              {errorMsg}
            </div>
          )}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Domain Hostname
            </label>
            <input
              type="text"
              required
              value={domainName}
              onChange={(e) => setDomainName(e.target.value)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
            />
            <p className="mt-1 text-[10px] text-amber-700 leading-snug">
              Renaming resets verification: the domain goes back to PENDING with a new DNS TXT token and must be verified again.
            </p>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Edge SSL Routing Status
            </label>
            <input
              readOnly
              aria-readonly="true"
              value={domain.ssl_status}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-slate-50 text-slate-500 font-mono"
            />
            <p className="mt-1 text-[10px] text-slate-500 leading-snug">
              Read-only. It is set by DNS verification, not edited by hand.
            </p>
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPrimary}
                disabled={domain.is_primary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                className="h-3.5 w-3.5 text-teal-600 focus:ring-teal-500 border-slate-300 rounded"
              />
              <span className="text-xs text-slate-700 font-medium">Designate as Primary Storefront Route</span>
            </label>
            <p className="ml-5 text-[10px] text-slate-500 leading-snug">
              A primary domain cannot be un-set directly. To change it, set another verified domain as primary instead.
            </p>

            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isCustom}
                onChange={(e) => setIsCustom(e.target.checked)}
                className="h-3.5 w-3.5 text-teal-600 focus:ring-teal-500 border-slate-300 rounded"
              />
              <span className="text-xs text-slate-700 font-medium">Apex Custom Domain (CNAME / ALIAS)</span>
            </label>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3 py-1.5 border border-slate-300 rounded-md text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-md text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSubmitting ? 'Saving...' : 'Save Domain Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
