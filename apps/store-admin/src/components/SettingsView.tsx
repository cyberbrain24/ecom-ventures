import React, { useState } from 'react';
import {
  Settings,
  Save,
  CheckCircle2,
  Shield,
  UserPlus,
  Trash2,
  Pencil,
  Plus,
  Globe,
  Search,
  Share2,
  FileText,
  Lock,
  ExternalLink,
  Sparkles,
  Smartphone,
  Eye,
  Check,
} from 'lucide-react';
import { StoreSettings, StoreBrand } from '../types/store';
import { AddStaffModal, StoreStaffMember } from './AddStaffModal';
import { EditStaffModal } from './EditStaffModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { GoogleSerpPreview } from './GoogleSerpPreview';

interface SettingsViewProps {
  currentStore: StoreBrand;
  settings: StoreSettings;
  onSaveSettings: (settings: StoreSettings) => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ currentStore, settings, onSaveSettings }) => {
  const [activeSubTab, setActiveSubTab] = useState<'operations' | 'seo'>('operations');
  const [form, setForm] = useState<StoreSettings>({
    ...settings,
    metaTitleTemplate: settings.metaTitleTemplate || '%s | ' + currentStore.name,
    defaultMetaTitle: settings.defaultMetaTitle || `${currentStore.name} — Luxury Boutique & Online Store`,
    defaultMetaDescription: settings.defaultMetaDescription || `Discover curated fashion, artisan goods, and premium collections at ${currentStore.name}.`,
    defaultKeywords: settings.defaultKeywords || `${currentStore.name}, online shopping, fashion boutique, premium collections`,
    faviconUrl: settings.faviconUrl || '',
    appleTouchIconUrl: settings.appleTouchIconUrl || '',
    defaultOgImageUrl: settings.defaultOgImageUrl || '',
    twitterHandle: settings.twitterHandle || '',
    googleSiteVerification: settings.googleSiteVerification || '',
    bingSiteVerification: settings.bingSiteVerification || '',
    pinterestVerification: settings.pinterestVerification || '',
    robotsTxtCustom: settings.robotsTxtCustom || `User-agent: *\nAllow: /\nDisallow: /checkout\nDisallow: /admin\nDisallow: /api/\nSitemap: https://${currentStore.primaryDomain}/sitemap.xml`,
    sitemapEnabled: settings.sitemapEnabled !== undefined ? settings.sitemapEnabled : true,
  });
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [staffList, setStaffList] = useState<StoreStaffMember[]>([
    { id: 'st-1', name: 'Store Owner', email: `admin@${currentStore.slug}.com`, role: 'STORE_OWNER', status: 'ACTIVE' },
    { id: 'st-2', name: 'Inventory Manager', email: `ops@${currentStore.slug}.com`, role: 'STORE_ADMIN', status: 'ACTIVE' },
  ]);

  const [isAddStaffOpen, setIsAddStaffOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StoreStaffMember | null>(null);
  const [deletingStaff, setDeletingStaff] = useState<StoreStaffMember | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(form);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
            Store Settings & Operations
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
            Operational parameters, delivery rates, Favicon, and 100% SEO metadata for <code>{currentStore.name}</code>
          </p>
        </div>
      </div>

      {/* Subtab Navigation Pills */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '18px' }}>
        <button
          type="button"
          onClick={() => setActiveSubTab('operations')}
          className={`btn btn-sm ${activeSubTab === 'operations' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', fontSize: '0.82rem' }}
        >
          <Settings size={15} />
          <span>Operations & Staff</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveSubTab('seo')}
          className={`btn btn-sm ${activeSubTab === 'seo' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', fontSize: '0.82rem' }}
        >
          <Globe size={15} />
          <span>SEO, Favicon & Webmaster</span>
          <span
            style={{
              fontSize: '0.68rem',
              fontWeight: 800,
              backgroundColor: activeSubTab === 'seo' ? '#ffffff' : 'var(--primary)',
              color: activeSubTab === 'seo' ? 'var(--primary)' : '#ffffff',
              borderRadius: '999px',
              padding: '1px 6px',
              marginLeft: '4px',
            }}
          >
            100% SEO
          </span>
        </button>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: '880px' }}>
        {activeSubTab === 'operations' ? (
          <>
            {/* Store Profile */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Brand Identity & Support Coordinates</div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Store Brand Name</label>
                  <input
                    type="text"
                    required
                    value={form.brandName}
                    onChange={(e) => setForm({ ...form, brandName: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Support Email Address</label>
                  <input
                    type="email"
                    required
                    value={form.contactEmail}
                    onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Customer Contact Phone</label>
                  <input
                    type="text"
                    required
                    value={form.contactPhone}
                    onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Order Number Prefix</label>
                  <input
                    type="text"
                    required
                    value={form.orderPrefix}
                    onChange={(e) => setForm({ ...form, orderPrefix: e.target.value.toUpperCase() })}
                    className="form-input"
                  />
                </div>
              </div>
            </div>

            {/* Shipping & Delivery Rates */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Shipping & Logistics Rates</div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Inside Dhaka Delivery Fee (BDT)</label>
                  <input
                    type="number"
                    required
                    value={form.shippingInsideDhaka}
                    onChange={(e) => setForm({ ...form, shippingInsideDhaka: parseInt(e.target.value, 10) || 0 })}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Outside Dhaka Delivery Fee (BDT)</label>
                  <input
                    type="number"
                    required
                    value={form.shippingOutsideDhaka}
                    onChange={(e) => setForm({ ...form, shippingOutsideDhaka: parseInt(e.target.value, 10) || 0 })}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Return & Replacement Window (Days)</label>
                <input
                  type="number"
                  required
                  value={form.returnPolicyDays}
                  onChange={(e) => setForm({ ...form, returnPolicyDays: parseInt(e.target.value, 10) || 7 })}
                  className="form-input"
                />
              </div>
            </div>

            {/* Staff Directory */}
            <div className="card">
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div className="card-title">Authorized Store Staff Accounts</div>
                  <div className="card-desc">Authorized operators and team members with role permissions</div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddStaffOpen(true)}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.78rem', padding: '5px 12px' }}
                >
                  <Plus size={14} />
                  <span>Add Staff Operator</span>
                </button>
              </div>

              <table className="data-table" style={{ marginBottom: '16px' }}>
                <thead>
                  <tr>
                    <th>Staff Name</th>
                    <th>Email Address</th>
                    <th>Assigned Role</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.map((st) => (
                    <tr key={st.id}>
                      <td style={{ fontWeight: 600 }}>{st.name}</td>
                      <td>{st.email}</td>
                      <td><span className="badge badge-shipped">{st.role}</span></td>
                      <td><span className="badge badge-active">{st.status}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => setEditingStaff(st)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '3px 6px' }}
                            title="Edit Staff Member"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingStaff(st)}
                            className="btn btn-danger btn-sm"
                            style={{ padding: '3px 6px' }}
                            title="Delete Staff Member"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          /* ========================================================
             SEO, FAVICON & WEBMASTER SUB-TAB
             ======================================================== */
          <>
            {/* 1. Interactive Browser Tab Simulator */}
            <div className="card" style={{ borderLeft: '4px solid var(--primary)' }}>
              <div className="card-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Globe size={18} style={{ color: 'var(--primary)' }} />
                  <div>
                    <div className="card-title">Live Browser Tab Simulation</div>
                    <div className="card-desc">Visual preview of how your store title and favicon appear in user browser tabs</div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#1e293b',
                  borderRadius: '10px 10px 6px 6px',
                  padding: '10px 12px 14px 12px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                }}
              >
                {/* Simulated Chrome/Safari window header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#ef4444' }} />
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#f59e0b' }} />
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#10b981' }} />
                  <div style={{ fontSize: '0.7rem', color: '#94a3b8', marginLeft: '6px', fontFamily: 'var(--font-mono)' }}>
                    Browser Viewport
                  </div>
                </div>

                {/* Tabs row */}
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', paddingLeft: '4px' }}>
                  {/* Active Store Tab */}
                  <div
                    style={{
                      backgroundColor: '#334155',
                      borderRadius: '8px 8px 0 0',
                      padding: '8px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      maxWidth: '240px',
                      boxShadow: '0 -2px 6px rgba(0,0,0,0.1)',
                      borderTop: '2px solid var(--primary)',
                    }}
                  >
                    {form.faviconUrl ? (
                      <img
                        src={form.faviconUrl}
                        alt="Favicon"
                        style={{ width: '16px', height: '16px', borderRadius: '3px', objectFit: 'cover' }}
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Globe size={14} style={{ color: '#38bdf8' }} />
                    )}
                    <span
                      style={{
                        fontSize: '0.76rem',
                        fontWeight: 600,
                        color: '#f8fafc',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {form.defaultMetaTitle || form.brandName}
                    </span>
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', cursor: 'pointer', marginLeft: 'auto' }}>×</span>
                  </div>

                  {/* Adjacent Inactive Tab */}
                  <div
                    style={{
                      backgroundColor: 'rgba(51, 65, 85, 0.4)',
                      borderRadius: '8px 8px 0 0',
                      padding: '8px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      maxWidth: '120px',
                    }}
                  >
                    <Search size={12} style={{ color: '#64748b' }} />
                    <span style={{ fontSize: '0.72rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                      Google Search
                    </span>
                  </div>
                </div>

                {/* Simulated Address Bar */}
                <div
                  style={{
                    backgroundColor: '#0f172a',
                    borderRadius: '0 0 6px 6px',
                    padding: '6px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.74rem',
                    color: '#94a3b8',
                    border: '1px solid #334155',
                    borderTop: 'none',
                  }}
                >
                  <Lock size={12} style={{ color: '#10b981' }} />
                  <span style={{ color: '#cbd5e1' }}>https://{currentStore.primaryDomain || `${currentStore.slug}.localhost:3002`}</span>
                  <span style={{ marginLeft: 'auto', color: '#64748b', fontSize: '0.68rem' }}>SSL TLS 1.3</span>
                </div>
              </div>
            </div>

            {/* 2. Favicon & App Icons Configuration */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Favicon & Mobile Touch Icons</div>
                <div className="card-desc">Visual identity displayed on browser tabs, bookmarks, and mobile home screens</div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Favicon URL (.ico, .png, .svg)</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="url"
                      placeholder="https://.../favicon.png"
                      value={form.faviconUrl || ''}
                      onChange={(e) => setForm({ ...form, faviconUrl: e.target.value })}
                      className="form-input"
                    />
                    {form.faviconUrl && (
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '6px',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: '#ffffff',
                          flexShrink: 0,
                        }}
                      >
                        <img src={form.faviconUrl} alt="Favicon" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', marginTop: '4px', display: 'block' }}>
                    Recommended size: 32x32px or 64x64px square image.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Apple Touch Icon URL</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="url"
                      placeholder="https://.../apple-touch-icon.png"
                      value={form.appleTouchIconUrl || ''}
                      onChange={(e) => setForm({ ...form, appleTouchIconUrl: e.target.value })}
                      className="form-input"
                    />
                    {form.appleTouchIconUrl && (
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '8px',
                          border: '1px solid var(--border)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: '#ffffff',
                          flexShrink: 0,
                        }}
                      >
                        <img src={form.appleTouchIconUrl} alt="Apple Icon" style={{ width: '26px', height: '26px', objectFit: 'contain' }} />
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', marginTop: '4px', display: 'block' }}>
                    Recommended size: 180x180px PNG with opaque background for iOS.
                  </span>
                </div>
              </div>
            </div>

            {/* 3. Global Metadata & Title Template */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Global Meta Titles & Search Optimization</div>
                <div className="card-desc">Default fallback metadata and dynamic title patterning for all storefront pages</div>
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">
                  Meta Title Template
                  <span style={{ fontWeight: 400, color: 'var(--text-subtle)', marginLeft: '6px' }}>
                    (<code>%s</code> is automatically replaced by Product, Category or Blog title)
                  </span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="%s | Store Brand"
                  value={form.metaTitleTemplate || ''}
                  onChange={(e) => setForm({ ...form, metaTitleTemplate: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label">Homepage / Default Meta Title</label>
                  <span style={{ fontSize: '0.7rem', color: (form.defaultMetaTitle || '').length > 60 ? '#ef4444' : '#10b981' }}>
                    {(form.defaultMetaTitle || '').length} / 60 characters
                  </span>
                </div>
                <input
                  type="text"
                  required
                  placeholder="Primary search title for homepage"
                  value={form.defaultMetaTitle || ''}
                  onChange={(e) => setForm({ ...form, defaultMetaTitle: e.target.value })}
                  className="form-input"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label className="form-label">Homepage / Default Meta Description</label>
                  <span style={{ fontSize: '0.7rem', color: (form.defaultMetaDescription || '').length > 160 ? '#ef4444' : '#10b981' }}>
                    {(form.defaultMetaDescription || '').length} / 160 characters
                  </span>
                </div>
                <textarea
                  rows={3}
                  required
                  placeholder="Engaging summary for search engines (120-160 characters recommended)"
                  value={form.defaultMetaDescription || ''}
                  onChange={(e) => setForm({ ...form, defaultMetaDescription: e.target.value })}
                  className="form-textarea"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Default Target Keywords (Comma-separated)</label>
                <input
                  type="text"
                  placeholder="e.g. evening dresses, silk fashion, luxury clothing dhaka"
                  value={form.defaultKeywords || ''}
                  onChange={(e) => setForm({ ...form, defaultKeywords: e.target.value })}
                  className="form-input"
                />
              </div>
            </div>

            {/* 4. Live SERP & Social Card Preview */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Homepage Google SERP & Social Preview</div>
                <div className="card-desc">Simulate how your homepage appears in Google Search and Social Media shares</div>
              </div>

              <GoogleSerpPreview
                title={form.defaultMetaTitle || form.brandName}
                description={form.defaultMetaDescription || ''}
                url={`https://${currentStore.primaryDomain}`}
                faviconUrl={form.faviconUrl}
                focusKeyword={form.defaultKeywords?.split(',')[0]}
                ogImageUrl={form.defaultOgImageUrl}
                brandName={form.brandName}
              />
            </div>

            {/* 5. Open Graph & Social Media */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Social Sharing (Open Graph & Twitter Cards)</div>
                <div className="card-desc">Controls how shared links render on Facebook, WhatsApp, LinkedIn, and X</div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Default Social Share Image (OG Image URL)</label>
                  <input
                    type="url"
                    placeholder="https://.../og-banner-1200x630.jpg"
                    value={form.defaultOgImageUrl || ''}
                    onChange={(e) => setForm({ ...form, defaultOgImageUrl: e.target.value })}
                    className="form-input"
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', marginTop: '4px', display: 'block' }}>
                    Optimal resolution: 1200 x 630 pixels.
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Twitter / X Creator Handle</label>
                  <input
                    type="text"
                    placeholder="@YourBrand"
                    value={form.twitterHandle || ''}
                    onChange={(e) => setForm({ ...form, twitterHandle: e.target.value })}
                    className="form-input"
                  />
                </div>
              </div>

              {form.defaultOgImageUrl && (
                <div style={{ marginTop: '10px' }}>
                  <label className="form-label" style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>Image Preview:</label>
                  <img
                    src={form.defaultOgImageUrl}
                    alt="OG Preview"
                    style={{ width: '100%', maxHeight: '180px', objectFit: 'cover', borderRadius: '6px', border: '1px solid var(--border)' }}
                  />
                </div>
              )}
            </div>

            {/* 6. Webmaster Tools Verification */}
            <div className="card">
              <div className="card-header">
                <div className="card-title">Search Engine & Webmaster Verification</div>
                <div className="card-desc">Inject official ownership meta tags for Google Search Console, Bing, and Pinterest</div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Google Search Console Verification Code</label>
                  <input
                    type="text"
                    placeholder="e.g. google-site-verification=xxxx or token"
                    value={form.googleSiteVerification || ''}
                    onChange={(e) => setForm({ ...form, googleSiteVerification: e.target.value })}
                    className="form-input"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', marginTop: '4px', display: 'block' }}>
                    Injected as <code>&lt;meta name="google-site-verification" ...&gt;</code>
                  </span>
                </div>

                <div className="form-group">
                  <label className="form-label">Bing Webmaster (msvalidate.01) Token</label>
                  <input
                    type="text"
                    placeholder="e.g. 7484B79A3482C..."
                    value={form.bingSiteVerification || ''}
                    onChange={(e) => setForm({ ...form, bingSiteVerification: e.target.value })}
                    className="form-input"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', marginTop: '4px', display: 'block' }}>
                    Injected as <code>&lt;meta name="msvalidate.01" ...&gt;</code>
                  </span>
                </div>
              </div>

              <div className="form-group" style={{ marginTop: '10px' }}>
                <label className="form-label">Pinterest Domain Verification Token</label>
                <input
                  type="text"
                  placeholder="e.g. a39e8f492b0..."
                  value={form.pinterestVerification || ''}
                  onChange={(e) => setForm({ ...form, pinterestVerification: e.target.value })}
                  className="form-input"
                  style={{ fontFamily: 'var(--font-mono)' }}
                />
              </div>
            </div>

            {/* 7. Crawling & Sitemap */}
            <div className="card">
              <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div className="card-title">Search Engine Crawling & XML Sitemaps</div>
                  <div className="card-desc">Configure search indexing bots and review your automated XML sitemap</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <a
                    href="http://localhost:3002/sitemap.xml"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.74rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <ExternalLink size={12} />
                    <span>View /sitemap.xml</span>
                  </a>
                  <a
                    href="http://localhost:3002/robots.txt"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.74rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                  >
                    <ExternalLink size={12} />
                    <span>View /robots.txt</span>
                  </a>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <input
                  type="checkbox"
                  id="sitemapEnabled"
                  checked={form.sitemapEnabled}
                  onChange={(e) => setForm({ ...form, sitemapEnabled: e.target.checked })}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <label htmlFor="sitemapEnabled" style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-main)', cursor: 'pointer', margin: 0 }}>
                  Enable Automated Dynamic XML Sitemap Generation (<code>/sitemap.xml</code>)
                </label>
              </div>

              <div className="form-group">
                <label className="form-label">
                  Custom Robots.txt Content
                  <span style={{ fontWeight: 400, color: 'var(--text-subtle)', marginLeft: '6px' }}>
                    (Served at <code>/robots.txt</code> for web spiders)
                  </span>
                </label>
                <textarea
                  rows={6}
                  value={form.robotsTxtCustom || ''}
                  onChange={(e) => setForm({ ...form, robotsTxtCustom: e.target.value })}
                  className="form-textarea"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}
                  placeholder={`User-agent: *\nAllow: /\nDisallow: /checkout\nDisallow: /admin\nSitemap: https://${currentStore.primaryDomain}/sitemap.xml`}
                />
              </div>
            </div>
          </>
        )}

        {/* Global Save Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '20px' }}>
          <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px', fontSize: '0.88rem' }}>
            <Save size={16} />
            <span>Save Store Configuration</span>
          </button>
          {savedSuccess && (
            <span style={{ color: '#059669', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} /> Store SEO & settings committed to database!
            </span>
          )}
        </div>
      </form>

      {/* Add Staff Modal */}
      {isAddStaffOpen && (
        <AddStaffModal
          onClose={() => setIsAddStaffOpen(false)}
          onAdd={(newMember) => {
            setStaffList((prev) => [...prev, newMember]);
            setIsAddStaffOpen(false);
          }}
        />
      )}

      {/* Edit Staff Modal */}
      {editingStaff && (
        <EditStaffModal
          staff={editingStaff}
          onClose={() => setEditingStaff(null)}
          onSave={(updated) => {
            setStaffList((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
            setEditingStaff(null);
          }}
        />
      )}

      {/* Delete Approval Confirmation Modal */}
      {deletingStaff && (
        <ConfirmDeleteModal
          isOpen={!!deletingStaff}
          title="Delete Staff Account"
          itemName={`${deletingStaff.name} (${deletingStaff.email})`}
          itemType="Staff Account"
          warningMessage={`Are you sure you want to permanently delete staff account for "${deletingStaff.name}"? This operator will immediately lose access to ${currentStore.name}.`}
          onConfirm={() => {
            setStaffList((prev) => prev.filter((s) => s.id !== deletingStaff.id));
            setDeletingStaff(null);
          }}
          onClose={() => setDeletingStaff(null)}
        />
      )}
    </div>
  );
};
