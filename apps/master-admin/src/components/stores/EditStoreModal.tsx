import React, { useState } from 'react';
import { X, Save, Edit3, Store } from 'lucide-react';
import { StoreSummary, StoreStatus } from '../../types/store';

interface EditStoreModalProps {
  store: StoreSummary;
  onClose: () => void;
  onSave: (updatedStore: StoreSummary) => void;
}

export const EditStoreModal: React.FC<EditStoreModalProps> = ({ store, onClose, onSave }) => {
  const [name, setName] = useState(store.name);
  const [contactEmail, setContactEmail] = useState(store.contact_email);
  const [primaryDomain, setPrimaryDomain] = useState(store.primary_domain || '');
  const [activeTheme, setActiveTheme] = useState(store.active_theme);
  const [status, setStatus] = useState<StoreStatus>(store.status);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const updated: StoreSummary = {
      ...store,
      name: name.trim(),
      contact_email: contactEmail.trim(),
      primary_domain: primaryDomain.trim(),
      active_theme: activeTheme,
      status,
    };
    onSave(updated);
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="h-6 w-6 rounded bg-teal-500 flex items-center justify-center text-white">
              <Edit3 className="h-3.5 w-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-bold leading-none">Edit Store Tenant</h3>
              <p className="text-[10px] text-teal-400 font-mono mt-0.5">{store.slug}</p>
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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Store Brand Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Contact Email
              </label>
              <input
                type="email"
                required
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Primary Host Domain
              </label>
              <input
                type="text"
                value={primaryDomain}
                onChange={(e) => setPrimaryDomain(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono"
                placeholder="e.g. brand.localhost"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Active Theme Blueprint
              </label>
              <input
                type="text"
                required
                value={activeTheme}
                onChange={(e) => setActiveTheme(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Operational Lifecycle Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as StoreStatus)}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
            >
              <option value="ACTIVE">ACTIVE — Public Consumer Traffic Enabled</option>
              <option value="PROVISIONING">PROVISIONING — Dynamic DB Building</option>
              <option value="MAINTENANCE">MAINTENANCE — Storefront Read-Only Banner</option>
              <option value="SUSPENDED">SUSPENDED — Routing & DB Access Blocked</option>
              <option value="ARCHIVED">ARCHIVED — Deprecated & Cold Storage</option>
            </select>
          </div>

          {/* Footer */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 border border-slate-300 rounded-md text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-md text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
