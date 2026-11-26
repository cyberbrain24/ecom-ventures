import React, { useEffect, useMemo, useState } from 'react';
import { Upload, X, HelpCircle, Film, Sparkles, Check, Info, Search, GripVertical } from 'lucide-react';
import {
  CatalogAttribute,
  CatalogProduct,
  ProductInput,
  createProductVariant,
  deleteProductVariant,
  fetchProductVariants,
  updateProductVariant,
} from '../lib/catalog-api';
import { deleteStoreMedia, uploadStoreMedia } from '../lib/api';
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
  attributes?: CatalogAttribute[];
  careInstructions: CareInstructionOption[];
  sizeGuides?: SizeGuideOption[];
  currency: string;
  onClose: () => void;
  onSubmit: (input: ProductInput) => Promise<CatalogProduct>;
}

type TabKey = 'basic' | 'media' | 'categorization' | 'pricing' | 'templates' | 'seo';

export const ProductUploadModal: React.FC<ProductUploadModalProps> = ({
  isOpen,
  mode,
  product,
  categories,
  brands,
  attributes = [],
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
  const [pendingUploads, setPendingUploads] = useState<Array<{ url: string; key: string }>>([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);
  const [photoUploadError, setPhotoUploadError] = useState<string | null>(null);
  const [draggedImageIndex, setDraggedImageIndex] = useState<number | null>(null);
  const [dragOverImageIndex, setDragOverImageIndex] = useState<number | null>(null);
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
  const [selectedAttrValues, setSelectedAttrValues] = useState<Record<string, string[]>>({});
  const [bulkCostInput, setBulkCostInput] = useState<string>('');
  const [bulkSellInput, setBulkSellInput] = useState<string>('');

  interface VariantMatrixRow {
    localKey: string;
    id?: string;
    title: string;
    sku: string;
    costPrice: string;
    price: string;
    imageUrl: string;
    isActive: boolean;
    attributeValueIds: string[];
  }
  const [variantRows, setVariantRows] = useState<VariantMatrixRow[]>([]);
  const [deletedVariantIds, setDeletedVariantIds] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen && mode === 'edit' && product?.id) {
      void fetchProductVariants(product.id).then((list) => {
        setVariantRows(
          list.map((v) => ({
            localKey: v.id || v.sku,
            id: v.id,
            title: v.title,
            sku: v.sku,
            costPrice: v.costPrice !== undefined ? String(v.costPrice) : '',
            price: String(v.price),
            imageUrl: v.imageUrl || '',
            isActive: v.isActive,
            attributeValueIds: v.attributeValueIds || [],
          })),
        );
      });
    } else {
      setVariantRows([]);
    }
    setDeletedVariantIds([]);
  }, [isOpen, mode, product?.id]);

  const sortedAttributes = useMemo(
    () => [...attributes].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)),
    [attributes],
  );

  const plannedCombinations = useMemo(() => {
    const activeAttrs = sortedAttributes
      .map((attr) => {
        const chosenIds = selectedAttrValues[attr.id] || [];
        const chosenVals = attr.values.filter((v) => chosenIds.includes(v.id));
        return { attr, values: chosenVals };
      })
      .filter((entry) => entry.values.length > 0);

    if (activeAttrs.length === 0) return [] as Array<{ title: string; skuSuffix: string; valueIds: string[] }>;

    let combos: Array<{ title: string; skuSuffix: string; valueIds: string[] }> = [
      { title: '', skuSuffix: '', valueIds: [] },
    ];
    for (const { values } of activeAttrs) {
      const next: Array<{ title: string; skuSuffix: string; valueIds: string[] }> = [];
      for (const c of combos) {
        for (const v of values) {
          const valLabel = v.displayValue || v.value;
          const codePart = valLabel.toUpperCase().replace(/[^A-Z0-9]+/g, '');
          next.push({
            title: c.title ? `${c.title} / ${valLabel}` : valLabel,
            skuSuffix: c.skuSuffix ? `${c.skuSuffix}-${codePart}` : codePart,
            valueIds: [...c.valueIds, v.id],
          });
        }
      }
      combos = next;
    }
    return combos;
  }, [sortedAttributes, selectedAttrValues]);

  const handleAutoGenerateCombinations = () => {
    if (plannedCombinations.length === 0) return;
    const prefixBase = (sku.trim() || title.trim() || 'ITEM')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const defaultSell = basePrice.trim() || '0';
    const defaultCost = costPrice.trim() || '';

    setVariantRows((prev) => {
      const existingComboKeys = new Set(
        prev.map((r) =>
          r.attributeValueIds.length > 0 ? [...r.attributeValueIds].sort().join('|') : r.title.toLowerCase(),
        ),
      );
      const existingSkus = new Set(prev.map((r) => r.sku.toUpperCase()));
      const additions: VariantMatrixRow[] = [];

      for (const combo of plannedCombinations) {
        const comboKey = [...combo.valueIds].sort().join('|');
        if (existingComboKeys.has(comboKey) || existingComboKeys.has(combo.title.toLowerCase())) {
          continue;
        }
        let candidateSku = `${prefixBase}-${combo.skuSuffix}`;
        let counter = 2;
        while (existingSkus.has(candidateSku.toUpperCase())) {
          candidateSku = `${prefixBase}-${combo.skuSuffix}-${counter++}`;
        }
        existingSkus.add(candidateSku.toUpperCase());
        existingComboKeys.add(comboKey);
        additions.push({
          localKey: `new-${comboKey}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          title: combo.title,
          sku: candidateSku,
          costPrice: defaultCost,
          price: defaultSell,
          imageUrl: '',
          isActive: true,
          attributeValueIds: combo.valueIds,
        });
      }
      return [...prev, ...additions];
    });
  };

  const minActiveVariantPrice = useMemo(() => {
    const activePrices = variantRows
      .filter((r) => r.isActive)
      .map((r) => parseFloat(r.price))
      .filter((n) => !isNaN(n) && n >= 0);
    if (activePrices.length === 0) return null;
    return Math.min(...activePrices);
  }, [variantRows]);

  const toggleAttrValue = (attrId: string, valueId: string) => {
    setSelectedAttrValues((prev) => {
      const current = prev[attrId] || [];
      const exists = current.includes(valueId);
      const updated = exists ? current.filter((id) => id !== valueId) : [...current, valueId];
      return { ...prev, [attrId]: updated };
    });
  };

  const galleryList = useMemo(
    () =>
      galleryFilenames
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    [galleryFilenames],
  );

  const handleMultiPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    setIsUploadingPhotos(true);
    setPhotoUploadError(null);
    try {
      const uploadedItems: Array<{ url: string; key: string }> = [];
      for (const file of files) {
        const res = await uploadStoreMedia(file, 'products');
        uploadedItems.push({ url: res.url, key: res.key || '' });
      }
      setPendingUploads((prev) => [...prev, ...uploadedItems]);

      let nextFeatured = featuredImageUrl.trim();
      const extraUrls: string[] = [];
      for (const item of uploadedItems) {
        if (!nextFeatured) {
          nextFeatured = item.url;
        } else if (item.url !== nextFeatured) {
          extraUrls.push(item.url);
        }
      }
      if (nextFeatured !== featuredImageUrl.trim()) {
        setFeaturedImageUrl(nextFeatured);
      }
      if (extraUrls.length > 0) {
        setGalleryFilenames((prev) => {
          const existing = prev
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          const merged = Array.from(new Set([...existing, ...extraUrls]));
          return merged.join(', ');
        });
      }
    } catch (err) {
      setPhotoUploadError(err instanceof Error ? err.message : 'Failed to upload product photos.');
    } finally {
      setIsUploadingPhotos(false);
    }
  };

  const handleRemoveImage = async (urlToRemove: string) => {
    if (featuredImageUrl.trim() === urlToRemove) {
      const remainingGallery = galleryList.filter((u) => u !== urlToRemove);
      setFeaturedImageUrl(remainingGallery[0] || '');
      setGalleryFilenames(remainingGallery.slice(1).join(', '));
    } else {
      setGalleryFilenames(galleryList.filter((u) => u !== urlToRemove).join(', '));
    }

    const pending = pendingUploads.find((p) => p.url === urlToRemove);
    if (pending) {
      setPendingUploads((prev) => prev.filter((p) => p.url !== urlToRemove));
      if (pending.key) {
        try {
          await deleteStoreMedia(pending.key);
        } catch {
          // Ignore cleanup errors on already-deleted keys
        }
      }
    }
  };

  const handleCancelAndCleanup = async () => {
    const toDelete = pendingUploads.filter((p) => p.key);
    setPendingUploads([]);
    await Promise.allSettled(toDelete.map((p) => deleteStoreMedia(p.key)));
    onClose();
  };

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
    const effectiveBasePrice =
      optionLayout === 'variants' && minActiveVariantPrice !== null ? minActiveVariantPrice : parseFloat(basePrice);
    if (isNaN(effectiveBasePrice) || effectiveBasePrice < 0) {
      setError('A valid Base Retail Price (or active variant selling price) is required.');
      setActiveTab('pricing');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const payload: ProductInput = {
        title: title.trim(),
        sku: sku.trim() || undefined,
        basePrice: effectiveBasePrice,
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

      const savedProduct = await onSubmit(payload);
      if (optionLayout === 'variants' && savedProduct?.id) {
        for (const delId of deletedVariantIds) {
          await deleteProductVariant(delId);
        }
        for (const row of variantRows) {
          const sellNum = parseFloat(row.price);
          const costNum = row.costPrice.trim() ? parseFloat(row.costPrice) : undefined;
          const varPayload = {
            sku: row.sku.trim(),
            title: row.title.trim(),
            price: isNaN(sellNum) ? effectiveBasePrice : sellNum,
            costPrice: costNum !== undefined && !isNaN(costNum) ? costNum : undefined,
            imageUrl: row.imageUrl,
            isActive: row.isActive,
            attributeValueIds: row.attributeValueIds,
          };
          if (row.id) {
            await updateProductVariant(row.id, varPayload);
          } else {
            await createProductVariant(savedProduct.id, varPayload);
          }
        }
      }
      setPendingUploads([]);
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
                    Product Photos (Upload Multiple or Paste Primary URL)
                  </label>
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                    <label
                      style={{
                        minWidth: '110px',
                        height: '64px',
                        padding: '0 12px',
                        borderRadius: 'var(--radius-md)',
                        border: '1.5px dashed #0d9488',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '3px',
                        color: '#0f766e',
                        backgroundColor: '#f0fdfa',
                        flexShrink: 0,
                        cursor: isUploadingPhotos ? 'not-allowed' : 'pointer',
                        opacity: isUploadingPhotos ? 0.6 : 1,
                      }}
                      title="Select one or multiple photos from your computer"
                    >
                      <Upload size={16} />
                      <span style={{ fontSize: '0.7rem', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {isUploadingPhotos ? 'Uploading...' : 'Upload Photos'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={isUploadingPhotos}
                        onChange={handleMultiPhotoUpload}
                        style={{ display: 'none' }}
                      />
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. https://cdn.yourdomain.com/products/product.webp"
                      value={featuredImageUrl}
                      onChange={(e) => setFeaturedImageUrl(e.target.value)}
                      className="form-input"
                      style={{ flex: 1 }}
                    />
                  </div>
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    You can select multiple photos at once. Uploaded photos are saved only when you click OK; clicking Cancel deletes unsaved uploads automatically.
                  </span>
                  {photoUploadError && (
                    <p style={{ color: '#e11d48', fontSize: '0.78rem', marginTop: '6px' }}>{photoUploadError}</p>
                  )}
                </div>

                {(featuredImageUrl.trim() || galleryList.length > 0) && (() => {
                  const orderedImages = Array.from(new Set([featuredImageUrl.trim(), ...galleryList].filter(Boolean)));
                  const handleDropReorder = (targetIdx: number) => {
                    if (draggedImageIndex === null || draggedImageIndex === targetIdx) {
                      setDraggedImageIndex(null);
                      setDragOverImageIndex(null);
                      return;
                    }
                    const next = [...orderedImages];
                    const [moved] = next.splice(draggedImageIndex, 1);
                    next.splice(targetIdx, 0, moved);
                    setFeaturedImageUrl(next[0] || '');
                    setGalleryFilenames(next.slice(1).join(', '));
                    setDraggedImageIndex(null);
                    setDragOverImageIndex(null);
                  };

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                        Drag &amp; drop photos with your mouse to reorder (1st image is Primary):
                      </span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {orderedImages.map((imgUrl, idx) => {
                          const isPrimary = idx === 0;
                          const isDragTarget = dragOverImageIndex === idx && draggedImageIndex !== idx;
                          return (
                            <div
                              key={imgUrl}
                              draggable
                              onDragStart={(e) => {
                                setDraggedImageIndex(idx);
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                              onDragOver={(e) => {
                                e.preventDefault();
                                e.dataTransfer.dropEffect = 'move';
                                if (dragOverImageIndex !== idx) setDragOverImageIndex(idx);
                              }}
                              onDragLeave={() => {
                                if (dragOverImageIndex === idx) setDragOverImageIndex(null);
                              }}
                              onDrop={(e) => {
                                e.preventDefault();
                                handleDropReorder(idx);
                              }}
                              onDragEnd={() => {
                                setDraggedImageIndex(null);
                                setDragOverImageIndex(null);
                              }}
                              style={{
                                width: '108px',
                                border: isDragTarget
                                  ? '2px dashed #0284c7'
                                  : isPrimary
                                    ? '2px solid #0d9488'
                                    : '1px solid var(--border)',
                                borderRadius: '8px',
                                overflow: 'hidden',
                                background: '#fff',
                                display: 'flex',
                                flexDirection: 'column',
                                cursor: 'grab',
                                opacity: draggedImageIndex === idx ? 0.5 : 1,
                                transition: 'transform 0.15s ease, border-color 0.15s ease',
                              }}
                            >
                              <div style={{ position: 'relative', width: '100%', height: '82px', background: '#f8fafc' }}>
                                <img
                                  src={imgUrl}
                                  alt={`Product ${idx + 1}`}
                                  draggable={false}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }}
                                />
                                <span
                                  style={{
                                    position: 'absolute',
                                    top: '4px',
                                    left: '4px',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '2px',
                                    padding: '2px 5px',
                                    borderRadius: '4px',
                                    background: 'rgba(15, 23, 42, 0.75)',
                                    color: '#fff',
                                    fontSize: '0.65rem',
                                    fontWeight: 700,
                                  }}
                                >
                                  <GripVertical size={10} />#{idx + 1}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => void handleRemoveImage(imgUrl)}
                                  title="Remove photo"
                                  style={{
                                    position: 'absolute',
                                    top: '4px',
                                    right: '4px',
                                    width: '20px',
                                    height: '20px',
                                    borderRadius: '9999px',
                                    background: 'rgba(15, 23, 42, 0.75)',
                                    color: '#fff',
                                    border: 'none',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <X size={12} />
                                </button>
                              </div>
                              <div style={{ padding: '4px 6px', textAlign: 'center', fontSize: '0.68rem', fontWeight: 700 }}>
                                {isPrimary ? (
                                  <span style={{ color: '#0f766e' }}>Primary</span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const nextGallery = orderedImages.filter((u) => u !== imgUrl);
                                      setFeaturedImageUrl(imgUrl);
                                      setGalleryFilenames(nextGallery.join(', '));
                                    }}
                                    style={{
                                      background: 'none',
                                      border: 'none',
                                      color: '#475569',
                                      cursor: 'pointer',
                                      textDecoration: 'underline',
                                      fontSize: '0.68rem',
                                      fontWeight: 600,
                                    }}
                                  >
                                    Set Primary
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Additional Gallery Image URLs / Filenames
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Comma-separated image URLs or filenames"
                    value={galleryFilenames}
                    onChange={(e) => setGalleryFilenames(e.target.value)}
                    className="form-input"
                    style={{ resize: 'vertical', fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}
                  />
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

                {/* Real-Time Gross Profit Preview (Simple Mode) */}
                {optionLayout === 'simple' && (() => {
                  const retail = parseFloat(basePrice);
                  const cost = parseFloat(costPrice);
                  const hasValid = !isNaN(retail) && retail > 0 && !isNaN(cost) && cost >= 0;
                  const margin = hasValid ? retail - cost : 0;
                  const pct = hasValid ? (margin / retail) * 100 : 0;
                  const profitable = margin >= 0;
                  return (
                    <div
                      style={{
                        border: `1px solid ${!hasValid ? 'var(--border)' : profitable ? '#a7f3d0' : '#fecdd3'}`,
                        background: !hasValid ? '#f8fafc' : profitable ? '#ecfdf5' : '#fff1f2',
                        borderRadius: 'var(--radius-md)',
                        padding: '12px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: !hasValid ? 'var(--text-muted)' : profitable ? '#065f46' : '#9f1239' }}>
                        {hasValid
                          ? `Estimated Gross Profit per Unit: ${currency} ${margin.toFixed(2)} (${pct.toFixed(1)}%)`
                          : 'Enter Base Retail Price and Purchase / Costing Price to preview real-time gross margin.'}
                      </div>
                      {hasValid && (
                        <span
                          className={`badge ${profitable ? 'badge-active' : 'badge-danger'}`}
                          style={{ fontSize: '0.7rem', fontWeight: 800 }}
                        >
                          {profitable ? 'PROFITABLE' : 'LOSS'}
                        </span>
                      )}
                    </div>
                  );
                })()}

                {/* Combinatorial Variant Builder Matrix (Variable Mode) */}
                {optionLayout === 'variants' && (() => {
                  const uploadedImages = Array.from(new Set([featuredImageUrl.trim(), ...galleryList].filter(Boolean)));
                  return (
                    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '14px', background: '#f8fafc', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                      {/* 1. Attribute Selection */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)' }}>
                            1. Attribute Selection &amp; Permutation Generator
                          </span>
                          <span className="badge badge-active" style={{ fontSize: '0.7rem' }}>
                            {variantRows.length} Active Matrix Row(s)
                          </span>
                        </div>

                        {sortedAttributes.length === 0 ? (
                          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                            No attributes defined yet. Create attributes (e.g., Ring Size, Color) in the Attributes tab first.
                          </p>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {sortedAttributes.map((attr) => {
                              const chosen = selectedAttrValues[attr.id] || [];
                              return (
                                <div key={attr.id} style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px' }}>
                                  <div style={{ fontSize: '0.76rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-main)' }}>
                                    {attr.name} <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: 'var(--text-muted)' }}>({attr.code})</span>
                                  </div>
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                    {attr.values.map((val) => {
                                      const active = chosen.includes(val.id);
                                      return (
                                        <button
                                          key={val.id}
                                          type="button"
                                          onClick={() => toggleAttrValue(attr.id, val.id)}
                                          style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            padding: '4px 10px',
                                            borderRadius: '9999px',
                                            fontSize: '0.74rem',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            border: active ? '1.5px solid #0d9488' : '1px solid #cbd5e1',
                                            background: active ? '#f0fdfa' : '#fff',
                                            color: active ? '#0f766e' : '#334155',
                                          }}
                                        >
                                          {val.colorHex && (
                                            <span style={{ width: '10px', height: '10px', borderRadius: '9999px', backgroundColor: val.colorHex, border: '1px solid rgba(0,0,0,0.15)' }} />
                                          )}
                                          <span>{val.displayValue || val.value}</span>
                                        </button>
                                      );
                                    })}
                                    {attr.values.length === 0 && (
                                      <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>No values configured for this attribute.</span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                          <button
                            type="button"
                            onClick={handleAutoGenerateCombinations}
                            disabled={plannedCombinations.length === 0}
                            className="btn btn-primary btn-sm"
                            style={{ fontWeight: 700, fontSize: '0.76rem' }}
                          >
                            AUTO-GENERATE COMBINATIONS ({plannedCombinations.length} Variants)
                          </button>
                          {minActiveVariantPrice !== null && (
                            <span style={{ fontSize: '0.74rem', color: '#0f766e', fontWeight: 700 }}>
                              Parent Base Price auto-roll-up: {currency} {minActiveVariantPrice.toFixed(2)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 2. Bulk Pricing Toolbar */}
                      {variantRows.length > 0 && (
                        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '8px', padding: '10px 12px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-main)' }}>2. Bulk Pricing Toolbar:</span>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Purchase Cost:</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={bulkCostInput}
                              onChange={(e) => setBulkCostInput(e.target.value)}
                              className="form-input"
                              style={{ width: '90px', padding: '4px 8px', fontSize: '0.76rem' }}
                            />
                            <button
                              type="button"
                              onClick={() => setVariantRows((prev) => prev.map((r) => ({ ...r, costPrice: bulkCostInput })))}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                            >
                              Apply
                            </button>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>Selling Price:</span>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={bulkSellInput}
                              onChange={(e) => setBulkSellInput(e.target.value)}
                              className="form-input"
                              style={{ width: '90px', padding: '4px 8px', fontSize: '0.76rem' }}
                            />
                            <button
                              type="button"
                              onClick={() => setVariantRows((prev) => prev.map((r) => ({ ...r, price: bulkSellInput })))}
                              className="btn btn-secondary btn-sm"
                              style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                            >
                              Apply
                            </button>
                          </div>
                        </div>
                      )}

                      {/* 3. Variant Matrix Table */}
                      {variantRows.length > 0 && (
                        <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: '8px', overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem', textAlign: 'left' }}>
                            <thead style={{ background: '#f1f5f9', color: '#475569' }}>
                              <tr>
                                <th style={{ padding: '8px' }}>Img</th>
                                <th style={{ padding: '8px' }}>Attributes Combo</th>
                                <th style={{ padding: '8px' }}>Variant SKU</th>
                                <th style={{ padding: '8px' }}>Cost ({currency})</th>
                                <th style={{ padding: '8px' }}>Sell ({currency})</th>
                                <th style={{ padding: '8px' }}>Profit</th>
                                <th style={{ padding: '8px', textAlign: 'center' }}>Active</th>
                                <th style={{ padding: '8px' }} />
                              </tr>
                            </thead>
                            <tbody>
                              {variantRows.map((row, idx) => {
                                const sell = parseFloat(row.price);
                                const cost = parseFloat(row.costPrice);
                                const hasProfit = !isNaN(sell) && !isNaN(cost);
                                const profit = hasProfit ? sell - cost : null;
                                return (
                                  <tr key={row.localKey} style={{ borderTop: '1px solid #e2e8f0' }}>
                                    <td style={{ padding: '6px 8px' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        {row.imageUrl && (
                                          <img src={row.imageUrl} alt="" style={{ width: '24px', height: '24px', borderRadius: '4px', objectFit: 'cover' }} />
                                        )}
                                        <select
                                          value={row.imageUrl}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            setVariantRows((prev) => prev.map((r, i) => (i === idx ? { ...r, imageUrl: val } : r)));
                                          }}
                                          className="form-select"
                                          style={{ width: '76px', padding: '3px 4px', fontSize: '0.7rem' }}
                                        >
                                          <option value="">Default</option>
                                          {uploadedImages.map((u, imgIdx) => (
                                            <option key={u} value={u}>
                                              Photo #{imgIdx + 1}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    </td>
                                    <td style={{ padding: '6px 8px', fontWeight: 600 }}>{row.title}</td>
                                    <td style={{ padding: '6px 8px' }}>
                                      <input
                                        type="text"
                                        value={row.sku}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setVariantRows((prev) => prev.map((r, i) => (i === idx ? { ...r, sku: val } : r)));
                                        }}
                                        className="form-input"
                                        style={{ width: '130px', padding: '4px 6px', fontSize: '0.72rem', fontFamily: 'var(--font-mono)' }}
                                      />
                                    </td>
                                    <td style={{ padding: '6px 8px' }}>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={row.costPrice}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setVariantRows((prev) => prev.map((r, i) => (i === idx ? { ...r, costPrice: val } : r)));
                                        }}
                                        className="form-input"
                                        style={{ width: '78px', padding: '4px 6px', fontSize: '0.72rem' }}
                                      />
                                    </td>
                                    <td style={{ padding: '6px 8px' }}>
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        value={row.price}
                                        onChange={(e) => {
                                          const val = e.target.value;
                                          setVariantRows((prev) => prev.map((r, i) => (i === idx ? { ...r, price: val } : r)));
                                        }}
                                        className="form-input"
                                        style={{ width: '78px', padding: '4px 6px', fontSize: '0.72rem' }}
                                      />
                                    </td>
                                    <td style={{ padding: '6px 8px', fontWeight: 700, color: profit === null ? '#64748b' : profit >= 0 ? '#059669' : '#e11d48' }}>
                                      {profit === null ? '—' : `${profit.toFixed(0)}`}
                                    </td>
                                    <td style={{ padding: '6px 8px', textAlign: 'center' }}>
                                      <input
                                        type="checkbox"
                                        checked={row.isActive}
                                        onChange={(e) => {
                                          const checked = e.target.checked;
                                          setVariantRows((prev) => prev.map((r, i) => (i === idx ? { ...r, isActive: checked } : r)));
                                        }}
                                      />
                                    </td>
                                    <td style={{ padding: '6px 8px' }}>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (row.id) setDeletedVariantIds((prev) => [...prev, row.id!]);
                                          setVariantRows((prev) => prev.filter((_, i) => i !== idx));
                                        }}
                                        title="Remove variant"
                                        style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                                      >
                                        <X size={13} />
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })()}

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
                  </select>
                  {sizeGuides.length === 0 && (
                    <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      No size guide templates uploaded yet. Create one in the Size Guides tab.
                    </span>
                  )}
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
              onClick={() => void handleCancelAndCleanup()}
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
