import React, { useState } from 'react';
import {
  Package,
  Plus,
  Search,
  Tag,
  Sparkles,
  Trash2,
  Layers,
  Sliders,
  CheckCircle2,
  Pencil,
  Award,
  Globe,
  ExternalLink,
  ShieldCheck,
  Image as ImageIcon,
  Check,
  Star,
  AlertTriangle,
  RefreshCw,
  X,
  ChevronDown,
  ChevronUp,
  Clock,
} from 'lucide-react';
import { GoogleSerpPreview } from './GoogleSerpPreview';
import {
  StoreProduct,
  StoreBrand,
  StoreCategory,
  StoreAttribute,
  ProductBrand,
  CareInstruction,
  ProductVariant
} from '../types/store';
import { EditProductModal } from './EditProductModal';
import { EditCategoryModal } from './EditCategoryModal';
import { EditAttributeModal } from './EditAttributeModal';
import { EditBrandModal } from './EditBrandModal';
import { EditCareInstructionModal } from './EditCareInstructionModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface CatalogViewProps {
  currentStore: StoreBrand;
  products: StoreProduct[];
  categories: StoreCategory[];
  attributes: StoreAttribute[];
  brands: ProductBrand[];
  careInstructions: CareInstruction[];
  onAddProduct: (product: StoreProduct) => void;
  onUpdateProduct: (product: StoreProduct) => void;
  onDeleteProduct: (productId: string) => void;
  onAddCategory: (category: StoreCategory) => void;
  onUpdateCategory: (category: StoreCategory) => void;
  onDeleteCategory: (categoryId: string) => void;
  onAddAttribute: (attribute: StoreAttribute) => void;
  onUpdateAttribute: (attribute: StoreAttribute) => void;
  onDeleteAttribute: (attributeId: string) => void;
  onAddBrand: (brand: ProductBrand) => void;
  onUpdateBrand: (brand: ProductBrand) => void;
  onDeleteBrand: (brandId: string) => void;
  onAddCareInstruction: (instruction: CareInstruction) => void;
  onUpdateCareInstruction: (instruction: CareInstruction) => void;
  onDeleteCareInstruction: (instructionId: string) => void;
}

