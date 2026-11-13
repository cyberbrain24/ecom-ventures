import React, { useState } from 'react';
import { Globe, Smartphone, Monitor, Share2, Check, AlertTriangle } from 'lucide-react';

interface GoogleSerpPreviewProps {
  title: string;
  description: string;
  url: string;
  faviconUrl?: string;
  focusKeyword?: string;
  ogImageUrl?: string;
  titleTemplate?: string;
  brandName?: string;
}

export const GoogleSerpPreview: React.FC<GoogleSerpPreviewProps> = ({
  title,
  description,
  url,
  faviconUrl,
  focusKeyword,
  ogImageUrl,
  titleTemplate,
  brandName,
}) => {
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [previewTab, setPreviewTab] = useState<'serp' | 'social'>('serp');

  // Format final display title
  let displayTitle = title.trim();
  if (!displayTitle && brandName) {
    displayTitle = brandName;
  }
  if (titleTemplate && displayTitle && !displayTitle.includes('|') && !displayTitle.includes('-')) {
    displayTitle = titleTemplate.replace('%s', displayTitle);
  }

  const cleanDescription = description.trim() || 'Please provide a meta description. Search engines typically display between 120 to 160 characters in search results.';

  // URL breadcrumbs for Google SERP
  let formattedUrl = url;
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    formattedUrl = `${parsed.hostname}${pathParts.length > 0 ? ' > ' + pathParts.join(' > ') : ''}`;
  } catch {
    formattedUrl = url;
  }

  // Length statuses
  const titleLen = displayTitle.length;
  const descLen = cleanDescription.length;

  const getTitleStatus = () => {
    if (titleLen === 0) return { label: 'Empty', color: '#ef4444' };
    if (titleLen < 30) return { label: 'Short', color: '#f59e0b' };
    if (titleLen <= 65) return { label: 'Optimal', color: '#10b981' };
    return { label: 'Too Long', color: '#ef4444' };
  };

  const getDescStatus = () => {
    if (descLen === 0) return { label: 'Empty', color: '#ef4444' };
    if (descLen < 100) return { label: 'Short', color: '#f59e0b' };
    if (descLen <= 160) return { label: 'Optimal', color: '#10b981' };
    return { label: 'Too Long', color: '#ef4444' };
  };

  const titleStatus = getTitleStatus();
  const descStatus = getDescStatus();

  // Highlight focus keyword in description if present
  const renderDescription = () => {
    if (!focusKeyword || !cleanDescription.toLowerCase().includes(focusKeyword.toLowerCase().trim())) {
      return cleanDescription;
    }
    const escapedKeyword = focusKeyword.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escapedKeyword})`, 'gi');
    const parts = cleanDescription.split(regex);
    return parts.map((part, i) =>
      part.toLowerCase() === focusKeyword.toLowerCase().trim() ? (
        <strong key={i} style={{ color: 'var(--text-main)', fontWeight: 700 }}>
          {part}
        </strong>
      ) : (
        part
      )
    );
  };

  return (
    <div
      style={{
        borderRadius: 'var(--radius-md, 8px)',
        border: '1px solid var(--border)',
        backgroundColor: 'var(--bg-surface, #ffffff)',
        padding: '14px',
        marginBottom: '16px',
      }}
    >
      {/* Header bar with toggles */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '12px',
          borderBottom: '1px solid var(--border)',
          paddingBottom: '8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Live SERP & Social Preview
          </span>
          <div style={{ display: 'flex', background: 'var(--bg-subtle, #f1f5f9)', borderRadius: '6px', padding: '2px' }}>
            <button
              type="button"
              onClick={() => setPreviewTab('serp')}
              style={{
                background: previewTab === 'serp' ? 'var(--bg-surface, #ffffff)' : 'transparent',
                color: previewTab === 'serp' ? 'var(--primary, #0284c7)' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '4px',
                padding: '3px 8px',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: previewTab === 'serp' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              Google Search
            </button>
            <button
              type="button"
              onClick={() => setPreviewTab('social')}
              style={{
                background: previewTab === 'social' ? 'var(--bg-surface, #ffffff)' : 'transparent',
                color: previewTab === 'social' ? 'var(--primary, #0284c7)' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '4px',
                padding: '3px 8px',
                fontSize: '0.72rem',
                fontWeight: 600,
                cursor: 'pointer',
                boxShadow: previewTab === 'social' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              Social (OG / Card)
            </button>
          </div>
        </div>

        {previewTab === 'serp' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              type="button"
              onClick={() => setDevice('desktop')}
              style={{
                background: device === 'desktop' ? 'var(--primary-glow, rgba(2,132,199,0.1))' : 'transparent',
                color: device === 'desktop' ? 'var(--primary, #0284c7)' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '4px',
                padding: '4px',
                cursor: 'pointer',
              }}
              title="Desktop SERP"
            >
              <Monitor size={14} />
            </button>
            <button
              type="button"
              onClick={() => setDevice('mobile')}
              style={{
                background: device === 'mobile' ? 'var(--primary-glow, rgba(2,132,199,0.1))' : 'transparent',
                color: device === 'mobile' ? 'var(--primary, #0284c7)' : 'var(--text-muted)',
                border: 'none',
                borderRadius: '4px',
                padding: '4px',
                cursor: 'pointer',
              }}
              title="Mobile SERP"
            >
              <Smartphone size={14} />
            </button>
          </div>
        )}
      </div>

      {/* Preview Content */}
      {previewTab === 'serp' ? (
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: device === 'mobile' ? '12px' : '6px',
            border: '1px solid #e2e8f0',
            padding: device === 'mobile' ? '12px 14px' : '14px 18px',
            maxWidth: device === 'mobile' ? '380px' : '650px',
            fontFamily: 'arial, sans-serif',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          {/* Top URL + Favicon row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            {faviconUrl ? (
              <img
                src={faviconUrl}
                alt="Favicon"
                style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover' }}
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: '#f1f5f9',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#64748b',
                }}
              >
                <Globe size={11} />
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.2 }}>
              <span style={{ fontSize: '12px', color: '#202124', fontWeight: 400 }}>
                {brandName || 'Store'}
              </span>
              <span style={{ fontSize: '11px', color: '#4d5156', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>
                {formattedUrl}
              </span>
            </div>
          </div>

          {/* Snippet Title */}
          <div
            style={{
              fontSize: device === 'mobile' ? '16px' : '18px',
              lineHeight: 1.3,
              color: '#1a0dab',
              cursor: 'pointer',
              fontWeight: 400,
              textDecoration: 'none',
              marginBottom: '4px',
              wordBreak: 'break-word',
            }}
          >
            {displayTitle || 'Page Title Goes Here'}
          </div>

          {/* Snippet Description */}
          <div
            style={{
              fontSize: '13px',
              lineHeight: 1.5,
              color: '#4d5156',
              wordBreak: 'break-word',
            }}
          >
            {renderDescription()}
          </div>
        </div>
      ) : (
        /* Social Open Graph Card */
        <div
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '8px',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
            maxWidth: '520px',
            boxShadow: '0 2px 4px rgba(0,0,0,0.05)',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          {ogImageUrl ? (
            <div style={{ width: '100%', height: '220px', backgroundColor: '#f8fafc', overflow: 'hidden' }}>
              <img
                src={ogImageUrl}
                alt={displayTitle}
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            </div>
          ) : (
            <div
              style={{
                width: '100%',
                height: '160px',
                backgroundColor: '#f1f5f9',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                gap: '6px',
              }}
            >
              <Share2 size={28} />
              <span style={{ fontSize: '0.78rem' }}>No OG Image provided. Default fallback image will be used.</span>
            </div>
          )}
          <div style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600, letterSpacing: '0.04em', marginBottom: '4px' }}>
              {brandName || 'STORE'}
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', lineHeight: 1.3, marginBottom: '6px' }}>
              {displayTitle}
            </div>
            <div style={{ fontSize: '13px', color: '#64748b', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {cleanDescription}
            </div>
          </div>
        </div>
      )}

      {/* Character count & recommendation meters */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '12px',
          marginTop: '12px',
          fontSize: '0.72rem',
          color: 'var(--text-muted)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span>Title Length:</span>
          <strong style={{ color: titleStatus.color }}>
            {titleLen} / 60 chars ({titleStatus.label})
          </strong>
        </div>
        <div style={{ width: '1px', height: '12px', backgroundColor: 'var(--border)' }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span>Description Length:</span>
          <strong style={{ color: descStatus.color }}>
            {descLen} / 160 chars ({descStatus.label})
          </strong>
        </div>
        {focusKeyword && (
          <>
            <div style={{ width: '1px', height: '12px', backgroundColor: 'var(--border)' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span>Focus Keyword:</span>
              <span
                style={{
                  background: 'var(--primary-glow, rgba(2,132,199,0.1))',
                  color: 'var(--primary, #0284c7)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontWeight: 600,
                }}
              >
                {focusKeyword}
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

