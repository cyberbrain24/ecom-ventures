import React, { useState, useEffect } from 'react';
import { Save, CheckCircle2, ShieldAlert } from 'lucide-react';
import { MarketingConfig, StoreBrand } from '../types/store';
import { fetchMarketingConfig, saveMarketingConfig } from '../lib/marketing-api';

interface MarketingViewProps {
  currentStore: StoreBrand;
  marketing?: MarketingConfig | null;
}

export const MarketingView: React.FC<MarketingViewProps> = ({ currentStore }) => {
  const [metaPixelId, setMetaPixelId] = useState('');
  const [metaCapiToken, setMetaCapiToken] = useState('');
  const [ga4MeasurementId, setGa4MeasurementId] = useState('');
  const [gtmContainerId, setGtmContainerId] = useState('');
  const [trackPageView, setTrackPageView] = useState(true);
  const [trackAddToCart, setTrackAddToCart] = useState(true);
  const [trackPurchase, setTrackPurchase] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const config = await fetchMarketingConfig();
      if (config) {
        setMetaPixelId(config.metaPixelId || '');
        setMetaCapiToken(config.metaCapiToken || '');
        setGa4MeasurementId(config.ga4MeasurementId || '');
        setGtmContainerId(config.gtmContainerId || '');
        setTrackPageView(config.trackPageView);
        setTrackAddToCart(config.trackAddToCart);
        setTrackPurchase(config.trackPurchase);
      }
    } catch {
      setNotice({ type: 'error', text: 'Failed to load marketing settings from server.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentStore.slug]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setNotice(null);

    try {
      await saveMarketingConfig({
        meta_pixel_id: metaPixelId.trim(),
        meta_capi_token: metaCapiToken.trim(),
        ga4_measurement_id: ga4MeasurementId.trim(),
        gtm_container_id: gtmContainerId.trim(),
        is_pixel_enabled: trackPageView,
        is_capi_enabled: trackAddToCart,
        is_ga4_enabled: trackPurchase,
        is_gtm_enabled: Boolean(gtmContainerId.trim()),
      });
      setNotice({ type: 'success', text: 'Marketing telemetry & pixel tracking configurations saved successfully.' });
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Failed to save marketing tracking settings.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '14px' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
          Marketing Telemetry & Pixels
        </h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
          Conversion tracking, Meta CAPI & Google Analytics 4 settings for <code>{currentStore.name}</code>
        </p>
      </div>

      {notice && (
        <div className={`notice notice-${notice.type === 'success' ? 'success' : 'warning'}`} style={{ marginBottom: '14px' }}>
          {notice.text}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ maxWidth: '820px' }}>
        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="card-header">
            <div className="card-title">Meta (Facebook & Instagram Tracking)</div>
          </div>
          <div className="form-group" style={{ marginBottom: '16px' }}>
            <label className="form-label" htmlFor="mkt-meta-pixel">Meta Pixel ID</label>
            <input
              id="mkt-meta-pixel"
              type="text"
              placeholder="e.g. 182937492817293"
              value={metaPixelId}
              onChange={(e) => setMetaPixelId(e.target.value)}
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="mkt-capi-token">Conversions API (CAPI) Server Token</label>
            <input
              id="mkt-capi-token"
              type="password"
              placeholder="Leave empty or enter new CAPI system token"
              value={metaCapiToken}
              onChange={(e) => setMetaCapiToken(e.target.value)}
              className="form-input"
            />
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
              Enables server-side deduplicated conversion tracking even when ad blockers are active.
            </span>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '16px' }}>
          <div className="card-header">
            <div className="card-title">Google Analytics 4 & Tag Manager</div>
          </div>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label" htmlFor="mkt-ga4">GA4 Measurement ID</label>
              <input
                id="mkt-ga4"
                type="text"
                placeholder="G-XXXXXXXXXX"
                value={ga4MeasurementId}
                onChange={(e) => setGa4MeasurementId(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label" htmlFor="mkt-gtm">GTM Container ID</label>
              <input
                id="mkt-gtm"
                type="text"
                placeholder="GTM-XXXXXXX"
                value={gtmContainerId}
                onChange={(e) => setGtmContainerId(e.target.value)}
                className="form-input"
              />
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '20px' }}>
          <div className="card-header">
            <div className="card-title">Telemetry Events & Tracking Signals</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={trackPageView}
                onChange={(e) => setTrackPageView(e.target.checked)}
              />
              <span style={{ fontWeight: 600 }}>Track Page Views (Automatic on storefront route changes)</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={trackAddToCart}
                onChange={(e) => setTrackAddToCart(e.target.checked)}
              />
              <span style={{ fontWeight: 600 }}>Track AddToCart & ViewContent</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '0.85rem' }}>
              <input
                type="checkbox"
                checked={trackPurchase}
                onChange={(e) => setTrackPurchase(e.target.checked)}
              />
              <span style={{ fontWeight: 600 }}>Track Purchase with Revenue & Items Payload</span>
            </label>
          </div>
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="btn btn-primary"
          style={{ padding: '10px 24px', gap: '8px' }}
        >
          <Save size={16} />
          <span>{isSaving ? 'Saving Settings...' : 'Save Tracking Settings'}</span>
        </button>
      </form>
    </div>
  );
};
