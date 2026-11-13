import React, { useState } from 'react';
import { Palette, Eye, Sparkles, CheckCircle2, Save, Layout, Type } from 'lucide-react';
import { ThemeCustomizerConfig, StoreBrand } from '../types/store';

interface ThemeViewProps {
  currentStore: StoreBrand;
  themeConfig: ThemeCustomizerConfig;
  onSaveTheme: (config: ThemeCustomizerConfig) => void;
}

export const ThemeView: React.FC<ThemeViewProps> = ({ currentStore, themeConfig, onSaveTheme }) => {
  const [form, setForm] = useState<ThemeCustomizerConfig>({ ...themeConfig });
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveTheme(form);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2500);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
            Theme Customizer & Visual Appearance
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
            Live storefront design tokens, typography, and announcement bar for <code>{currentStore.name}</code>
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(320px, 1fr)', gap: '12px', alignItems: 'start' }}>
        {/* Controls Form */}
        <form onSubmit={handleSubmit}>
          {/* Announcement Bar */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Announcement Bar Banner</div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={form.showAnnouncement}
                  onChange={(e) => setForm({ ...form, showAnnouncement: e.target.checked })}
                />
                <span>Enable Announcement Bar on Storefront</span>
              </label>
            </div>

            {form.showAnnouncement && (
              <div className="form-group">
                <label className="form-label">Banner Announcement Message</label>
                <input
                  type="text"
                  required
                  value={form.announcementText}
                  onChange={(e) => setForm({ ...form, announcementText: e.target.value })}
                  className="form-input"
                />
              </div>
            )}
          </div>

          {/* Color Palette */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Color Palette Tokens</div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Primary Brand Accent</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="color"
                    value={form.primaryColor}
                    onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                    style={{ width: '40px', height: '40px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={form.primaryColor}
                    onChange={(e) => setForm({ ...form, primaryColor: e.target.value })}
                    className="form-input"
                    style={{ flex: 1, fontFamily: 'var(--font-mono)' }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Secondary Brand Color</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="color"
                    value={form.secondaryColor}
                    onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                    style={{ width: '40px', height: '40px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
                  />
                  <input
                    type="text"
                    value={form.secondaryColor}
                    onChange={(e) => setForm({ ...form, secondaryColor: e.target.value })}
                    className="form-input"
                    style={{ flex: 1, fontFamily: 'var(--font-mono)' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Typography & Layout */}
          <div className="card">
            <div className="card-header">
              <div className="card-title">Typography & Layout Elements</div>
            </div>

            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Heading Typography</label>
                <select
                  value={form.headingFont}
                  onChange={(e) => setForm({ ...form, headingFont: e.target.value })}
                  className="form-select"
                >
                  <option value="Inter">Inter (Clean Modern)</option>
                  <option value="Plus Jakarta Sans">Plus Jakarta Sans (Contemporary)</option>
                  <option value="Playfair Display">Playfair Display (Luxury Serif)</option>
                  <option value="Cinzel">Cinzel (Heritage High-End)</option>
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Corner Radius Geometry</label>
                <select
                  value={form.borderRadius}
                  onChange={(e) => setForm({ ...form, borderRadius: e.target.value as any })}
                  className="form-select"
                >
                  <option value="none">Sharp Edges (0px)</option>
                  <option value="sm">Subtle Rounded (4px)</option>
                  <option value="md">Modern Rounded (8px)</option>
                  <option value="lg">Curved (14px)</option>
                  <option value="full">Pill Shaped (Full)</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Storefront Navigation Layout</label>
              <select
                value={form.headerLayout}
                onChange={(e) => setForm({ ...form, headerLayout: e.target.value as any })}
                className="form-select"
              >
                <option value="standard">Standard Left Logo & Right Nav</option>
                <option value="centered">Centered Brand Identity</option>
                <option value="minimal">Minimal Hamburger Navigation</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <button type="submit" className="btn btn-primary" style={{ padding: '10px 22px' }}>
              <Save size={16} />
              <span>Publish Theme Overrides</span>
            </button>
            {savedSuccess && (
              <span style={{ color: '#059669', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={16} /> Updated theme styling and design tokens successfully!
              </span>
            )}
          </div>
        </form>

        {/* Live Visual Preview Mock */}
        <div style={{ position: 'sticky', top: '84px' }}>
          <div className="card">
            <div className="card-header">
              <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Eye size={16} />
                <span>Real-Time Storefront Preview</span>
              </div>
            </div>

            {/* Preview Frame */}
            <div
              style={{
                border: '1px solid var(--border)',
                borderRadius: form.borderRadius === 'full' ? '18px' : form.borderRadius === 'none' ? '0' : '10px',
                overflow: 'hidden',
                background: '#ffffff',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              {/* Announcement Bar Preview */}
              {form.showAnnouncement && (
                <div
                  style={{
                    backgroundColor: form.primaryColor,
                    color: 'white',
                    padding: '8px 12px',
                    fontSize: '0.75rem',
                    textAlign: 'center',
                    fontWeight: 600,
                  }}
                >
                  {form.announcementText}
                </div>
              )}

              {/* Navigation Header Preview */}
              <div
                style={{
                  padding: '16px 20px',
                  borderBottom: '1px solid #f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a', fontFamily: form.headingFont }}>
                  {currentStore.name}
                </div>
                <div style={{ display: 'flex', gap: '16px', fontSize: '0.8rem', color: '#64748b', fontWeight: 500 }}>
                  <span>Catalog</span>
                  <span>New Arrivals</span>
                  <span>Sale</span>
                </div>
              </div>

              {/* Hero Banner Preview */}
              <div style={{ padding: '36px 20px', background: '#f8fafc', textAlign: 'center' }}>
                <h3
                  style={{
                    fontSize: '1.4rem',
                    fontWeight: 800,
                    color: '#0f172a',
                    fontFamily: form.headingFont,
                    marginBottom: '8px',
                  }}
                >
                  Welcome to {currentStore.name}
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', maxWidth: '320px', margin: '0 auto 16px' }}>
                  Explore handcrafted collections built for perfection and everyday luxury.
                </p>
                <button
                  type="button"
                  style={{
                    backgroundColor: form.primaryColor,
                    color: 'white',
                    border: 'none',
                    padding: '8px 18px',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    borderRadius: form.borderRadius === 'full' ? '9999px' : form.borderRadius === 'none' ? '0' : '6px',
                    cursor: 'default',
                  }}
                >
                  Shop Now
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
