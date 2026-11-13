/**
 * StoreCreatorWizard provides a 4-step guided brand creation experience
 * validating slug uniqueness, theme selection, owner credentials, and primary domain mapping.
 */

import React, { useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, Check, Sparkles, AlertCircle, Palette, Gem } from 'lucide-react';
import { CreateStorePayload } from '../../types/store';
import { ThemeBlueprint } from '../../types/theme';
import { ProvisioningTracker } from './ProvisioningTracker';
import { api } from '../../lib/api';
import { AxiosError } from 'axios';
import { ProblemDetails } from '../../types/auth';

interface StoreCreatorWizardProps {
  onCancel: () => void;
  onSuccess: (newStoreId: string) => void;
}

const defaultThemes: ThemeBlueprint[] = [
  {
    id: 'thm_modern_minimal',
    name: 'Modern Minimal',
    slug: 'modern-minimal',
    description: 'Clean typography, high-contrast aesthetics optimized for fashion, luxury wear, and formal apparel.',
    version: '1.0.0',
    is_active: true,
  },
  {
    id: 'thm_artisan_boutique',
    name: 'Artisan Boutique',
    slug: 'artisan-boutique',
    description: 'Warm earth tones, serif headings tailored for handcrafted leather goods, ceramics, and perfumes.',
    version: '1.0.0',
    is_active: true,
  },
  {
    id: 'thm_urban_streetwear',
    name: 'Urban Streetwear',
    slug: 'urban-streetwear',
    description: 'Bold grids, dark-mode accents suited for footwear, sneakers, and contemporary hype apparel.',
    version: '1.0.0',
    is_active: true,
  },
  {
    id: 'thm_jewelry_shop',
    name: 'Jewelry Shop',
    slug: 'jewelry-shop',
    description: 'Warm champagne gold & ivory palette with serif elegance, ring size guides, and gemstone presentation.',
    version: '1.0.0',
    is_active: true,
  },
];

const getThemeAccent = (slug: string) => {
  if (slug.includes('jewelry')) {
    return {
      border: 'border-[#B8975A]',
      bgSelected: 'bg-[#FDFAF5] ring-2 ring-[#B8975A]',
      badge: 'bg-[#B8975A]/20 text-[#8B6914] border-[#B8975A]/40',
      dots: ['#B8975A', '#7A5C2E', '#F5ECD7', '#2C1810'],
      Icon: Gem,
    };
  }
  if (slug.includes('artisan')) {
    return {
      border: 'border-amber-500',
      bgSelected: 'bg-amber-50/40 ring-2 ring-amber-500',
      badge: 'bg-amber-500/20 text-amber-800 border-amber-500/40',
      dots: ['#92400E', '#D97706', '#FEF3C7', '#78350F'],
      Icon: Palette,
    };
  }
  if (slug.includes('urban') || slug.includes('streetwear')) {
    return {
      border: 'border-violet-500',
      bgSelected: 'bg-violet-50/40 ring-2 ring-violet-500',
      badge: 'bg-violet-500/20 text-violet-800 border-violet-500/40',
      dots: ['#7C3AED', '#EC4899', '#1A1A2E', '#F8F8F8'],
      Icon: Palette,
    };
  }
  return {
    border: 'border-teal-500',
    bgSelected: 'bg-teal-50/40 ring-2 ring-teal-500',
    badge: 'bg-teal-500/20 text-teal-800 border-teal-500/40',
    dots: ['#0F766E', '#0284C7', '#F8FAFC', '#1E293B'],
    Icon: Palette,
  };
};

