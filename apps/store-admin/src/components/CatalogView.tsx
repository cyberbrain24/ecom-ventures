import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ImageOff, Pencil, Plus, Star, Trash2, LayoutGrid, List, Copy, Eye, AlertTriangle, Upload, X } from 'lucide-react';
import { StoreBrand } from '../types/store';
import { uploadStoreMedia } from '../lib/api';
import {
  AttributeInput,
  BrandInput,
  CareInstructionInput,
  CatalogAttribute,
  CatalogBrand,
  CatalogCareInstruction,
  CatalogCategory,
  CatalogProduct,
  CatalogSizeGuideTemplate,
  CategoryInput,
  ProductInput,
  SizeGuideTemplateInput,
  createAttribute,
  createBrand,
  createCareInstruction,
  createCategory,
  createProduct,
  createSizeGuideTemplate,
  deleteAttribute,
  deleteBrand,
  deleteCareInstruction,
  deleteCategory,
  deleteProduct,
  deleteSizeGuideTemplate,
  fetchAttributes,
  fetchBrands,
  fetchCareInstructions,
  fetchCategories,
  fetchProducts,
  fetchSizeGuideTemplates,
  saveAttributeOrder,
  saveBrandOrder,
  saveCareInstructionOrder,
  saveCategoryOrder,
  saveFeaturedOrder,
  saveProductOrder,
  setProductFeatured,
  setProductLinks,
  updateAttribute,
  updateBrand,
  updateCareInstruction,
  updateCategory,
  updateProduct,
  updateSizeGuideTemplate,
} from '../lib/catalog-api';
import { describeError, formatMoney } from '../lib/format';
import { EmptyState } from './StoreStatusNotices';
import { SortableList } from './SortableList';
import { FeaturedProductsTab } from './FeaturedProductsTab';
import { BrandsTab } from './BrandsTab';
import { CareInstructionsTab } from './CareInstructionsTab';
import { SizeGuidesTab } from './SizeGuidesTab';
import { AttributesTab } from './AttributesTab';
import { RecordModal } from './RecordModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { ProductUploadModal } from './ProductUploadModal';
import { AdvancedSeoEditor } from './AdvancedSeoEditor';

interface CatalogViewProps {
  currentStore: StoreBrand;
}

type CatalogTab = 'products' | 'featured' | 'categories' | 'attributes' | 'brands' | 'care' | 'sizeguides';

interface CatalogData {
  products: CatalogProduct[];
  featured: CatalogProduct[];
  categories: CatalogCategory[];
  attributes: CatalogAttribute[];
  brands: CatalogBrand[];
  careInstructions: CatalogCareInstruction[];
  sizeGuides: CatalogSizeGuideTemplate[];
}

function replaceGroup(tree: CatalogCategory[], parentId: string | null, next: CatalogCategory[]): CatalogCategory[] {
  if (parentId === null) return next;
  return tree.map((node) =>
    node.id === parentId
      ? { ...node, children: next }
      : { ...node, children: replaceGroup(node.children, parentId, next) }
  );
}

function flattenCategories(nodes: CatalogCategory[], prefix = ''): { id: string; name: string }[] {
  const result: { id: string; name: string }[] = [];
  for (const node of nodes) {
    const currentName = prefix ? `${prefix} > ${node.name}` : node.name;
    result.push({ id: node.id, name: currentName });
    if (node.children && node.children.length > 0) {
      result.push(...flattenCategories(node.children, currentName));
    }
  }
  return result;
}

