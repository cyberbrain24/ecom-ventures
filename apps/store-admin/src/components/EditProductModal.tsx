import React, { useState } from 'react';
import { X, Save, Package, Award, Sparkles, Image as ImageIcon, Plus, Trash2, CheckCircle2, AlertCircle, Globe, ChevronDown, ChevronUp } from 'lucide-react';
import { StoreProduct, ProductVariant, ProductBrand, CareInstruction } from '../types/store';
import { GoogleSerpPreview } from './GoogleSerpPreview';

interface EditProductModalProps {
  product: StoreProduct;
  brands?: ProductBrand[];
  careInstructions?: CareInstruction[];
  onClose: () => void;
  onSave: (updated: StoreProduct) => void;
}

export const EditProductModal: React.FC<EditProductModalProps> = ({
  product,
  brands = [],
  careInstructions = [],
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState(product.title);
  const [sku, setSku] = useState(product.sku);
  const [price, setPrice] = useState(product.price.toString());
  const [comparePrice, setComparePrice] = useState(product.compareAtPrice ? product.compareAtPrice.toString() : '');
  const [category, setCategory] = useState(product.category);
  const [inventoryCount, setInventoryCount] = useState(product.inventoryCount.toString());
  
  // Toggles requested by user
  const [isLiveActive, setIsLiveActive] = useState(product.status === 'ACTIVE');
  const [isFeatured, setIsFeatured] = useState(Boolean(product.isFeatured));
  const [isSoldOut, setIsSoldOut] = useState(Boolean(product.isSoldOut));

  // Brand & Care Instruction selections
  const [brandId, setBrandId] = useState(product.brandId || (brands[0]?.id || ''));
  const [careInstructionId, setCareInstructionId] = useState(product.careInstructionId || (careInstructions[0]?.id || ''));

  // Product Type: Single Product vs Variable Product
  const [productType, setProductType] = useState<'SINGLE' | 'VARIABLE'>(
    product.productType || (product.variants && product.variants.length > 0 ? 'VARIABLE' : 'SINGLE')
  );

  // Images state
  const [images, setImages] = useState<string[]>(
    product.images && product.images.length > 0
      ? product.images
      : product.imageUrl
      ? [product.imageUrl]
      : ['https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=600&auto=format&fit=crop&q=80']
  );
  const [newImageUrl, setNewImageUrl] = useState('');

  // Variants state
  const [variants, setVariants] = useState<ProductVariant[]>(
    product.variants && product.variants.length > 0
      ? product.variants
      : []
  );

  // 100% SEO Focused Fields
  const [showSeoSection, setShowSeoSection] = useState(true);
  const [metaTitle, setMetaTitle] = useState(product.metaTitle || product.title);
  const [metaDescription, setMetaDescription] = useState(product.metaDescription || product.description || '');
  const [focusKeyword, setFocusKeyword] = useState(product.focusKeyword || product.title.toLowerCase());
  const [canonicalUrl, setCanonicalUrl] = useState(product.canonicalUrl || `https://store.localhost/product/${product.slug}`);
  const [metaRobots, setMetaRobots] = useState(product.metaRobots || 'index, follow');
  const [ogImageUrl, setOgImageUrl] = useState(product.ogImageUrl || product.images?.[0] || product.imageUrl || '');

  const handleAddImage = () => {
    if (newImageUrl.trim()) {
      setImages([...images, newImageUrl.trim()]);
      setNewImageUrl('');
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleUpdateVariant = (index: number, field: keyof ProductVariant, val: any) => {
    setVariants((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleRemoveVariant = (index: number) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const handleAddCustomVariant = () => {
    const baseSkuClean = sku.trim().toUpperCase() || 'PROD';
    const varIdx = variants.length + 1;
    const newV: ProductVariant = {
      id: `v-custom-${Date.now()}-${varIdx}`,
      sku: `${baseSkuClean}-VAR-${varIdx}`,
      title: `Custom Variant ${varIdx}`,
      price: parseFloat(price) || 0,
      inventoryCount: 10,
      attributes: { Option: `Var-${varIdx}` },
      imageUrl: images[0] || '',
    };
    setVariants([...variants, newV]);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !sku.trim() || !price) return;

    const selectedBrand = brands.find((b) => b.id === brandId);
    const selectedCare = careInstructions.find((c) => c.id === careInstructionId);

    const basePrice = parseFloat(price) || 0;
    const totalInventory =
      productType === 'VARIABLE' && variants.length > 0
        ? variants.reduce((sum, v) => sum + (v.inventoryCount || 0), 0)
        : parseInt(inventoryCount, 10) || 0;

    const updated: StoreProduct = {
      ...product,
      title: title.trim(),
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      sku: sku.trim().toUpperCase(),
      price: basePrice,
      compareAtPrice: comparePrice ? parseFloat(comparePrice) : undefined,
      category: category.trim() || 'General',
      inventoryCount: totalInventory,
      status: isLiveActive ? 'ACTIVE' : 'DRAFT',
      isFeatured,
      isSoldOut,
      productType,
      brandId: selectedBrand?.id,
      brandName: selectedBrand?.name,
      brandLogoUrl: selectedBrand?.logoUrl,
      careInstructionId: selectedCare?.id,
      careInstructionTitle: selectedCare?.title,
      careInstructionText: selectedCare?.instructions,
      images,
      imageUrl: images[0] || product.imageUrl,
      variants: productType === 'VARIABLE' ? variants : [],
      metaTitle: metaTitle.trim(),
      metaDescription: metaDescription.trim(),
      focusKeyword: focusKeyword.trim(),
      canonicalUrl: canonicalUrl.trim(),
      metaRobots: metaRobots.trim(),
      ogImageUrl: ogImageUrl.trim(),
    };

    onSave(updated);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal-content" style={{ maxWidth: '680px', maxHeight: '90vh', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={16} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.96rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>Edit Product Specifications</h3>
              <span style={{ fontSize: '0.7rem', fontFamily: 'var(--font-mono)', color: 'var(--text-subtle)' }}>SKU: {product.sku}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Quick Status Control Toggles Bar */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', padding: '10px', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', marginBottom: '14px' }}>
            {/* Storefront Active Toggle */}
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: '#fff', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', cursor: 'pointer' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: isLiveActive ? 'var(--primary)' : 'var(--text-subtle)' }}>
                {isLiveActive ? '● Storefront Active' : '○ Inactive (Draft)'}
              </span>
              <input
                type="checkbox"
                checked={isLiveActive}
                onChange={(e) => setIsLiveActive(e.target.checked)}
                style={{ width: '15px', height: '15px', accentColor: 'var(--primary)' }}
              />
            </label>

            {/* Homepage Featured Toggle */}
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: '#fff', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', cursor: 'pointer' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: isFeatured ? '#f59e0b' : 'var(--text-subtle)' }}>
                {isFeatured ? '★ Featured Live' : '☆ Not Featured'}
              </span>
              <input
                type="checkbox"
                checked={isFeatured}
                onChange={(e) => setIsFeatured(e.target.checked)}
                style={{ width: '15px', height: '15px', accentColor: '#f59e0b' }}
              />
            </label>

            {/* Sold Out Toggle */}
            <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', background: '#fff', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', cursor: 'pointer' }}>
              <span style={{ fontSize: '0.74rem', fontWeight: 700, color: isSoldOut ? '#ef4444' : 'var(--text-subtle)' }}>
                {isSoldOut ? '⛔ Marked Sold Out' : '✓ Stock Available'}
              </span>
              <input
                type="checkbox"
                checked={isSoldOut}
                onChange={(e) => setIsSoldOut(e.target.checked)}
                style={{ width: '15px', height: '15px', accentColor: '#ef4444' }}
              />
            </label>
          </div>

          {/* Product Type Switch: Single vs Variable */}
          <div style={{ marginBottom: '14px' }}>
            <label className="form-label" style={{ marginBottom: '6px' }}>Product Structure Type *</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setProductType('SINGLE')}
                style={{
                  padding: '8px',
                  borderRadius: 'var(--radius-sm)',
                  border: productType === 'SINGLE' ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: productType === 'SINGLE' ? 'var(--primary-glow)' : '#fff',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  color: productType === 'SINGLE' ? 'var(--primary)' : 'var(--text-main)',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                📦 Single Product (Standard SKU)
              </button>
              <button
                type="button"
                onClick={() => setProductType('VARIABLE')}
                style={{
                  padding: '8px',
                  borderRadius: 'var(--radius-sm)',
                  border: productType === 'VARIABLE' ? '2px solid var(--primary)' : '1px solid var(--border)',
                  background: productType === 'VARIABLE' ? 'var(--primary-glow)' : '#fff',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  color: productType === 'VARIABLE' ? 'var(--primary)' : 'var(--text-main)',
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                ⚡ Variable Product (Size / Color Matrix)
              </button>
            </div>
          </div>

          {/* Basic Info */}
          <div className="form-group" style={{ marginBottom: '10px' }}>
            <label className="form-label">Product Title *</label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-grid" style={{ marginBottom: '10px' }}>
            <div className="form-group">
              <label className="form-label">Base SKU Identifier *</label>
              <input
                type="text"
                required
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                className="form-input"
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Category</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          {/* Brand & Care Instruction Selection Bar */}
          <div className="form-grid" style={{ marginBottom: '12px' }}>
            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Award size={13} color="var(--primary)" />
                <span>Brand & Manufacturer</span>
              </label>
              <select
                value={brandId}
                onChange={(e) => setBrandId(e.target.value)}
                className="form-select"
                style={{ fontSize: '0.8rem' }}
              >
                <option value="">-- No Brand Assigned --</option>
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.origin || 'Global'})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Sparkles size={13} color="var(--primary)" />
                <span>Care Instruction Guide</span>
              </label>
              <select
                value={careInstructionId}
                onChange={(e) => setCareInstructionId(e.target.value)}
                className="form-select"
                style={{ fontSize: '0.8rem' }}
              >
                <option value="">-- No Care Guide Assigned --</option>
                {careInstructions.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title} — [{c.materialCategory}]
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Pricing & Stock */}
          <div className="form-grid" style={{ marginBottom: '12px' }}>
            <div className="form-group">
              <label className="form-label">Selling Base Price (৳) *</label>
              <input
                type="number"
                required
                min="0"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Compare-At Price (৳)</label>
              <input
                type="number"
                min="0"
                step="0.01"
                value={comparePrice}
                onChange={(e) => setComparePrice(e.target.value)}
                className="form-input"
                placeholder="Optional strike-through"
              />
            </div>
            {productType === 'SINGLE' && (
              <div className="form-group">
                <label className="form-label">Stock Inventory *</label>
                <input
                  type="number"
                  min="0"
                  value={inventoryCount}
                  onChange={(e) => setInventoryCount(e.target.value)}
                  className="form-input"
                />
              </div>
            )}
          </div>

          {/* Images Upload / Gallery Section */}
          <div style={{ marginBottom: '14px', padding: '10px', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <ImageIcon size={14} color="var(--primary)" />
                <span>Product Media Assets ({images.length})</span>
              </span>
            </div>

            <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '8px', paddingBottom: '4px' }}>
              {images.map((imgUrl, idx) => (
                <div key={idx} style={{ position: 'relative', width: '56px', height: '56px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: idx === 0 ? '2px solid var(--primary)' : '1px solid var(--border)', background: '#fff', flexShrink: 0 }}>
                  <img src={imgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {idx === 0 && (
                    <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--primary)', color: '#fff', fontSize: '0.55rem', fontWeight: 800, textAlign: 'center', lineHeight: '12px' }}>
                      MAIN
                    </span>
                  )}
                  {images.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveImage(idx)}
                      style={{ position: 'absolute', top: '2px', right: '2px', width: '16px', height: '16px', borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <input
                type="url"
                placeholder="Enter image URL to add to gallery..."
                value={newImageUrl}
                onChange={(e) => setNewImageUrl(e.target.value)}
                className="form-input"
                style={{ fontSize: '0.76rem', flex: 1 }}
              />
              <button
                type="button"
                onClick={handleAddImage}
                className="btn btn-secondary"
                style={{ fontSize: '0.76rem', padding: '4px 10px' }}
              >
                Add Image
              </button>
            </div>
          </div>

          {/* Variable Product Variation Matrix */}
          {productType === 'VARIABLE' && (
            <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-main)' }}>
                    Variation SKU Matrix ({variants.length})
                  </h4>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-subtle)' }}>
                    Each variation maintains its own SKU, selling price, stock level, and assigned image.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleAddCustomVariant}
                  className="btn btn-secondary"
                  style={{ fontSize: '0.74rem', padding: '4px 8px', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  <Plus size={12} />
                  <span>Add Variation</span>
                </button>
              </div>

              {variants.length === 0 ? (
                <div style={{ padding: '14px', textAlign: 'center', background: '#fff', borderRadius: 'var(--radius-sm)', border: '1px dashed var(--border)', fontSize: '0.78rem', color: 'var(--text-subtle)' }}>
                  No variations defined yet. Click "Add Variation" or save to generate.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {variants.map((v, vIdx) => (
                    <div
                      key={v.id || vIdx}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '70px 1.2fr 1fr 90px 70px 30px',
                        gap: '8px',
                        alignItems: 'center',
                        padding: '8px 10px',
                        background: '#fff',
                        borderRadius: 'var(--radius-sm)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      {/* Image Picker for Variant */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <div style={{ width: '32px', height: '32px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border)', background: '#f8fafc', flexShrink: 0 }}>
                          <img
                            src={v.imageUrl || images[0] || 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=600&auto=format&fit=crop&q=80'}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        </div>
                        <select
                          value={v.imageUrl || images[0] || ''}
                          onChange={(e) => handleUpdateVariant(vIdx, 'imageUrl', e.target.value)}
                          className="form-select"
                          style={{ fontSize: '0.66rem', padding: '2px 4px', width: '32px' }}
                          title="Assign image"
                        >
                          {images.map((img, i) => (
                            <option key={i} value={img}>
                              Img {i + 1}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Variant Title */}
                      <input
                        type="text"
                        value={v.title}
                        onChange={(e) => handleUpdateVariant(vIdx, 'title', e.target.value)}
                        className="form-input"
                        style={{ fontSize: '0.74rem', padding: '4px 6px' }}
                        placeholder="Variant title"
                      />

                      {/* Auto SKU */}
                      <input
                        type="text"
                        value={v.sku}
                        onChange={(e) => handleUpdateVariant(vIdx, 'sku', e.target.value)}
                        className="form-input"
                        style={{ fontSize: '0.72rem', padding: '4px 6px', fontFamily: 'var(--font-mono)' }}
                        placeholder="Auto SKU"
                      />

                      {/* Price */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>৳</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={v.price}
                          onChange={(e) => handleUpdateVariant(vIdx, 'price', parseFloat(e.target.value) || 0)}
                          className="form-input"
                          style={{ fontSize: '0.74rem', padding: '4px 6px' }}
                        />
                      </div>

                      {/* Stock */}
                      <input
                        type="number"
                        min="0"
                        value={v.inventoryCount}
                        onChange={(e) => handleUpdateVariant(vIdx, 'inventoryCount', parseInt(e.target.value, 10) || 0)}
                        className="form-input"
                        style={{ fontSize: '0.74rem', padding: '4px 6px' }}
                        placeholder="Stock"
                      />

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => handleRemoveVariant(vIdx)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                        title="Remove Variant"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================
              PRODUCT SEO, SCHEMA & SERP PREVIEW SECTION
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
                  Search Engine Optimization (SEO) & Structured Data (Product Schema.org)
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
                  title={metaTitle || title}
                  description={metaDescription || product.description || ''}
                  url={canonicalUrl || `https://store.localhost/product/${product.slug}`}
                  focusKeyword={focusKeyword}
                  ogImageUrl={ogImageUrl || images[0]}
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
                    placeholder="e.g. Silk Evening Gown Emerald Edition | Store Name"
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
                    placeholder="Snippet displayed on Google Search and social links (120-160 characters recommended)"
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
                      placeholder="e.g. silk evening gown"
                      value={focusKeyword}
                      onChange={(e) => setFocusKeyword(e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Robots Indexing Directive</label>
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

                <div className="form-grid" style={{ marginBottom: '6px' }}>
                  <div className="form-group">
                    <label className="form-label">Canonical URL (Prevent Duplicate Content)</label>
                    <input
                      type="url"
                      placeholder="https://.../product/slug"
                      value={canonicalUrl}
                      onChange={(e) => setCanonicalUrl(e.target.value)}
                      className="form-input"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Social Share Image (OG Image)</label>
                    <input
                      type="url"
                      placeholder="https://.../og-image.jpg"
                      value={ogImageUrl}
                      onChange={(e) => setOgImageUrl(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Save size={14} />
              <span>Update Product & Matrix</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