export const StoreCreatorWizard: React.FC<StoreCreatorWizardProps> = ({ onCancel, onSuccess }) => {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [themes, setThemes] = useState<ThemeBlueprint[]>(defaultThemes);
  const [isLoadingThemes, setIsLoadingThemes] = useState(false);

  // Newly created store tracking for provisioning view
  const [createdStoreId, setCreatedStoreId] = useState<string | null>(null);

  const [formData, setFormData] = useState<CreateStorePayload>({
    name: '',
    slug: '',
    description: '',
    theme_slug: 'modern-minimal',
    contact_email: '',
    contact_phone: '',
    currency: 'BDT',
    timezone: 'Asia/Dhaka',
    primary_domain: '',
    initial_owner: {
      email: '',
      password: '',
      first_name: '',
      last_name: '',
    },
  });

  useEffect(() => {
    const fetchThemes = async () => {
      setIsLoadingThemes(true);
      try {
        const res = await api.get<{ data: ThemeBlueprint[] }>('/platform/themes');
        if (res.data?.data && res.data.data.length > 0) {
          const activeOnly = res.data.data.filter((t) => t.is_active !== false);
          if (activeOnly.length > 0) {
            setThemes(activeOnly);
          }
        }
      } catch (err) {
        console.warn('Failed to load dynamic themes, using default blueprints', err);
      } finally {
        setIsLoadingThemes(false);
      }
    };
    fetchThemes();
  }, []);

  const handleNameChange = (name: string) => {
    // Automatically generate lowercase hyphenated slug if not manually altered
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
    setIsSubmitting(true);

    try {
      const res = await api.post<{ data: { store: { id: string } } }>('/platform/stores', formData);
      const newId = res.data?.data?.store?.id || (res.data as unknown as { store: { id: string } })?.store?.id;
      setCreatedStoreId(newId);
      setCurrentStep(5); // Move to provisioning tracker view
    } catch (err) {
      const axiosErr = err as AxiosError<ProblemDetails>;
      if (axiosErr.response?.data?.detail) {
        setErrorMsg(axiosErr.response.data.detail);
      } else {
        setErrorMsg('Failed to trigger store provisioning. Please verify inputs.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // Step 5: Live Provisioning View
  if (currentStep === 5 && createdStoreId) {
    return (
      <ProvisioningTracker
        storeId={createdStoreId}
        storeSlug={formData.slug}
        onComplete={() => {
          setTimeout(() => onSuccess(createdStoreId), 2000);
        }}
        onFailed={(err) => setErrorMsg(err)}
      />
    );
  }

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
          Step {currentStep} of 4
        </span>
      </div>

      {/* Error Alert */}
      {errorMsg && (
        <div className="mx-4 sm:mx-8 mt-4 sm:mt-6 bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm flex items-start space-x-2">
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
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">e.g. Mior Fashion</span>
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
                <p className="text-[11px] text-slate-400 mt-1">Admin route: store.dropiobd.com/{formData.slug || 'brand-slug'}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Official Contact Email</label>
                <input
                  type="email"
                  required
                  aria-label="Official Contact Email"
                  value={formData.contact_email}
                  onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">e.g. contact@mior.com</span>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700">Contact Phone</label>
                <input
                  type="text"
                  aria-label="Contact Phone"
                  value={formData.contact_phone}
                  onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                  className="mt-1 w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-500 outline-none"
                />
                <span className="text-[11px] text-slate-400 mt-1 block">e.g. +880 1700 000000</span>
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
                <span className="text-[11px] text-slate-400 mt-1 block">Brief summary of the brand catalog and target demographic</span>
              </div>
            </div>
          </div>
        )}

        {/* Step 2: Theme Selection */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b pb-2">
              <h3 className="text-base font-bold text-slate-900">2. Reusable Storefront Theme</h3>
              <span className="text-xs text-slate-500 font-medium">
                {themes.length} available blueprints
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Select the initial presentation blueprint. Themes can be changed dynamically at any time without rebuilding frontend code.
            </p>

            {isLoadingThemes ? (
              <div className="p-8 text-center text-slate-500 text-xs">Loading themes...</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {themes.map((theme) => {
                  const isSelected = formData.theme_slug === theme.slug;
                  const visual = getThemeAccent(theme.slug);
                  const Icon = visual.Icon;

                  return (
                    <div
                      key={theme.slug}
                      onClick={() => setFormData({ ...formData, theme_slug: theme.slug })}
                      className={`cursor-pointer rounded-xl border p-4 transition flex flex-col justify-between ${
                        isSelected
                          ? `${visual.bgSelected} ${visual.border} shadow-sm`
                          : 'border-slate-200 hover:border-slate-300 bg-white hover:shadow-xs'
                      }`}
                    >
                      <div>
                        {/* Header with Icon and Check */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center space-x-1.5">
                            <div className="p-1.5 rounded-md bg-slate-100 text-slate-700">
                              <Icon className="h-4 w-4" />
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
                          {theme.description}
                        </p>

                        {/* Color palette preview dots */}
                        <div className="flex items-center space-x-1.5 mt-3 pt-2.5 border-t border-slate-100">
                          {visual.dots.map((dot, idx) => (
                            <span
                              key={idx}
                              className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-2xs"
                              style={{ backgroundColor: dot }}
                            />
                          ))}
                          <span className="text-[10px] text-slate-400 font-mono ml-1">palette</span>
                        </div>
                      </div>

                      {/* Footer Badge */}
                      <div className="mt-4 pt-2 flex items-center justify-between text-[11px]">
                        <span className="font-mono text-slate-400">v{theme.version}</span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${visual.badge}`}>
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
                  Apex domains (e.g. `mior.com`) can be verified after provisioning.
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
                  <span className="text-slate-400 block">Active Theme:</span>
                  <span className="font-semibold text-slate-800">
                    {themes.find((t) => t.slug === formData.theme_slug)?.name || formData.theme_slug} ({formData.theme_slug})
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
      </div>

      {/* Wizard Footer Controls */}
      <div className="px-4 sm:px-8 py-3.5 sm:py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between sticky bottom-0 z-10">
        <button
          onClick={currentStep === 1 ? onCancel : () => setCurrentStep((prev) => prev - 1)}
          className="min-h-[44px] px-3 sm:px-4 py-2 text-slate-600 hover:text-slate-900 text-sm font-medium flex items-center space-x-1.5 rounded-lg hover:bg-slate-200/60 transition"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{currentStep === 1 ? 'Cancel' : 'Previous Step'}</span>
        </button>

        {currentStep < 4 ? (
          <button
            onClick={handleNext}
            className="min-h-[44px] px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold shadow-xs flex items-center space-x-1.5 transition"
          >
            <span>Continue</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="min-h-[44px] px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold shadow-xs flex items-center space-x-2 transition disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            <span>{isSubmitting ? 'Initializing...' : 'Execute Provisioning'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
