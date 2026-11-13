import React, { useState } from 'react';
import { X, Save, Layers, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { StoreCategory } from '../types/store';
import { GoogleSerpPreview } from './GoogleSerpPreview';

interface EditCategoryModalProps {
  category: StoreCategory;
  onClose: () => void;
  onSave: (updated: StoreCategory) => void;
}

export const EditCategoryModal: React.FC<EditCategoryModalProps> = ({ category, onClose, onSave }) => {
  const [name, setName] = useState(category.name);
  const [slug, setSlug] = useState(category.slug);
  const [description, setDescription] = useState(category.description || '');
  const [displayOrder, setDisplayOrder] = useState(category.displayOrder.toString());
  const [isActive, setIsActive] = useState(category.isActive);

  // SEO Fields
  const [showSeoSection, setShowSeoSection] = useState(true);
  const [metaTitle, setMetaTitle] = useState(category.metaTitle || `${category.name} Collection`);
  const [metaDescription, setMetaDescription] = useState(category.metaDescription || category.description || '');
  const [focusKeyword, setFocusKeyword] = useState(category.focusKeyword || category.name.toLowerCase());
  const [canonicalUrl, setCanonicalUrl] = useState(category.canonicalUrl || `https://store.localhost/catalog?category=${category.slug}`);
  const [metaRobots, setMetaRobots] = useState(category.metaRobots || 'index, follow');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const cleanSlug = slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const updated: StoreCategory = {
      ...category,
      name: name.trim(),
      slug: cleanSlug,
      description: description.trim(),
      displayOrder: parseInt(displayOrder, 10) || 1,
      isActive,
      metaTitle: metaTitle.trim(),
      metaDescription: metaDescription.trim(),
      focusKeyword: focusKeyword.trim(),
      canonicalUrl: canonicalUrl.trim(),
      metaRobots: metaRobots.trim(),
    };
    onSave(updated);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal-content" style={{ maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Layers size={15} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>Edit Category Specifications</h3>
              <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-subtle)' }}>/{category.slug}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '10px' }}>
            <label className="form-label">Category Name *</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!metaTitle || metaTitle === `${category.name} Collection`) {
                  setMetaTitle(`${e.target.value} Collection`);
                }
              }}
              className="form-input"
            />
          </div>

          <div className="form-grid" style={{ marginBottom: '10px' }}>
            <div className="form-group">
              <label className="form-label">URL Slug *</label>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="form-input"
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Display Order</label>
              <input
                type="number"
                min="1"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (!metaDescription) {
                  setMetaDescription(e.target.value);
                }
              }}
              className="form-input"
              placeholder="Taxonomy summary..."
            />
          </div>

          <div className="form-group" style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="cat-is-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <label htmlFor="cat-is-active" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>
              Active in Storefront Navigation Menu
            </label>
          </div>

          {/* ========================================================
              CATEGORY SEO & SERP PREVIEW SECTION
             ======================================================== */}
          <div
            style={{
              borderRadius: '8px',
              border: '1px solid var(--border)',
              backgroundColor: 'var(--bg-subtle, #f8fafc)',
              marginBottom: '16px',
              overflow: 'hidden',
            }}
          >
            <button
              type="button"
              onClick={() => setShowSeoSection(!showSeoSection)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Globe size={16} style={{ color: 'var(--primary)' }} />
                <span style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-main)' }}>
                  Search Engine Optimization (SEO) & Taxonomy Schema
                </span>
                <span style={{ fontSize: '0.66rem', fontWeight: 700, backgroundColor: 'var(--primary)', color: '#ffffff', borderRadius: '4px', padding: '1px 5px' }}>
                  100% SEO
                </span>
              </div>
              {showSeoSection ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showSeoSection && (
              <div style={{ padding: '0 14px 14px 14px' }}>
                <GoogleSerpPreview
                  title={metaTitle || name}
                  description={metaDescription || description}
                  url={canonicalUrl || `https://store.localhost/catalog?category=${slug}`}
                  focusKeyword={focusKeyword}
                />

                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label">SEO Meta Title</label>
                    <span style={{ fontSize: '0.7rem', color: metaTitle.length > 60 ? '#ef4444' : '#10b981' }}>
                      {metaTitle.length} / 60 characters
                    </span>
                  </div>
                  <input
                    type="text"
                    placeholder="e.g. Silk Evening Dresses & Gowns | Store Name"
                    value={metaTitle}
                    onChange={(e) => setMetaTitle(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label className="form-label">SEO Meta Description</label>
                    <span style={{ fontSize: '0.7rem', color: metaDescription.length > 160 ? '#ef4444' : '#10b981' }}>
                      {metaDescription.length} / 160 characters
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    placeholder="Summary snippet displayed on Google search results (120-160 characters recommended)"
                    value={metaDescription}
                    onChange={(e) => setMetaDescription(e.target.value)}
                    className="form-textarea"
                  />
                </div>

                <div className="form-grid" style={{ marginBottom: '10px' }}>
                  <div className="form-group">
                    <label className="form-label">Focus Keyword</label>
                    <input
                      type="text"
                      placeholder="e.g. evening dresses"
                      value={focusKeyword}
                      onChange={(e) => setFocusKeyword(e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Robots Indexing</label>
                    <select
                      value={metaRobots}
                      onChange={(e) => setMetaRobots(e.target.value)}
                      className="form-select"
                    >
                      <option value="index, follow">Index, Follow (Recommended)</option>
                      <option value="noindex, follow">Noindex, Follow</option>
                      <option value="noindex, nofollow">Noindex, Nofollow</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Canonical URL</label>
                  <input
                    type="url"
                    placeholder="https://.../catalog?category=slug"
                    value={canonicalUrl}
                    onChange={(e) => setCanonicalUrl(e.target.value)}
                    className="form-input"
                    style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}
                  />
                </div>
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm">
              <Save size={13} />
              <span>Save Category Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
