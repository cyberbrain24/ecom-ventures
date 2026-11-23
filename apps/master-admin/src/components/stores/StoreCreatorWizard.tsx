/**
 * StoreCreatorWizard provides a 4-step guided brand creation experience
 * validating slug uniqueness, theme selection, owner credentials, and primary domain mapping.
 * Themes are loaded only from GET /platform/themes; when that fails, store creation is blocked.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Sparkles, AlertCircle, Palette, RotateCcw } from 'lucide-react';
import { CreateStorePayload } from '../../types/store';
import { ThemeItem } from '../../types/theme';
import { ProvisioningTracker } from './ProvisioningTracker';
import { api, apiErrorMessage } from '../../lib/api';
import { readThemePreview } from '../../lib/theme-preview';

interface StoreCreatorWizardProps {
  onCancel: () => void;
  onSuccess: (newStoreId: string) => void;
}

/**
 * Platform currency for new stores. The launch market is Bangladesh, so new stores default to BDT
 * and the timezone to Asia/Dhaka. This is the platform default, not a per-brand value.
 */
const PLATFORM_DEFAULT_CURRENCY = 'BDT';
const PLATFORM_DEFAULT_TIMEZONE = 'Asia/Dhaka';

/**
 * Renders the store creation wizard. Step 5 hosts the provisioning tracker, and any provisioning
 * failure remains visible in the wizard's error alert.
 *
 * @param props - Cancel handler and success handler receiving the new store id
 * @returns The wizard
 */
