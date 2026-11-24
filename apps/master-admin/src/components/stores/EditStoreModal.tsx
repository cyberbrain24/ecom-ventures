import React, { useEffect, useState } from 'react';
import { X, Save, Edit3, Lock, Key, ShieldCheck, Globe, Palette } from 'lucide-react';
import { StoreDetailResponse, StoreSummary } from '../../types/store';
import { api, apiErrorMessage } from '../../lib/api';

/** The fields PATCH /platform/stores/{id} accepts from this form. */
export interface StoreEditPayload {
  name: string;
  description: string;
  contact_email: string;
  contact_phone: string;
  currency: string;
  timezone: string;
  primary_domain?: string;
  active_theme?: string;
  owner_email?: string;
  owner_password?: string;
  owner_first_name?: string;
  owner_last_name?: string;
}

interface EditStoreModalProps {
  store: StoreSummary;
  onClose: () => void;
  /** Resolves when the server accepted the change; rejects so the modal can show the error. */
  onSave: (storeId: string, changes: StoreEditPayload) => Promise<void>;
}

const INPUT_CLASS =
  'w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500';
const READONLY_CLASS =
  'w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-md bg-slate-50 text-slate-500 font-mono';

/**
 * EditStoreModal edits a store tenant's profile: name, description, contact email, contact phone,
 * currency, timezone, primary domain, active theme, and store owner administrator credentials.
 * Slug, status and database name are shown read-only because they are fixed database and routing coordinates.
 */
