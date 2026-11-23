'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { AlertCircle, Check, Search, ShoppingBag, Sparkles, X } from 'lucide-react';
import { BundleProductSelection } from '../../types/bundle';
import { CatalogSearchResponse, PublicProductCard } from '../../types/catalog';
import { PublicProductDetail } from '../../types/product';
import { fetchStorefrontData, StorefrontApiError } from '../../lib/api';

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

function mapProductDetail(product: PublicProductDetail): ProductItem {
  const attributes = product.attributes || [];
  return {
    id: product.id,
    title: product.title,
    slug: product.slug,
    imageUrl: product.featuredImageURL || product.featured_image_url || '',
    category: product.categoryName || product.category_name || '',
    basePrice: product.basePrice ?? product.base_price,
    variants: (product.variants || [])
      .filter((variant) => variant.inStock ?? variant.in_stock)
      .map((variant) => {
        const valueIDs = variant.attributeValueIDs || variant.attribute_value_ids || [];
        const selectedValues = attributes.flatMap((attribute) =>
          attribute.values
            .filter((value) => valueIDs.includes(value.id))
            .map((value) => ({
              attribute: `${attribute.name} ${attribute.code}`.toLowerCase(),
              value: value.displayValue || value.display_value || value.value,
            }))
        );
        return {
          id: variant.id,
          title: variant.title,
          sku: variant.sku,
          price: variant.price,
          size: selectedValues.find(({ attribute }) => attribute.includes('size'))?.value,
          color: selectedValues.find(({ attribute }) => attribute.includes('color'))?.value,
        };
      }),
  };
}

