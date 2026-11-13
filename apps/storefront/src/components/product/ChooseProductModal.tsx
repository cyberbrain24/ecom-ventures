'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { X, Search, Check, Sparkles, ShoppingBag } from 'lucide-react';
import { BundleProductSelection } from '../../types/bundle';

interface ChooseProductModalProps {
  isOpen: boolean;
  slotNumber: number;
  discountPercentage: number;
  onClose: () => void;
  onSelect: (selection: BundleProductSelection) => void;
}

interface ProductItem {
  id: string;
  title: string;
  slug: string;
  imageUrl: string;
  category: string;
  basePrice: number;
  variants: Array<{
    id: string;
    title: string;
    sku: string;
    price: number;
    size?: string;
    color?: string;
  }>;
}

const DEMO_CATALOG_PRODUCTS: ProductItem[] = [
  {
    id: 'prod-tee-01',
    title: 'Acid Trim Heavyweight Tee',
    slug: 'acid-trim-heavyweight-tee',
    imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80',
    category: 'T-Shirts',
    basePrice: 1000,
    variants: [
      { id: 'v-tee-blk-m', title: 'Black / M', sku: 'TEE-ACD-BLK-M', price: 1000, color: 'Black', size: 'M' },
      { id: 'v-tee-blk-l', title: 'Black / L', sku: 'TEE-ACD-BLK-L', price: 1000, color: 'Black', size: 'L' },
      { id: 'v-tee-blk-xl', title: 'Black / XL', sku: 'TEE-ACD-BLK-XL', price: 1000, color: 'Black', size: 'XL' },
      { id: 'v-tee-wht-l', title: 'Vintage White / L', sku: 'TEE-ACD-WHT-L', price: 1000, color: 'Vintage White', size: 'L' },
    ],
  },
  {
    id: 'prod-cargo-02',
    title: 'Baggy Tactical Cargo Pants',
    slug: 'baggy-tactical-cargo-pants',
    imageUrl: 'https://images.unsplash.com/photo-1517445312882-bc9910d016b7?w=600&auto=format&fit=crop&q=80',
    category: 'Bottoms',
    basePrice: 1200,
    variants: [
      { id: 'v-crg-olv-30', title: 'Olive / 30', sku: 'CRG-TC-OLV-30', price: 1200, color: 'Olive', size: '30' },
      { id: 'v-crg-olv-32', title: 'Olive / 32', sku: 'CRG-TC-OLV-32', price: 1200, color: 'Olive', size: '32' },
      { id: 'v-crg-olv-34', title: 'Olive / 34', sku: 'CRG-TC-OLV-34', price: 1200, color: 'Olive', size: '34' },
      { id: 'v-crg-blk-32', title: 'Black / 32', sku: 'CRG-TC-BLK-32', price: 1200, color: 'Black', size: '32' },
    ],
  },
  {
    id: 'prod-hoodie-03',
    title: 'Oversized Boxy Raw Hoodie',
    slug: 'oversized-boxy-raw-hoodie',
    imageUrl: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=600&auto=format&fit=crop&q=80',
    category: 'Outerwear',
    basePrice: 1800,
    variants: [
      { id: 'v-hd-char-l', title: 'Charcoal / L', sku: 'HD-RAW-CHR-L', price: 1800, color: 'Charcoal', size: 'L' },
      { id: 'v-hd-char-xl', title: 'Charcoal / XL', sku: 'HD-RAW-CHR-XL', price: 1800, color: 'Charcoal', size: 'XL' },
      { id: 'v-hd-snd-l', title: 'Sand / L', sku: 'HD-RAW-SND-L', price: 1800, color: 'Sand', size: 'L' },
    ],
  },
  {
    id: 'prod-denim-04',
    title: 'Wide Leg Distressed Denim',
    slug: 'wide-leg-distressed-denim',
    imageUrl: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=600&auto=format&fit=crop&q=80',
    category: 'Bottoms',
    basePrice: 1500,
    variants: [
      { id: 'v-dnm-blu-30', title: 'Washed Blue / 30', sku: 'DNM-WID-BLU-30', price: 1500, color: 'Washed Blue', size: '30' },
      { id: 'v-dnm-blu-32', title: 'Washed Blue / 32', sku: 'DNM-WID-BLU-32', price: 1500, color: 'Washed Blue', size: '32' },
      { id: 'v-dnm-blu-34', title: 'Washed Blue / 34', sku: 'DNM-WID-BLU-34', price: 1500, color: 'Washed Blue', size: '34' },
    ],
  },
  {
    id: 'prod-cap-05',
    title: 'Distressed Embroidery Baseball Cap',
    slug: 'distressed-embroidery-baseball-cap',
    imageUrl: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=600&auto=format&fit=crop&q=80',
    category: 'Accessories',
    basePrice: 650,
    variants: [
      { id: 'v-cap-blk-os', title: 'Washed Black / OS', sku: 'CAP-DST-BLK-OS', price: 650, color: 'Washed Black', size: 'One Size' },
      { id: 'v-cap-khk-os', title: 'Khaki / OS', sku: 'CAP-DST-KHK-OS', price: 650, color: 'Khaki', size: 'One Size' },
    ],
  },
  {
    id: 'prod-shorts-06',
    title: 'Heavy Terry Graphic Shorts',
    slug: 'heavy-terry-graphic-shorts',
    imageUrl: 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=600&auto=format&fit=crop&q=80',
    category: 'Bottoms',
    basePrice: 850,
    variants: [
      { id: 'v-shrt-blk-m', title: 'Black / M', sku: 'SHT-TRY-BLK-M', price: 850, color: 'Black', size: 'M' },
      { id: 'v-shrt-blk-l', title: 'Black / L', sku: 'SHT-TRY-BLK-L', price: 850, color: 'Black', size: 'L' },
      { id: 'v-shrt-gry-l', title: 'Heather Grey / L', sku: 'SHT-TRY-GRY-L', price: 850, color: 'Grey', size: 'L' },
    ],
  },
];

