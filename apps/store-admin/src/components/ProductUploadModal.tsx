import React, { useState } from 'react';
import { Upload, X, HelpCircle, Film, Sparkles, Check, Info, Search } from 'lucide-react';
import { CatalogProduct, ProductInput } from '../lib/catalog-api';
import { AdvancedSeoEditor, SeoState } from './AdvancedSeoEditor';

export interface CategoryOption {
  id: string;
  name: string;
}

export interface BrandOption {
  id: string;
  name: string;
}

export interface CareInstructionOption {
  id: string;
  title: string;
}

export interface SizeGuideOption {
  id: string;
  name: string;
}

interface ProductUploadModalProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  product: CatalogProduct | null;
  categories: CategoryOption[];
  brands: BrandOption[];
  careInstructions: CareInstructionOption[];
  sizeGuides?: SizeGuideOption[];
  currency: string;
  onClose: () => void;
  onSubmit: (input: ProductInput) => Promise<void>;
}

type TabKey = 'basic' | 'media' | 'categorization' | 'pricing' | 'templates' | 'seo';

export const ProductUploadModal: React.FC<ProductUploadModalProps> = ({
  isOpen,
  mode,
  product,
  categories,
  brands,
  careInstructions,
  sizeGuides = [],
  currency,
  onClose,
  onSubmit,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('basic');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields - Tab 1: Basic Info
  const [title, setTitle] = useState(product?.title || '');
  const [sku, setSku] = useState(product?.sku || '');
  const [optionLayout, setOptionLayout] = useState<'simple' | 'variants'>(product?.optionLayout || 'simple');
  const [isStorefrontActive, setIsStorefrontActive] = useState(product ? product.status === 'ACTIVE' : true);
  const [isFeatured, setIsFeatured] = useState(product?.isFeatured || false);
  const [isSoldOut, setIsSoldOut] = useState(false);
  const [listingOrder, setListingOrder] = useState<number>(product?.sortOrder || 0);
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');

  // Form Fields - Tab 2: Media Gallery
  const [featuredImageUrl, setFeaturedImageUrl] = useState(product?.imageUrl || '');
  const [galleryFilenames, setGalleryFilenames] = useState('');
  const [videoUrl, setVideoUrl] = useState(product?.videoUrl || '');
  const [videoAutoplay, setVideoAutoplay] = useState(product?.videoAutoplay || false);
  const [videoMuted, setVideoMuted] = useState(product?.videoMuted ?? true);

  // Form Fields - Tab 3: Categorization & Tags
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>(product?.categoryId || '');
  const [selectedBrandId, setSelectedBrandId] = useState<string>(product?.brandId || '');
  const [searchTags, setSearchTags] = useState<string>('');

  // Form Fields - Tab 6: Advanced SEO System
  const [seo, setSeo] = useState<SeoState>({
    metaTitle: product?.metaTitle || '',
    metaDescription: product?.metaDescription || '',
    focusKeyword: product?.focusKeyword || '',
    canonicalUrl: product?.canonicalUrl || '',
    metaRobots: product?.metaRobots || 'index, follow',
    ogImageUrl: product?.ogImageUrl || '',
  });

  // Form Fields - Tab 4: Pricing & Variants
  const [basePrice, setBasePrice] = useState<string>(product ? String(product.basePrice) : '');
  const [costPrice, setCostPrice] = useState<string>(product?.costPrice ? String(product.costPrice) : '');
  const [compareAtPrice, setCompareAtPrice] = useState<string>(product?.compareAtPrice ? String(product.compareAtPrice) : '');
  const [stockQuantity, setStockQuantity] = useState<string>('50');
  const [lowStockAlert, setLowStockAlert] = useState<string>('5');
  const [selectedSizes, setSelectedSizes] = useState<string[]>(['S', 'M', 'L', 'XL']);
  const [selectedColors, setSelectedColors] = useState<string[]>(['Black', 'Washed Grey']);
  const [selectedGsm, setSelectedGsm] = useState<string>('240 GSM');

  // Form Fields - Tab 5: Content Templates
  const [sizeGuideTemplate, setSizeGuideTemplate] = useState(product?.sizeGuideTemplate || '');
  const [selectedCareId, setSelectedCareId] = useState<string>(product?.careInstructionId || '');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Product Name is required.');
      setActiveTab('basic');
      return;
    }
    const priceNum = parseFloat(basePrice);
    if (isNaN(priceNum) || priceNum < 0) {
      setError('A valid Base Retail Price is required.');
      setActiveTab('pricing');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const payload: ProductInput = {
        title: title.trim(),
        sku: sku.trim() || undefined,
        basePrice: priceNum,
        costPrice: costPrice.trim() ? parseFloat(costPrice) : undefined,
        compareAtPrice: compareAtPrice.trim() ? parseFloat(compareAtPrice) : undefined,
        categoryId: selectedCategoryId || null,
        brandId: selectedBrandId || null,
        careInstructionId: selectedCareId || null,
        status: isStorefrontActive ? 'ACTIVE' : 'DRAFT',
        isFeatured: isFeatured,
        summary: summary.trim(),
        description: description.trim(),
        featuredImageUrl: featuredImageUrl.trim(),
        galleryFilenames: galleryFilenames.trim(),
        videoUrl: videoUrl.trim(),
        videoAutoplay: videoAutoplay,
        videoMuted: videoMuted,
        optionLayout: optionLayout,
        sizeGuideTemplate: sizeGuideTemplate.trim(),
        sortOrder: listingOrder,
        metaTitle: seo.metaTitle.trim(),
        metaDescription: seo.metaDescription.trim(),
        focusKeyword: seo.focusKeyword.trim(),
        canonicalUrl: seo.canonicalUrl.trim(),
        metaRobots: seo.metaRobots.trim(),
        ogImageUrl: seo.ogImageUrl.trim(),
      };

      await onSubmit(payload);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save product drop entry.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 999 }}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '860px',
          width: '95%',
          backgroundColor: '#ffffff',
          color: 'var(--text-main)',
          borderRadius: 'var(--radius-lg)',
          boxShadow: '0 20px 40px -10px rgba(15, 23, 42, 0.25)',
          border: '1px solid var(--border)',
          padding: 0,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Top Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: '1px solid var(--border)',
            backgroundColor: '#ffffff',
          }}
        >
          <div>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
              {mode === 'create' ? 'Create New Street Drop Entry' : `Edit Drop: ${product?.title}`}
            </h2>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Configure product specifications, media assets, pricing and presentation templates
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: '#f8fafc',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'var(--text-muted)',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab Navigation Pill Bar */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '10px 24px',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid var(--border)',
            overflowX: 'auto',
          }}
        >
          {(
            [
              { key: 'basic', label: 'Basic Info' },
              { key: 'media', label: 'Media Gallery' },
              { key: 'categorization', label: 'Categorization & Tags' },
              { key: 'pricing', label: 'Pricing & Variants' },
              { key: 'templates', label: 'Content Templates' },
              { key: 'seo', label: '⚡ Advanced SEO System' },
            ] as const
          ).map((tab) => {
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`btn btn-sm ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                style={{
                  padding: '6px 14px',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                  borderRadius: 'var(--radius-sm)',
                  whiteSpace: 'nowrap',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="notice notice-error" style={{ margin: '14px 24px 0 24px' }}>
            {error}
          </div>
        )}

        {/* Form Body with Smooth Padding */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div style={{ padding: '22px 24px', overflowY: 'auto', maxHeight: '62vh' }}>
            {/* TAB 1: BASIC INFO */}
            {activeTab === 'basic' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>
                      <span style={{ color: '#ef4444' }}>* </span>Product Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Acid-Wash Oversized Heavy Tee"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>
                      SKU Identifier (Auto-generated if empty)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. PP-TEE-ACID-BLK"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      className="form-input mono"
                    />
                  </div>
                </div>

                {/* Control Toggles Strip */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.3fr 1fr 1fr 1.2fr 0.8fr',
                    gap: '12px',
                    alignItems: 'center',
                    padding: '14px 16px',
                    backgroundColor: '#f8fafc',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.74rem', fontWeight: 700 }}>
                      <span style={{ color: '#ef4444' }}>* </span>Product Option Layout
                    </label>
                    <select
                      value={optionLayout}
                      onChange={(e) => setOptionLayout(e.target.value as any)}
                      className="form-select"
                      style={{ fontSize: '0.8rem', padding: '6px 8px' }}
                    >
                      <option value="simple">Simple (Single Base Pricing)</option>
                      <option value="variants">Multi-Variant Matrix</option>
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                      Storefront Active
                    </span>
                    <EcomSwitch checked={isStorefrontActive} onChange={setIsStorefrontActive} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                      Homepage Featured
                    </span>
                    <EcomSwitch checked={isFeatured} onChange={setIsFeatured} />
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                      Sold Out Status
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <EcomSwitch checked={isSoldOut} onChange={setIsSoldOut} />
                      <span
                        className={`badge ${isSoldOut ? 'badge-danger' : 'badge-active'}`}
                        style={{ fontSize: '0.68rem', padding: '2px 6px' }}
                      >
                        {isSoldOut ? 'SOLD OUT' : 'AVAILABLE'}
                      </span>
                    </div>
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label" style={{ fontSize: '0.74rem', fontWeight: 700 }}>
                      Listing Order
                    </label>
                    <input
                      type="number"
                      value={listingOrder}
                      onChange={(e) => setListingOrder(parseInt(e.target.value) || 0)}
                      className="form-input"
                      style={{ textAlign: 'center', padding: '6px', fontSize: '0.82rem' }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Short Description (Above the fold teaser text)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Enter primary streetwear specs highlights..."
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    className="form-input"
                    style={{ resize: 'vertical' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Full Rich Description
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Enter rich specifications details..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="form-input"
                    style={{ resize: 'vertical' }}
                  />
                </div>
              </div>
            )}

            {/* TAB 2: MEDIA GALLERY */}
            {activeTab === 'media' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Featured Primary Image URL
                  </label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <div
                      style={{
                        width: '64px',
                        height: '64px',
                        borderRadius: 'var(--radius-md)',
                        border: '1px dashed #94a3b8',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '2px',
                        color: 'var(--text-muted)',
                        backgroundColor: '#f8fafc',
                        flexShrink: 0,
                      }}
                    >
                      <Upload size={16} />
                      <span style={{ fontSize: '0.68rem', fontWeight: 700 }}>Upload</span>
                    </div>
                    <input
                      type="text"
                      placeholder="e.g. https://cdn.yourdomain.com/products/acid-wash-hoodie.webp"
                      value={featuredImageUrl}
                      onChange={(e) => setFeaturedImageUrl(e.target.value)}
                      className="form-input"
                      style={{ flex: 1 }}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Associated Media Library Image Filenames
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. 1781024294094.webp, 17810242940s94.webp"
                    value={galleryFilenames}
                    onChange={(e) => setGalleryFilenames(e.target.value)}
                    className="form-input"
                    style={{ resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                  />
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Type or paste filenames of images already uploaded in the central Media Library (separated by commas). This will automatically link them to the product gallery.
                  </span>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.88rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '12px' }}>
                    <Film size={16} style={{ color: 'var(--primary)' }} />
                    <span>Video Media</span>
                  </div>

                  <div className="form-group" style={{ marginBottom: '12px' }}>
                    <label className="form-label" style={{ fontWeight: 700 }}>
                      YouTube Video Embed Link
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. https://www.youtube.com/watch?v=XXXXXX"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '32px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                        Autoplay Video
                      </span>
                      <EcomSwitch checked={videoAutoplay} onChange={setVideoAutoplay} />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                        Mute Video on Load
                      </span>
                      <EcomSwitch checked={videoMuted} onChange={setVideoMuted} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: CATEGORIZATION & TAGS */}
            {activeTab === 'categorization' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    <span style={{ color: '#ef4444' }}>* </span>Linked Drop Categories (Multi-select)
                  </label>
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => setSelectedCategoryId(e.target.value)}
                    className="form-select"
                  >
                    <option value="">Select collections mapping...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Linked Brand
                  </label>
                  <select
                    value={selectedBrandId}
                    onChange={(e) => setSelectedBrandId(e.target.value)}
                    className="form-select"
                  >
                    <option value="">Select brand label...</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Dynamic Search Tags (Comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. streetwear, oversized, drop-2026, acid-wash, heavy-cotton"
                    value={searchTags}
                    onChange={(e) => setSearchTags(e.target.value)}
                    className="form-input"
                  />
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Powers visual semantic search and AI merchandising tag discovery.
                  </span>
                </div>

                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                      Quick SEO & Meta Tags
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('seo')}
                      className="btn btn-sm btn-secondary"
                      style={{ fontSize: '0.73rem', padding: '3px 8px', gap: '4px' }}
                    >
                      <Search size={12} />
                      <span>Open Full Advanced SEO System →</span>
                    </button>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>SEO Meta Title</label>
                      <input
                        type="text"
                        placeholder="e.g. Acid-Wash Oversized Heavy Tee | Poshplex"
                        value={seo.metaTitle}
                        onChange={(e) => setSeo((prev) => ({ ...prev, metaTitle: e.target.value }))}
                        className="form-input"
                        style={{ fontSize: '0.82rem' }}
                      />
                    </div>
                    <div>
                      <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>OpenGraph / Meta Description</label>
                      <input
                        type="text"
                        placeholder="e.g. Limited drop engineered with 240 GSM heavy cotton."
                        value={seo.metaDescription}
                        onChange={(e) => setSeo((prev) => ({ ...prev, metaDescription: e.target.value }))}
                        className="form-input"
                        style={{ fontSize: '0.82rem' }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 4: PRICING & VARIANTS */}
            {activeTab === 'pricing' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>
                      <span style={{ color: '#ef4444' }}>* </span>Base Retail Price ({currency})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="e.g. 199.00"
                      value={basePrice}
                      onChange={(e) => setBasePrice(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 700 }}>
                      <span>Purchase / Costing Price ({currency})</span>
                      <HelpCircle size={13} style={{ color: 'var(--text-subtle)' }} />
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 120.00 (Optional)"
                      value={costPrice}
                      onChange={(e) => setCostPrice(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>
                      Compare At Original Price ({currency})
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="e.g. 249.00"
                      value={compareAtPrice}
                      onChange={(e) => setCompareAtPrice(e.target.value)}
                      className="form-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>
                      Warehouse Stock Quantity
                    </label>
                    <input
                      type="number"
                      min="0"
                      placeholder="e.g. 50"
                      value={stockQuantity}
                      onChange={(e) => setStockQuantity(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Low-Stock Alert Threshold
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="e.g. 5"
                    value={lowStockAlert}
                    onChange={(e) => setLowStockAlert(e.target.value)}
                    className="form-input"
                    style={{ maxWidth: '240px' }}
                  />
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Triggers warning badge when remaining inventory dips below this quota.
                  </span>
                </div>

                {optionLayout === 'variants' && (
                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '12px', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        Variant Combinations Matrix (Permutations Generator)
                      </span>
                      <span className="badge badge-active" style={{ fontSize: '0.7rem' }}>
                        {selectedSizes.length * selectedColors.length} SKUs Planned
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', fontSize: '0.78rem' }}>
                      <div style={{ background: '#fff', border: '1px solid var(--border)', padding: '6px 10px', borderRadius: 'var(--radius-sm)' }}>
                        <strong>Sizes:</strong> {selectedSizes.join(', ')}
                      </div>
                      <div style={{ background: '#fff', border: '1px solid var(--border)', padding: '6px 10px', borderRadius: 'var(--radius-sm)' }}>
                        <strong>Colors:</strong> {selectedColors.join(', ')}
                      </div>
                      <div style={{ background: '#fff', border: '1px solid var(--border)', padding: '6px 10px', borderRadius: 'var(--radius-sm)' }}>
                        <strong>Fabric Weight:</strong> {selectedGsm}
                      </div>
                    </div>
                  </div>
                )}

                <div className="notice notice-info" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                  <Info size={15} style={{ flexShrink: 0 }} />
                  <span>
                    Costing metrics are directly linked to the Ledger & Financial Reconciliation engine for live P&L reporting.
                  </span>
                </div>
              </div>
            )}

            {/* TAB 5: CONTENT TEMPLATES */}
            {activeTab === 'templates' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Size Guide Template Block
                  </label>
                  <select
                    value={sizeGuideTemplate}
                    onChange={(e) => setSizeGuideTemplate(e.target.value)}
                    className="form-select"
                  >
                    <option value="">Attach reusable size chart guide template</option>
                    {sizeGuides.map((sg) => (
                      <option key={sg.id} value={sg.id}>
                        {sg.name}
                      </option>
                    ))}
                    <optgroup label="Standard Templates">
                      <option value="apparel-standard-unisex">Apparel Standard Unisex Chart (S, M, L, XL, XXL)</option>
                      <option value="oversized-streetwear-tee">Oversized Streetwear Tee Spec Sheet</option>
                      <option value="pants-denim-measurements">Pants & Denim Waist/Inseam Chart</option>
                      <option value="jewelry-ring-sizer">Jewelry Ring Circumference Sizer</option>
                    </optgroup>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Wash & Care Template Block
                  </label>
                  <select
                    value={selectedCareId}
                    onChange={(e) => setSelectedCareId(e.target.value)}
                    className="form-select"
                  >
                    <option value="">Attach reusable wash instructions template</option>
                    {careInstructions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="notice notice-warning" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
                  <Sparkles size={15} style={{ flexShrink: 0 }} />
                  <span>
                    Editing these attached templates from settings will automatically refresh layouts across all catalog items.
                  </span>
                </div>
              </div>
            )}

            {/* TAB 6: ADVANCED SEO SYSTEM */}
            {activeTab === 'seo' && (
              <AdvancedSeoEditor
                title={title}
                defaultSlug={product?.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}
                type="product"
                price={parseFloat(basePrice) || 0}
                currency={currency}
                defaultImageUrl={featuredImageUrl}
                seo={seo}
                onChange={(field, value) => setSeo((prev) => ({ ...prev, [field]: value }))}
              />
            )}
          </div>

          {/* Modal Footer Strip */}
          <div
            style={{
              padding: '14px 24px',
              borderTop: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              backgroundColor: '#f8fafc',
            }}
          >
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary btn-sm"
              style={{ padding: '7px 18px', fontWeight: 600 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn btn-primary btn-sm"
              style={{ padding: '7px 22px', fontWeight: 700 }}
            >
              {isSubmitting ? 'Saving...' : 'OK'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/** Clean Ecom Store Admin switch styled to match the theme design tokens */
const EcomSwitch: React.FC<{ checked: boolean; onChange: (v: boolean) => void }> = ({ checked, onChange }) => (
  <div
    onClick={() => onChange(!checked)}
    style={{
      width: '40px',
      height: '22px',
      backgroundColor: checked ? 'var(--primary)' : '#cbd5e1',
      borderRadius: '20px',
      padding: '2px',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      transition: 'background-color 0.15s ease',
    }}
  >
    <div
      style={{
        width: '18px',
        height: '18px',
        backgroundColor: '#ffffff',
        borderRadius: '50%',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transform: checked ? 'translateX(18px)' : 'translateX(0)',
        transition: 'transform 0.15s ease',
      }}
    />
  </div>
);
