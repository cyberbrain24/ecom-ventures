import React, { useState } from 'react';
import { BarChart3, ShieldCheck, CheckCircle2, Save, TrendingUp, Globe, Eye, ShoppingBag } from 'lucide-react';
import { MarketingConfig, StoreBrand } from '../types/store';

interface MarketingViewProps {
  currentStore: StoreBrand;
  marketing: MarketingConfig;
  onSaveMarketing: (config: MarketingConfig) => void;
}

export const MarketingView: React.FC<MarketingViewProps> = ({ currentStore, marketing, onSaveMarketing }) => {
  const [form, setForm] = useState<MarketingConfig>({ ...marketing });
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveMarketing(form);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
            Marketing Telemetry & Analytics Hub
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
            Client-side scripts & server-side Conversions API (CAPI) for <code>{currentStore.name}</code>
          </p>
        </div>
      </div>

      {/* Marketing Telemetry Metrics - 7 Column Box Card Design */}
      <div className="stats-grid">
        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Meta Pixel</div>
            <div className="stat-val" style={{ color: form.metaPixelId ? '#059669' : 'var(--text-subtle)', fontSize: '1rem' }}>
              {form.metaPixelId ? 'Connected' : 'Unset'}
            </div>
            <div className="stat-sub" style={{ color: form.metaPixelId ? '#10b981' : 'var(--text-subtle)' }}>
              <BarChart3 size={11} /> Client pixel
            </div>
          </div>
          <div className="stat-icon" style={{ background: form.metaPixelId ? '#ecfdf5' : '#f1f5f9', color: form.metaPixelId ? '#059669' : '#94a3b8' }}>
            <BarChart3 size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Server CAPI</div>
            <div className="stat-val" style={{ color: form.metaCapiToken ? '#059669' : 'var(--text-subtle)', fontSize: '1rem' }}>
              {form.metaCapiToken ? 'Protected' : 'Pending'}
            </div>
            <div className="stat-sub" style={{ color: form.metaCapiToken ? '#10b981' : 'var(--text-subtle)' }}>
              <ShieldCheck size={11} /> Server events
            </div>
          </div>
          <div className="stat-icon" style={{ background: form.metaCapiToken ? '#ecfdf5' : '#f1f5f9', color: form.metaCapiToken ? '#059669' : '#94a3b8' }}>
            <ShieldCheck size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Google GA4</div>
            <div className="stat-val" style={{ color: form.ga4MeasurementId ? '#0284c7' : 'var(--text-subtle)', fontSize: '1rem' }}>
              {form.ga4MeasurementId ? 'Stream OK' : 'Unset'}
            </div>
            <div className="stat-sub" style={{ color: form.ga4MeasurementId ? '#0284c7' : 'var(--text-subtle)' }}>
              <TrendingUp size={11} /> Analytics 4
            </div>
          </div>
          <div className="stat-icon" style={{ background: form.ga4MeasurementId ? '#f0f9ff' : '#f1f5f9', color: form.ga4MeasurementId ? '#0284c7' : '#94a3b8' }}>
            <TrendingUp size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Google GTM</div>
            <div className="stat-val" style={{ color: form.gtmContainerId ? '#6366f1' : 'var(--text-subtle)', fontSize: '1rem' }}>
              {form.gtmContainerId ? 'Mounted' : 'Unset'}
            </div>
            <div className="stat-sub" style={{ color: form.gtmContainerId ? '#6366f1' : 'var(--text-subtle)' }}>
              <Globe size={11} /> Container
            </div>
          </div>
          <div className="stat-icon" style={{ background: form.gtmContainerId ? '#eef2ff' : '#f1f5f9', color: form.gtmContainerId ? '#6366f1' : '#94a3b8' }}>
            <Globe size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Page Views</div>
            <div className="stat-val" style={{ color: form.trackPageView ? '#059669' : 'var(--text-subtle)', fontSize: '1rem' }}>
              {form.trackPageView ? 'Tracking' : 'Paused'}
            </div>
            <div className="stat-sub" style={{ color: form.trackPageView ? '#10b981' : 'var(--text-subtle)' }}>
              <Eye size={11} /> View beacon
            </div>
          </div>
          <div className="stat-icon" style={{ background: form.trackPageView ? '#ecfdf5' : '#f1f5f9', color: form.trackPageView ? '#059669' : '#94a3b8' }}>
            <Eye size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Add To Cart</div>
            <div className="stat-val" style={{ color: form.trackAddToCart ? '#059669' : 'var(--text-subtle)', fontSize: '1rem' }}>
              {form.trackAddToCart ? 'Tracking' : 'Paused'}
            </div>
            <div className="stat-sub" style={{ color: form.trackAddToCart ? '#10b981' : 'var(--text-subtle)' }}>
              <ShoppingBag size={11} /> Intent beacon
            </div>
          </div>
          <div className="stat-icon" style={{ background: form.trackAddToCart ? '#ecfdf5' : '#f1f5f9', color: form.trackAddToCart ? '#059669' : '#94a3b8' }}>
            <ShoppingBag size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Purchases</div>
            <div className="stat-val" style={{ color: form.trackPurchase ? '#059669' : 'var(--text-subtle)', fontSize: '1rem' }}>
              {form.trackPurchase ? 'Tracking' : 'Paused'}
            </div>
            <div className="stat-sub" style={{ color: form.trackPurchase ? '#10b981' : 'var(--text-subtle)' }}>
              <CheckCircle2 size={11} /> Conversions
            </div>
          </div>
          <div className="stat-icon" style={{ background: form.trackPurchase ? '#dcfce7' : '#f1f5f9', color: form.trackPurchase ? '#15803d' : '#94a3b8' }}>
            <CheckCircle2 size={16} />
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} style={{ maxWidth: '800px' }}>
        {/* Meta Integration */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Meta Business Suite (Facebook & Instagram)</div>
              <div className="card-desc">Sync browser pixel and server-side Conversions API events</div>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label">Meta Pixel ID</label>
            <input
              type="text"
              placeholder="e.g. 9845112093412"
              value={form.metaPixelId}
              onChange={(e) => setForm({ ...form, metaPixelId: e.target.value })}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Server-Side Meta Conversions API (CAPI) Access Token</label>
            <input
              type="password"
              placeholder="EAAG..."
              value={form.metaCapiToken}
              onChange={(e) => setForm({ ...form, metaCapiToken: e.target.value })}
              className="form-input"
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              Enables privacy-resilient server-side purchase tracking bypassing browser ad-blockers.
            </span>
          </div>
        </div>

        {/* Google Analytics & GTM */}
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Google Analytics 4 & Tag Manager</div>
              <div className="card-desc">Direct client telemetry streaming</div>
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">GA4 Measurement ID</label>
              <input
                type="text"
                placeholder="e.g. G-XXXXXXXXXX"
                value={form.ga4MeasurementId}
                onChange={(e) => setForm({ ...form, ga4MeasurementId: e.target.value })}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Google Tag Manager Container ID</label>
              <input
                type="text"
                placeholder="e.g. GTM-XXXXXX"
                value={form.gtmContainerId}
                onChange={(e) => setForm({ ...form, gtmContainerId: e.target.value })}
                className="form-input"
              />
            </div>
          </div>
        </div>

        {/* Telemetry Tracking Toggles */}
        <div className="card">
          <div className="card-header">
            <div className="card-title">Telemetry Dispatch Rules</div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.trackPageView}
                onChange={(e) => setForm({ ...form, trackPageView: e.target.checked })}
              />
              <span>Stream <strong>PageView</strong> events on brand catalog and PDP navigation</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.trackAddToCart}
                onChange={(e) => setForm({ ...form, trackAddToCart: e.target.checked })}
              />
              <span>Dispatch <strong>AddToCart</strong> and <strong>InitiateCheckout</strong> telemetry</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.85rem', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={form.trackPurchase}
                onChange={(e) => setForm({ ...form, trackPurchase: e.target.checked })}
              />
              <span>Trigger dual-pipeline <strong>Purchase</strong> CAPI and browser conversion event</span>
            </label>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <button type="submit" className="btn btn-primary" style={{ padding: '10px 20px' }}>
            <Save size={16} />
            <span>Save Telemetry Configuration</span>
          </button>
          {savedSuccess && (
            <span style={{ color: '#059669', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <CheckCircle2 size={16} /> Telemetry parameters saved to store settings successfully!
            </span>
          )}
        </div>
      </form>
    </div>
  );
};
