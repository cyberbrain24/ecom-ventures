import React, { useState, useEffect } from 'react';
import {
  Save,
  Users,
  Image as ImageIcon,
  Globe,
  Share2,
  FileCode,
  Shield,
  Layers,
  Check,
  Eye,
  Sliders,
  UserPlus,
  Pencil,
  Trash2,
} from 'lucide-react';
import { StoreBrand, StoreSettings, StoreStaff } from '../types/store';
import { getStorefrontUrl } from '../lib/storefront';
// Staff and store configuration API services
import {
  fetchStaffList,
  fetchStoreSettings,
  updateStoreSettings,
  createStaffMember,
  updateStaffMember,
  deleteStaffMember,
} from '../lib/settings-api';
import { RecordModal } from './RecordModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface SettingsViewProps {
  currentStore: StoreBrand;
  settings?: StoreSettings | null;
}

const Field: React.FC<{ label: string; value: string | null; emptyText?: string }> = ({
  label,
  value,
  emptyText = 'Not set',
}) => (
  <div
    style={{
      display: 'flex',
      justifyContent: 'space-between',
      gap: '12px',
      padding: '8px 0',
      borderBottom: '1px solid var(--border)',
      fontSize: '0.85rem',
    }}
  >
    <span style={{ color: 'var(--text-muted)' }}>{label}</span>
    <span
      style={{
        fontWeight: 600,
        fontFamily: 'var(--font-mono)',
        textAlign: 'right',
        wordBreak: 'break-all',
      }}
    >
      {value !== null && value !== '' ? value : emptyText}
    </span>
  </div>
);