export const CatalogView: React.FC<CatalogViewProps> = ({ currentStore }) => {
  const [activeTab, setActiveTab] = useState<CatalogTab>('products');
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');
  const [selectedProductIds, setSelectedProductIds] = useState<Set<string>>(new Set());
  const [data, setData] = useState<CatalogData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Modals for Products
  const [productModal, setProductModal] = useState<{ mode: 'create' | 'edit'; product: CatalogProduct | null } | null>(null);
  const [deleteProductTarget, setDeleteProductTarget] = useState<CatalogProduct | null>(null);

  // Modals for Categories
  const [categoryModal, setCategoryModal] = useState<{ mode: 'create' | 'edit'; category: CatalogCategory | null; parentId?: string | null } | null>(null);
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<CatalogCategory | null>(null);
  const [categoryTab, setCategoryTab] = useState<'general' | 'seo'>('general');

  // Modals for Attributes
  const [deleteAttributeTarget, setDeleteAttributeTarget] = useState<CatalogAttribute | null>(null);

  // Forms State
  const [productForm, setProductForm] = useState<ProductInput>({
    title: '',
    slug: '',
    sku: '',
    basePrice: 0,
    compareAtPrice: undefined,
    categoryId: null,
    status: 'ACTIVE',
    summary: '',
    description: '',
    featuredImageUrl: '',
    isFeatured: false,
    metaTitle: '',
    metaDescription: '',
    focusKeyword: '',
    canonicalUrl: '',
    metaRobots: 'index, follow',
    ogImageUrl: '',
  });

  const [categoryForm, setCategoryForm] = useState<CategoryInput>({
    name: '',
    slug: '',
    parentId: null,
    description: '',
    imageUrl: '',
    isActive: true,
    metaTitle: '',
    metaDescription: '',
    focusKeyword: '',
    canonicalUrl: '',
    metaRobots: 'index, follow',
    ogImageUrl: '',
  });
  const [isUploadingCategoryImage, setIsUploadingCategoryImage] = useState(false);
  const [categoryImageUploadError, setCategoryImageUploadError] = useState<string | null>(null);

  const handleCategoryImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsUploadingCategoryImage(true);
    setCategoryImageUploadError(null);
    try {
      const uploaded = await uploadStoreMedia(file, 'categories');
      setCategoryForm((prev) => ({ ...prev, imageUrl: uploaded.url }));
    } catch (err) {
      setCategoryImageUploadError(err instanceof Error ? err.message : 'Failed to upload category image.');
    } finally {
      setIsUploadingCategoryImage(false);
    }
  };

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [products, featured, categories, attributes, brands, careInstructions, sizeGuides] = await Promise.all([
        fetchProducts(false),
        fetchProducts(true),
        fetchCategories(),
        fetchAttributes(),
        fetchBrands(),
        fetchCareInstructions(),
        fetchSizeGuideTemplates(),
      ]);
      setData({ products, featured, categories, attributes, brands, careInstructions, sizeGuides });
    } catch (err) {
      setLoadError(describeError(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const flatCategories = useMemo(() => {
    return data ? flattenCategories(data.categories) : [];
  }, [data]);

  const categoryNames = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of flatCategories) {
      map.set(c.id, c.name);
    }
    return map;
  }, [flatCategories]);

  const saveChange = async (update: (current: CatalogData) => CatalogData, persist: () => Promise<void>) => {
    setSaving(true);
    setActionError(null);
    try {
      await persist();
      setData((current) => (current === null ? current : update(current)));
    } catch (err) {
      setActionError(describeError(err));
    } finally {
      setSaving(false);
    }
  };

  const reorderProducts = (next: CatalogProduct[]) =>
    saveChange((d) => ({ ...d, products: next }), () => saveProductOrder(next.map((p) => p.id)));

  const reorderFeatured = (next: CatalogProduct[]) =>
    saveChange((d) => ({ ...d, featured: next }), () => saveFeaturedOrder(next.map((p) => p.id)));

  const reorderCategories = (parentId: string | null, next: CatalogCategory[]) =>
    saveChange(
      (d) => ({ ...d, categories: replaceGroup(d.categories, parentId, next) }),
      () => saveCategoryOrder(next.map((c) => c.id)),
    );

  const reorderAttributes = (next: CatalogAttribute[]) =>
    saveChange((d) => ({ ...d, attributes: next }), () => saveAttributeOrder(next.map((a) => a.id)));

  const reorderBrands = (next: CatalogBrand[]) =>
    saveChange((d) => ({ ...d, brands: next }), () => saveBrandOrder(next.map((b) => b.id)));

  const reorderCare = (next: CatalogCareInstruction[]) =>
    saveChange((d) => ({ ...d, careInstructions: next }), () => saveCareInstructionOrder(next.map((c) => c.id)));

  const saveBrand = async (id: string | null, input: BrandInput): Promise<void> => {
    const saved = id === null ? await createBrand(input) : await updateBrand(id, input);
    setData((d) =>
      d === null ? d : { ...d, brands: id === null ? [...d.brands, saved] : d.brands.map((b) => (b.id === saved.id ? saved : b)) },
    );
  };

  const saveCare = async (id: string | null, input: CareInstructionInput): Promise<void> => {
    const saved = id === null ? await createCareInstruction(input) : await updateCareInstruction(id, input);
    setData((d) =>
      d === null
        ? d
        : { ...d, careInstructions: id === null ? [...d.careInstructions, saved] : d.careInstructions.map((c) => (c.id === saved.id ? saved : c)) },
    );
  };

  const saveSizeGuide = async (id: string | null, input: SizeGuideTemplateInput): Promise<void> => {
    const saved = id === null ? await createSizeGuideTemplate(input) : await updateSizeGuideTemplate(id, input);
    setData((d) =>
      d === null
        ? d
        : { ...d, sizeGuides: id === null ? [...d.sizeGuides, saved] : d.sizeGuides.map((s) => (s.id === saved.id ? saved : s)) },
    );
  };

  const saveAttribute = async (id: string | null, input: AttributeInput): Promise<void> => {
    if (id === null) {
      const saved = await createAttribute(input);
      setData((d) => (d === null ? d : { ...d, attributes: [...d.attributes, saved] }));
    } else {
      await updateAttribute(id, {
        name: input.name,
        dataType: input.dataType,
        displayType: input.displayType || 'text',
        sortOrder: input.sortOrder,
        values: input.values,
      });
      const attributes = await fetchAttributes();
      setData((d) => (d === null ? d : { ...d, attributes }));
    }
  };

  const deleteAttributeHandler = async (attr: CatalogAttribute): Promise<void> => {
    await runDelete(
      `Attribute "${attr.name}"`,
      () => deleteAttribute(attr.id),
      (d) => ({
        ...d,
        attributes: d.attributes.filter((a) => a.id !== attr.id),
      }),
    );
  };

  const deleteSizeGuide = async (item: CatalogSizeGuideTemplate): Promise<void> => {
    await runDelete(
      `Size guide "${item.name}"`,
      () => deleteSizeGuideTemplate(item.id),
      (d) => ({
        ...d,
        sizeGuides: d.sizeGuides.filter((s) => s.id !== item.id),
      }),
    );
  };

  const runDelete = async (label: string, remove: () => Promise<void>, drop: (d: CatalogData) => CatalogData): Promise<void> => {
    setSaving(true);
    setActionError(null);
    try {
      await remove();
      setData((d) => (d === null ? d : drop(d)));
    } catch (err) {
      setActionError(`${label} was not deleted: ${describeError(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const changeLink = async (product: CatalogProduct, field: 'brandId' | 'careInstructionId', value: string | null): Promise<void> => {
    const brandId = field === 'brandId' ? value : product.brandId;
    const careId = field === 'careInstructionId' ? value : product.careInstructionId;
    const apply = (list: CatalogProduct[]) => list.map((p) => (p.id === product.id ? { ...p, brandId, careInstructionId: careId } : p));
    await saveChange(
      (d) => ({ ...d, products: apply(d.products), featured: apply(d.featured) }),
      () => setProductLinks(product.id, brandId, careId),
    );
  };

  const toggleFeatured = async (product: CatalogProduct): Promise<void> => {
    setSaving(true);
    setActionError(null);
    try {
      await setProductFeatured(product.id, !product.isFeatured);
    } catch (err) {
      setActionError(`"${product.title}" was not updated: ${describeError(err)}`);
      setSaving(false);
      return;
    }
    try {
      const [products, featured] = await Promise.all([fetchProducts(false), fetchProducts(true)]);
      setData((current) => (current === null ? current : { ...current, products, featured }));
    } catch (err) {
      setActionError(`"${product.title}" was saved, but the list could not be refreshed: ${describeError(err)}`);
    } finally {
      setSaving(false);
    }
  };

  // Product CRUD
  const openCreateProduct = () => {
    setProductForm({
      title: '',
      slug: '',
      sku: '',
      basePrice: 0,
      compareAtPrice: undefined,
      categoryId: null,
      status: 'ACTIVE',
      summary: '',
      description: '',
      featuredImageUrl: '',
      isFeatured: false,
    });
    setProductModal({ mode: 'create', product: null });
  };

  const openEditProduct = (p: CatalogProduct) => {
    setProductForm({
      title: p.title,
      slug: p.slug,
      sku: p.sku,
      basePrice: p.basePrice,
      categoryId: p.categoryId,
      status: p.status,
      featuredImageUrl: p.imageUrl,
      isFeatured: p.isFeatured,
    });
    setProductModal({ mode: 'edit', product: p });
  };

  const handleDuplicateProduct = async (p: CatalogProduct) => {
    setSaving(true);
    setActionError(null);
    try {
      const duplicated = await createProduct({
        title: `${p.title} (Copy)`,
        slug: `${p.slug}-copy-${Math.floor(Math.random() * 1000)}`,
        sku: p.sku ? `${p.sku}-CPY` : undefined,
        basePrice: p.basePrice,
        costPrice: p.costPrice,
        compareAtPrice: p.compareAtPrice,
        categoryId: p.categoryId,
        status: 'DRAFT',
        featuredImageUrl: p.imageUrl,
        isFeatured: false,
        brandId: p.brandId,
        careInstructionId: p.careInstructionId,
        videoUrl: p.videoUrl,
        videoAutoplay: p.videoAutoplay,
        videoMuted: p.videoMuted,
        optionLayout: p.optionLayout,
        sizeGuideTemplate: p.sizeGuideTemplate,
      });
      setData((d) => (d ? { ...d, products: [duplicated, ...d.products] } : d));
    } catch (err) {
      setActionError(`Could not duplicate "${p.title}": ${describeError(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleProductStatus = async (p: CatalogProduct) => {
    setSaving(true);
    setActionError(null);
    const nextStatus = p.status === 'ACTIVE' ? 'DRAFT' : 'ACTIVE';
    try {
      const updated = await updateProduct(p.id, {
        title: p.title,
        status: nextStatus,
        basePrice: p.basePrice,
        costPrice: p.costPrice,
        compareAtPrice: p.compareAtPrice,
        categoryId: p.categoryId,
        featuredImageUrl: p.imageUrl,
        sku: p.sku,
        isFeatured: p.isFeatured,
      });
      setData((d) =>
        d
          ? {
              ...d,
              products: d.products.map((item) => (item.id === updated.id ? updated : item)),
              featured: d.featured.map((item) => (item.id === updated.id ? updated : item)),
            }
          : d
      );
    } catch (err) {
      setActionError(`Failed to update status for "${p.title}": ${describeError(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const toggleSelectProduct = (id: string) => {
    setSelectedProductIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllProducts = (all: CatalogProduct[]) => {
    if (selectedProductIds.size === all.length) {
      setSelectedProductIds(new Set());
    } else {
      setSelectedProductIds(new Set(all.map((p) => p.id)));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedProductIds.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedProductIds.size} selected drops?`)) return;
    setSaving(true);
    setActionError(null);
    try {
      for (const id of Array.from(selectedProductIds)) {
        await deleteProduct(id);
      }
      setData((d) =>
        d
          ? {
              ...d,
              products: d.products.filter((p) => !selectedProductIds.has(p.id)),
              featured: d.featured.filter((p) => !selectedProductIds.has(p.id)),
            }
          : d
      );
      setSelectedProductIds(new Set());
    } catch (err) {
      setActionError(`Bulk deletion error: ${describeError(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveProduct = async () => {
    if (!productForm.title.trim()) throw new Error('Product title is required.');
    if (productForm.basePrice < 0) throw new Error('Price cannot be negative.');

    if (productModal?.mode === 'create') {
      const created = await createProduct(productForm);
      setData((d) => (d ? { ...d, products: [created, ...d.products] } : d));
    } else if (productModal?.mode === 'edit' && productModal.product) {
      const updated = await updateProduct(productModal.product.id, productForm);
      setData((d) =>
        d
          ? {
              ...d,
              products: d.products.map((p) => (p.id === updated.id ? updated : p)),
              featured: d.featured.map((p) => (p.id === updated.id ? updated : p)),
            }
          : d
      );
    }
  };

  // Category CRUD
  const openCreateCategory = (parentId: string | null = null) => {
    setCategoryTab('general');
    setCategoryForm({
      name: '',
      slug: '',
      parentId,
      description: '',
      imageUrl: '',
      isActive: true,
      metaTitle: '',
      metaDescription: '',
      focusKeyword: '',
      canonicalUrl: '',
      metaRobots: 'index, follow',
      ogImageUrl: '',
    });
    setCategoryModal({ mode: 'create', category: null, parentId });
  };

  const openEditCategory = (c: CatalogCategory) => {
    setCategoryTab('general');
    setCategoryForm({
      name: c.name,
      slug: c.slug,
      parentId: c.parentId,
      description: c.description || '',
      imageUrl: c.imageUrl || '',
      isActive: c.isActive,
      metaTitle: c.metaTitle || '',
      metaDescription: c.metaDescription || '',
      focusKeyword: c.focusKeyword || '',
      canonicalUrl: c.canonicalUrl || '',
      metaRobots: c.metaRobots || 'index, follow',
      ogImageUrl: c.ogImageUrl || '',
    });
    setCategoryModal({ mode: 'edit', category: c });
  };

  const handleSaveCategory = async () => {
    if (!categoryForm.name.trim()) throw new Error('Category name is required.');
    if (categoryModal?.mode === 'create') {
      await createCategory(categoryForm);
    } else if (categoryModal?.mode === 'edit' && categoryModal.category) {
      await updateCategory(categoryModal.category.id, categoryForm);
    }
    const categories = await fetchCategories();
    setData((d) => (d ? { ...d, categories } : d));
  };

  const tabs: { id: CatalogTab; label: string; count: number | null }[] = [
    { id: 'products', label: 'Products', count: data?.products.length ?? null },
    { id: 'featured', label: 'Featured', count: data?.featured.length ?? null },
    { id: 'categories', label: 'Categories', count: data ? countCategories(data.categories) : null },
    { id: 'attributes', label: 'Attributes', count: data?.attributes.length ?? null },
    { id: 'brands', label: 'Brands', count: data?.brands.length ?? null },
    { id: 'care', label: 'Care instructions', count: data?.careInstructions.length ?? null },
    { id: 'sizeguides', label: 'Size Guides', count: data?.sizeGuides.length ?? null },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '8px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
            Products & Catalogue
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
            Live connected catalogue management for <code>{currentStore.name}</code>
          </p>
        </div>

        <div>
          {activeTab === 'products' && (
            <button onClick={openCreateProduct} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Plus size={14} /> Add Product
            </button>
          )}
          {activeTab === 'categories' && (
            <button onClick={() => openCreateCategory(null)} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Plus size={14} /> Add Category
            </button>
          )}
        </div>
      </div>

      {actionError !== null && (
        <div className="notice notice-error" role="alert" style={{ marginBottom: '12px' }}>
          {actionError}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', flexWrap: 'nowrap', WebkitOverflowScrolling: 'touch', borderBottom: '1px solid var(--border)', marginBottom: '12px', paddingBottom: '8px' }}>
        {tabs.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flexShrink: 0, whiteSpace: 'nowrap' }} className={`btn btn-sm ${activeTab === tab.id ? 'btn-primary' : 'btn-secondary'}`}>
            {tab.label}
            {tab.count !== null ? ` (${tab.count})` : ''}
          </button>
        ))}
      </div>

      {loadError !== null && (
        <div className="notice notice-error" role="alert">
          <div>Could not load the catalogue: {loadError}</div>
          <button className="btn btn-secondary btn-sm" style={{ marginTop: '8px' }} onClick={() => void load()}>
            Try again
          </button>
        </div>
      )}

      {loadError === null && data === null && (
        <div className="card" style={{ padding: 0 }}>
          <EmptyState message="Loading the catalogue from the server..." />
        </div>
      )}

      {/* PRODUCTS TAB */}
      {data !== null && activeTab === 'products' && (
        <div className="card" style={{ padding: '12px' }}>
          {data.products.length === 0 ? (
            <EmptyState message="This store has no products yet. Click 'Add Product' above to create one." />
          ) : (
            <>
              {/* Curation Toolbar: Layout Switcher & Bulk Operations */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '12px',
                  marginBottom: '14px',
                  paddingBottom: '10px',
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={selectedProductIds.size === data.products.length && data.products.length > 0}
                      onChange={() => toggleSelectAllProducts(data.products)}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>Select All ({selectedProductIds.size}/{data.products.length})</span>
                  </label>

                  {selectedProductIds.size > 0 && (
                    <button
                      type="button"
                      onClick={() => void handleBulkDelete()}
                      className="btn btn-sm"
                      style={{ backgroundColor: '#fef2f2', color: '#dc2626', borderColor: '#fca5a5', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Trash2 size={13} />
                      <span>Delete Selected ({selectedProductIds.size})</span>
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Display:</span>
                  <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 'var(--radius-sm)', padding: '2px', border: '1px solid var(--border)' }}>
                    <button
                      type="button"
                      onClick={() => setViewMode('grid')}
                      className={`btn btn-xs ${viewMode === 'grid' ? 'btn-primary' : ''}`}
                      style={{
                        padding: '4px 8px',
                        border: 'none',
                        background: viewMode === 'grid' ? 'var(--primary)' : 'transparent',
                        color: viewMode === 'grid' ? '#fff' : 'var(--text-muted)',
                        borderRadius: 'var(--radius-xs)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                      }}
                      title="Ultra-Dense Drop Grid View (8-column)"
                    >
                      <LayoutGrid size={13} /> Grid
                    </button>
                    <button
                      type="button"
                      onClick={() => setViewMode('table')}
                      className={`btn btn-xs ${viewMode === 'table' ? 'btn-primary' : ''}`}
                      style={{
                        padding: '4px 8px',
                        border: 'none',
                        background: viewMode === 'table' ? 'var(--primary)' : 'transparent',
                        color: viewMode === 'table' ? '#fff' : 'var(--text-muted)',
                        borderRadius: 'var(--radius-xs)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 700,
                      }}
                      title="Sortable Reordering List View"
                    >
                      <List size={13} /> List
                    </button>
                  </div>
                </div>
              </div>

              {viewMode === 'grid' ? (
                /* Ultra-dense 8-column responsive Drop Listing Grid */
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
                    gap: '12px',
                  }}
                >
                  {data.products.map((product) => {
                    const isSelected = selectedProductIds.has(product.id);
                    const isSoldOut = product.status !== 'ACTIVE';
                    const hasCost = typeof product.costPrice === 'number' && product.costPrice > 0;
                    const categoryTitle = product.categoryId ? (categoryNames.get(product.categoryId) || 'Streetwear') : 'Streetwear';

                    return (
                      <div
                        key={product.id}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          background: '#ffffff',
                          border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                          borderRadius: 'var(--radius-md)',
                          overflow: 'hidden',
                          boxShadow: isSelected ? '0 0 0 1px var(--primary)' : '0 1px 3px rgba(0,0,0,0.05)',
                          transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                          position: 'relative',
                        }}
                      >
                        {/* 1:1 Aspect Ratio Media Viewport with Overlays */}
                        <div
                          style={{
                            position: 'relative',
                            width: '100%',
                            paddingTop: '100%',
                            backgroundColor: '#0f172a',
                            overflow: 'hidden',
                          }}
                        >
                          {product.imageUrl ? (
                            <img
                              src={product.imageUrl}
                              alt={product.title}
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                objectFit: 'cover',
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#64748b',
                              }}
                            >
                              <ImageOff size={28} />
                            </div>
                          )}

                          {/* Top Overlay: Checkbox & Featured Star */}
                          <div
                            style={{
                              position: 'absolute',
                              top: '6px',
                              left: '6px',
                              right: '6px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              zIndex: 2,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectProduct(product.id)}
                              style={{
                                width: '16px',
                                height: '16px',
                                cursor: 'pointer',
                                accentColor: 'var(--primary)',
                              }}
                            />

                            <button
                              type="button"
                              onClick={() => void toggleFeatured(product)}
                              style={{
                                background: product.isFeatured ? '#f59e0b' : 'rgba(15, 23, 42, 0.65)',
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: 'var(--radius-xs)',
                                padding: '2px 4px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              title={product.isFeatured ? 'Pinned to Featured Drops' : 'Pin to Featured'}
                            >
                              <Star size={12} fill={product.isFeatured ? '#ffffff' : 'none'} />
                            </button>
                          </div>

                          {/* Bottom Overlay: Stock / Sold Out Badge */}
                          {isSoldOut && (
                            <div
                              style={{
                                position: 'absolute',
                                bottom: '6px',
                                left: '6px',
                                background: 'rgba(239, 68, 68, 0.9)',
                                color: '#ffffff',
                                fontSize: '0.62rem',
                                fontWeight: 800,
                                padding: '2px 6px',
                                borderRadius: 'var(--radius-xs)',
                                letterSpacing: '0.04em',
                                textTransform: 'uppercase',
                                zIndex: 2,
                              }}
                            >
                              SOLD OUT
                            </div>
                          )}
                        </div>

                        {/* Drop Metadata Block */}
                        <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                          {/* Product Title Truncated */}
                          <strong
                            title={product.title}
                            style={{
                              fontSize: '0.78rem',
                              fontWeight: 700,
                              color: 'var(--text-main)',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              lineHeight: 1.3,
                            }}
                          >
                            {product.title}
                          </strong>

                          {/* SKU & Category Split */}
                          <div
                            style={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              fontSize: '0.68rem',
                              color: 'var(--text-muted)',
                            }}
                          >
                            <span className="mono" style={{ fontWeight: 600 }}>
                              {product.sku || 'NO-SKU'}
                            </span>
                            <span
                              title={categoryTitle}
                              style={{
                                maxWidth: '75px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {categoryTitle}
                            </span>
                          </div>

                          {/* Financial Economics Row */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              marginTop: '2px',
                              paddingTop: '4px',
                              borderTop: '1px dashed var(--border)',
                            }}
                          >
                            <span style={{ fontSize: '0.82rem', fontWeight: 800, color: 'var(--text-main)' }}>
                              {formatMoney(currentStore.currency, product.basePrice)}
                            </span>
                            {hasCost ? (
                              <span style={{ fontSize: '0.68rem', color: '#059669', fontWeight: 700 }}>
                                Cost: {formatMoney(currentStore.currency, product.costPrice || 0)}
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: '0.62rem',
                                  color: '#d97706',
                                  fontWeight: 800,
                                  background: '#fef3c7',
                                  padding: '1px 4px',
                                  borderRadius: 'var(--radius-xs)',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                }}
                                title="No procurement cost entered. Accurate P&L calculations require cost price."
                              >
                                <AlertTriangle size={10} /> NO COST
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Quick State Toggles */}
                        <div
                          style={{
                            padding: '4px 8px',
                            background: '#f8fafc',
                            borderTop: '1px solid var(--border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            fontSize: '0.68rem',
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => void toggleFeatured(product)}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              fontWeight: 700,
                              color: product.isFeatured ? '#d97706' : 'var(--text-subtle)',
                            }}
                          >
                            <Star size={11} fill={product.isFeatured ? 'currentColor' : 'none'} />
                            <span>{product.isFeatured ? 'FEATURED' : 'DROP'}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => void handleToggleProductStatus(product)}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '3px',
                              fontWeight: 700,
                              color: product.status === 'ACTIVE' ? '#059669' : '#dc2626',
                            }}
                          >
                            <span>{product.status === 'ACTIVE' ? 'STOCK' : 'OUT'}</span>
                          </button>
                        </div>

                        {/* Action Bar (Preview, Edit, Duplicate, Delete) */}
                        <div
                          style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(4, 1fr)',
                            borderTop: '1px solid var(--border)',
                            background: '#ffffff',
                          }}
                        >
                          <button
                            type="button"
                            title="Storefront Live Preview"
                            onClick={() => window.open(`http://${currentStore.slug}.dropiobd.localhost:5200/product/${product.slug}`, '_blank')}
                            style={{
                              padding: '6px 0',
                              border: 'none',
                              background: 'transparent',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                            }}
                          >
                            <Eye size={12} />
                          </button>

                          <button
                            type="button"
                            title="Edit Drop Entry"
                            onClick={() => openEditProduct(product)}
                            style={{
                              padding: '6px 0',
                              border: 'none',
                              borderLeft: '1px solid var(--border)',
                              background: 'transparent',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                            }}
                          >
                            <Pencil size={12} />
                          </button>

                          <button
                            type="button"
                            title="Clone / Duplicate Drop"
                            onClick={() => void handleDuplicateProduct(product)}
                            style={{
                              padding: '6px 0',
                              border: 'none',
                              borderLeft: '1px solid var(--border)',
                              background: 'transparent',
                              color: 'var(--text-muted)',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                            }}
                          >
                            <Copy size={12} />
                          </button>

                          <button
                            type="button"
                            title="Delete Drop"
                            onClick={() => setDeleteProductTarget(product)}
                            style={{
                              padding: '6px 0',
                              border: 'none',
                              borderLeft: '1px solid var(--border)',
                              background: 'transparent',
                              color: '#dc2626',
                              cursor: 'pointer',
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center',
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* Sortable Reordering List View */
                <SortableList
                  label="Products"
                  items={data.products}
                  getId={(p) => p.id}
                  onReorder={(next) => void reorderProducts(next)}
                  disabled={saving}
                  renderItem={(product, row) => (
                    <div className="sortable-line">
                      {row.controls}
                      <div className="sortable-thumb">
                        {product.imageUrl ? <img src={product.imageUrl} alt="" draggable={false} /> : <ImageOff size={16} />}
                      </div>
                      <div className="sortable-main">
                        <strong>{product.title}</strong>
                        <span className="sortable-sub mono">
                          {product.sku !== '' ? `${product.sku} · ` : ''}
                          {product.slug}
                        </span>
                      </div>
                      <span className="sortable-cell">
                        {product.categoryId !== null ? (categoryNames.get(product.categoryId) ?? 'Unknown category') : 'No category'}
                      </span>
                      <span className="sortable-cell mono">{formatMoney(currentStore.currency, product.basePrice)}</span>
                      <span className="sortable-cell">
                        <span className={`badge ${product.status === 'ACTIVE' ? 'badge-active' : 'badge-outline'}`}>{product.status}</span>
                      </span>
                      <select
                        className="form-select"
                        aria-label={`Brand for ${product.title}`}
                        value={product.brandId ?? ''}
                        disabled={saving}
                        onChange={(e) => void changeLink(product, 'brandId', e.target.value === '' ? null : e.target.value)}
                        style={{ minWidth: '120px', fontSize: '0.78rem' }}
                      >
                        <option value="">No brand</option>
                        {data.brands.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.isActive ? b.name : `${b.name} (inactive)`}
                          </option>
                        ))}
                      </select>
                      <select
                        className="form-select"
                        aria-label={`Care instruction for ${product.title}`}
                        value={product.careInstructionId ?? ''}
                        disabled={saving}
                        onChange={(e) => void changeLink(product, 'careInstructionId', e.target.value === '' ? null : e.target.value)}
                        style={{ minWidth: '140px', fontSize: '0.78rem' }}
                      >
                        <option value="">No care instruction</option>
                        {data.careInstructions.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.isActive ? c.title : `${c.title} (inactive)`}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        className={`btn btn-sm ${product.isFeatured ? 'btn-primary' : 'btn-secondary'}`}
                        aria-pressed={product.isFeatured}
                        disabled={saving}
                        title={product.isFeatured ? 'Remove from featured' : 'Mark as featured'}
                        onClick={() => void toggleFeatured(product)}
                      >
                        <Star size={13} fill={product.isFeatured ? 'currentColor' : 'none'} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        title="Edit Product"
                        onClick={() => openEditProduct(product)}
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-secondary"
                        title="Clone / Duplicate Drop"
                        onClick={() => void handleDuplicateProduct(product)}
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                        title="Delete Product"
                        onClick={() => setDeleteProductTarget(product)}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                />
              )}
            </>
          )}
        </div>
      )}

      {/* FEATURED TAB */}
      {data !== null && activeTab === 'featured' && (
        <FeaturedProductsTab
          featured={data.featured}
          currency={currentStore.currency}
          categoryNames={categoryNames}
          storeSlug={currentStore.slug}
          busy={saving}
          onReorder={(next) => void reorderFeatured(next)}
          onUnfeature={(product) => void toggleFeatured(product)}
          onEditProduct={(product) => openEditProduct(product)}
        />
      )}

      {/* CATEGORIES TAB */}
      {data !== null && activeTab === 'categories' && (
        <div className="card" style={{ padding: '10px' }}>
          {data.categories.length === 0 ? (
            <EmptyState message="This store has no categories yet. Click 'Add Category' above to create one." />
          ) : (
            <>
              <p className="sortable-hint">Hierarchical category taxonomy. Drag or position to reorder sibling categories.</p>
              <CategoryTreeGroup
                nodes={data.categories}
                parentId={null}
                disabled={saving}
                onReorder={(parentId, next) => void reorderCategories(parentId, next)}
                onEdit={openEditCategory}
                onDelete={(c) => setDeleteCategoryTarget(c)}
                onAddSub={(parent) => openCreateCategory(parent.id)}
              />
            </>
          )}
        </div>
      )}

      {/* BRANDS TAB */}
      {data !== null && activeTab === 'brands' && (
        <BrandsTab
          brands={data.brands}
          busy={saving}
          onReorder={(next) => void reorderBrands(next)}
          onSave={saveBrand}
          onDelete={(brand) =>
            runDelete(
              `Brand "${brand.name}"`,
              () => deleteBrand(brand.id),
              (d) => ({
                ...d,
                brands: d.brands.filter((b) => b.id !== brand.id),
                products: d.products.map((p) => (p.brandId === brand.id ? { ...p, brandId: null } : p)),
                featured: d.featured.map((p) => (p.brandId === brand.id ? { ...p, brandId: null } : p)),
              }),
            )
          }
        />
      )}

      {/* CARE INSTRUCTIONS TAB */}
      {data !== null && activeTab === 'care' && (
        <CareInstructionsTab
          items={data.careInstructions}
          busy={saving}
          onReorder={(next) => void reorderCare(next)}
          onSave={saveCare}
          onDelete={(item) =>
            runDelete(
              `Care instruction "${item.title}"`,
              () => deleteCareInstruction(item.id),
              (d) => ({
                ...d,
                careInstructions: d.careInstructions.filter((c) => c.id !== item.id),
                products: d.products.map((p) => (p.careInstructionId === item.id ? { ...p, careInstructionId: null } : p)),
                featured: d.featured.map((p) => (p.careInstructionId === item.id ? { ...p, careInstructionId: null } : p)),
              }),
            )
          }
        />
      )}

      {/* SIZE GUIDES TAB */}
      {data !== null && activeTab === 'sizeguides' && (
        <SizeGuidesTab
          items={data.sizeGuides}
          busy={saving}
          onSave={saveSizeGuide}
          onDelete={deleteSizeGuide}
        />
      )}

      {/* ATTRIBUTES TAB */}
      {data !== null && activeTab === 'attributes' && (
        <AttributesTab
          attributes={data.attributes}
          busy={saving}
          onSave={saveAttribute}
          onDelete={deleteAttributeHandler}
        />
      )}

      {/* PRODUCT CREATE/EDIT FULL MODAL */}
      {productModal && (
        <ProductUploadModal
          isOpen={true}
          mode={productModal.mode}
          product={productModal.product}
          categories={flatCategories}
          brands={data?.brands || []}
          attributes={data?.attributes || []}
          careInstructions={data?.careInstructions || []}
          sizeGuides={data?.sizeGuides || []}
          currency={currentStore.currency}
          onClose={() => setProductModal(null)}
          onSubmit={async (input) => {
            if (productModal.mode === 'create') {
              const created = await createProduct(input);
              setData((d) => (d ? { ...d, products: [created, ...d.products] } : d));
              return created;
            }
            if (productModal.mode === 'edit' && productModal.product) {
              const updated = await updateProduct(productModal.product.id, input);
              setData((d) =>
                d
                  ? {
                      ...d,
                      products: d.products.map((p) => (p.id === updated.id ? updated : p)),
                      featured: d.featured.map((p) => (p.id === updated.id ? updated : p)),
                    }
                  : d
              );
              return updated;
            }
            throw new Error('No product selected.');
          }}
        />
      )}

      {/* CONFIRM DELETE PRODUCT MODAL */}
      {deleteProductTarget && (
        <ConfirmDeleteModal
          isOpen={true}
          itemName={deleteProductTarget.title}
          itemType="Product"
          warningMessage="This product and its variants will be removed from your store catalogue."
          onClose={() => setDeleteProductTarget(null)}
          onConfirm={async () => {
            await deleteProduct(deleteProductTarget.id);
            setData((d) =>
              d
                ? {
                    ...d,
                    products: d.products.filter((p) => p.id !== deleteProductTarget.id),
                    featured: d.featured.filter((p) => p.id !== deleteProductTarget.id),
                  }
                : d
            );
            setDeleteProductTarget(null);
          }}
        />
      )}

      {/* CATEGORY CREATE/EDIT MODAL */}
      {categoryModal && (
        <RecordModal
          title={
            categoryModal.mode === 'create'
              ? categoryModal.parentId
                ? 'Add Subcategory'
                : 'Add Category'
              : `Edit Category: ${categoryModal.category?.name}`
          }
          submitLabel={categoryModal.mode === 'create' ? 'Create Category' : 'Save Changes'}
          onClose={() => setCategoryModal(null)}
          onSubmit={handleSaveCategory}
          maxWidth="760px"
        >
          {/* Sub-tabs header */}
          <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #e2e8f0', marginBottom: '16px', paddingBottom: '4px' }}>
            <button
              type="button"
              onClick={() => setCategoryTab('general')}
              style={{
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: categoryTab === 'general' ? '#0f172a' : '#f1f5f9',
                color: categoryTab === 'general' ? '#fff' : '#64748b',
                transition: 'all 0.15s ease',
              }}
            >
              General Info
            </button>
            <button
              type="button"
              onClick={() => setCategoryTab('seo')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 700,
                borderRadius: '6px',
                border: 'none',
                cursor: 'pointer',
                background: categoryTab === 'seo' ? '#0f172a' : '#f1f5f9',
                color: categoryTab === 'seo' ? '#fff' : '#64748b',
                transition: 'all 0.15s ease',
              }}
            >
              <span style={{ color: '#f59e0b' }}>⚡</span> Advanced SEO System
            </button>
          </div>

          {categoryTab === 'general' ? (
            <div className="form-grid">
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Category Name *</label>
                <input
                  className="form-input"
                  required
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                  placeholder="e.g. Men's Streetwear"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label className="form-label">Parent Category</label>
                <select
                  className="form-select"
                  value={categoryForm.parentId || ''}
                  onChange={(e) => setCategoryForm({ ...categoryForm, parentId: e.target.value || null })}
                >
                  <option value="">Top Level (Root)</option>
                  {flatCategories
                    .filter((c) => (categoryModal.category ? c.id !== categoryModal.category.id : true))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Slug</label>
                <input
                  className="form-input"
                  value={categoryForm.slug || ''}
                  onChange={(e) => setCategoryForm({ ...categoryForm, slug: e.target.value })}
                  placeholder="Auto-generated if blank"
                />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Category Description</label>
                <textarea
                  className="form-input"
                  rows={3}
                  value={categoryForm.description || ''}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  placeholder="Brief description of this collection..."
                />
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label className="form-label">Banner / Image (Upload or URL)</label>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    className="form-input"
                    style={{ flex: 1 }}
                    value={categoryForm.imageUrl || ''}
                    onChange={(e) => setCategoryForm({ ...categoryForm, imageUrl: e.target.value })}
                    placeholder="https://images.unsplash.com/... or upload an image"
                  />
                  <label
                    className="btn btn-secondary"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      cursor: isUploadingCategoryImage ? 'not-allowed' : 'pointer',
                      whiteSpace: 'nowrap',
                      opacity: isUploadingCategoryImage ? 0.6 : 1,
                    }}
                  >
                    <Upload size={14} />
                    <span>{isUploadingCategoryImage ? 'Uploading...' : 'Upload Image'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      disabled={isUploadingCategoryImage}
                      onChange={handleCategoryImageUpload}
                      style={{ display: 'none' }}
                    />
                  </label>
                </div>
                {categoryImageUploadError && (
                  <p style={{ color: '#e11d48', fontSize: '0.78rem', marginTop: '6px' }}>{categoryImageUploadError}</p>
                )}
                {categoryForm.imageUrl && (
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <img
                      src={categoryForm.imageUrl}
                      alt="Category preview"
                      style={{
                        width: '64px',
                        height: '64px',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setCategoryForm({ ...categoryForm, imageUrl: '' })}
                      className="btn btn-secondary"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '4px 10px' }}
                    >
                      <X size={12} />
                      <span>Remove</span>
                    </button>
                  </div>
                )}
              </div>

              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={categoryForm.isActive ?? true}
                    onChange={(e) => setCategoryForm({ ...categoryForm, isActive: e.target.checked })}
                  />
                  <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Active in storefront navigation</span>
                </label>
              </div>
            </div>
          ) : (
            <div style={{ marginBottom: '14px' }}>
              <AdvancedSeoEditor
                title={categoryForm.name}
                defaultSlug={
                  categoryForm.slug ||
                  categoryForm.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
                }
                storeName={currentStore.name}
                type={categoryForm.parentId ? 'subcategory' : 'category'}
                seo={{
                  metaTitle: categoryForm.metaTitle || '',
                  metaDescription: categoryForm.metaDescription || '',
                  focusKeyword: categoryForm.focusKeyword || '',
                  canonicalUrl: categoryForm.canonicalUrl || '',
                  metaRobots: categoryForm.metaRobots || 'index, follow',
                  ogImageUrl: categoryForm.ogImageUrl || '',
                }}
                onChange={(field, value) => setCategoryForm((prev) => ({ ...prev, [field]: value }))}
              />
            </div>
          )}
        </RecordModal>
      )}

      {/* CONFIRM DELETE CATEGORY MODAL */}
      {deleteCategoryTarget && (
        <ConfirmDeleteModal
          isOpen={true}
          itemName={deleteCategoryTarget.name}
          itemType="Category"
          warningMessage="Products in this category will have their category link unassigned."
          onClose={() => setDeleteCategoryTarget(null)}
          onConfirm={async () => {
            await deleteCategory(deleteCategoryTarget.id);
            const categories = await fetchCategories();
            setData((d) => (d ? { ...d, categories } : d));
            setDeleteCategoryTarget(null);
          }}
        />
      )}

      {/* CONFIRM DELETE ATTRIBUTE MODAL */}
      {deleteAttributeTarget && (
        <ConfirmDeleteModal
          isOpen={true}
          itemName={deleteAttributeTarget.name}
          itemType="Attribute"
          warningMessage="This attribute and its options will no longer be available when generating product variants."
          onClose={() => setDeleteAttributeTarget(null)}
          onConfirm={async () => {
            await deleteAttribute(deleteAttributeTarget.id);
            const attributes = await fetchAttributes();
            setData((d) => (d ? { ...d, attributes } : d));
            setDeleteAttributeTarget(null);
          }}
        />
      )}
    </div>
  );
};