export const CatalogView: React.FC<CatalogViewProps> = ({
  currentStore,
  products,
  categories,
  attributes,
  brands,
  careInstructions,
  onAddProduct,
  onUpdateProduct,
  onDeleteProduct,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onAddAttribute,
  onUpdateAttribute,
  onDeleteAttribute,
  onAddBrand,
  onUpdateBrand,
  onDeleteBrand,
  onAddCareInstruction,
  onUpdateCareInstruction,
  onDeleteCareInstruction,
}) => {
  // Navigation tabs: products, categories, attributes, brands, care
  const [activeCatalogTab, setActiveCatalogTab] = useState<'products' | 'categories' | 'attributes' | 'brands' | 'care'>('products');

  // Modals visibility
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isAttributeModalOpen, setIsAttributeModalOpen] = useState(false);
  const [isBrandModalOpen, setIsBrandModalOpen] = useState(false);
  const [isCareModalOpen, setIsCareModalOpen] = useState(false);

  // Edit / Delete State for Universal CRUD Governance
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<StoreProduct | null>(null);

  const [editingCategory, setEditingCategory] = useState<StoreCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<StoreCategory | null>(null);

  const [editingAttribute, setEditingAttribute] = useState<StoreAttribute | null>(null);
  const [deletingAttribute, setDeletingAttribute] = useState<StoreAttribute | null>(null);

  const [editingBrand, setEditingBrand] = useState<ProductBrand | null>(null);
  const [deletingBrand, setDeletingBrand] = useState<ProductBrand | null>(null);

  const [editingCare, setEditingCare] = useState<CareInstruction | null>(null);
  const [deletingCare, setDeletingCare] = useState<CareInstruction | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // ==========================================
  // New Product Form State (Advanced Creation)
  // ==========================================
  const [title, setTitle] = useState('');
  const [sku, setSku] = useState('');
  const [price, setPrice] = useState('');
  const [comparePrice, setComparePrice] = useState('');
  const [category, setCategory] = useState('');
  const [inventoryCount, setInventoryCount] = useState('25');
  const [description, setDescription] = useState('');

  // Toggles requested by user
  const [isLiveActive, setIsLiveActive] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);
  const [isSoldOut, setIsSoldOut] = useState(false);

  // Brand & Care Instruction assignment
  const [selectedBrandId, setSelectedBrandId] = useState('');
  const [selectedCareId, setSelectedCareId] = useState('');

  // Product 100% SEO Fields
  const [showProdSeo, setShowProdSeo] = useState(false);
  const [prodMetaTitle, setProdMetaTitle] = useState('');
  const [prodMetaDesc, setProdMetaDesc] = useState('');
  const [prodFocusKeyword, setProdFocusKeyword] = useState('');
  const [prodCanonicalUrl, setProdCanonicalUrl] = useState('');
  const [prodMetaRobots, setProdMetaRobots] = useState('index, follow');
  const [prodOgImageUrl, setProdOgImageUrl] = useState('');

  // Single vs Variable Product switch
  const [productType, setProductType] = useState<'SINGLE' | 'VARIABLE'>('SINGLE');

  // Media gallery for product
  const [productImages, setProductImages] = useState<string[]>([
    'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=600&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=600&auto=format&fit=crop&q=80'
  ]);
  const [imageInputUrl, setImageInputUrl] = useState('');

  // Variable product attribute selections & generated matrix
  // selectedAttrValues maps attribute.code -> array of value strings
  const [selectedAttrValues, setSelectedAttrValues] = useState<Record<string, string[]>>({});
  const [generatedVariants, setGeneratedVariants] = useState<ProductVariant[]>([]);

  // ==========================================
  // New Brand Form State
  // ==========================================
  const [brandName, setBrandName] = useState('');
  const [brandSlug, setBrandSlug] = useState('');
  const [brandLogo, setBrandLogo] = useState('');
  const [brandOrigin, setBrandOrigin] = useState('');
  const [brandDesc, setBrandDesc] = useState('');
  const [brandWebsite, setBrandWebsite] = useState('');

  // ==========================================
  // New Care Instruction Form State
  // ==========================================
  const [careTitle, setCareTitle] = useState('');
  const [careMaterial, setCareMaterial] = useState('');
  const [careBulletsText, setCareBulletsText] = useState('Dry clean recommended or gentle hand wash\nDry flat on clean towel away from heat\nSteam iron on reverse using lowest heat');
  const [careSummary, setCareSummary] = useState('');

  // ==========================================
  // New Category & Attribute Form State
  // ==========================================
  const [catName, setCatName] = useState('');
  const [catDesc, setCatDesc] = useState('');
  const [showCatSeo, setShowCatSeo] = useState(false);
  const [catMetaTitle, setCatMetaTitle] = useState('');
  const [catMetaDesc, setCatMetaDesc] = useState('');
  const [catFocusKeyword, setCatFocusKeyword] = useState('');
  const [catCanonicalUrl, setCatCanonicalUrl] = useState('');
  const [catMetaRobots, setCatMetaRobots] = useState('index, follow');

  const [attrName, setAttrName] = useState('');
  const [attrCode, setAttrCode] = useState('');
  const [attrType, setAttrType] = useState<'SELECT' | 'COLOR_SWATCH' | 'BUTTON'>('BUTTON');
  const [attrValuesText, setAttrValuesText] = useState('S, M, L, XL');

  // Filtering products
  const filteredProducts = products.filter((p) => {
    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
    const matchesSearch =
      p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.brandName && p.brandName.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // Handle adding image to product media gallery
  const handleAddProductImage = () => {
    if (imageInputUrl.trim()) {
      setProductImages([...productImages, imageInputUrl.trim()]);
      setImageInputUrl('');
    }
  };

  const handleRemoveProductImage = (idx: number) => {
    setProductImages(productImages.filter((_, i) => i !== idx));
  };

  // Toggle attribute value selection for variable products
  const handleToggleAttrValue = (attrCode: string, valStr: string) => {
    setSelectedAttrValues((prev) => {
      const currentList = prev[attrCode] || [];
      if (currentList.includes(valStr)) {
        return { ...prev, [attrCode]: currentList.filter((v) => v !== valStr) };
      } else {
        return { ...prev, [attrCode]: [...currentList, valStr] };
      }
    });
  };

  // Cartesian Product Generator for Variation Matrix
  const handleGenerateVariations = () => {
    const baseSkuClean = sku.trim().toUpperCase() || 'PROD';
    const basePriceNum = parseFloat(price) || 0;

    // Filter attributes that have at least one value selected
    const activeEntries = Object.entries(selectedAttrValues).filter(([_, vals]) => vals.length > 0);

    if (activeEntries.length === 0) {
      // Fallback: If no attributes selected, generate S, M, L
      const defaults = ['S', 'M', 'L'];
      const generated: ProductVariant[] = defaults.map((size, idx) => ({
        id: `v-auto-${Date.now()}-${idx}`,
        sku: `${baseSkuClean}-${size}`,
        title: `${title || 'Product'} — ${size}`,
        price: basePriceNum,
        inventoryCount: 10,
        attributes: { Size: size },
        imageUrl: productImages[idx % productImages.length] || productImages[0] || '',
      }));
      setGeneratedVariants(generated);
      return;
    }

    // Cartesian product algorithm
    const cartesian = (arrays: string[][]): string[][] => {
      return arrays.reduce(
        (acc, curr) => acc.flatMap((c) => curr.map((n) => [...c, n])),
        [[]] as string[][]
      );
    };

    const keys = activeEntries.map(([k]) => k);
    const valueLists = activeEntries.map(([_, v]) => v);
    const combinations = cartesian(valueLists);

    const generated: ProductVariant[] = combinations.map((combo, idx) => {
      const attrMap: Record<string, string> = {};
      combo.forEach((val, i) => {
        attrMap[keys[i]] = val;
      });

      const comboSuffix = combo.map((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '')).join('-');
      const comboTitle = combo.join(' / ');

      return {
        id: `v-gen-${Date.now()}-${idx}`,
        sku: `${baseSkuClean}-${comboSuffix}`,
        title: `${title || 'Product'} — ${comboTitle}`,
        price: basePriceNum,
        inventoryCount: 10,
        attributes: attrMap,
        imageUrl: productImages[idx % productImages.length] || productImages[0] || '',
      };
    });

    setGeneratedVariants(generated);
  };

  const handleUpdateGeneratedVariant = (idx: number, field: keyof ProductVariant, val: any) => {
    setGeneratedVariants((prev) => {
      const copy = [...prev];
      copy[idx] = { ...copy[idx], [field]: val };
      return copy;
    });
  };

  const handleRemoveGeneratedVariant = (idx: number) => {
    setGeneratedVariants(generatedVariants.filter((_, i) => i !== idx));
  };

  // Submit New Product
  const handleSubmitProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !sku.trim() || !price) return;

    const basePriceNum = parseFloat(price);
    const selectedBrand = brands.find((b) => b.id === selectedBrandId);
    const selectedCare = careInstructions.find((c) => c.id === selectedCareId);

    const finalVariants = productType === 'VARIABLE' ? generatedVariants : [];
    const totalInventory =
      productType === 'VARIABLE' && finalVariants.length > 0
        ? finalVariants.reduce((sum, v) => sum + (v.inventoryCount || 0), 0)
        : parseInt(inventoryCount, 10) || 0;

    const newProd: StoreProduct = {
      id: `prod-${Date.now()}`,
      title: title.trim(),
      slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      sku: sku.trim().toUpperCase(),
      price: basePriceNum,
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
      description: description.trim(),
      images: productImages,
      imageUrl: productImages[0] || 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=600&auto=format&fit=crop&q=80',
      createdAt: new Date().toISOString().split('T')[0],
      variants: finalVariants,
      metaTitle: prodMetaTitle.trim() || title.trim(),
      metaDescription: prodMetaDesc.trim() || description.trim(),
      focusKeyword: prodFocusKeyword.trim() || title.toLowerCase().trim(),
      canonicalUrl: prodCanonicalUrl.trim(),
      metaRobots: prodMetaRobots.trim(),
      ogImageUrl: prodOgImageUrl.trim() || productImages[0] || '',
    };

    onAddProduct(newProd);
    setIsModalOpen(false);

    // Reset Form
    setTitle('');
    setSku('');
    setPrice('');
    setComparePrice('');
    setCategory('');
    setInventoryCount('25');
    setDescription('');
    setIsLiveActive(true);
    setIsFeatured(false);
    setIsSoldOut(false);
    setSelectedBrandId('');
    setSelectedCareId('');
    setProductType('SINGLE');
    setSelectedAttrValues({});
    setGeneratedVariants([]);
    setProdMetaTitle('');
    setProdMetaDesc('');
    setProdFocusKeyword('');
    setProdCanonicalUrl('');
    setProdMetaRobots('index, follow');
    setProdOgImageUrl('');
  };

  // Submit New Brand
  const handleCreateBrand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandName.trim()) return;

    const newBrand: ProductBrand = {
      id: `brand-${Date.now()}`,
      name: brandName.trim(),
      slug: (brandSlug.trim() || brandName).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      logoUrl: brandLogo.trim() || 'https://images.unsplash.com/photo-1544441893-675973e31985?w=120&auto=format&fit=crop&q=80',
      origin: brandOrigin.trim() || 'Bangladesh',
      description: brandDesc.trim(),
      websiteUrl: brandWebsite.trim(),
      productCount: 0,
      isActive: true,
    };

    onAddBrand(newBrand);
    setIsBrandModalOpen(false);
    setBrandName('');
    setBrandSlug('');
    setBrandLogo('');
    setBrandOrigin('');
    setBrandDesc('');
    setBrandWebsite('');
  };

  // Submit New Care Instruction
  const handleCreateCareInstruction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!careTitle.trim() || !careMaterial.trim()) return;

    const bullets = careBulletsText
      .split('\n')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const newCare: CareInstruction = {
      id: `care-${Date.now()}`,
      title: careTitle.trim(),
      materialCategory: careMaterial.trim(),
      instructions: bullets.length > 0 ? bullets : ['Follow standard garment care instructions.'],
      description: careSummary.trim(),
      careSymbols: ['hand-wash', 'dry-flat', 'iron-low'],
      isActive: true,
    };

    onAddCareInstruction(newCare);
    setIsCareModalOpen(false);
    setCareTitle('');
    setCareMaterial('');
    setCareBulletsText('');
    setCareSummary('');
  };

  // Submit New Category
  const handleCreateCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;

    const newCat: StoreCategory = {
      id: `cat-${Date.now()}`,
      name: catName.trim(),
      slug: catName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      description: catDesc.trim(),
      productCount: 0,
      displayOrder: categories.length + 1,
      isActive: true,
      metaTitle: catMetaTitle.trim() || `${catName.trim()} Collection`,
      metaDescription: catMetaDesc.trim() || catDesc.trim(),
      focusKeyword: catFocusKeyword.trim() || catName.toLowerCase().trim(),
      canonicalUrl: catCanonicalUrl.trim(),
      metaRobots: catMetaRobots.trim(),
    };

    onAddCategory(newCat);
    setIsCategoryModalOpen(false);
    setCatName('');
    setCatDesc('');
    setCatMetaTitle('');
    setCatMetaDesc('');
    setCatFocusKeyword('');
    setCatCanonicalUrl('');
    setCatMetaRobots('index, follow');
  };

  // Submit New Attribute
  const handleCreateAttribute = (e: React.FormEvent) => {
    e.preventDefault();
    if (!attrName.trim() || !attrCode.trim()) return;

    const vals = attrValuesText
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0)
      .map((v, i) => ({
        id: `val-${Date.now()}-${i}`,
        value: v.toLowerCase(),
        displayValue: v,
        colorHex: attrType === 'COLOR_SWATCH' ? '#047857' : undefined,
      }));

    const newAttr: StoreAttribute = {
      id: `attr-${Date.now()}`,
      name: attrName.trim(),
      code: attrCode.trim().toLowerCase(),
      displayType: attrType,
      values: vals,
    };

    onAddAttribute(newAttr);
    setIsAttributeModalOpen(false);
    setAttrName('');
    setAttrCode('');
  };

  return (
    <div>
      {/* Top Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
            Catalog, Taxonomies & Brands
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
            Product inventory, categories, and brand collections for <strong>{currentStore.name}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {activeCatalogTab === 'products' && (
            <button onClick={() => setIsModalOpen(true)} className="btn btn-primary btn-sm">
              <Plus size={15} />
              <span>Add Product</span>
            </button>
          )}
          {activeCatalogTab === 'categories' && (
            <button onClick={() => setIsCategoryModalOpen(true)} className="btn btn-primary btn-sm">
              <Plus size={15} />
              <span>Create Category</span>
            </button>
          )}
          {activeCatalogTab === 'attributes' && (
            <button onClick={() => setIsAttributeModalOpen(true)} className="btn btn-primary btn-sm">
              <Plus size={15} />
              <span>Define Attribute</span>
            </button>
          )}
          {activeCatalogTab === 'brands' && (
            <button onClick={() => setIsBrandModalOpen(true)} className="btn btn-primary btn-sm">
              <Plus size={15} />
              <span>Add Brand</span>
            </button>
          )}
          {activeCatalogTab === 'care' && (
            <button onClick={() => setIsCareModalOpen(true)} className="btn btn-primary btn-sm">
              <Plus size={15} />
              <span>Create Care Guide</span>
            </button>
          )}
        </div>
      </div>

      {/* Catalog Overview Metrics - 7 Column Box Card Design */}
      <div className="stats-grid">
        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Total SKUs</div>
            <div className="stat-val">{products.length}</div>
            <div className="stat-sub" style={{ color: '#0284c7', fontWeight: 600 }}>
              <Package size={11} /> All inventory
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#f0f9ff', color: '#0284c7' }}>
            <Package size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Active Live</div>
            <div className="stat-val" style={{ color: '#059669' }}>
              {products.filter((p) => p.status === 'ACTIVE').length}
            </div>
            <div className="stat-sub" style={{ color: '#10b981' }}>
              <CheckCircle2 size={11} /> Published
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
            <CheckCircle2 size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Draft Staged</div>
            <div className="stat-val" style={{ color: products.filter((p) => p.status === 'DRAFT').length > 0 ? '#f59e0b' : 'var(--text-main)' }}>
              {products.filter((p) => p.status === 'DRAFT').length}
            </div>
            <div className="stat-sub" style={{ color: '#d97706' }}>
              <Clock size={11} /> Unpublished
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
            <Clock size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Featured</div>
            <div className="stat-val" style={{ color: '#6366f1' }}>
              {products.filter((p) => p.isFeatured).length}
            </div>
            <div className="stat-sub" style={{ color: '#6366f1' }}>
              <Sparkles size={11} /> Home hero
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#eef2ff', color: '#6366f1' }}>
            <Sparkles size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Categories</div>
            <div className="stat-val">{categories.length}</div>
            <div className="stat-sub" style={{ color: '#64748b' }}>
              <Layers size={11} /> Taxonomies
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#f1f5f9', color: '#64748b' }}>
            <Layers size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Brands</div>
            <div className="stat-val">{brands.length}</div>
            <div className="stat-sub" style={{ color: '#059669' }}>
              <Award size={11} /> Ateliers
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
            <Award size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Avg Price</div>
            <div className="stat-val">
              ৳{Math.round(products.reduce((sum, p) => sum + (p.price || 0), 0) / (products.length || 1)).toLocaleString()}
            </div>
            <div className="stat-sub" style={{ color: '#64748b' }}>
              <Tag size={11} /> Per SKU
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#f8fafc', color: '#475569' }}>
            <Tag size={16} />
          </div>
        </div>
      </div>

      {/* Sub-Tabs Navigation Bar */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '12px', paddingBottom: '8px', overflowX: 'auto' }}>
        <button
          onClick={() => setActiveCatalogTab('products')}
          className={`btn btn-sm ${activeCatalogTab === 'products' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.8rem', padding: '5px 12px' }}
        >
          <Package size={14} />
          <span>Products & Matrix ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveCatalogTab('categories')}
          className={`btn btn-sm ${activeCatalogTab === 'categories' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.8rem', padding: '5px 12px' }}
        >
          <Layers size={14} />
          <span>Categories & Taxonomies ({categories.length})</span>
        </button>

        <button
          onClick={() => setActiveCatalogTab('attributes')}
          className={`btn btn-sm ${activeCatalogTab === 'attributes' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.8rem', padding: '5px 12px' }}
        >
          <Sliders size={14} />
          <span>Attributes & Swatches ({attributes.length})</span>
        </button>

        <button
          onClick={() => setActiveCatalogTab('brands')}
          className={`btn btn-sm ${activeCatalogTab === 'brands' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.8rem', padding: '5px 12px' }}
        >
          <Award size={14} />
          <span>Brands & Manufacturers ({brands.length})</span>
        </button>

        <button
          onClick={() => setActiveCatalogTab('care')}
          className={`btn btn-sm ${activeCatalogTab === 'care' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.8rem', padding: '5px 12px' }}
        >
          <Sparkles size={14} />
          <span>Care Instructions ({careInstructions.length})</span>
        </button>
      </div>

      {/* ========================================================
          1. PRODUCTS & VARIATION MATRIX SUB-TAB
         ======================================================== */}
      {activeCatalogTab === 'products' && (
        <>
          <div className="card" style={{ padding: '10px 14px', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
                <Search size={15} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--text-subtle)' }} />
                <input
                  type="text"
                  placeholder="Search products by title, SKU, or brand..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-input"
                  style={{ paddingLeft: '32px', width: '100%', height: '32px', fontSize: '0.82rem' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>Category:</span>
                <button
                  onClick={() => setSelectedCategory('ALL')}
                  className={`btn btn-sm ${selectedCategory === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                >
                  All ({products.length})
                </button>
                {categories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCategory(c.name)}
                    className={`btn btn-sm ${selectedCategory === c.name ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Desktop Table View (>= 768px) */}
            <div className="desktop-table-view table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product & Brand</th>
                    <th>SKU & Structure</th>
                    <th>Category</th>
                    <th>Base Price</th>
                    <th>Inventory Status</th>
                    <th>Badges</th>
                    <th>Care Guide</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-subtle)' }}>
                        No products match the criteria. Click "Add Product" to create one.
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)', background: '#f8fafc', flexShrink: 0 }}>
                              <img
                                src={p.imageUrl || (p.images && p.images[0]) || 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=600&auto=format&fit=crop&q=80'}
                                alt=""
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.82rem' }}>{p.title}</div>
                              {p.brandName && (
                                <div style={{ fontSize: '0.68rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                                  <Award size={11} />
                                  <span>{p.brandName}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        <td>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.74rem', fontWeight: 600 }}>{p.sku}</div>
                          <div style={{ fontSize: '0.68rem', color: 'var(--text-subtle)' }}>
                            {p.productType === 'VARIABLE' ? `⚡ Variable (${p.variants?.length || 0} SKUs)` : '📦 Single Product'}
                          </div>
                        </td>

                        <td>
                          <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                            {p.category}
                          </span>
                        </td>

                        <td>
                          <div style={{ fontWeight: 800, fontSize: '0.82rem', color: 'var(--text-main)' }}>
                            ৳{p.price.toLocaleString()}
                          </div>
                          {p.compareAtPrice && (
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', textDecoration: 'line-through' }}>
                              ৳{p.compareAtPrice.toLocaleString()}
                            </div>
                          )}
                        </td>

                        <td>
                          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: p.isSoldOut || p.inventoryCount === 0 ? '#ef4444' : p.inventoryCount < 10 ? '#f59e0b' : '#10b981' }}>
                            {p.isSoldOut || p.inventoryCount === 0 ? '⛔ Sold Out' : `${p.inventoryCount} units`}
                          </div>
                        </td>

                        <td>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            <span className={`badge ${p.status === 'ACTIVE' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.66rem' }}>
                              {p.status}
                            </span>
                            {p.isFeatured && (
                              <span className="badge" style={{ backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontSize: '0.66rem' }}>
                                ★ Featured
                              </span>
                            )}
                          </div>
                        </td>

                        <td>
                          {p.careInstructionTitle ? (
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                              <Sparkles size={11} color="var(--primary)" />
                              <span>{p.careInstructionTitle}</span>
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.68rem', color: 'var(--text-subtle)' }}>—</span>
                          )}
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              onClick={() => setEditingProduct(p)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                              title="Edit product specs"
                            >
                              <Pencil size={13} />
                              <span>Edit</span>
                            </button>
                            <button
                              onClick={() => setDeletingProduct(p)}
                              className="btn btn-danger btn-sm"
                              style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                              title="Delete product"
                            >
                              <Trash2 size={13} />
                              <span>Delete</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards Stack View (< 768px Viewports) */}
            <div className="mobile-cards-view" style={{ padding: '12px' }}>
              {filteredProducts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-subtle)' }}>
                  No products match the criteria. Click "Add Product" to create one.
                </div>
              ) : (
                filteredProducts.map((p) => (
                  <div key={p.id} className="mobile-data-card">
                    {/* Header: Image, Title, Brand, Badges */}
                    <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '10px' }}>
                      <div
                        style={{
                          width: '56px',
                          height: '56px',
                          borderRadius: 'var(--radius-sm)',
                          overflow: 'hidden',
                          border: '1px solid var(--border)',
                          background: '#f8fafc',
                          flexShrink: 0,
                        }}
                      >
                        <img
                          src={p.imageUrl || (p.images && p.images[0]) || 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=600&auto=format&fit=crop&q=80'}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.92rem', lineHeight: 1.25 }}>
                          {p.title}
                        </div>
                        {p.brandName && (
                          <div style={{ fontSize: '0.72rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '3px' }}>
                            <Award size={12} />
                            <span>{p.brandName}</span>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                          <span className={`badge ${p.status === 'ACTIVE' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.66rem' }}>
                            {p.status}
                          </span>
                          {p.isFeatured && (
                            <span className="badge" style={{ backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontSize: '0.66rem' }}>
                              ★ Featured
                            </span>
                          )}
                          <span className="badge badge-secondary" style={{ fontSize: '0.66rem' }}>
                            {p.category}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Metadata: Price, Inventory, SKU */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '10px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', fontSize: '0.78rem' }}>
                      <div>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', textTransform: 'uppercase', display: 'block' }}>Base Price</span>
                        <div style={{ fontWeight: 800, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                          ৳{p.price.toLocaleString()}
                          {p.compareAtPrice && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', textDecoration: 'line-through', marginLeft: '6px' }}>
                              ৳{p.compareAtPrice.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', textTransform: 'uppercase', display: 'block' }}>Stock Status</span>
                        <div style={{ fontWeight: 700, color: p.isSoldOut || p.inventoryCount === 0 ? '#ef4444' : p.inventoryCount < 10 ? '#f59e0b' : '#10b981' }}>
                          {p.isSoldOut || p.inventoryCount === 0 ? '⛔ Sold Out' : `${p.inventoryCount} units available`}
                        </div>
                      </div>
                      <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          SKU: {p.sku} • {p.productType === 'VARIABLE' ? `Variable (${p.variants?.length || 0} variants)` : 'Single'}
                        </span>
                        {p.careInstructionTitle && (
                          <span style={{ fontSize: '0.68rem', color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                            <Sparkles size={11} /> {p.careInstructionTitle}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Touch-compliant action buttons (min-height 44px) */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingTop: '10px' }}>
                      <button
                        onClick={() => setEditingProduct(p)}
                        className="btn btn-secondary touch-btn"
                        style={{ width: '100%' }}
                        aria-label={`Edit ${p.title}`}
                      >
                        <Pencil size={15} style={{ marginRight: '6px' }} />
                        <span>Edit Specs</span>
                      </button>
                      <button
                        onClick={() => setDeletingProduct(p)}
                        className="btn btn-danger touch-btn"
                        style={{ width: '100%' }}
                        aria-label={`Delete ${p.title}`}
                      >
                        <Trash2 size={15} style={{ marginRight: '6px' }} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}

      {/* ========================================================
          2. BRANDS & MANUFACTURERS SUB-TAB (NEW!)
         ======================================================== */}
      {activeCatalogTab === 'brands' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Configure product brands, manufacturers, and ateliers with logos shown across catalog and storefront product pages.
            </span>
            <button onClick={() => setIsBrandModalOpen(true)} className="btn btn-primary btn-sm">
              <Plus size={14} />
              <span>Add Brand</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
            {brands.map((b) => (
              <div key={b.id} className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                    <div style={{ width: '48px', height: '48px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--border)', background: '#fff', flexShrink: 0 }}>
                      <img src={b.logoUrl} alt={b.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as any).src = 'https://images.unsplash.com/photo-1544441893-675973e31985?w=120&auto=format&fit=crop&q=80'; }} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: 'var(--text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {b.name}
                        </h3>
                        <span className={`badge ${b.isActive ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.64rem' }}>
                          {b.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                        <Globe size={11} />
                        <span>{b.origin || 'Global'}</span>
                      </div>
                    </div>
                  </div>

                  <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '0 0 12px 0', lineHeight: 1.4 }}>
                    {b.description || 'No description provided.'}
                  </p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>
                    {products.filter((p) => p.brandId === b.id || p.brandName === b.name).length} linked products
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => setEditingBrand(b)}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                    >
                      <Pencil size={12} />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => setDeletingBrand(b)}
                      className="btn btn-danger btn-sm"
                      style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                    >
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ========================================================
          3. CARE INSTRUCTIONS SUB-TAB (NEW!)
         ======================================================== */}
      {activeCatalogTab === 'care' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Define material care instructions, washing guidelines, and fabric preservation tips selectable in product uploads.
            </span>
            <button onClick={() => setIsCareModalOpen(true)} className="btn btn-primary btn-sm">
              <Plus size={14} />
              <span>Create Care Guide</span>
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: '14px' }}>
            {careInstructions.map((c) => (
              <div key={c.id} className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sparkles size={15} color="var(--primary)" />
                      <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                        {c.title}
                      </h3>
                    </div>
                    <span className="badge badge-secondary" style={{ fontSize: '0.66rem' }}>
                      {c.materialCategory}
                    </span>
                  </div>

                  {c.description && (
                    <p style={{ fontSize: '0.74rem', color: 'var(--text-muted)', margin: '0 0 10px 0', fontStyle: 'italic' }}>
                      {c.description}
                    </p>
                  )}

                  <div style={{ background: 'var(--bg-main)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '12px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px' }}>
                      Care Bullet Guidelines:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '0.74rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                      {c.instructions.map((inst, i) => (
                        <li key={i}>{inst}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                  <span className={`badge ${c.isActive ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.64rem' }}>
                    {c.isActive ? 'Ready for Products' : 'Inactive'}
                  </span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => setEditingCare(c)}
                      className="btn btn-secondary btn-sm"
                      style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                    >
                      <Pencil size={12} />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => setDeletingCare(c)}
                      className="btn btn-danger btn-sm"
                      style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                    >
                      <Trash2 size={12} />
                      <span>Delete</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ========================================================
          4. CATEGORIES SUB-TAB
         ======================================================== */}
      {activeCatalogTab === 'categories' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Desktop Table View */}
          <div className="desktop-table-view table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Category Name</th>
                  <th>Slug Identifier</th>
                  <th>Description</th>
                  <th>Display Order</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.84rem' }}>{c.name}</div>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.74rem', color: 'var(--text-subtle)' }}>/{c.slug}</code>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{c.description || '—'}</span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.76rem', fontWeight: 600 }}>#{c.displayOrder}</span>
                    </td>
                    <td>
                      <span className={`badge ${c.isActive ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.68rem' }}>
                        {c.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          onClick={() => setEditingCategory(c)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                        >
                          <Pencil size={13} />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => setDeletingCategory(c)}
                          className="btn btn-danger btn-sm"
                          style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                        >
                          <Trash2 size={13} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards Stack View (< 768px) */}
          <div className="mobile-cards-view" style={{ padding: '12px' }}>
            {categories.map((c) => (
              <div key={c.id} className="mobile-data-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-main)' }}>{c.name}</span>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-subtle)', marginTop: '2px' }}>
                      /{c.slug}
                    </div>
                  </div>
                  <span className={`badge ${c.isActive ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '0.68rem' }}>
                    {c.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  {c.description || 'No description provided.'}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.72rem', color: 'var(--text-subtle)', borderTop: '1px solid var(--border)', paddingTop: '8px' }}>
                  <span>Display Priority: <strong>#{c.displayOrder}</strong></span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingTop: '10px' }}>
                  <button onClick={() => setEditingCategory(c)} className="btn btn-secondary touch-btn" style={{ width: '100%' }}>
                    <Pencil size={14} style={{ marginRight: '6px' }} />
                    <span>Edit</span>
                  </button>
                  <button onClick={() => setDeletingCategory(c)} className="btn btn-danger touch-btn" style={{ width: '100%' }}>
                    <Trash2 size={14} style={{ marginRight: '6px' }} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================
          5. ATTRIBUTES SUB-TAB
         ======================================================== */}
      {activeCatalogTab === 'attributes' && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Desktop Table View */}
          <div className="desktop-table-view table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Attribute Name</th>
                  <th>Code Key</th>
                  <th>Swatch Style</th>
                  <th>Configured Values</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {attributes.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.84rem' }}>{a.name}</div>
                    </td>
                    <td>
                      <code style={{ fontSize: '0.74rem', color: 'var(--text-subtle)' }}>{a.code}</code>
                    </td>
                    <td>
                      <span className="badge badge-secondary" style={{ fontSize: '0.68rem' }}>
                        {a.displayType}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {a.values.map((v) => (
                          <span
                            key={v.id}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              padding: '2px 6px',
                              background: 'var(--bg-main)',
                              border: '1px solid var(--border)',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                            }}
                          >
                            {v.colorHex && (
                              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: v.colorHex }} />
                            )}
                            <span>{v.displayValue}</span>
                          </span>
                        ))}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button
                          onClick={() => setEditingAttribute(a)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                        >
                          <Pencil size={13} />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => setDeletingAttribute(a)}
                          className="btn btn-danger btn-sm"
                          style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                        >
                          <Trash2 size={13} />
                          <span>Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards Stack View (< 768px) */}
          <div className="mobile-cards-view" style={{ padding: '12px' }}>
            {attributes.map((a) => (
              <div key={a.id} className="mobile-data-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <div>
                    <span style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-main)' }}>{a.name}</span>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem', color: 'var(--text-subtle)', marginTop: '2px' }}>
                      Key: {a.code}
                    </div>
                  </div>
                  <span className="badge badge-secondary" style={{ fontSize: '0.68rem' }}>
                    {a.displayType}
                  </span>
                </div>

                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', padding: '8px 0', borderTop: '1px solid var(--border)' }}>
                  {a.values.map((v) => (
                    <span
                      key={v.id}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '5px',
                        padding: '3px 8px',
                        background: 'var(--bg-main)',
                        border: '1px solid var(--border)',
                        borderRadius: '4px',
                        fontSize: '0.74rem',
                      }}
                    >
                      {v.colorHex && (
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: v.colorHex }} />
                      )}
                      <span>{v.displayValue}</span>
                    </span>
                  ))}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingTop: '10px' }}>
                  <button onClick={() => setEditingAttribute(a)} className="btn btn-secondary touch-btn" style={{ width: '100%' }}>
                    <Pencil size={14} style={{ marginRight: '6px' }} />
                    <span>Edit</span>
                  </button>
                  <button onClick={() => setDeletingAttribute(a)} className="btn btn-danger touch-btn" style={{ width: '100%' }}>
                    <Trash2 size={14} style={{ marginRight: '6px' }} />
                    <span>Delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================
          ADVANCED PRODUCT UPLOAD MODAL (USER REQUIREMENTS)
         ======================================================== */}
      {isModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '720px', maxHeight: '92vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '30px', height: '30px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Package size={16} />
                </div>
                <div>
                  <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>Publish New Product</h2>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>Multi-attribute matrix, brand identity & care guidelines</span>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmitProduct}>
              {/* Top Quick Status Control Toggles Bar */}
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
                    {isFeatured ? '★ Featured on Home' : '☆ Standard Catalog'}
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
                    {isSoldOut ? '⛔ Marked Sold Out' : '✓ Stock Ready'}
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
                <label className="form-label" style={{ marginBottom: '6px' }}>Select Product Catalog Type *</label>
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
                    📦 Single Product (Simple SKU)
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

              {/* Core Info */}
              <div className="form-group" style={{ marginBottom: '10px' }}>
                <label className="form-label">Product Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Royal Silk Anarkali Gown"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (!sku) {
                      setSku(e.target.value.substring(0, 3).toUpperCase() + '-101');
                    }
                  }}
                  className="form-input"
                />
              </div>

              <div className="form-grid" style={{ marginBottom: '10px' }}>
                <div className="form-group">
                  <label className="form-label">Base SKU Code *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. MIO-DRS-10"
                    value={sku}
                    onChange={(e) => setSku(e.target.value)}
                    className="form-input"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="form-select"
                    required
                  >
                    <option value="">-- Choose Category --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Brand and Care Instruction Selectors */}
              <div className="form-grid" style={{ marginBottom: '12px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Award size={13} color="var(--primary)" />
                    <span>Brand / Manufacturer</span>
                  </label>
                  <select
                    value={selectedBrandId}
                    onChange={(e) => setSelectedBrandId(e.target.value)}
                    className="form-select"
                  >
                    <option value="">-- Select Brand --</option>
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
                    <span>Care Instruction Template</span>
                  </label>
                  <select
                    value={selectedCareId}
                    onChange={(e) => setSelectedCareId(e.target.value)}
                    className="form-select"
                  >
                    <option value="">-- Select Care Guide --</option>
                    {careInstructions.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title} [{c.materialCategory}]
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Pricing & Stock */}
              <div className="form-grid" style={{ marginBottom: '12px' }}>
                <div className="form-group">
                  <label className="form-label">Base Price (৳) *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Compare-at Price (৳)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Optional strike-through"
                    value={comparePrice}
                    onChange={(e) => setComparePrice(e.target.value)}
                    className="form-input"
                  />
                </div>
                {productType === 'SINGLE' && (
                  <div className="form-group">
                    <label className="form-label">Initial Stock Quantity *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={inventoryCount}
                      onChange={(e) => setInventoryCount(e.target.value)}
                      className="form-input"
                    />
                  </div>
                )}
              </div>

              {/* Media Assets Section */}
              <div style={{ marginBottom: '14px', padding: '10px', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '8px' }}>
                  <ImageIcon size={14} color="var(--primary)" />
                  <span>Product Media Assets ({productImages.length})</span>
                </span>

                <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', marginBottom: '8px', paddingBottom: '4px' }}>
                  {productImages.map((imgUrl, idx) => (
                    <div key={idx} style={{ position: 'relative', width: '56px', height: '56px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: idx === 0 ? '2px solid var(--primary)' : '1px solid var(--border)', background: '#fff', flexShrink: 0 }}>
                      <img src={imgUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      {idx === 0 && (
                        <span style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'var(--primary)', color: '#fff', fontSize: '0.55rem', fontWeight: 800, textAlign: 'center', lineHeight: '12px' }}>
                          MAIN
                        </span>
                      )}
                      {productImages.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveProductImage(idx)}
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
                    value={imageInputUrl}
                    onChange={(e) => setImageInputUrl(e.target.value)}
                    className="form-input"
                    style={{ fontSize: '0.76rem', flex: 1 }}
                  />
                  <button
                    type="button"
                    onClick={handleAddProductImage}
                    className="btn btn-secondary"
                    style={{ fontSize: '0.76rem', padding: '4px 10px' }}
                  >
                    Add Media
                  </button>
                </div>
              </div>

              {/* VARIABLE PRODUCT: ATTRIBUTES SELECTION & AUTO GENERATE VARIATION MATRIX */}
              {productType === 'VARIABLE' && (
                <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--bg-main)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ margin: 0, fontSize: '0.84rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        Select Attributes & Swatches for Auto-Variations
                      </h4>
                      <button
                        type="button"
                        onClick={handleGenerateVariations}
                        className="btn btn-primary"
                        style={{ fontSize: '0.74rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Sparkles size={12} />
                        <span>⚡ Generate Variations Matrix</span>
                      </button>
                    </div>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>
                      Select the attribute values below then click "Generate Variations Matrix" to build Cartesian combinations.
                    </span>
                  </div>

                  {/* Attribute Swatch Choosers */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
                    {attributes.map((attr) => {
                      const selectedList = selectedAttrValues[attr.code] || [];
                      return (
                        <div key={attr.id} style={{ background: '#fff', padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                          <span style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
                            {attr.name} ({attr.code})
                          </span>
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                            {attr.values.map((v) => {
                              const isSelected = selectedList.includes(v.value);
                              return (
                                <button
                                  key={v.id}
                                  type="button"
                                  onClick={() => handleToggleAttrValue(attr.code, v.value)}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '5px',
                                    padding: '3px 8px',
                                    borderRadius: 'var(--radius-sm)',
                                    border: isSelected ? '1.5px solid var(--primary)' : '1px solid var(--border)',
                                    background: isSelected ? 'var(--primary-glow)' : '#f8fafc',
                                    color: isSelected ? 'var(--primary)' : 'var(--text-main)',
                                    fontSize: '0.72rem',
                                    fontWeight: isSelected ? 700 : 500,
                                    cursor: 'pointer',
                                  }}
                                >
                                  {v.colorHex && (
                                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: v.colorHex }} />
                                  )}
                                  <span>{v.displayValue}</span>
                                  {isSelected && <Check size={11} />}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Generated Variations Matrix List */}
                  {generatedVariants.length > 0 && (
                    <div>
                      <div style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '6px' }}>
                        Generated Variations ({generatedVariants.length} SKUs):
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {generatedVariants.map((gv, gIdx) => (
                          <div
                            key={gv.id || gIdx}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '70px 1.2fr 1fr 90px 70px 30px',
                              gap: '8px',
                              alignItems: 'center',
                              padding: '6px 8px',
                              background: '#fff',
                              borderRadius: 'var(--radius-sm)',
                              border: '1px solid var(--border)',
                            }}
                          >
                            {/* Image selector */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <div style={{ width: '28px', height: '28px', borderRadius: '4px', overflow: 'hidden', border: '1px solid var(--border)', background: '#f8fafc', flexShrink: 0 }}>
                                <img
                                  src={gv.imageUrl || productImages[0] || 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=600&auto=format&fit=crop&q=80'}
                                  alt=""
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              </div>
                              <select
                                value={gv.imageUrl || productImages[0] || ''}
                                onChange={(e) => handleUpdateGeneratedVariant(gIdx, 'imageUrl', e.target.value)}
                                className="form-select"
                                style={{ fontSize: '0.66rem', padding: '2px 4px', width: '32px' }}
                                title="Assign variation image"
                              >
                                {productImages.map((img, i) => (
                                  <option key={i} value={img}>
                                    Img {i + 1}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Title */}
                            <input
                              type="text"
                              value={gv.title}
                              onChange={(e) => handleUpdateGeneratedVariant(gIdx, 'title', e.target.value)}
                              className="form-input"
                              style={{ fontSize: '0.72rem', padding: '3px 6px' }}
                            />

                            {/* Auto SKU */}
                            <input
                              type="text"
                              value={gv.sku}
                              onChange={(e) => handleUpdateGeneratedVariant(gIdx, 'sku', e.target.value)}
                              className="form-input"
                              style={{ fontSize: '0.72rem', padding: '3px 6px', fontFamily: 'var(--font-mono)' }}
                            />

                            {/* Selling Price */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)' }}>৳</span>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={gv.price}
                                onChange={(e) => handleUpdateGeneratedVariant(gIdx, 'price', parseFloat(e.target.value) || 0)}
                                className="form-input"
                                style={{ fontSize: '0.72rem', padding: '3px 6px' }}
                              />
                            </div>

                            {/* Stock */}
                            <input
                              type="number"
                              min="0"
                              value={gv.inventoryCount}
                              onChange={(e) => handleUpdateGeneratedVariant(gIdx, 'inventoryCount', parseInt(e.target.value, 10) || 0)}
                              className="form-input"
                              style={{ fontSize: '0.72rem', padding: '3px 6px' }}
                            />

                            {/* Remove */}
                            <button
                              type="button"
                              onClick={() => handleRemoveGeneratedVariant(gIdx)}
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ========================================================
                  PRODUCT SEO & SERP PREVIEW ACCORDION
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
                  onClick={() => setShowProdSeo(!showProdSeo)}
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
                      Search Engine Optimization (SEO) & Schema.org Structured Data
                    </span>
                    <span style={{ fontSize: '0.66rem', fontWeight: 700, backgroundColor: 'var(--primary)', color: '#ffffff', borderRadius: '4px', padding: '1px 5px' }}>
                      100% SEO
                    </span>
                  </div>
                  {showProdSeo ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {showProdSeo && (
                  <div style={{ padding: '0 14px 14px 14px' }}>
                    <GoogleSerpPreview
                      title={prodMetaTitle || title}
                      description={prodMetaDesc || description}
                      url={prodCanonicalUrl || `https://${currentStore.primaryDomain || 'store.localhost'}/product/${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                      focusKeyword={prodFocusKeyword}
                      ogImageUrl={prodOgImageUrl || productImages[0]}
                      brandName={currentStore.name}
                    />

                    <div className="form-group" style={{ marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label className="form-label">SEO Meta Title</label>
                        <span style={{ fontSize: '0.7rem', color: prodMetaTitle.length > 60 ? '#ef4444' : '#10b981' }}>
                          {prodMetaTitle.length} / 60 characters
                        </span>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. Silk Evening Gown Emerald Edition | Store Name"
                        value={prodMetaTitle}
                        onChange={(e) => setProdMetaTitle(e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label className="form-label">SEO Meta Description</label>
                        <span style={{ fontSize: '0.7rem', color: prodMetaDesc.length > 160 ? '#ef4444' : '#10b981' }}>
                          {prodMetaDesc.length} / 160 characters
                        </span>
                      </div>
                      <textarea
                        rows={2}
                        placeholder="Search snippet displayed on Google results (120-160 characters recommended)"
                        value={prodMetaDesc}
                        onChange={(e) => setProdMetaDesc(e.target.value)}
                        className="form-textarea"
                      />
                    </div>

                    <div className="form-grid" style={{ marginBottom: '10px' }}>
                      <div className="form-group">
                        <label className="form-label">Focus Keyword</label>
                        <input
                          type="text"
                          placeholder="e.g. silk evening gown"
                          value={prodFocusKeyword}
                          onChange={(e) => setProdFocusKeyword(e.target.value)}
                          className="form-input"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Robots Indexing</label>
                        <select
                          value={prodMetaRobots}
                          onChange={(e) => setProdMetaRobots(e.target.value)}
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
                        <label className="form-label">Canonical URL (Prevent Duplicate Penalties)</label>
                        <input
                          type="url"
                          placeholder="https://.../product/slug"
                          value={prodCanonicalUrl}
                          onChange={(e) => setProdCanonicalUrl(e.target.value)}
                          className="form-input"
                          style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Social Share Image (OG Image)</label>
                        <input
                          type="url"
                          placeholder="https://.../og-banner.jpg"
                          value={prodOgImageUrl}
                          onChange={(e) => setProdOgImageUrl(e.target.value)}
                          className="form-input"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Form Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Publish to Storefront
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          ADD BRAND MODAL
         ======================================================== */}
      {isBrandModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Award size={15} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>Add Brand / Manufacturer</h3>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-subtle)' }}>Multi-brand identity with logo</span>
                </div>
              </div>
              <button onClick={() => setIsBrandModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateBrand}>
              <div className="form-group" style={{ marginBottom: '10px' }}>
                <label className="form-label">Brand Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Mior Atelier, Gucci, Nike"
                  value={brandName}
                  onChange={(e) => {
                    setBrandName(e.target.value);
                    setBrandSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                  }}
                  className="form-input"
                />
              </div>

              <div className="form-grid" style={{ marginBottom: '10px' }}>
                <div className="form-group">
                  <label className="form-label">Slug Key</label>
                  <input
                    type="text"
                    value={brandSlug}
                    onChange={(e) => setBrandSlug(e.target.value)}
                    className="form-input"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Country / Origin</label>
                  <input
                    type="text"
                    placeholder="e.g. Dhaka, Bangladesh"
                    value={brandOrigin}
                    onChange={(e) => setBrandOrigin(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '10px' }}>
                <label className="form-label">Brand Logo Image URL</label>
                <input
                  type="url"
                  placeholder="https://..."
                  value={brandLogo}
                  onChange={(e) => setBrandLogo(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Description / Bio</label>
                <textarea
                  rows={2}
                  placeholder="Brief overview of craftsmanship or heritage..."
                  value={brandDesc}
                  onChange={(e) => setBrandDesc(e.target.value)}
                  className="form-textarea"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                <button type="button" onClick={() => setIsBrandModalOpen(false)} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Save Brand
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          ADD CARE INSTRUCTION MODAL
         ======================================================== */}
      {isCareModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={15} />
                </div>
                <div>
                  <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>Create Care Instruction Guide</h3>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-subtle)' }}>Washing & fabric maintenance instructions</span>
                </div>
              </div>
              <button onClick={() => setIsCareModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)' }}>
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateCareInstruction}>
              <div className="form-grid" style={{ marginBottom: '10px' }}>
                <div className="form-group">
                  <label className="form-label">Care Guide Title *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pure Silk & Delicates"
                    value={careTitle}
                    onChange={(e) => setCareTitle(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Material Category *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Silk & Chiffon, Cashmere"
                    value={careMaterial}
                    onChange={(e) => setCareMaterial(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label className="form-label" style={{ margin: 0 }}>Bullet Care Instructions (One per line) *</label>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-subtle)' }}>Shown as bullet points</span>
                </div>
                <textarea
                  rows={4}
                  required
                  value={careBulletsText}
                  onChange={(e) => setCareBulletsText(e.target.value)}
                  className="form-textarea"
                  style={{ fontSize: '0.78rem' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Overview Summary</label>
                <input
                  type="text"
                  placeholder="e.g. Preserves natural fiber softness and colors."
                  value={careSummary}
                  onChange={(e) => setCareSummary(e.target.value)}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                <button type="button" onClick={() => setIsCareModalOpen(false)} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Save Care Guide
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          ADD CATEGORY MODAL
         ======================================================== */}
      {isCategoryModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '14px' }}>Create New Category</h2>
            <form onSubmit={handleCreateCategory}>
              <div className="form-group" style={{ marginBottom: '10px' }}>
                <label className="form-label">Category Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Evening Gowns, Formalwear"
                  value={catName}
                  onChange={(e) => {
                    setCatName(e.target.value);
                    if (!catMetaTitle) {
                      setCatMetaTitle(`${e.target.value} Collection`);
                    }
                  }}
                  className="form-input"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Description</label>
                <textarea
                  rows={2}
                  placeholder="Brief description for SEO and category header..."
                  value={catDesc}
                  onChange={(e) => {
                    setCatDesc(e.target.value);
                    if (!catMetaDesc) {
                      setCatMetaDesc(e.target.value);
                    }
                  }}
                  className="form-textarea"
                />
              </div>

              {/* ========================================================
                  CATEGORY SEO & SERP PREVIEW ACCORDION
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
                  onClick={() => setShowCatSeo(!showCatSeo)}
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
                  {showCatSeo ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </button>

                {showCatSeo && (
                  <div style={{ padding: '0 14px 14px 14px' }}>
                    <GoogleSerpPreview
                      title={catMetaTitle || catName}
                      description={catMetaDesc || catDesc}
                      url={catCanonicalUrl || `https://${currentStore.primaryDomain || 'store.localhost'}/catalog?category=${catName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
                      focusKeyword={catFocusKeyword}
                      brandName={currentStore.name}
                    />

                    <div className="form-group" style={{ marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label className="form-label">SEO Meta Title</label>
                        <span style={{ fontSize: '0.7rem', color: catMetaTitle.length > 60 ? '#ef4444' : '#10b981' }}>
                          {catMetaTitle.length} / 60 characters
                        </span>
                      </div>
                      <input
                        type="text"
                        placeholder="e.g. Silk Evening Dresses & Gowns | Store Name"
                        value={catMetaTitle}
                        onChange={(e) => setCatMetaTitle(e.target.value)}
                        className="form-input"
                      />
                    </div>

                    <div className="form-group" style={{ marginBottom: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <label className="form-label">SEO Meta Description</label>
                        <span style={{ fontSize: '0.7rem', color: catMetaDesc.length > 160 ? '#ef4444' : '#10b981' }}>
                          {catMetaDesc.length} / 160 characters
                        </span>
                      </div>
                      <textarea
                        rows={2}
                        placeholder="Search snippet displayed on Google results (120-160 characters recommended)"
                        value={catMetaDesc}
                        onChange={(e) => setCatMetaDesc(e.target.value)}
                        className="form-textarea"
                      />
                    </div>

                    <div className="form-grid" style={{ marginBottom: '6px' }}>
                      <div className="form-group">
                        <label className="form-label">Focus Keyword</label>
                        <input
                          type="text"
                          placeholder="e.g. evening dresses"
                          value={catFocusKeyword}
                          onChange={(e) => setCatFocusKeyword(e.target.value)}
                          className="form-input"
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label">Robots Indexing</label>
                        <select
                          value={catMetaRobots}
                          onChange={(e) => setCatMetaRobots(e.target.value)}
                          className="form-select"
                        >
                          <option value="index, follow">Index, Follow (Recommended)</option>
                          <option value="noindex, follow">Noindex, Follow</option>
                          <option value="noindex, nofollow">Noindex, Nofollow</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                <button type="button" onClick={() => setIsCategoryModalOpen(false)} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Save Category
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          ADD ATTRIBUTE MODAL
         ======================================================== */}
      {isAttributeModalOpen && (
        <div className="modal-overlay" style={{ zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '14px' }}>Define Product Attribute</h2>
            <form onSubmit={handleCreateAttribute}>
              <div className="form-grid" style={{ marginBottom: '10px' }}>
                <div className="form-group">
                  <label className="form-label">Attribute Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Size, Color, Fabric"
                    value={attrName}
                    onChange={(e) => {
                      setAttrName(e.target.value);
                      setAttrCode(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ''));
                    }}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Code Key *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. size, color"
                    value={attrCode}
                    onChange={(e) => setAttrCode(e.target.value)}
                    className="form-input"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '10px' }}>
                <label className="form-label">Display Swatch Type</label>
                <select
                  value={attrType}
                  onChange={(e) => setAttrType(e.target.value as any)}
                  className="form-select"
                >
                  <option value="BUTTON">Selectable Buttons (Size / Specs)</option>
                  <option value="COLOR_SWATCH">Color Circle Swatches</option>
                  <option value="SELECT">Dropdown Menu</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '16px' }}>
                <label className="form-label">Initial Values (Comma separated)</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. S, M, L, XL"
                  value={attrValuesText}
                  onChange={(e) => setAttrValuesText(e.target.value)}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" onClick={() => setIsAttributeModalOpen(false)} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary btn-sm">
                  Save Attribute
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================
          EDIT MODALS (UNIVERSAL CRUD GOVERNANCE)
         ======================================================== */}
      {editingProduct && (
        <EditProductModal
          product={editingProduct}
          brands={brands}
          careInstructions={careInstructions}
          onClose={() => setEditingProduct(null)}
          onSave={(updated) => {
            onUpdateProduct(updated);
            setEditingProduct(null);
          }}
        />
      )}

      {editingCategory && (
        <EditCategoryModal
          category={editingCategory}
          onClose={() => setEditingCategory(null)}
          onSave={(updated) => {
            onUpdateCategory(updated);
            setEditingCategory(null);
          }}
        />
      )}

      {editingAttribute && (
        <EditAttributeModal
          attribute={editingAttribute}
          onClose={() => setEditingAttribute(null)}
          onSave={(updated) => {
            onUpdateAttribute(updated);
            setEditingAttribute(null);
          }}
        />
      )}

      {editingBrand && (
        <EditBrandModal
          brand={editingBrand}
          onClose={() => setEditingBrand(null)}
          onSave={(updated) => {
            onUpdateBrand(updated);
            setEditingBrand(null);
          }}
        />
      )}

      {editingCare && (
        <EditCareInstructionModal
          instruction={editingCare}
          onClose={() => setEditingCare(null)}
          onSave={(updated) => {
            onUpdateCareInstruction(updated);
            setEditingCare(null);
          }}
        />
      )}

      {/* ========================================================
          CONFIRM DELETE APPROVAL MODALS (UNIVERSAL CRUD GOVERNANCE)
         ======================================================== */}
      {deletingProduct && (
        <ConfirmDeleteModal
          isOpen={true}
          title="Delete Product from Catalog"
          itemName={`Product: ${deletingProduct.title}`}
          itemType="Product"
          onClose={() => setDeletingProduct(null)}
          onConfirm={() => {
            onDeleteProduct(deletingProduct.id);
            setDeletingProduct(null);
          }}
        />
      )}

      {deletingCategory && (
        <ConfirmDeleteModal
          isOpen={true}
          title="Delete Product Category"
          itemName={`Category: ${deletingCategory.name}`}
          itemType="Category"
          onClose={() => setDeletingCategory(null)}
          onConfirm={() => {
            onDeleteCategory(deletingCategory.id);
            setDeletingCategory(null);
          }}
        />
      )}

      {deletingAttribute && (
        <ConfirmDeleteModal
          isOpen={true}
          title="Delete Product Attribute"
          itemName={`Attribute: ${deletingAttribute.name}`}
          itemType="Attribute"
          onClose={() => setDeletingAttribute(null)}
          onConfirm={() => {
            onDeleteAttribute(deletingAttribute.id);
            setDeletingAttribute(null);
          }}
        />
      )}

      {deletingBrand && (
        <ConfirmDeleteModal
          isOpen={true}
          title="Delete Brand / Manufacturer"
          itemName={`Brand: ${deletingBrand.name}`}
          itemType="Brand"
          onClose={() => setDeletingBrand(null)}
          onConfirm={() => {
            onDeleteBrand(deletingBrand.id);
            setDeletingBrand(null);
          }}
        />
      )}

      {deletingCare && (
        <ConfirmDeleteModal
          isOpen={true}
          title="Delete Care Instruction Guide"
          itemName={`Care Guide: ${deletingCare.title}`}
          itemType="Care Instruction"
          onClose={() => setDeletingCare(null)}
          onConfirm={() => {
            onDeleteCareInstruction(deletingCare.id);
            setDeletingCare(null);
          }}
        />
      )}
    </div>
  );
};