export const ChooseProductModal: React.FC<ChooseProductModalProps> = ({
  isOpen,
  slotNumber,
  discountPercentage,
  onClose,
  onSelect,
}) => {
  const [products, setProducts] = useState<PublicProductCard[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [selectedVariantId, setSelectedVariantId] = useState('');
  const [isLoadingProducts, setIsLoadingProducts] = useState(false);
  const [isLoadingProduct, setIsLoadingProduct] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    setSearchTerm('');
    setSelectedCategory('All');
    setSelectedProduct(null);
    setSelectedVariantId('');
    setError(null);
    setIsLoadingProducts(true);

    const host = window.location.host;
    const query = new URLSearchParams({ page: '1', limit: '100', in_stock: 'true' });
    fetchStorefrontData<CatalogSearchResponse>(
      host,
      `/storefront/catalog/products?${query.toString()}`
    )
      .then((result) => {
        if (!Array.isArray(result.products)) {
          throw new StorefrontApiError('The store API returned an invalid product list.', 502);
        }
        if (active) setProducts(result.products);
      })
      .catch((loadError: unknown) => {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load products.');
        }
      })
      .finally(() => {
        if (active) setIsLoadingProducts(false);
      });

    return () => {
      active = false;
    };
  }, [isOpen]);

  const categories = useMemo(
    () => [
      'All',
      ...Array.from(new Set(products.map((product) => product.category_name).filter((name): name is string => Boolean(name)))),
    ],
    [products]
  );
  const filteredProducts = products.filter((product) => {
    const category = product.category_name || '';
    const matchesCategory = selectedCategory === 'All' || category === selectedCategory;
    const matchesSearch = `${product.title} ${category}`.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const handleProductPick = async (product: PublicProductCard) => {
    setIsLoadingProduct(true);
    setSelectedProduct(null);
    setSelectedVariantId('');
    setError(null);
    try {
      const detail = await fetchStorefrontData<PublicProductDetail>(
        window.location.host,
        `/storefront/catalog/products/${encodeURIComponent(product.slug)}`
      );
      const mapped = mapProductDetail(detail);
      setSelectedProduct(mapped);
      setSelectedVariantId(mapped.variants[0]?.id || '');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load product options.');
    } finally {
      setIsLoadingProduct(false);
    }
  };

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!selectedProduct) return;
    const variant = selectedProduct.variants.find((item) => item.id === selectedVariantId);
    if (!variant) return;

    const originalPrice = variant.price;
    const savings = Math.round(originalPrice * (discountPercentage / 100) * 100) / 100;
    onSelect({
      productId: selectedProduct.id,
      productTitle: selectedProduct.title,
      productSlug: selectedProduct.slug,
      imageUrl: selectedProduct.imageUrl,
      variantId: variant.id,
      variantTitle: variant.title,
      sku: variant.sku,
      originalPrice,
      discountedPrice: Math.max(0, originalPrice - savings),
      savings,
      color: variant.color,
      size: variant.size,
    });
    onClose();
  };

  const currentVariant = selectedProduct?.variants.find((item) => item.id === selectedVariantId);
  const originalPrice = currentVariant?.price || 0;
  const savings = Math.round(originalPrice * (discountPercentage / 100) * 100) / 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">Choose Product for Slot #{slotNumber}</h3>
            <p className="text-xs text-slate-500">
              Choose a product from this store's catalog with {discountPercentage}% bundle discount.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close product selector" className="p-1.5 text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 border-b border-slate-100 bg-slate-50/50 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {categories.map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => setSelectedCategory(category)}
                className={`px-3 py-1 rounded-full text-xs font-semibold ${
                  selectedCategory === category ? 'bg-[var(--brand-primary)] text-white' : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div role="alert" className="mx-4 mt-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 sm:grid-cols-12 gap-4">
          <div className="sm:col-span-7 space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {isLoadingProducts ? (
              <p className="p-6 text-center text-xs text-slate-500">Loading products...</p>
            ) : filteredProducts.length === 0 ? (
              <p className="p-6 text-center text-xs text-slate-500">No products are available for this store.</p>
            ) : (
              filteredProducts.map((product) => (
                <button
                  type="button"
                  key={product.id}
                  onClick={() => void handleProductPick(product)}
                  className="w-full flex items-center gap-3 p-2.5 rounded-xl border border-slate-200 text-left hover:border-[var(--brand-primary)]"
                >
                  <div className="relative w-14 h-16 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                    {product.featured_image_url ? (
                      <Image src={product.featured_image_url} alt={product.title} fill sizes="56px" className="object-cover" />
                    ) : (
                      <div className="h-full flex items-center justify-center"><ShoppingBag className="h-5 w-5 text-slate-400" /></div>
                    )}
                  </div>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-bold text-slate-900 truncate">{product.title}</span>
                    <span className="block text-[11px] text-slate-400">{product.category_name || 'Uncategorized'}</span>
                    <span className="block mt-1 text-xs font-extrabold text-[var(--brand-primary)]">৳ {product.base_price.toLocaleString()}</span>
                  </span>
                  {selectedProduct?.id === product.id && <Check className="h-4 w-4 text-[var(--brand-primary)]" />}
                </button>
              ))
            )}
          </div>

          <div className="sm:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-col justify-between">
            {isLoadingProduct ? (
              <p className="text-center py-10 text-xs text-slate-500">Loading product options...</p>
            ) : selectedProduct ? (
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Selected Product</span>
                  <h4 className="text-xs font-bold text-slate-900 mt-0.5">{selectedProduct.title}</h4>
                </div>
                {selectedProduct.variants.length === 0 ? (
                  <p className="text-xs text-slate-600">This product has no purchasable variants.</p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {selectedProduct.variants.map((variant) => (
                      <button
                        key={variant.id}
                        type="button"
                        onClick={() => setSelectedVariantId(variant.id)}
                        className={`w-full text-left px-3 py-2 rounded-lg text-xs flex items-center justify-between border ${
                          selectedVariantId === variant.id ? 'border-[var(--brand-primary)] bg-white' : 'border-slate-200 bg-white/70'
                        }`}
                      >
                        <span>{variant.title}</span>
                        <span className="font-mono text-[11px] text-slate-400">{variant.sku}</span>
                      </button>
                    ))}
                  </div>
                )}
                {currentVariant && (
                  <div className="pt-3 border-t border-slate-200 space-y-1 text-xs">
                    <div className="flex justify-between text-slate-500">
                      <span>Retail Price:</span><span>৳ {originalPrice.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-emerald-600">
                      <span>Bundle Discount ({discountPercentage}%):</span><span>- ৳ {savings.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-extrabold text-slate-900">
                      <span>Slot Price:</span><span>৳ {(originalPrice - savings).toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center py-10 text-slate-400 text-xs">Select a product to choose a variant.</p>
            )}
            <button
              type="button"
              disabled={!currentVariant || isLoadingProduct}
              onClick={handleConfirm}
              className="mt-4 w-full py-2.5 bg-[var(--brand-primary)] text-white text-xs font-bold rounded-xl disabled:opacity-40 flex items-center justify-center gap-1.5"
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