interface CategoryTreeGroupProps {
  nodes: CatalogCategory[];
  parentId: string | null;
  disabled: boolean;
  onReorder: (parentId: string | null, next: CatalogCategory[]) => void;
  onEdit: (c: CatalogCategory) => void;
  onDelete: (c: CatalogCategory) => void;
  onAddSub: (c: CatalogCategory) => void;
}

const CategoryTreeGroup: React.FC<CategoryTreeGroupProps> = ({
  nodes,
  parentId,
  disabled,
  onReorder,
  onEdit,
  onDelete,
  onAddSub,
}) => (
  <SortableList
    label={parentId === null ? 'Categories' : 'Subcategories'}
    items={nodes}
    getId={(c) => c.id}
    disabled={disabled}
    onReorder={(next) => onReorder(parentId, next)}
    renderItem={(category, row) => (
      <>
        <div className="sortable-line">
          {row.controls}
          <div className="sortable-main">
            <strong>{category.name}</strong>
            <span className="sortable-sub mono">{category.slug}</span>
          </div>
          <span className={`badge ${category.isActive ? 'badge-active' : 'badge-outline'}`}>
            {category.isActive ? 'Active' : 'Inactive'}
          </span>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            title="Add Subcategory"
            onClick={() => onAddSub(category)}
          >
            <Plus size={12} /> Sub
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            title="Edit Category"
            onClick={() => onEdit(category)}
          >
            <Pencil size={12} />
          </button>
          <button
            type="button"
            className="btn btn-sm"
            style={{ color: '#dc2626', borderColor: '#fca5a5' }}
            title="Delete Category"
            onClick={() => onDelete(category)}
          >
            <Trash2 size={12} />
          </button>
        </div>
        {category.children.length > 0 && (
          <div className="sortable-nested">
            <CategoryTreeGroup
              nodes={category.children}
              parentId={category.id}
              disabled={disabled}
              onReorder={onReorder}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddSub={onAddSub}
            />
          </div>
        )}
      </>
    )}
  />
);

function countCategories(tree: CatalogCategory[]): number {
  return tree.reduce((sum, node) => sum + 1 + countCategories(node.children), 0);
}