export const ChooseProductModal: React.FC<ChooseProductModalProps> = ({
  isOpen,
  slotNumber,
  discountPercentage,
  onClose,
  onSelect,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setSearchTerm('');
      setSelectedCategory('All');
      // Preselect first product for instant preview
      if (DEMO_CATALOG_PRODUCTS.length > 0) {
        const first = DEMO_CATALOG_PRODUCTS[0];
        setSelectedProduct(first);
        setSelectedVariantId(first.variants[0]?.id || '');
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const categories = ['All', 'T-Shirts', 'Bottoms', 'Outerwear', 'Accessories'];

  const filteredProducts = DEMO_CATALOG_PRODUCTS.filter((prod) => {
    const matchesCategory = selectedCategory === 'All' || prod.category === selectedCategory;
    const matchesSearch =
      prod.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      prod.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleProductPick = (prod: ProductItem) => {
    setSelectedProduct(prod);
    setSelectedVariantId(prod.variants[0]?.id || '');
  };

  const handleConfirm = () => {
    if (!selectedProduct) return;
    const variant = selectedProduct.variants.find((v) => v.id === selectedVariantId) || selectedProduct.variants[0];
    if (!variant) return;

    const originalPrice = variant.price;
    const savings = Math.round((originalPrice * (discountPercentage / 100)) * 100) / 100;
    const discountedPrice = Math.max(0, originalPrice - savings);

    onSelect({
      productId: selectedProduct.id,
      productTitle: selectedProduct.title,
      productSlug: selectedProduct.slug,
      imageUrl: selectedProduct.imageUrl,
      variantId: variant.id,
      variantTitle: variant.title,
      sku: variant.sku,
      originalPrice,
      discountedPrice,
      savings,
      color: variant.color,
      size: variant.size,
    });
    onClose();
  };

  const currentVariant = selectedProduct?.variants.find((v) => v.id === selectedVariantId);
  const originalPrice = currentVariant?.price || selectedProduct?.basePrice || 0;
  const savings = Math.round((originalPrice * (discountPercentage / 100)) * 100) / 100;
  const discountedPrice = Math.max(0, originalPrice - savings);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="h-8 w-8 rounded-lg bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] flex items-center justify-center font-bold text-xs">
              #{slotNumber}
            </div>
            <div>
              <h3 className="text-base font-extrabold text-slate-900 font-[var(--brand-font-heading)]">
                Choose Product for Slot #{slotNumber}
              </h3>
              <p className="text-xs text-slate-500">
                Mix and match any piece from our collection with {discountPercentage}% bundle discount
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search & Category Pills */}
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search garments by name or keyword..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-[var(--brand-primary)] focus:ring-1 focus:ring-[var(--brand-primary)] transition"
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                  selectedCategory === cat
                    ? 'bg-[var(--brand-primary)] text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Body Grid: Product Picker (Left) & Variant Details (Right) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-12 gap-4">
          {/* Products List (7 Cols) */}
          <div className="sm:col-span-7 space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {filteredProducts.map((prod) => {
              const isSelected = selectedProduct?.id === prod.id;
              return (
                <div
                  key={prod.id}
                  onClick={() => handleProductPick(prod)}
                  className={`flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition ${
                    isSelected
                      ? 'border-[var(--brand-primary)] bg-[var(--brand-primary)]/5 ring-1 ring-[var(--brand-primary)]'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="relative w-14 h-16 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                    <Image
                      src={prod.imageUrl}
                      alt={prod.title}
                      fill
                      sizes="56px"
                      className="object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{prod.title}</p>
                    <p className="text-[11px] text-slate-400">{prod.category}</p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs font-extrabold text-[var(--brand-primary)] font-mono">
                        ৳ {prod.basePrice.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {isSelected && (
                    <div className="h-6 w-6 rounded-full bg-[var(--brand-primary)] text-white flex items-center justify-center shrink-0">
                      <Check className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Variant Selector & Price Calculation Preview (5 Cols) */}
          <div className="sm:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
            {selectedProduct ? (
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Selected Garment</span>
                  <h4 className="text-xs font-bold text-slate-900 mt-0.5 line-clamp-1">{selectedProduct.title}</h4>
                </div>

                {/* Variant Options */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wide mb-1.5">
                    Select Size & Color
                  </label>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {selectedProduct.variants.map((v) => {
                      const isVSelected = selectedVariantId === v.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => setSelectedVariantId(v.id)}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold flex items-center justify-between border transition ${
                            isVSelected
                              ? 'border-[var(--brand-primary)] bg-white text-slate-900 ring-1 ring-[var(--brand-primary)]'
                              : 'border-slate-200 bg-white/70 text-slate-600 hover:bg-white'
                          }`}
                        >
                          <span>{v.title}</span>
                          <span className="font-mono text-[11px] text-slate-400">{v.sku}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Price Breakdown */}
                <div className="pt-3 border-t border-slate-200 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>Retail Price:</span>
                    <span className="line-through font-mono">৳ {originalPrice.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Bundle Discount ({discountPercentage}%):</span>
                    <span className="font-mono">- ৳ {savings.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between font-extrabold text-slate-900 pt-1 border-t border-slate-200">
                    <span>Slot Price:</span>
                    <span className="text-sm font-mono text-[var(--brand-primary)]">
                      ৳ {discountedPrice.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-10 text-slate-400 text-xs">
                Select a product from the list to choose variations.
              </div>
            )}

            <button
              type="button"
              disabled={!selectedProduct || !selectedVariantId}
              onClick={handleConfirm}
              className="mt-4 w-full py-2.5 bg-[var(--brand-primary)] text-white text-xs font-bold rounded-xl shadow-md hover:opacity-95 transition disabled:opacity-40 flex items-center justify-center space-x-1.5"
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>Confirm Slot #{slotNumber}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

