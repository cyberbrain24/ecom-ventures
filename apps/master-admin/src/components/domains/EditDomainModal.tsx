import React, { useState } from 'react';
import { X, Save, Globe } from 'lucide-react';
import { DomainItem, SSLStatus } from '../../types/domain';

interface EditDomainModalProps {
  domain: DomainItem;
  onClose: () => void;
  onSave: (updatedDomain: DomainItem) => void;
}

export const EditDomainModal: React.FC<EditDomainModalProps> = ({ domain, onClose, onSave }) => {
  const [domainName, setDomainName] = useState(domain.domain);
  const [isPrimary, setIsPrimary] = useState(domain.is_primary);
  const [isCustom, setIsCustom] = useState(domain.is_custom);
  const [sslStatus, setSslStatus] = useState<SSLStatus>(domain.ssl_status);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const updated: DomainItem = {
      ...domain,
      domain: domainName.trim().toLowerCase(),
      is_primary: isPrimary,
      is_custom: isCustom,
      ssl_status: sslStatus,
      updated_at: new Date().toISOString(),
    };
    onSave(updated);
    setIsSubmitting(false);
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
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Edge SSL Routing Status
            </label>
            <select
              value={sslStatus}
              onChange={(e) => setSslStatus(e.target.value as SSLStatus)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
            >
              <option value="ACTIVE">ACTIVE</option>
              <option value="PENDING">PENDING</option>
              <option value="FAILED">FAILED</option>
              <option value="REVOKED">REVOKED</option>
            </select>
          </div>

          <div className="space-y-2 pt-1">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                className="h-3.5 w-3.5 text-teal-600 focus:ring-teal-500 border-slate-300 rounded"
              />
              <span className="text-xs text-slate-700 font-medium">Designate as Primary Storefront Route</span>
            </label>

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