export const SettingsView: React.FC<SettingsViewProps> = ({ currentStore }) => {
  const [activeTab, setActiveTab] = useState<'general' | 'branding' | 'social_seo' | 'staff'>('general');
  const [staffList, setStaffList] = useState<StoreStaff[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // General & Operations
  const [brandName, setBrandName] = useState(currentStore.name);
  const [legalName, setLegalName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [orderPrefix, setOrderPrefix] = useState('ORD-');
  const [shippingFee, setShippingFee] = useState<number>(60);
  const [taxRatePercent, setTaxRatePercent] = useState<number>(0);
  const [pricesIncludeTax, setPricesIncludeTax] = useState<boolean>(false);

  // Visual Branding & Media
  const [logoUrl, setLogoUrl] = useState('');
  const [desktopHeroBannerUrl, setDesktopHeroBannerUrl] = useState('');
  const [mobileHeroBannerUrl, setMobileHeroBannerUrl] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');
  const [appleTouchIconUrl, setAppleTouchIconUrl] = useState('');
  const [defaultOgImageUrl, setDefaultOgImageUrl] = useState('');
  const [siteDescription, setSiteDescription] = useState('');
  const [footerContent, setFooterContent] = useState('');

  // Social & Channels
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [twitterHandle, setTwitterHandle] = useState('');

  // SEO & Webmaster Verification
  const [metaTitleTemplate, setMetaTitleTemplate] = useState('');
  const [defaultMetaTitle, setDefaultMetaTitle] = useState('');
  const [defaultMetaDescription, setDefaultMetaDescription] = useState('');
  const [defaultKeywords, setDefaultKeywords] = useState('');
  const [googleSiteVerification, setGoogleSiteVerification] = useState('');
  const [bingSiteVerification, setBingSiteVerification] = useState('');
  const [pinterestVerification, setPinterestVerification] = useState('');
  const [robotsTxtCustom, setRobotsTxtCustom] = useState('');
  const [sitemapEnabled, setSitemapEnabled] = useState(true);

  // Staff Management State
  const [staffModal, setStaffModal] = useState<{ mode: 'create' | 'edit'; staff: StoreStaff | null } | null>(null);
  const [deleteStaffTarget, setDeleteStaffTarget] = useState<StoreStaff | null>(null);
  const [staffForm, setStaffForm] = useState<{
    firstName: string;
    lastName: string;
    email: string;
    password: string;
    role: 'STORE_OWNER' | 'STORE_ADMIN' | 'STORE_STAFF';
    isActive: boolean;
  }>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    role: 'STORE_STAFF',
    isActive: true,
  });

  const storefrontUrl = getStorefrontUrl(currentStore);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sData, stList] = await Promise.all([fetchStoreSettings(), fetchStaffList()]);
      if (sData) {
        setBrandName(sData.brandName || currentStore.name);
        setLegalName(sData.legalBusinessName || '');
        setContactEmail(sData.contactEmail || '');
        setContactPhone(sData.contactPhone || '');
        setOrderPrefix(sData.orderPrefix || 'ORD-');
        setShippingFee(sData.shippingInsideDhaka ?? 60);
        setTaxRatePercent(sData.taxRatePercent ?? 0);
        setPricesIncludeTax(Boolean(sData.pricesIncludeTax));

        setLogoUrl(sData.logoUrl || '');
        setDesktopHeroBannerUrl(sData.desktopHeroBannerUrl || '');
        setMobileHeroBannerUrl(sData.mobileHeroBannerUrl || '');
        setFaviconUrl(sData.faviconUrl || '');
        setAppleTouchIconUrl(sData.appleTouchIconUrl || '');
        setDefaultOgImageUrl(sData.defaultOgImageUrl || '');

        setSiteDescription(sData.siteDescription || '');
        setFooterContent(sData.footerContent || '');

        setWhatsappPhone(sData.whatsappPhone || '');
        setFacebookUrl(sData.facebookUrl || '');
        setInstagramUrl(sData.instagramUrl || '');
        setTwitterHandle(sData.twitterHandle || '');

        setMetaTitleTemplate(sData.metaTitleTemplate || '');
        setDefaultMetaTitle(sData.defaultMetaTitle || '');
        setDefaultMetaDescription(sData.defaultMetaDescription || '');
        setDefaultKeywords(sData.defaultKeywords || '');
        setGoogleSiteVerification(sData.googleSiteVerification || '');
        setBingSiteVerification(sData.bingSiteVerification || '');
        setPinterestVerification(sData.pinterestVerification || '');
        setRobotsTxtCustom(sData.robotsTxtCustom || '');
        setSitemapEnabled(sData.sitemapEnabled !== undefined ? sData.sitemapEnabled : true);
      }
      setStaffList(stList);
    } catch {
      setNotice({ type: 'error', text: 'Failed to load store settings & staff accounts.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentStore.slug]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setNotice(null);

    try {
      await updateStoreSettings({
        store_name: brandName.trim(),
        legal_business_name: legalName.trim(),
        support_email: contactEmail.trim(),
        contact_phone: contactPhone.trim(),
        order_number_prefix: orderPrefix.trim(),
        default_shipping_fee: Number(shippingFee),
        tax_rate_percent: Number(taxRatePercent),
        prices_include_tax: pricesIncludeTax,

        logo_url: logoUrl.trim(),
        desktop_hero_banner_url: desktopHeroBannerUrl.trim(),
        mobile_hero_banner_url: mobileHeroBannerUrl.trim(),
        favicon_url: faviconUrl.trim(),
        apple_touch_icon_url: appleTouchIconUrl.trim(),
        default_og_image_url: defaultOgImageUrl.trim(),

        site_description: siteDescription.trim(),
        footer_content: footerContent.trim(),

        whatsapp_phone: whatsappPhone.trim(),
        facebook_url: facebookUrl.trim(),
        instagram_url: instagramUrl.trim(),
        twitter_handle: twitterHandle.trim(),

        meta_title_template: metaTitleTemplate.trim(),
        default_meta_title: defaultMetaTitle.trim(),
        default_meta_description: defaultMetaDescription.trim(),
        default_keywords: defaultKeywords.trim(),
        google_site_verification: googleSiteVerification.trim(),
        bing_site_verification: bingSiteVerification.trim(),
        pinterest_verification: pinterestVerification.trim(),
        robots_txt_custom: robotsTxtCustom.trim(),
        sitemap_enabled: sitemapEnabled,
      });
      setNotice({ type: 'success', text: 'Store preferences and visual branding updated successfully!' });
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Failed to save store settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  const openCreateStaff = () => {
    setStaffForm({
      firstName: '',
      lastName: '',
      email: '',
      password: '',
      role: 'STORE_STAFF',
      isActive: true,
    });
    setStaffModal({ mode: 'create', staff: null });
  };

  const openEditStaff = (st: StoreStaff) => {
    const parts = st.name.split(' ');
    const firstName = st.firstName || parts[0] || '';
    const lastName = st.lastName || parts.slice(1).join(' ') || '';
    setStaffForm({
      firstName,
      lastName,
      email: st.email,
      password: '',
      role: (st.role as any) || 'STORE_STAFF',
      isActive: st.isActive,
    });
    setStaffModal({ mode: 'edit', staff: st });
  };

  const handleSaveStaff = async () => {
    if (staffModal?.mode === 'create') {
      if (!staffForm.email.trim()) throw new Error('Email address is required.');
      if (!staffForm.password.trim() || staffForm.password.length < 8) {
        throw new Error('Password must be at least 8 characters long.');
      }
      const created = await createStaffMember({
        email: staffForm.email.trim(),
        password: staffForm.password,
        firstName: staffForm.firstName.trim(),
        lastName: staffForm.lastName.trim(),
        role: staffForm.role === 'STORE_OWNER' ? 'STORE_ADMIN' : (staffForm.role as 'STORE_ADMIN' | 'STORE_STAFF'),
      });
      setStaffList((prev) => [created, ...prev]);
      setNotice({ type: 'success', text: `Staff account for ${created.name} (${created.email}) created successfully!` });
    } else if (staffModal?.mode === 'edit' && staffModal.staff) {
      const updated = await updateStaffMember(staffModal.staff.id, {
        firstName: staffForm.firstName.trim(),
        lastName: staffForm.lastName.trim(),
        role: staffForm.role,
        isActive: staffForm.isActive,
      });
      setStaffList((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setNotice({ type: 'success', text: `Staff member ${updated.name} updated successfully!` });
    }
  };

  const handleDeleteStaff = async () => {
    if (!deleteStaffTarget) return;
    if (deleteStaffTarget.role === 'STORE_OWNER') {
      setNotice({ type: 'error', text: 'Store Owner account cannot be deleted.' });
      setDeleteStaffTarget(null);
      return;
    }
    try {
      await deleteStaffMember(deleteStaffTarget.id);
      setStaffList((prev) => prev.filter((s) => s.id !== deleteStaffTarget.id));
      setNotice({ type: 'success', text: `Staff member "${deleteStaffTarget.name}" deleted successfully.` });
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Failed to delete staff member.' });
    } finally {
      setDeleteStaffTarget(null);
    }
  };

  if (isLoading) {
    return (
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ height: '28px', width: '260px', background: 'var(--border)', borderRadius: '6px' }} />
        <div style={{ height: '360px', background: '#fff', borderRadius: '8px', border: '1px solid var(--border)' }} />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: '14px' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
          Store Settings & Brand Engine
        </h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
          Visual identity, theme tokens, operational policies, SEO, and staff accounts for <code>{currentStore.slug}</code>
        </p>
      </div>

      {notice && (
        <div className={`notice notice-${notice.type === 'success' ? 'success' : 'warning'}`} style={{ marginBottom: '14px' }}>
          {notice.text}
        </div>
      )}

      {/* Main Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '18px', paddingBottom: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('general')}
          className={`btn btn-sm ${activeTab === 'general' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Sliders size={14} />
          <span>General & Operations</span>
        </button>
        <button
          onClick={() => setActiveTab('branding')}
          className={`btn btn-sm ${activeTab === 'branding' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <ImageIcon size={14} />
          <span>Visual Branding & Media</span>
        </button>
        <button
          onClick={() => setActiveTab('social_seo')}
          className={`btn btn-sm ${activeTab === 'social_seo' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Globe size={14} />
          <span>Social & SEO Webmaster</span>
        </button>
        <button
          onClick={() => setActiveTab('staff')}
          className={`btn btn-sm ${activeTab === 'staff' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Users size={14} />
          <span>Staff Accounts ({staffList.length})</span>
        </button>
      </div>

      {/* Settings Form Container */}
      {activeTab !== 'staff' && (
        <form onSubmit={handleSaveSettings}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px', maxWidth: '1080px', marginBottom: '24px' }}>

            {/* TAB 1: GENERAL & OPERATIONS */}
            {activeTab === 'general' && (
              <>
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Tenant Identity & Domain</div>
                  </div>
                  <Field label="Store Name" value={currentStore.name} />
                  <Field label="Store Slug" value={currentStore.slug} />
                  <Field label="Status" value={currentStore.status ?? 'ACTIVE'} />
                  <Field label="Currency" value={currentStore.currency} />
                  <Field label="Timezone" value={currentStore.timezone} />
                  <Field label="Primary Domain" value={currentStore.primaryDomain} emptyText="Not set" />
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: '8px 0', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Storefront URL</span>
                    {storefrontUrl === null ? (
                      <span style={{ fontWeight: 600 }}>Not set</span>
                    ) : (
                      <a
                        href={storefrontUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{ fontWeight: 600, fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}
                      >
                        {storefrontUrl}
                      </a>
                    )}
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Operational Policies</div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">Store Brand Display Name</label>
                    <input
                      type="text"
                      required
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">Legal Entity / Registered Business Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Poshplex Holdings Ltd."
                      value={legalName}
                      onChange={(e) => setLegalName(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-grid" style={{ marginBottom: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Customer Support Email</label>
                      <input
                        type="email"
                        placeholder="support@domain.com"
                        value={contactEmail}
                        onChange={(e) => setContactEmail(e.target.value)}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Contact Phone</label>
                      <input
                        type="tel"
                        placeholder="+8801..."
                        value={contactPhone}
                        onChange={(e) => setContactPhone(e.target.value)}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="form-grid" style={{ marginBottom: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Order Prefix</label>
                      <input
                        type="text"
                        required
                        value={orderPrefix}
                        onChange={(e) => setOrderPrefix(e.target.value)}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Default Shipping Fee ({currentStore.currency})</label>
                      <input
                        type="number"
                        required
                        value={shippingFee}
                        onChange={(e) => setShippingFee(Number(e.target.value))}
                        className="form-input"
                      />
                    </div>
                  </div>

                  <div className="form-grid" style={{ marginBottom: '12px' }}>
                    <div className="form-group">
                      <label className="form-label">Tax Rate (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={taxRatePercent}
                        onChange={(e) => setTaxRatePercent(Number(e.target.value))}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                      <label className="form-label" style={{ marginBottom: '6px' }}>Prices Include Tax</label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                        <input
                          type="checkbox"
                          checked={pricesIncludeTax}
                          onChange={(e) => setPricesIncludeTax(e.target.checked)}
                        />
                        <span>Catalog prices are tax-inclusive</span>
                      </label>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* TAB 2: VISUAL BRANDING & MEDIA */}
            {activeTab === 'branding' && (
              <>
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Brand Assets & Previews</div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">Brand Logo URL</label>
                    <input
                      type="url"
                      placeholder="https://.../logo.png"
                      value={logoUrl}
                      onChange={(e) => setLogoUrl(e.target.value)}
                      className="form-input"
                    />
                    {logoUrl && (
                      <div style={{ marginTop: '8px', padding: '10px', background: '#f8fafc', borderRadius: '6px', border: '1px solid var(--border)', display: 'inline-block' }}>
                        <img src={logoUrl} alt="Store Logo Preview" style={{ maxHeight: '48px', maxWidth: '200px', objectFit: 'contain' }} onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }} />
                      </div>
                    )}
                  </div>

                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">Favicon URL (32x32)</label>
                    <input
                      type="url"
                      placeholder="https://.../favicon.ico"
                      value={faviconUrl}
                      onChange={(e) => setFaviconUrl(e.target.value)}
                      className="form-input"
                    />
                    {faviconUrl && (
                      <div style={{ marginTop: '8px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <img src={faviconUrl} alt="Favicon" style={{ width: '24px', height: '24px', objectFit: 'contain' }} />
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Live tab icon</span>
                      </div>
                    )}
                  </div>

                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">Apple Touch Icon URL (180x180)</label>
                    <input
                      type="url"
                      placeholder="https://.../apple-touch-icon.png"
                      value={appleTouchIconUrl}
                      onChange={(e) => setAppleTouchIconUrl(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">Default Social Share Image URL (OG 1200x630)</label>
                    <input
                      type="url"
                      placeholder="https://.../og-banner.jpg"
                      value={defaultOgImageUrl}
                      onChange={(e) => setDefaultOgImageUrl(e.target.value)}
                      className="form-input"
                    />
                    {defaultOgImageUrl && (
                      <div style={{ marginTop: '8px', maxHeight: '120px', overflow: 'hidden', borderRadius: '6px', border: '1px solid var(--border)' }}>
                        <img src={defaultOgImageUrl} alt="OG Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Storefront Hero Banners</div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">Desktop Hero Banner URL (Aspect 16:9 or 21:9)</label>
                    <input
                      type="url"
                      placeholder="https://.../hero-desktop.jpg"
                      value={desktopHeroBannerUrl}
                      onChange={(e) => setDesktopHeroBannerUrl(e.target.value)}
                      className="form-input"
                    />
                    {desktopHeroBannerUrl && (
                      <div style={{ marginTop: '8px', height: '120px', overflow: 'hidden', borderRadius: '6px', border: '1px solid var(--border)' }}>
                        <img src={desktopHeroBannerUrl} alt="Desktop Hero" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                  </div>

                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">Mobile Hero Banner URL (Aspect 4:5 or 1:1)</label>
                    <input
                      type="url"
                      placeholder="https://.../hero-mobile.jpg"
                      value={mobileHeroBannerUrl}
                      onChange={(e) => setMobileHeroBannerUrl(e.target.value)}
                      className="form-input"
                    />
                    {mobileHeroBannerUrl && (
                      <div style={{ marginTop: '8px', height: '140px', width: '120px', overflow: 'hidden', borderRadius: '6px', border: '1px solid var(--border)' }}>
                        <img src={mobileHeroBannerUrl} alt="Mobile Hero" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                    )}
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Brand Statement & Footer Summary</div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">Site Meta Description / Search Summary</label>
                    <textarea
                      rows={3}
                      placeholder="Brief synopsis of what this brand offers..."
                      value={siteDescription}
                      onChange={(e) => setSiteDescription(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label">Footer Brand Statement & Copyright</label>
                    <textarea
                      rows={3}
                      placeholder="© 2026 Poshplex. All rights reserved. Premium Dhaka streetwear."
                      value={footerContent}
                      onChange={(e) => setFooterContent(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>
              </>
            )}

            {/* TAB 4: SOCIAL & SEO WEBMASTER */}
            {activeTab === 'social_seo' && (
              <>
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Social Media Channels</div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">WhatsApp Helpline Number</label>
                    <input
                      type="text"
                      placeholder="+8801..."
                      value={whatsappPhone}
                      onChange={(e) => setWhatsappPhone(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">Facebook Page URL</label>
                    <input
                      type="url"
                      placeholder="https://facebook.com/..."
                      value={facebookUrl}
                      onChange={(e) => setFacebookUrl(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">Instagram Profile URL</label>
                    <input
                      type="url"
                      placeholder="https://instagram.com/..."
                      value={instagramUrl}
                      onChange={(e) => setInstagramUrl(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">Twitter / X Handle</label>
                    <input
                      type="text"
                      placeholder="@brand"
                      value={twitterHandle}
                      onChange={(e) => setTwitterHandle(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Search Engine & Webmaster Verification</div>
                  </div>

                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">SEO Meta Title Pattern</label>
                    <input
                      type="text"
                      placeholder="%s | {store_name}"
                      value={metaTitleTemplate}
                      onChange={(e) => setMetaTitleTemplate(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">Default Meta Title</label>
                    <input
                      type="text"
                      placeholder="Premium Streetwear & Contemporary Drops"
                      value={defaultMetaTitle}
                      onChange={(e) => setDefaultMetaTitle(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">Default Meta Description</label>
                    <textarea
                      rows={2}
                      placeholder="Shop the latest drops in oversized tees, cargo pants, and hoodies..."
                      value={defaultMetaDescription}
                      onChange={(e) => setDefaultMetaDescription(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">Default SEO Keywords</label>
                    <input
                      type="text"
                      placeholder="streetwear, hoodies, oversized tees, bangladesh fashion"
                      value={defaultKeywords}
                      onChange={(e) => setDefaultKeywords(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">Google Site Verification Code</label>
                    <input
                      type="text"
                      placeholder="google-site-verification token"
                      value={googleSiteVerification}
                      onChange={(e) => setGoogleSiteVerification(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label">Custom robots.txt Rules</label>
                    <textarea
                      rows={2}
                      placeholder="User-agent: *&#10;Disallow: /admin"
                      value={robotsTxtCustom}
                      onChange={(e) => setRobotsTxtCustom(e.target.value)}
                      className="form-input"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                    />
                  </div>

                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                      <input
                        type="checkbox"
                        checked={sitemapEnabled}
                        onChange={(e) => setSitemapEnabled(e.target.checked)}
                      />
                      <span>Generate and serve dynamic XML Sitemap at /sitemap.xml</span>
                    </label>
                  </div>
                </div>
              </>
            )}

          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button type="submit" disabled={isSaving} className="btn btn-primary" style={{ gap: '6px' }}>
              <Save size={14} />
              <span>{isSaving ? 'Saving Changes...' : 'Save Store Preferences'}</span>
            </button>
          </div>
        </form>
      )}

      {/* TAB: STAFF ACCOUNTS */}
      {activeTab === 'staff' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '1000px' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              padding: '14px 18px',
              background: '#ffffff',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
            }}
          >
            <div>
              <div style={{ fontSize: '0.98rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Store Staff Members & RBAC Permissions
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Authorize staff accounts, assign operational roles, and manage access credentials.
              </div>
            </div>
            <button
              type="button"
              onClick={openCreateStaff}
              className="btn btn-sm btn-primary"
              style={{ gap: '6px' }}
            >
              <UserPlus size={14} />
              <span>Add Staff Member</span>
            </button>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="table-container" style={{ border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Staff Member</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.map((st) => (
                    <tr key={st.id}>
                      <td style={{ fontWeight: 600 }}>{st.name}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{st.email}</td>
                      <td>
                        <span
                          className={`badge ${
                            st.role === 'STORE_OWNER'
                              ? 'badge-active'
                              : st.role === 'STORE_ADMIN'
                                ? 'badge-shipped'
                                : 'badge-outline'
                          }`}
                        >
                          {st.role}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${st.isActive ? 'badge-active' : 'badge-outline'}`}>
                          {st.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {st.createdAt ? new Date(st.createdAt).toLocaleDateString() : '—'}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            title="Edit Staff Member"
                            onClick={() => openEditStaff(st)}
                            style={{ padding: '4px 8px' }}
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            title={st.role === 'STORE_OWNER' ? 'Store owner cannot be deleted' : 'Delete Staff Member'}
                            disabled={st.role === 'STORE_OWNER'}
                            onClick={() => setDeleteStaffTarget(st)}
                            style={{
                              padding: '4px 8px',
                              color: st.role === 'STORE_OWNER' ? '#cbd5e1' : '#dc2626',
                              borderColor: st.role === 'STORE_OWNER' ? '#e2e8f0' : '#fca5a5',
                              cursor: st.role === 'STORE_OWNER' ? 'not-allowed' : 'pointer',
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {staffList.length === 0 && (
                    <tr>
                      <td colSpan={6} style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)' }}>
                        No staff members found. Click "Add Staff Member" to authorize team members.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

              {/* CREATE / EDIT STAFF MODAL */}
              {staffModal && (
                <RecordModal
                  title={staffModal.mode === 'create' ? 'Add Staff Member' : `Edit Staff: ${staffModal.staff?.name}`}
                  submitLabel={staffModal.mode === 'create' ? 'Create Staff Account' : 'Save Changes'}
                  onClose={() => setStaffModal(null)}
                  onSubmit={handleSaveStaff}
                  maxWidth="560px"
                >
                  <div className="form-grid">
                    <div className="form-group">
                      <label className="form-label">First Name *</label>
                      <input
                        className="form-input"
                        required
                        value={staffForm.firstName}
                        onChange={(e) => setStaffForm({ ...staffForm, firstName: e.target.value })}
                        placeholder="e.g. Tanvir"
                        autoFocus
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">Last Name *</label>
                      <input
                        className="form-input"
                        required
                        value={staffForm.lastName}
                        onChange={(e) => setStaffForm({ ...staffForm, lastName: e.target.value })}
                        placeholder="e.g. Ahmed"
                      />
                    </div>

                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Email Address *</label>
                      <input
                        type="email"
                        className="form-input"
                        required
                        disabled={staffModal.mode === 'edit'}
                        value={staffForm.email}
                        onChange={(e) => setStaffForm({ ...staffForm, email: e.target.value })}
                        placeholder="tanvir@poshplex.com"
                        style={staffModal.mode === 'edit' ? { backgroundColor: '#f1f5f9', cursor: 'not-allowed' } : undefined}
                      />
                      {staffModal.mode === 'edit' && (
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px', display: 'block' }}>
                          Email address serves as unique store login credential and cannot be changed.
                        </span>
                      )}
                    </div>

                    {staffModal.mode === 'create' && (
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label className="form-label">Temporary Account Password *</label>
                        <input
                          type="password"
                          className="form-input"
                          required
                          value={staffForm.password}
                          onChange={(e) => setStaffForm({ ...staffForm, password: e.target.value })}
                          placeholder="Min. 8 characters"
                        />
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px', display: 'block' }}>
                          Provide initial password. Staff member can change their password anytime via the workstation.
                        </span>
                      </div>
                    )}

                    <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                      <label className="form-label">Access Role *</label>
                      <select
                        className="form-select"
                        value={staffForm.role}
                        disabled={staffModal.staff?.role === 'STORE_OWNER'}
                        onChange={(e) => setStaffForm({ ...staffForm, role: e.target.value as any })}
                      >
                        {staffModal.staff?.role === 'STORE_OWNER' && (
                          <option value="STORE_OWNER">Store Owner (Superuser / Full Authority)</option>
                        )}
                        <option value="STORE_ADMIN">Store Admin (Catalog, Orders, Inventory, Marketing)</option>
                        <option value="STORE_STAFF">Store Staff (Order Processing, Packaging & Dispatch)</option>
                      </select>
                    </div>

                    {staffModal.mode === 'edit' && staffModal.staff?.role !== 'STORE_OWNER' && (
                      <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={staffForm.isActive}
                            onChange={(e) => setStaffForm({ ...staffForm, isActive: e.target.checked })}
                          />
                          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Account is active and authorized to log in</span>
                        </label>
                      </div>
                    )}
                  </div>
                </RecordModal>
              )}

              {/* CONFIRM DELETE STAFF MODAL */}
              {deleteStaffTarget && (
                <ConfirmDeleteModal
                  isOpen={true}
                  itemName={deleteStaffTarget.name || deleteStaffTarget.email}
                  itemType="Staff Member"
                  warningMessage={`Are you sure you want to delete staff account "${deleteStaffTarget.name}" (${deleteStaffTarget.email})? They will immediately lose access to the store admin workstation.`}
                  confirmButtonText="Yes, Delete Staff"
                  onClose={() => setDeleteStaffTarget(null)}
                  onConfirm={handleDeleteStaff}
                />
              )}
          </div>
          );
};