export const EditStoreModal: React.FC<EditStoreModalProps> = ({ store, onClose, onSave }) => {
  const [name, setName] = useState(store.name);
  const [description, setDescription] = useState('');
  const [contactEmail, setContactEmail] = useState(store.contact_email);
  const [contactPhone, setContactPhone] = useState('');
  const [currency, setCurrency] = useState(store.currency);
  const [timezone, setTimezone] = useState('');
  const [dbName, setDbName] = useState('');

  // Primary Domain & Theme State
  const [primaryDomain, setPrimaryDomain] = useState(store.primary_domain || '');
  const [activeTheme, setActiveTheme] = useState(store.active_theme || '');
  const [availableThemes, setAvailableThemes] = useState<Array<{ id: string; name: string; slug: string }>>([]);

  // Store Owner Credentials State
  const [ownerEmail, setOwnerEmail] = useState('');
  const [ownerPassword, setOwnerPassword] = useState('');
  const [ownerFirstName, setOwnerFirstName] = useState('');
  const [ownerLastName, setOwnerLastName] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const [storeRes, themesRes] = await Promise.all([
          api.get<{ data: StoreDetailResponse }>(`/platform/stores/${store.id}`),
          api.get<{ data: Array<{ id: string; name: string; slug: string }> }>('/platform/themes'),
        ]);

        const detail = storeRes.data?.data?.store;
        if (!detail) {
          throw new Error('The server returned store details in an unexpected format.');
        }
        if (!active) return;
        setName(detail.name);
        setDescription(detail.description ?? '');
        setContactEmail(detail.contact_email);
        setContactPhone(detail.contact_phone ?? '');
        setCurrency(detail.currency);
        setTimezone(detail.timezone);
        setDbName(detail.db_name);
        const primary = storeRes.data?.data?.domains?.find((d) => d.is_primary)?.domain || store.primary_domain || '';
        setPrimaryDomain(primary);

        const themeVal = storeRes.data?.data?.active_theme?.slug || storeRes.data?.data?.active_theme?.name || store.active_theme || '';
        setActiveTheme(themeVal);

        if (Array.isArray(themesRes.data?.data)) {
          setAvailableThemes(themesRes.data.data);
        }

        const owner = storeRes.data?.data?.owner;
        if (owner) {
          setOwnerEmail(owner.email ?? '');
          setOwnerFirstName(owner.first_name ?? '');
          setOwnerLastName(owner.last_name ?? '');
        } else {
          setOwnerEmail(detail.contact_email ?? '');
        }
      } catch (err) {
        if (active) {
          setLoadFailed(true);
          setErrorMsg(`Could not load the store record: ${apiErrorMessage(err)}`);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [store.id, store.primary_domain, store.active_theme]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (ownerPassword.trim() && ownerPassword.trim().length < 8) {
      setErrorMsg('Owner password must be at least 8 characters long.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: StoreEditPayload = {
        name: name.trim(),
        description: description.trim(),
        contact_email: contactEmail.trim(),
        contact_phone: contactPhone.trim(),
        currency: currency.trim().toUpperCase(),
        timezone: timezone.trim(),
      };

      if (primaryDomain.trim()) {
        payload.primary_domain = primaryDomain.trim().toLowerCase();
      }
      if (activeTheme.trim()) {
        payload.active_theme = activeTheme.trim();
      }
      if (ownerEmail.trim()) {
        payload.owner_email = ownerEmail.trim().toLowerCase();
      }
      if (ownerPassword.trim()) {
        payload.owner_password = ownerPassword.trim();
      }
      if (ownerFirstName.trim()) {
        payload.owner_first_name = ownerFirstName.trim();
      }
      if (ownerLastName.trim()) {
        payload.owner_last_name = ownerLastName.trim();
      }

      await onSave(store.id, payload);
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Could not save store changes.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const fieldsLocked = isLoading || loadFailed;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-150">
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
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-slate-400 hover:text-white rounded transition"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          {errorMsg && (
            <div
              role="alert"
              className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 whitespace-pre-line"
            >
              {errorMsg}
            </div>
          )}
          {isLoading && <p className="text-[11px] text-slate-500">Loading the current store record...</p>}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Store Brand Name</label>
              <input
                type="text"
                required
                maxLength={100}
                disabled={fieldsLocked}
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Contact Email</label>
              <input
                type="email"
                required
                disabled={fieldsLocked}
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              disabled={fieldsLocked}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Contact Phone</label>
              <input
                type="text"
                disabled={fieldsLocked}
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Currency (ISO)</label>
              <input
                type="text"
                required
                maxLength={3}
                disabled={fieldsLocked}
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={`${INPUT_CLASS} font-mono uppercase`}
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">Timezone (IANA)</label>
              <input
                type="text"
                required
                disabled={fieldsLocked}
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className={`${INPUT_CLASS} font-mono`}
              />
            </div>
          </div>

          {/* Primary Domain & Active Theme Section */}
          <div className="rounded-md border border-slate-200 bg-slate-50/70 p-3 space-y-2.5">
            <p className="flex items-center text-[11px] font-bold text-slate-800">
              <Globe className="h-3.5 w-3.5 mr-1 text-teal-600" /> Storefront Routing & Design Theme
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-semibold text-slate-700 mb-1">Primary Storefront Domain</label>
                <input
                  type="text"
                  required
                  disabled={fieldsLocked}
                  value={primaryDomain}
                  onChange={(e) => setPrimaryDomain(e.target.value)}
                  placeholder="e.g. mior.dropiobd.com"
                  className={INPUT_CLASS}
                />
                <p className="text-[9px] text-slate-500 mt-0.5">Primary routing domain for storefront visitors.</p>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-700 mb-1 flex items-center">
                  <Palette className="h-3 w-3 mr-0.5 text-slate-500" /> Active Design Theme
                </label>
                <select
                  disabled={fieldsLocked}
                  value={activeTheme}
                  onChange={(e) => setActiveTheme(e.target.value)}
                  className={INPUT_CLASS}
                >
                  {availableThemes.length === 0 && <option value={activeTheme}>{activeTheme || 'Default Theme'}</option>}
                  {availableThemes.map((th) => (
                    <option key={th.id} value={th.slug || th.name}>
                      {th.name} ({th.slug})
                    </option>
                  ))}
                </select>
                <p className="text-[9px] text-slate-500 mt-0.5">Layout and design components applied to storefront.</p>
              </div>
            </div>
          </div>

          {/* Store Owner Administrator Section */}
          <div className="rounded-md border border-teal-200 bg-teal-50/50 p-3 space-y-2.5">
            <p className="flex items-center text-[11px] font-bold text-teal-900">
              <ShieldCheck className="h-3.5 w-3.5 mr-1 text-teal-600" /> Store Owner Credentials & Admin Login
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-[10px] font-semibold text-slate-700 mb-1">Owner Admin Email</label>
                <input
                  type="email"
                  disabled={fieldsLocked}
                  value={ownerEmail}
                  onChange={(e) => setOwnerEmail(e.target.value)}
                  placeholder="admin@brand.com"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-700 mb-1 flex items-center">
                  <Key className="h-3 w-3 mr-0.5 text-slate-500" /> Reset Password
                </label>
                <input
                  type="password"
                  disabled={fieldsLocked}
                  value={ownerPassword}
                  onChange={(e) => setOwnerPassword(e.target.value)}
                  placeholder="Leave blank to keep current"
                  className={INPUT_CLASS}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-700 mb-1">Owner First Name</label>
                <input
                  type="text"
                  disabled={fieldsLocked}
                  value={ownerFirstName}
                  onChange={(e) => setOwnerFirstName(e.target.value)}
                  placeholder="First name"
                  className={INPUT_CLASS}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-700 mb-1">Owner Last Name</label>
                <input
                  type="text"
                  disabled={fieldsLocked}
                  value={ownerLastName}
                  onChange={(e) => setOwnerLastName(e.target.value)}
                  placeholder="Last name"
                  className={INPUT_CLASS}
                />
              </div>
            </div>
            <p className="text-[10px] text-teal-700 leading-tight">
              Updates the store administrator account in the store's dedicated database. Leave password empty to keep existing password.
            </p>
          </div>

          {/* Read-only registry fields */}
          <div className="rounded-md border border-slate-200 bg-slate-50/60 p-3 space-y-2">
            <p className="flex items-center text-[11px] font-semibold text-slate-600">
              <Lock className="h-3 w-3 mr-1" /> System Identifiers (Read-only)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div>
                <span className="block text-[10px] text-slate-500 mb-0.5">Status</span>
                <input readOnly aria-readonly="true" aria-label="Status" value={store.status} className={READONLY_CLASS} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-500 mb-0.5">Slug</span>
                <input readOnly aria-readonly="true" aria-label="Slug" value={store.slug} className={READONLY_CLASS} />
              </div>
              <div>
                <span className="block text-[10px] text-slate-500 mb-0.5">Database name</span>
                <input
                  readOnly
                  aria-readonly="true"
                  aria-label="Database name"
                  value={dbName || '-'}
                  className={READONLY_CLASS}
                />
              </div>
            </div>
            <p className="text-[10px] text-slate-500 leading-snug">
              Slug and database name are permanently isolated and fixed after creation.
            </p>
          </div>

          {/* Footer */}
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
              disabled={isSubmitting || fieldsLocked}
              className="inline-flex items-center space-x-1 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-md text-xs font-semibold shadow-sm transition disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{isSubmitting ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
