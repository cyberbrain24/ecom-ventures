import React, { useState } from 'react';
import { Search, Globe, Share2, Monitor, Smartphone, CheckCircle2, AlertCircle, Sparkles, Code, ExternalLink } from 'lucide-react';

export interface SeoState {
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  canonicalUrl: string;
  metaRobots: string;
  ogImageUrl: string;
}

interface AdvancedSeoEditorProps {
  title: string;
  defaultSlug: string;
  storeName?: string;
  storeDomain?: string;
  type: 'product' | 'category' | 'subcategory';
  price?: number;
  currency?: string;
  defaultImageUrl?: string;
  seo: SeoState;
  onChange: (field: keyof SeoState, value: string) => void;
}

export const AdvancedSeoEditor: React.FC<AdvancedSeoEditorProps> = ({
  title,
  defaultSlug,
  storeName = 'Store',
  storeDomain = 'yourstore.com',
  type,
  price,
  currency = 'BDT',
  defaultImageUrl = '',
  seo,
  onChange,
}) => {
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [activeSubTab, setActiveSubTab] = useState<'serp' | 'social' | 'schema'>('serp');

  const effectiveSlug = defaultSlug.trim() || 'item-slug';
  const displayTitle = seo.metaTitle.trim() || (title.trim() ? `${title.trim()} | ${storeName}` : `Item Title | ${storeName}`);
  const displayDesc =
    seo.metaDescription.trim() ||
    `Shop the latest ${title.trim() || 'collection'} at ${storeName}. High quality, fast delivery, and authentic items guaranteed.`;
  const displayUrl = seo.canonicalUrl.trim() || `https://${storeDomain}/${type === 'product' ? 'product' : 'catalog?category='}${effectiveSlug}`;
  const displayImage = seo.ogImageUrl.trim() || defaultImageUrl.trim();

  const titleLength = (seo.metaTitle || '').length;
  const descLength = (seo.metaDescription || '').length;

  const isTitleGood = titleLength >= 40 && titleLength <= 65;
  const isDescGood = descLength >= 120 && descLength <= 165;

  const kw = seo.focusKeyword.trim().toLowerCase();
  const kwInTitle = kw ? displayTitle.toLowerCase().includes(kw) : false;
  const kwInDesc = kw ? displayDesc.toLowerCase().includes(kw) : false;

  // Generate live JSON-LD Schema Preview
  const schemaMarkup =
    type === 'product'
      ? {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: title || 'Product Name',
          description: displayDesc,
          image: displayImage ? [displayImage] : undefined,
          offers: {
            '@type': 'Offer',
            priceCurrency: currency,
            price: price || 0,
            availability: 'https://schema.org/InStock',
            url: displayUrl,
          },
        }
      : {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: title || 'Category Name',
          description: displayDesc,
          url: displayUrl,
        };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {/* Live Preview Switcher Box */}
      <div
        style={{
          border: '1px solid #e2e8f0',
          borderRadius: 'var(--radius-md)',
          background: '#ffffff',
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={() => setActiveSubTab('serp')}
              className={`btn btn-sm ${activeSubTab === 'serp' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '4px 10px', gap: '5px' }}
            >
              <Search size={13} />
              <span>Google Search (SERP)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('social')}
              className={`btn btn-sm ${activeSubTab === 'social' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '4px 10px', gap: '5px' }}
            >
              <Share2 size={13} />
              <span>Social Media (OG)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveSubTab('schema')}
              className={`btn btn-sm ${activeSubTab === 'schema' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.75rem', padding: '4px 10px', gap: '5px' }}
            >
              <Code size={13} />
              <span>Structured Data (JSON-LD)</span>
            </button>
          </div>

          {activeSubTab === 'serp' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#ffffff', padding: '2px 4px', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={() => setPreviewDevice('desktop')}
                style={{
                  background: previewDevice === 'desktop' ? '#f1f5f9' : 'transparent',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '3px 6px',
                  cursor: 'pointer',
                  color: previewDevice === 'desktop' ? '#0f172a' : '#64748b',
                }}
                title="Desktop Google Preview"
              >
                <Monitor size={14} />
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice('mobile')}
                style={{
                  background: previewDevice === 'mobile' ? '#f1f5f9' : 'transparent',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '3px 6px',
                  cursor: 'pointer',
                  color: previewDevice === 'mobile' ? '#0f172a' : '#64748b',
                }}
                title="Mobile Google Preview"
              >
                <Smartphone size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Tab 1: SERP Preview Panel */}
        {activeSubTab === 'serp' && (
          <div style={{ padding: '16px 20px', background: '#ffffff' }}>
            <div
              style={{
                maxWidth: previewDevice === 'mobile' ? '360px' : '640px',
                padding: '12px 14px',
                border: previewDevice === 'mobile' ? '1px solid #e2e8f0' : 'none',
                borderRadius: previewDevice === 'mobile' ? '12px' : '0',
                margin: previewDevice === 'mobile' ? '0 auto' : '0',
                background: '#ffffff',
                fontFamily: 'arial, sans-serif',
              }}
            >
              {/* Google URL Header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                <div
                  style={{
                    width: '24px',
                    height: '24px',
                    borderRadius: '50%',
                    background: '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 700,
                    color: '#475569',
                  }}
                >
                  {storeName.charAt(0).toUpperCase()}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '13px', color: '#202124', lineHeight: 1.2 }}>{storeName}</span>
                  <span style={{ fontSize: '11px', color: '#4d5156', lineHeight: 1.2 }}>
                    https://{storeDomain} › {type === 'product' ? 'product' : 'category'} › {effectiveSlug}
                  </span>
                </div>
              </div>

              {/* Google Blue Title */}
              <div
                style={{
                  color: '#1a0dab',
                  fontSize: previewDevice === 'mobile' ? '16px' : '18px',
                  fontWeight: 400,
                  lineHeight: 1.3,
                  cursor: 'pointer',
                  textDecoration: 'none',
                  marginTop: '4px',
                  wordBreak: 'break-word',
                }}
              >
                {displayTitle}
              </div>

              {/* Google Snippet Description */}
              <div
                style={{
                  color: '#4d5156',
                  fontSize: '13px',
                  lineHeight: 1.5,
                  marginTop: '4px',
                  wordBreak: 'break-word',
                }}
              >
                {displayDesc}
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Social Media (OG) Card Preview */}
        {activeSubTab === 'social' && (
          <div style={{ padding: '16px 20px', background: '#f8fafc' }}>
            <div
              style={{
                maxWidth: '480px',
                margin: '0 auto',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                overflow: 'hidden',
                boxShadow: '0 2px 4px rgba(0,0,0,0.06)',
              }}
            >
              {displayImage ? (
                <div style={{ width: '100%', height: '220px', background: '#f1f5f9', overflow: 'hidden' }}>
                  <img
                    src={displayImage}
                    alt={displayTitle}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      (e.currentTarget as HTMLElement).style.display = 'none';
                    }}
                  />
                </div>
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '140px',
                    background: '#f1f5f9',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#94a3b8',
                    fontSize: '0.8rem',
                  }}
                >
                  <Share2 size={24} style={{ marginRight: '8px' }} />
                  <span>No Social Share Image provided (add URL below)</span>
                </div>
              )}
              <div style={{ padding: '12px 14px', background: '#f8fafc', borderTop: '1px solid #f1f5f9' }}>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>
                  {storeDomain}
                </div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a', margin: '3px 0', lineHeight: 1.3 }}>
                  {displayTitle}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: '#475569',
                    lineHeight: 1.4,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {displayDesc}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 3: Structured Data Schema Preview */}
        {activeSubTab === 'schema' && (
          <div style={{ padding: '14px 18px', background: '#0f172a', color: '#38bdf8', fontSize: '0.78rem', fontFamily: 'monospace' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ color: '#94a3b8' }}>application/ld+json Structured Data</span>
              <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <CheckCircle2 size={12} /> Rich Snippets Ready
              </span>
            </div>
            <pre style={{ margin: 0, maxHeight: '200px', overflowY: 'auto', whiteSpace: 'pre-wrap' }}>
              {JSON.stringify(schemaMarkup, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* SEO Health Score Checklist */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '8px',
          background: '#f8fafc',
          padding: '12px 14px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid #e2e8f0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
          {isTitleGood ? <CheckCircle2 size={14} color="#10b981" /> : <AlertCircle size={14} color="#f59e0b" />}
          <span>Title Length: {titleLength}/60</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
          {isDescGood ? <CheckCircle2 size={14} color="#10b981" /> : <AlertCircle size={14} color="#f59e0b" />}
          <span>Desc Length: {descLength}/160</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
          {kw ? (
            kwInTitle ? <CheckCircle2 size={14} color="#10b981" /> : <AlertCircle size={14} color="#f59e0b" />
          ) : (
            <span style={{ color: '#94a3b8' }}>○ Focus Keyword</span>
          )}
          <span>{kw ? (kwInTitle ? 'Keyword in Title' : 'Keyword not in Title') : 'No Keyword'}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem' }}>
          {displayImage ? <CheckCircle2 size={14} color="#10b981" /> : <AlertCircle size={14} color="#f59e0b" />}
          <span>{displayImage ? 'Social Card Image Set' : 'Missing Social Image'}</span>
        </div>
      </div>

      {/* SEO Form Inputs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {/* Focus Keyword */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <label className="form-label" style={{ fontWeight: 700, margin: 0 }}>Focus Keyword / Target Query</label>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Target search term customers use</span>
          </div>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. vintage oversized tee, wireless noise cancelling headphones"
            value={seo.focusKeyword}
            onChange={(e) => onChange('focusKeyword', e.target.value)}
          />
        </div>

        {/* SEO / Meta Title */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <label className="form-label" style={{ fontWeight: 700, margin: 0 }}>SEO Meta Title</label>
            <span style={{ fontSize: '0.72rem', color: isTitleGood ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
              {titleLength} / 60 characters {isTitleGood ? '(Optimal)' : titleLength > 60 ? '(Too Long)' : '(Recommended: 50-60)'}
            </span>
          </div>
          <input
            type="text"
            className="form-input"
            placeholder={title ? `${title} | ${storeName}` : 'Catchy title for Google search results...'}
            value={seo.metaTitle}
            onChange={(e) => onChange('metaTitle', e.target.value)}
          />
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
            Leave blank to automatically use: <em>{title || 'Title'} | {storeName}</em>
          </div>
        </div>

        {/* SEO / Meta Description */}
        <div className="form-group">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <label className="form-label" style={{ fontWeight: 700, margin: 0 }}>SEO Meta Description</label>
            <span style={{ fontSize: '0.72rem', color: isDescGood ? '#10b981' : '#f59e0b', fontWeight: 600 }}>
              {descLength} / 160 characters {isDescGood ? '(Optimal)' : descLength > 160 ? '(Too Long)' : '(Recommended: 140-160)'}
            </span>
          </div>
          <textarea
            className="form-input"
            rows={3}
            placeholder="Enter an engaging, persuasive summary for search engine snippet..."
            value={seo.metaDescription}
            onChange={(e) => onChange('metaDescription', e.target.value)}
            style={{ resize: 'vertical' }}
          />
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
            Displayed beneath the title in search results. Include your focus keyword naturally.
          </div>
        </div>

        {/* Canonical URL & Meta Robots Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 700 }}>Canonical URL</label>
            <input
              type="text"
              className="form-input"
              placeholder={`https://${storeDomain}/${type === 'product' ? 'product' : 'catalog?category='}${effectiveSlug}`}
              value={seo.canonicalUrl}
              onChange={(e) => onChange('canonicalUrl', e.target.value)}
            />
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
              Prevents duplicate content penalties. Leave blank for default URL.
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" style={{ fontWeight: 700 }}>Robots Index Directives</label>
            <select
              className="form-select"
              value={seo.metaRobots || 'index, follow'}
              onChange={(e) => onChange('metaRobots', e.target.value)}
            >
              <option value="index, follow">index, follow (Standard - Show in search results)</option>
              <option value="noindex, follow">noindex, follow (Hide from search, follow links)</option>
              <option value="index, nofollow">index, nofollow (Index page, ignore links)</option>
              <option value="noindex, nofollow">noindex, nofollow (Completely ignore page)</option>
            </select>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
              Controls whether web crawlers are allowed to index this page.
            </div>
          </div>
        </div>

        {/* Social Sharing / OpenGraph Image */}
        <div className="form-group">
          <label className="form-label" style={{ fontWeight: 700 }}>OpenGraph / Social Sharing Image URL</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              type="text"
              className="form-input"
              placeholder="https://example.com/images/social-banner.jpg"
              value={seo.ogImageUrl}
              onChange={(e) => onChange('ogImageUrl', e.target.value)}
            />
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
            The preview image shown when this link is shared on Facebook, WhatsApp, LinkedIn, or Twitter/X. Recommended size: 1200x630px.
          </div>
        </div>
      </div>
    </div>
  );
};