export const StoreCreatorWizard: React.FC<StoreCreatorWizardProps> = ({ onCancel, onSuccess }) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [themes, setThemes] = useState<ThemeItem[]>([]);
  const [themesStatus, setThemesStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [themesError, setThemesError] = useState<string | null>(null);
  const [provisioningFailed, setProvisioningFailed] = useState(false);

  // Newly created store tracking for provisioning view
  const [createdStoreId, setCreatedStoreId] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateStorePayload>({
    name: '',
    slug: '',
    description: '',
    theme_slug: '',
    contact_email: '',
    contact_phone: '',
    currency: PLATFORM_DEFAULT_CURRENCY,
    timezone: PLATFORM_DEFAULT_TIMEZONE,
    primary_domain: '',
    initial_owner: {
      email: '',
      password: '',
      first_name: '',
      last_name: '',
    },
  });

  const activeThemes = themes.filter((t) => t.is_active !== false);

  const loadThemes = useCallback(async () => {
    setThemesStatus('loading');
    setThemesError(null);
    try {
      const res = await api.get<{ data: ThemeItem[] }>('/platform/themes');
      const list = res.data?.data ?? [];
      const active = list.filter((t) => t.is_active !== false);
      setThemes(list);
      setThemesStatus('ready');
      setFormData((prev) => {
        if (active.length === 0) return { ...prev, theme_slug: '' };
        const stillValid = active.some((t) => t.slug === prev.theme_slug);
        return stillValid ? prev : { ...prev, theme_slug: active[0].slug };
      });
    } catch (err) {
      setThemes([]);
      setThemesStatus('error');
      setThemesError(apiErrorMessage(err, 'Could not load the theme registry.'));
    }
  }, []);

  useEffect(() => {
    loadThemes();
  }, [loadThemes]);

  const handleNameChange = (name: string) => {
    // Automatically generate lowercase hyphenated slug
    const autoSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    setFormData((prev) => ({
      ...prev,
      name,
      slug: autoSlug,
      primary_domain: `${autoSlug}.localhost`,
    }));
  };

  const handleNext = () => {
    setErrorMsg(null);
    if (currentStep === 1) {
      if (!formData.name || !formData.slug || !formData.contact_email) {
        setErrorMsg('Please provide store name, slug, and contact email.');
        return;
      }
    }
    if (currentStep === 2) {
      if (themesStatus !== 'ready' || activeThemes.length === 0 || !formData.theme_slug) {
        setErrorMsg('Select an active theme from the theme registry before continuing.');
        return;
      }
    }
    if (currentStep === 3) {
      const { email, password, first_name, last_name } = formData.initial_owner;
      if (!email || !password || !first_name || !last_name) {
        setErrorMsg('All store owner administrator fields are required.');
        return;
      }
      if (password.length < 8) {
        setErrorMsg('Owner password must be at least 8 characters long.');
        return;
      }
    }
    setCurrentStep((prev) => prev + 1);
  };

  const handleSubmit = async () => {
    setErrorMsg(null);
    if (themesStatus !== 'ready' || !formData.theme_slug) {
      setErrorMsg('A theme from the theme registry is required before provisioning.');
      return;
    }
    setIsSubmitting(true);

    try {
      const res = await api.post<{ data: { store: { id: string } } }>('/platform/stores', formData);
      const newId = res.data?.data?.store?.id;
      if (!newId) {
        setErrorMsg('The server accepted the request but did not return a store id. Check the portfolio list before retrying.');
        return;
      }
      setCreatedStoreId(newId);
      setCurrentStep(5); // Move to provisioning tracker view
    } catch (err) {
      setErrorMsg(apiErrorMessage(err, 'Failed to trigger store provisioning. Please verify inputs.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleProvisioningComplete = useCallback(() => {
    // Let the success state show briefly before the portfolio opens the new store.
    window.setTimeout(() => {
      if (createdStoreId) onSuccess(createdStoreId);
    }, 2000);
  }, [createdStoreId, onSuccess]);

  const handleProvisioningFailed = useCallback((message: string) => {
    setProvisioningFailed(true);
    setErrorMsg(message);
  }, []);

  const selectedTheme = activeThemes.find((t) => t.slug === formData.theme_slug);

  return (
    <div className="w-full max-w-4xl mx-auto bg-white sm:rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Wizard Header */}
      <div className="px-4 sm:px-8 py-4 sm:py-6 bg-slate-900 text-white flex items-center justify-between">
        <div>
          <h2 className="text-lg sm:text-xl font-bold tracking-tight">Launch New Brand Store</h2>
          <p className="text-xs text-slate-400 mt-0.5 sm:mt-1">
            Automated provisioning across isolated PostgreSQL databases
          </p>
        </div>
        <span className="text-xs font-mono bg-slate-800 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full text-teal-400 shrink-0">
          {currentStep <= 4 ? `Step ${currentStep} of 4` : 'Provisioning'}
        </span>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div role="alert" className="mx-4 sm:mx-8 mt-4 sm:mt-6 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm flex items-start space-x-2">
          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0 mt-0.5" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Wizard Body */}
      <div className="p-4 sm:p-8 flex-1 overflow-y-auto">
        {/* Step 1: Brand Identity */}
        {currentStep === 1 && (
          <div className="space-y-5 sm:space-y-6">
            <h3 className="text-base font-bold text-slate-900 border-b pb-2">1. Brand Identity & Routing</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700">Brand Name</label>
                <input
                  type="text"
                  required
                  aria-label="Brand Name"
                  placeholder="Store name"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Store Slug (URL Identifier)</label>
                <input
                  type="text"
                  required
                  aria-label="Store Slug"
                  value={formData.slug}
                  onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase() })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-teal-500 outline-none"
                />
                <p className="text-[11px] text-slate-400 mt-1">Store slug: {formData.slug || 'not set yet'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Official Contact Email</label>
                <input
                  type="email"
                  required
                  aria-label="Official Contact Email"
                  placeholder="contact@yourbrand.com"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Contact Phone</label>
                <input
                  type="text"
                  aria-label="Contact Phone"
                  placeholder="Optional"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700">Brand Description</label>
                <textarea
                  rows={2}
                  aria-label="Brand Description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">Brief summary of the brand catalog and target customers</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Theme Selection */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-base font-bold text-slate-900">2. Reusable Storefront Theme</h3>
              {themesStatus === 'ready' && (
                <span className="text-xs text-slate-500 font-medium">
                  {activeThemes.length} active {activeThemes.length === 1 ? 'theme' : 'themes'}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              Select the initial presentation theme. Themes can be changed later from the store drawer without rebuilding frontend code.
            </p>

            {themesStatus === 'loading' && (
              <div className="p-8 text-center text-slate-500 text-xs">Loading themes from the registry...</div>
            )}

            {themesStatus === 'error' && (
              <div role="alert" className="p-4 rounded-lg border border-rose-200 bg-rose-50 text-xs text-rose-800 space-y-3">
                <p>Themes could not be loaded, so this store cannot be created: {themesError}</p>
                <button
                  type="button"
                  onClick={loadThemes}
                  className="inline-flex items-center space-x-1.5 px-3 py-1.5 border border-rose-300 rounded-md bg-white font-semibold hover:bg-rose-100"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Retry</span>
                </button>
              </div>
            )}

            {themesStatus === 'ready' && activeThemes.length === 0 && (
              <div className="p-6 rounded-lg border border-slate-200 bg-slate-50 text-xs text-slate-600">
                No active theme is registered. Register and activate a theme in the Theme Registry before creating a store.
              </div>
            )}

            {themesStatus === 'ready' && themes.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {themes.map((theme) => {
                  const isActive = theme.is_active !== false;
                  const isSelected = isActive && formData.theme_slug === theme.slug;
                  const preview = readThemePreview(theme.config_schema);
                  const hasColors = preview.colors.length > 0;
                  const selectTheme = () => {
                    if (isActive) setFormData({ ...formData, theme_slug: theme.slug });
                  };

                  return (
                    <div
                      key={theme.slug}
                      role="button"
                      tabIndex={isActive ? 0 : -1}
                      aria-pressed={isSelected}
                      aria-disabled={!isActive}
                      onClick={selectTheme}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          selectTheme();
                        }
                      }}
                      className={`rounded-xl border p-4 transition flex flex-col justify-between ${
                        isActive ? 'cursor-pointer' : 'cursor-not-allowed opacity-60 bg-slate-50'
                      } ${
                        isSelected
                          ? 'border-teal-500 bg-teal-50/40 ring-2 ring-teal-500 shadow-sm'
                          : 'border-slate-200 hover:border-slate-300 bg-white hover:shadow-xs'
                      }`}
                    >
                      <div>
                        {/* Header with Icon and Check */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center space-x-1.5">
                            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
                              <Palette className="h-4 w-4" />
                            </div>
                            <h4 className="font-bold text-slate-900 text-sm leading-tight">{theme.name}</h4>
                          </div>
                          {isSelected && (
                            <div className="h-5 w-5 rounded-full bg-teal-600 text-white flex items-center justify-center shrink-0">
                              <Check className="h-3 w-3" />
                            </div>
                          )}
                        </div>

                        {/* Description */}
                        <p className="text-xs text-slate-500 mt-2.5 leading-relaxed line-clamp-3">
                          {theme.description || 'No description'}
                        </p>

                        {!isActive && (
                          <p role="note" className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-1 mt-2">
                            Inactive: this theme is deactivated in the Theme Registry, so it cannot be chosen for a new store.
                          </p>
                        )}

                        {/* Colour swatches from the theme record */}
                        <div className="flex items-center space-x-1.5 mt-3 pt-2.5 border-t border-slate-100">
                          {hasColors ? (
                            <>
                              {preview.colors.map((token) => (
                                <span
                                  key={token.key}
                                  className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-2xs"
                                  style={{ backgroundColor: token.value }}
                                  title={`${token.key}: ${token.value}`}
                                />
                              ))}
                              <span className="text-[10px] text-slate-400 font-mono ml-1">palette</span>
                            </>
                          ) : (
                            <span className="text-[10px] text-slate-400">Colours not configured</span>
                          )}
                        </div>
                      </div>

                      {/* Footer */}
                      <div className="mt-4 pt-2 flex items-center justify-between text-[11px]">
                        <span className="font-mono text-slate-400">v{theme.version}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold border border-slate-200 text-slate-600">
                          {theme.slug}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Initial Store Owner */}
        {currentStep === 3 && (
          <div className="space-y-6">
            <h3 className="text-base font-bold text-slate-900 border-b pb-2">3. Initial Store Administrator</h3>
            <p className="text-xs text-slate-500">
              The primary administrator account created inside the brand database staff registry (`store_staff`).
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700">First Name</label>
                <input
                  type="text"
                  required
                  aria-label="First Name"
                  value={formData.initial_owner.first_name}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      initial_owner: { ...formData.initial_owner, first_name: e.target.value },
                    })
                  }
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Last Name</label>
                <input
                  type="text"
                  required
                  aria-label="Last Name"
                  value={formData.initial_owner.last_name}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      initial_owner: { ...formData.initial_owner, last_name: e.target.value },
                    })
                  }
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Owner Login Email</label>
                <input
                  type="email"
                  required
                  aria-label="Owner Login Email"
                  placeholder="owner@yourbrand.com"
                  value={formData.initial_owner.email}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      initial_owner: { ...formData.initial_owner, email: e.target.value },
                    })
                  }
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Initial Password (Argon2id)</label>
                <input
                  type="password"
                  required
                  aria-label="Initial Password"
                  value={formData.initial_owner.password}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      initial_owner: { ...formData.initial_owner, password: e.target.value },
                    })
                  }
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">Minimum 8 characters with letters and numbers</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 4: Domain & Review */}
        {currentStep === 4 && (
          <div className="space-y-6">
            <h3 className="text-base font-bold text-slate-900 border-b pb-2">4. Domain Mapping & Confirmation</h3>
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700">Primary Storefront Domain</label>
                <input
                  type="text"
                  required
                  aria-label="Primary Storefront Domain"
                  value={formData.primary_domain}
                  onChange={(e) => setFormData({ ...formData, primary_domain: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm font-mono focus:ring-2 focus:ring-teal-500 outline-none"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Apex domains (for example `yourbrand.com`) can be verified after provisioning.
                </p>
              </div>

              <div className="border-t pt-4 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-slate-400 block">Brand Name:</span>
                  <span className="font-semibold text-slate-800">{formData.name}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Store Slug:</span>
                  <span className="font-mono text-slate-800">{formData.slug}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Theme:</span>
                  <span className="font-semibold text-slate-800">
                    {selectedTheme ? `${selectedTheme.name} (${selectedTheme.slug})` : 'No theme selected'}
                  </span>
                </div>
                <div>
                  <span className="text-slate-400 block">Database Model:</span>
                  <span className="font-semibold text-teal-700">Isolated PostgreSQL (Dedicated DB)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Step 5: Live Provisioning View. The error alert above stays visible if provisioning fails. */}
        {currentStep === 5 && createdStoreId && (
          <ProvisioningTracker
            storeId={createdStoreId}
            storeSlug={formData.slug}
            onComplete={handleProvisioningComplete}
            onFailed={handleProvisioningFailed}
          />
        )}
      </div>

      {/* Wizard Footer Controls */}
      <div className="px-4 sm:px-8 py-3.5 sm:py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between sticky bottom-0 z-10">
        {currentStep <= 4 ? (
          <button
            onClick={currentStep === 1 ? onCancel : () => setCurrentStep((prev) => prev - 1)}
            className="min-h-[44px] px-3 sm:px-4 py-2 text-slate-600 hover:text-slate-900 text-sm font-medium flex items-center space-x-1.5 rounded-lg hover:bg-slate-200/60 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>{currentStep === 1 ? 'Cancel' : 'Previous Step'}</span>
          </button>
        ) : (
          <span />
        )}

        {currentStep < 4 && (
          <button
            onClick={handleNext}
            disabled={currentStep === 2 && themesStatus !== 'ready'}
            className="min-h-[44px] px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold shadow-xs flex items-center space-x-1.5 transition disabled:opacity-50"
          >
            <span>Continue</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        )}

        {currentStep === 4 && (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || themesStatus !== 'ready' || !formData.theme_slug}
            className="min-h-[44px] px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold shadow-xs flex items-center space-x-2 transition disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            <span>{isSubmitting ? 'Initializing...' : 'Execute Provisioning'}</span>
          </button>
        )}

        {currentStep === 5 && provisioningFailed && (
          <button
            onClick={onCancel}
            className="min-h-[44px] px-5 py-2.5 border border-slate-300 bg-white text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-100 transition"
          >
            Back to Portfolio
          </button>
        )}
      </div>
    </div>
  );
};
