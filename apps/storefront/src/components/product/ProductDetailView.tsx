'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { PublicProductDetail, PublicVariantDetail } from '../../types/catalog';
import { useCart } from '../../context/CartContext';
import {
  Check,
  ShoppingBag,
  ShieldCheck,
  Truck,
  RefreshCw,
  Award,
  Sparkles,
  Star,
  AlertCircle,
  MessageSquarePlus,
  X,
  Camera,
  CheckCircle2,
  ThumbsUp,
} from 'lucide-react';
import {
  fetchProductReviews,
  submitCustomerReview,
  StorefrontReviewsResponse,
} from '../../lib/reviews-api';
import { ProductBundleBuilder } from './ProductBundleBuilder';

interface ProductDetailViewProps {
  product: PublicProductDetail;
  currency: string;
}

export const ProductDetailView: React.FC<ProductDetailViewProps> = ({ product, currency }) => {
  const { addItem, isLoading, toggleFitCheck } = useCart();

  // Active selections per attribute option { [attributeId]: valueId }
  const [selectedValues, setSelectedValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    if (product.variants && product.variants.length > 0) {
      // Initialize with first variant's attributes
      const first = product.variants[0];
      const firstAttrValues = first.attributeValueIDs || first.attribute_value_ids || [];
      if (product.attributes) {
        product.attributes.forEach((attr) => {
          const matchingVal = attr.values.find((v) => firstAttrValues.includes(v.id));
          if (matchingVal) init[attr.id] = matchingVal.id;
        });
      }
    }
    return init;
  });

  // Resolve matching variant
  const activeVariant: PublicVariantDetail | undefined = (product.variants || []).find((v) => {
    const valIDs = Object.values(selectedValues);
    const variantAttrIDs = v.attributeValueIDs || v.attribute_value_ids || [];
    return valIDs.every((id) => variantAttrIDs.includes(id));
  }) || (product.variants && product.variants.length > 0 ? product.variants[0] : undefined);

  // Gallery state
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [activeVariantImageOverride, setActiveVariantImageOverride] = useState<string | null>(null);

  // Social Proof & Reviews State
  const [reviewsData, setReviewsData] = useState<StorefrontReviewsResponse>({
    summary: {
      product_id: product.id,
      average_rating: 0,
      review_count: 0,
      rating_breakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
      photo_count: 0,
      verified_buyer_count: 0,
    },
    reviews: [],
    photo_urls: [],
  });

  const [reviewFilterRating, setReviewFilterRating] = useState<number>(0);
  const [onlyWithPhotos, setOnlyWithPhotos] = useState<boolean>(false);
  const [isWriteReviewOpen, setIsWriteReviewOpen] = useState(false);
  const [lightboxImageUrl, setLightboxImageUrl] = useState<string | null>(null);

  // Write Review Form State
  const [newRating, setNewRating] = useState<number>(5);
  const [newHoverRating, setNewHoverRating] = useState<number>(0);
  const [newTitle, setNewTitle] = useState('');
  const [newComment, setNewComment] = useState('');
  const [newPhotoUrl, setNewPhotoUrl] = useState('');
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [reviewSuccessMessage, setReviewSuccessMessage] = useState<string | null>(null);

  // Fetch reviews on mount
  useEffect(() => {
    let isMounted = true;
    fetchProductReviews(product.slug, product.id).then((res) => {
      if (isMounted && res) {
        setReviewsData(res);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [product.slug, product.id]);

  // Auto-match saved AI fit recommendation from localStorage if available
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedSize = localStorage.getItem('poshplex_fit_size');
        if (savedSize && product.attributes) {
          const sizeAttr = product.attributes.find(
            (a) => a.code?.toLowerCase() === 'size' || a.name.toLowerCase().includes('size')
          );
          if (sizeAttr) {
            const matchingVal = sizeAttr.values.find((v) => {
              const valLower = v.value.toLowerCase();
              const dispLower = (v.displayValue || v.display_value || '').toLowerCase();
              const target = savedSize.toLowerCase();
              return valLower === target || dispLower.includes(`(${target})`) || dispLower === target;
            });
            if (matchingVal) {
              setSelectedValues((prev) => ({ ...prev, [sizeAttr.id]: matchingVal.id }));
            }
          }
        }
      } catch (e) {
        // Ignore storage errors
      }
    }
  }, [product.attributes]);

  const handleAttributeSelect = (attrId: string, valId: string) => {
    const updated = { ...selectedValues, [attrId]: valId };
    setSelectedValues(updated);

    // Resolve the newly active variant
    const nextVariant = (product.variants || []).find((v) => {
      const valIDs = Object.values(updated);
      const variantAttrIDs = v.attributeValueIDs || v.attribute_value_ids || [];
      return valIDs.every((id) => variantAttrIDs.includes(id));
    });

    // Check for variant-specific image override or bound images
    const variantDirectImg = nextVariant?.imageUrl || nextVariant?.image_url;
    if (variantDirectImg) {
      setActiveVariantImageOverride(variantDirectImg);
    } else {
      setActiveVariantImageOverride(null);
      const boundImageIDs = nextVariant?.imageIDs || nextVariant?.image_ids;
      if (boundImageIDs && boundImageIDs.length > 0) {
        const imgIdx = (product.images || []).findIndex((img) => img.id === boundImageIDs[0]);
        if (imgIdx !== -1) setActiveImageIndex(imgIdx);
      }
    }
  };

  const handleAddToCart = async () => {
    if (!activeVariant) return;
    await addItem(activeVariant.id, quantity);
  };

  // Submit Customer Review (Channel A)
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmittingReview(true);
    const photos = newPhotoUrl.trim() ? [newPhotoUrl.trim()] : [];

    const res = await submitCustomerReview(product.slug, {
      product_id: product.id,
      rating: newRating,
      title: newTitle.trim() || 'Verified Customer Review',
      comment: newComment.trim(),
      images: photos,
    });

    setIsSubmittingReview(false);
    setReviewSuccessMessage(res.message);
    setNewTitle('');
    setNewComment('');
    setNewPhotoUrl('');

    setTimeout(() => {
      setIsWriteReviewOpen(false);
      setReviewSuccessMessage(null);
    }, 2500);
  };

  // Filtered reviews calculation
  const displayedReviews = reviewsData.reviews.filter((r) => {
    if (reviewFilterRating > 0 && r.rating !== reviewFilterRating) {
      return false;
    }
    if (onlyWithPhotos && (!r.images || r.images.length === 0)) {
      return false;
    }
    return true;
  });

  // Pricing & Stock resolution
  const displayPrice = activeVariant ? activeVariant.price : (product.basePrice ?? product.base_price ?? 0);
  const displayCompareAt = activeVariant
    ? (activeVariant.compareAtPrice ?? activeVariant.compare_at_price)
    : (product.compareAtPrice ?? product.compare_at_price);

  const isExplicitSoldOut = Boolean(product.isSoldOut ?? product.is_sold_out);
  const variantInStock = activeVariant ? Boolean(activeVariant.inStock ?? activeVariant.in_stock) : true;
  const isAvailable = !isExplicitSoldOut && variantInStock;

  const availableQty = activeVariant
    ? (activeVariant.availableQuantity ?? activeVariant.available_quantity ?? 0)
    : 10;

  const featuredImg = product.featuredImageURL || product.featured_image_url || '';
  const currentImgUrl = activeVariantImageOverride || (product.images && product.images[activeImageIndex]?.url) || featuredImg;
  const categoryDisplayName = product.categoryName || product.category_name;

  // Brand Resolution
  const brandName = product.brandName || product.brand_name;
  const brandLogo = product.brandLogoUrl || product.brand_logo_url;
  const brandOrigin = product.brandOrigin || product.brand_origin;

  // Care Instructions Resolution
  const careTitle = product.careInstructionTitle || product.care_instruction_title;
  const careList = product.careInstructions || product.care_instructions || [];

  return (
    <div className="pb-24 lg:pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-start">
        {/* Product Image Gallery: Sticky on Desktop (>= 1024px) */}
        <div className="space-y-4 lg:sticky lg:top-24">
          <div className="aspect-square w-full rounded-[var(--brand-radius)] overflow-hidden bg-slate-50 border border-slate-100 relative">
            {currentImgUrl ? (
              <Image
                src={currentImgUrl}
                alt={product.title}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 50vw"
                className={`object-cover object-center transition-all duration-300 ${
                  !isAvailable ? 'grayscale-[20%] opacity-90' : ''
                }`}
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-slate-300">
                <ShoppingBag className="h-20 w-20" />
              </div>
            )}

            {/* Floating Badges */}
            <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
              {(product.isFeatured ?? product.is_featured) && (
                <span className="px-2.5 py-1 rounded-full bg-amber-500 text-white text-[11px] font-extrabold tracking-wide uppercase shadow-sm flex items-center gap-1">
                  <Star className="h-3 w-3 fill-white" />
                  <span>Featured Collection</span>
                </span>
              )}
              {!isAvailable && (
                <span className="px-3 py-1 rounded-full bg-rose-600 text-white text-[11px] font-extrabold tracking-wide uppercase shadow-md flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  <span>Sold Out</span>
                </span>
              )}
            </div>
          </div>

          {/* Thumbnails Strip: Touch-scrollable */}
          {product.images && product.images.length > 1 && (
            <div className="flex space-x-3 overflow-x-auto no-scrollbar pb-2">
              {product.images.map((img, idx) => (
                <button
                  key={img.id || idx}
                  onClick={() => {
                    setActiveVariantImageOverride(null);
                    setActiveImageIndex(idx);
                  }}
                  className={`relative h-16 w-16 sm:h-20 sm:w-20 rounded-lg overflow-hidden border-2 shrink-0 transition ${
                    activeImageIndex === idx && !activeVariantImageOverride
                      ? 'border-[var(--brand-primary)] ring-2 ring-[var(--brand-primary)]/20'
                      : 'border-slate-200 opacity-70 hover:opacity-100'
                  }`}
                  aria-label={`Select product image ${idx + 1}`}
                >
                  <Image
                    src={img.url}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Details & Purchasing Actions */}
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              {categoryDisplayName && (
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {categoryDisplayName}
                </span>
              )}
              {activeVariant?.sku && (
                <span className="text-xs font-mono font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded">
                  SKU: {activeVariant.sku}
                </span>
              )}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 tracking-tight font-[var(--brand-font-heading)] leading-snug">
              {product.title}
            </h1>

            {/* Clickable Social Proof Badge in Hero */}
            {reviewsData.summary.review_count > 0 && (
              <a
                href="#customer-reviews"
                className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full bg-amber-50 hover:bg-amber-100 border border-amber-200/80 text-amber-900 transition text-xs font-semibold"
              >
                <div className="flex items-center text-amber-500">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-3 w-3 ${
                        reviewsData.summary.average_rating >= star ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="font-extrabold font-mono ml-0.5">{reviewsData.summary.average_rating.toFixed(1)}</span>
                <span className="text-slate-500">({reviewsData.summary.review_count} verified reviews)</span>
              </a>
            )}
          </div>

          {/* Brand Banner */}
          {brandName && (
            <div className="flex items-center gap-3.5 p-3.5 bg-slate-50 border border-slate-200/80 rounded-[var(--brand-radius)]">
              <div className="h-11 w-11 rounded-lg overflow-hidden border border-slate-200 bg-white shrink-0 flex items-center justify-center">
                {brandLogo ? (
                  <div className="relative h-full w-full">
                    <Image
                      src={brandLogo}
                      alt={brandName}
                      fill
                      sizes="44px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <Award className="h-6 w-6 text-[var(--brand-primary)]" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-900 tracking-tight truncate">{brandName}</span>
                  <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-emerald-700 bg-emerald-100 px-1.5 py-0.5 rounded uppercase shrink-0">
                    <ShieldCheck className="h-2.5 w-2.5" />
                    Verified
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                  Authentic designer goods • Origin: {brandOrigin || 'Bangladesh'}
                </p>
              </div>
            </div>
          )}

          {/* Price and Stock Indicators */}
          <div className="flex items-baseline space-x-3 border-b border-slate-100 pb-4 flex-wrap gap-y-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-950 font-mono">
              {currency} {displayPrice.toFixed(2)}
            </span>
            {displayCompareAt && (
              <span className="text-base text-slate-400 line-through font-mono">
                {currency} {displayCompareAt.toFixed(2)}
              </span>
            )}
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${
                isAvailable
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border border-rose-200'
              }`}
            >
              {isAvailable ? 'In Stock · Ready to Dispatch' : 'Sold Out'}
            </span>
          </div>

          {/* Dynamic Variant Attributes */}
          {product.attributes && product.attributes.length > 0 && (
            <div className="space-y-4">
              {product.attributes.map((attr) => {
                const isColor =
                  attr.displayType === 'COLOR_SWATCH' ||
                  attr.display_type === 'COLOR_SWATCH' ||
                  attr.name.toLowerCase().includes('color');
                const isSize =
                  attr.code?.toLowerCase() === 'size' ||
                  attr.name.toLowerCase().includes('size');

                return (
                  <div key={attr.id} className="space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 uppercase tracking-wide">{attr.name}</span>
                        {isSize && (
                          <button
                            type="button"
                            onClick={toggleFitCheck}
                            className="inline-flex items-center gap-1 text-[10.5px] font-bold text-cyan-700 hover:text-cyan-800 bg-cyan-50 hover:bg-cyan-100 border border-cyan-200/80 px-2 py-0.5 rounded-full transition active:scale-95"
                          >
                            <Sparkles className="h-3 w-3 text-cyan-500" />
                            <span>AI Fit Check™</span>
                          </button>
                        )}
                      </div>
                      <span className="text-slate-500 font-medium">
                        {attr.values.find((v) => v.id === selectedValues[attr.id])?.displayValue ||
                          attr.values.find((v) => v.id === selectedValues[attr.id])?.value}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-2.5">
                      {attr.values.map((val) => {
                        const isSelected = selectedValues[attr.id] === val.id;
                        const hex = val.colorHex || val.color_hex;

                        if (isColor && hex) {
                          return (
                            <button
                              key={val.id}
                              type="button"
                              onClick={() => handleAttributeSelect(attr.id, val.id)}
                              className={`relative h-8 w-8 rounded-full border-2 transition flex items-center justify-center ${
                                isSelected
                                  ? 'border-[var(--brand-primary)] ring-2 ring-[var(--brand-primary)]/30 scale-105'
                                  : 'border-slate-300 hover:border-slate-400'
                              }`}
                              style={{ backgroundColor: hex }}
                              title={val.displayValue || val.value}
                              aria-label={`Select color ${val.displayValue || val.value}`}
                            >
                              {isSelected && (
                                <Check
                                  className={`h-4 w-4 ${
                                    ['#ffffff', '#fff', 'white'].includes(hex.toLowerCase())
                                      ? 'text-slate-900'
                                      : 'text-white'
                                  }`}
                                />
                              )}
                            </button>
                          );
                        }

                        return (
                          <button
                            key={val.id}
                            type="button"
                            onClick={() => handleAttributeSelect(attr.id, val.id)}
                            className={`min-h-[38px] px-3.5 py-1.5 text-xs font-semibold rounded-[var(--brand-radius)] border transition ${
                              isSelected
                                ? 'bg-[var(--brand-primary)] text-white border-[var(--brand-primary)] shadow-sm'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {val.displayValue || val.value}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Multi-Item Bundle Tiers ("Buy More & Save") Slot-Filling Engine */}
          <ProductBundleBuilder
            currentProduct={product}
            currentVariant={activeVariant}
            selectedAttributes={selectedValues}
          />

          {/* Desktop Purchasing Actions */}
          <div className="pt-2 flex flex-col sm:flex-row gap-3">
            <div className="flex items-center border border-slate-200 rounded-[var(--brand-radius)] bg-white h-11 w-32 shrink-0">
              <button
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-10 h-full flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-30 text-sm font-bold"
                aria-label="Decrease quantity"
              >
                -
              </button>
              <span className="flex-1 text-center font-mono text-sm font-bold">{quantity}</span>
              <button
                disabled={!activeVariant || quantity >= availableQty}
                onClick={() => setQuantity((q) => q + 1)}
                className="w-10 h-full flex items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-30 text-sm font-bold"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>

            <button
              disabled={!isAvailable || isLoading}
              onClick={handleAddToCart}
              className={`flex-1 h-11 text-sm font-bold rounded-[var(--brand-radius)] shadow-sm transition flex items-center justify-center space-x-2 ${
                isAvailable
                  ? 'bg-[var(--brand-primary)] text-white hover:opacity-95'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <ShoppingBag className="h-4 w-4" />
              <span>{isAvailable ? 'Add to Cart' : 'Sold Out'}</span>
            </button>
          </div>

          {/* Care Instructions Accordion */}
          {careTitle && careList.length > 0 && (
            <div className="pt-4 border-t border-slate-100">
              <div className="p-3.5 bg-slate-50 rounded-[var(--brand-radius)] border border-slate-200/70">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="h-4 w-4 text-[var(--brand-primary)]" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                    Care Guidelines: {careTitle}
                  </h4>
                </div>
                <ul className="text-xs text-slate-600 space-y-1.5 pl-4 list-disc marker:text-[var(--brand-primary)]">
                  {careList.map((inst, idx) => (
                    <li key={idx} className="leading-relaxed">
                      {inst}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Summary & Description */}
          {product.description && (
            <div className="pt-5 border-t border-slate-100">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2">
                Product Overview & Specifications
              </h4>
              <div className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
                {product.description}
              </div>
            </div>
          )}

          {/* Store Trust Badges */}
          <div className="pt-6 border-t border-slate-100 grid grid-cols-3 gap-3 text-center">
            <div className="space-y-1">
              <Truck className="h-5 w-5 text-slate-400 mx-auto" />
              <p className="text-[11px] font-semibold text-slate-800">Nationwide Dispatch</p>
            </div>
            <div className="space-y-1">
              <ShieldCheck className="h-5 w-5 text-slate-400 mx-auto" />
              <p className="text-[11px] font-semibold text-slate-800">100% Authentic</p>
            </div>
            <div className="space-y-1">
              <RefreshCw className="h-5 w-5 text-slate-400 mx-auto" />
              <p className="text-[11px] font-semibold text-slate-800">7-Day Replacement</p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION: VERIFIED CUSTOMER REVIEWS & SOCIAL PROOF ENGINE                   */}
      {/* ========================================================================= */}
      <section id="customer-reviews" className="mt-16 pt-12 border-t border-slate-200">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-slate-950 font-[var(--brand-font-heading)]">
                  Verified Customer Reviews
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold uppercase tracking-wider">
                  Authentic Social Proof
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                Ratings calculated strictly from verified buyer feedback. Products with no reviews never display unearned badges.
              </p>
            </div>

            <button
              onClick={() => setIsWriteReviewOpen(true)}
              className="px-4 py-2.5 rounded-[var(--brand-radius)] bg-slate-950 hover:bg-slate-800 text-white text-xs font-bold transition flex items-center gap-2 shadow-sm shrink-0"
            >
              <MessageSquarePlus className="h-4 w-4" />
              <span>Write a Customer Review</span>
            </button>
          </div>

          {/* Social Proof Hero Card & 5-Star Histogram */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 p-6 sm:p-8 bg-slate-50 border border-slate-200 rounded-[var(--brand-radius)]">
            {/* Left: Overall Score */}
            <div className="md:col-span-4 flex flex-col items-center justify-center text-center p-4 border-b md:border-b-0 md:border-r border-slate-200">
              <div className="text-5xl font-black text-slate-950 font-mono tracking-tight">
                {reviewsData.summary.average_rating > 0 ? reviewsData.summary.average_rating.toFixed(1) : '—'}
              </div>
              <div className="flex items-center gap-1 my-2 text-amber-500">
                {[1, 2, 3, 4, 5].map((s) => (
                  <Star
                    key={s}
                    className={`h-4 w-4 ${
                      reviewsData.summary.average_rating >= s ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs font-semibold text-slate-700">
                Based on {reviewsData.summary.review_count} verified reviews
              </span>
              <span className="text-[11px] text-slate-400 mt-0.5">
                {reviewsData.summary.verified_buyer_count} verified purchase badges
              </span>
            </div>

            {/* Middle: Histogram Breakdown */}
            <div className="md:col-span-8 flex flex-col justify-center space-y-2">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = reviewsData.summary.rating_breakdown[star] || 0;
                const total = reviewsData.summary.review_count || 1;
                const pct = reviewsData.summary.review_count > 0 ? Math.round((count / total) * 100) : 0;

                return (
                  <div key={star} className="flex items-center gap-3 text-xs">
                    <span className="w-12 font-bold text-slate-700 flex items-center gap-1 font-mono">
                      <span>{star}</span>
                      <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    </span>
                    <div className="flex-1 h-2.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-10 text-right font-mono text-slate-500 text-[11px]">{pct}%</span>
                    <span className="w-8 text-right font-mono text-slate-400 text-[11px]">({count})</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Customer Fit Photo Proof Gallery Strip */}
          {reviewsData.photo_urls && reviewsData.photo_urls.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Camera className="h-4 w-4 text-[var(--brand-primary)]" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                  Buyer Fit & Unboxing Photos ({reviewsData.photo_urls.length})
                </h3>
              </div>
              <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
                {reviewsData.photo_urls.map((photo, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setLightboxImageUrl(photo)}
                    className="relative aspect-square w-20 sm:w-24 rounded-lg overflow-hidden border border-slate-200 shadow-xs hover:opacity-90 shrink-0 transition"
                  >
                    <Image
                      src={photo}
                      alt="Customer review photo"
                      fill
                      sizes="96px"
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Reviews Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setReviewFilterRating(0);
                  setOnlyWithPhotos(false);
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition ${
                  reviewFilterRating === 0 && !onlyWithPhotos
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                All Reviews ({reviewsData.reviews.length})
              </button>

              {[5, 4].map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setReviewFilterRating(s);
                    setOnlyWithPhotos(false);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1 ${
                    reviewFilterRating === s
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <span>{s} Stars</span>
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                </button>
              ))}

              <button
                type="button"
                onClick={() => setOnlyWithPhotos(!onlyWithPhotos)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1 ${
                  onlyWithPhotos
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Camera className="h-3 w-3" />
                <span>With Photos</span>
              </button>
            </div>

            <span className="text-xs text-slate-400">
              Showing {displayedReviews.length} of {reviewsData.reviews.length} reviews
            </span>
          </div>

          {/* Review Cards Grid */}
          <div className="space-y-4">
            {displayedReviews.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 rounded-[var(--brand-radius)] border border-slate-100 text-slate-500 text-xs">
                No reviews found matching the selected filter.
              </div>
            ) : (
              displayedReviews.map((rev) => (
                <div
                  key={rev.id}
                  className="p-5 sm:p-6 bg-white border border-slate-100 rounded-[var(--brand-radius)] shadow-xs space-y-3"
                >
                  {/* Reviewer Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-slate-100 text-slate-700 font-extrabold flex items-center justify-center text-xs">
                        {rev.customer_name.substring(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs sm:text-sm font-bold text-slate-900">
                            {rev.customer_name}
                          </span>
                          {rev.is_verified_purchase && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-bold">
                              <ShieldCheck className="h-3 w-3 text-emerald-600" />
                              <span>Verified Buyer</span>
                            </span>
                          )}
                          {rev.is_featured && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[10px] font-extrabold">
                              <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                              <span>Featured</span>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <span className="text-[11px] text-slate-400 font-mono">
                      {rev.created_at}
                    </span>
                  </div>

                  {/* Stars & Headline */}
                  <div>
                    <div className="flex items-center gap-1 text-amber-500 mb-1">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`h-3.5 w-3.5 ${
                            rev.rating >= s ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                          }`}
                        />
                      ))}
                    </div>
                    <h4 className="text-sm font-bold text-slate-950">
                      {rev.title}
                    </h4>
                  </div>

                  {/* Comment */}
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {rev.comment}
                  </p>

                  {/* Review Fit Photos */}
                  {rev.images && rev.images.length > 0 && (
                    <div className="flex gap-2.5 pt-1">
                      {rev.images.map((img, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setLightboxImageUrl(img)}
                          className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-lg overflow-hidden border border-slate-200 hover:opacity-90 transition shrink-0"
                        >
                          <Image
                            src={img}
                            alt="Customer fit photo"
                            fill
                            sizes="80px"
                            className="object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* CHANNEL A: WRITE REVIEW MODAL DRAWER                                      */}
      {/* ========================================================================= */}
      {isWriteReviewOpen && (
        <div
          className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          onClick={() => setIsWriteReviewOpen(false)}
        >
          <div
            className="bg-white rounded-xl max-w-lg w-full p-6 sm:p-7 shadow-2xl relative space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-slate-950">
                  Write a Verified Review
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Share your experience with <strong>{product.title}</strong>
                </p>
              </div>
              <button
                onClick={() => setIsWriteReviewOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {reviewSuccessMessage ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <span>{reviewSuccessMessage}</span>
              </div>
            ) : (
              <form onSubmit={handleReviewSubmit} className="space-y-4">
                {/* 1-5 Star Picker */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Overall Rating *
                  </label>
                  <div className="flex items-center gap-1.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setNewRating(s)}
                        onMouseEnter={() => setNewHoverRating(s)}
                        onMouseLeave={() => setNewHoverRating(0)}
                        className="p-1 hover:scale-110 transition"
                      >
                        <Star
                          className={`h-6 w-6 ${
                            (newHoverRating || newRating) >= s
                              ? 'fill-amber-400 text-amber-400'
                              : 'text-slate-300'
                          }`}
                        />
                      </button>
                    ))}
                    <span className="ml-2 font-mono text-xs font-bold text-amber-600">
                      {newRating} / 5 Stars
                    </span>
                  </div>
                </div>

                {/* Review Headline */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Review Headline
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Luxurious fabric, fits true to size!"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30"
                  />
                </div>

                {/* Detailed Feedback */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Detailed Feedback *
                  </label>
                  <textarea
                    rows={4}
                    placeholder="How does it fit? What do you think about the material, stitching, and packaging?"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30"
                    required
                  />
                </div>

                {/* Unboxing / Fit Photo URL */}
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Fit / Unboxing Photo URL (Optional)
                  </label>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/photo-..."
                    value={newPhotoUrl}
                    onChange={(e) => setNewPhotoUrl(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]/30"
                  />
                  <span className="text-[10px] text-slate-400 mt-1 block">
                    Upload fit photo to demonstrate real social proof to fellow shoppers.
                  </span>
                </div>

                {/* Moderation Gate Notice */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start gap-2">
                  <ShieldCheck className="h-4 w-4 text-[var(--brand-primary)] shrink-0 mt-0.5" />
                  <p className="text-[11px] text-slate-600 leading-normal">
                    To safeguard reviews from spam, your submission is routed through our strict moderation pipeline. It will appear publicly upon verification.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsWriteReviewOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingReview}
                    className="px-5 py-2 text-xs font-bold text-white bg-[var(--brand-primary)] hover:opacity-90 rounded-lg transition shadow-sm"
                  >
                    {isSubmittingReview ? 'Submitting...' : 'Submit for Moderation'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LIGHTBOX PREVIEW MODAL                                                    */}
      {/* ========================================================================= */}
      {lightboxImageUrl && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxImageUrl(null)}
        >
          <div
            className="relative max-w-2xl max-h-[85vh] rounded-lg overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setLightboxImageUrl(null)}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-black/60 text-white hover:bg-black transition"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={lightboxImageUrl}
              alt="Buyer fit proof"
              className="max-h-[85vh] max-w-full object-contain"
            />
          </div>
        </div>
      )}

      {/* Smartphone (< 768px / lg:hidden) Thumb-Driven Sticky Bottom CTA Bar */}
      <div className="fixed bottom-[52px] left-0 right-0 p-3 sm:p-4 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 flex items-center justify-between gap-4 shadow-2xl lg:hidden">
        <div className="flex flex-col">
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            {isAvailable ? 'Total Price' : 'Availability'}
          </span>
          <div className="flex items-baseline gap-1.5">
            <span className="text-base sm:text-lg font-black text-slate-950 font-mono">
              {currency} {(displayPrice * quantity).toFixed(2)}
            </span>
            {quantity > 1 && (
              <span className="text-[10px] text-slate-400 font-mono">
                ({quantity}x)
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Mobile Quantity Stepper */}
          {isAvailable && (
            <div className="flex items-center border border-slate-300 rounded-[var(--brand-radius)] bg-white h-11">
              <button
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="w-8 h-full flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30 text-sm font-bold"
                aria-label="Decrease quantity"
              >
                -
              </button>
              <span className="px-1.5 font-mono text-xs font-semibold">{quantity}</span>
              <button
                disabled={!activeVariant || quantity >= availableQty}
                onClick={() => setQuantity((q) => q + 1)}
                className="w-8 h-full flex items-center justify-center text-slate-600 hover:bg-slate-50 disabled:opacity-30 text-sm font-bold"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
          )}

          {/* Sticky CTA Button */}
          <button
            disabled={!isAvailable || isLoading}
            onClick={handleAddToCart}
            className={`min-h-[44px] px-5 py-2.5 text-xs sm:text-sm font-bold rounded-[var(--brand-radius)] shadow-md transition flex items-center justify-center space-x-1.5 ${
              isAvailable
                ? 'bg-[var(--brand-primary)] text-white hover:opacity-95'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            <ShoppingBag className="h-4 w-4" />
            <span>{isAvailable ? 'Add to Cart' : 'Sold Out'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
