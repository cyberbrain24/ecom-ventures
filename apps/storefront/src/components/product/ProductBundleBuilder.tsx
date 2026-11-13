'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import dynamic from 'next/dynamic';
import {
  Layers,
  Sparkles,
  Truck,
  Plus,
  Trash2,
  RefreshCw,
  ShoppingBag,
  CheckCircle2,
  Percent,
} from 'lucide-react';
import { StorefrontBundleTier, BundleProductSelection, BundleSlotState } from '../../types/bundle';
import { useCart } from '../../context/CartContext';

// Dynamically import heavy product selector modal
const ChooseProductModal = dynamic(
  () => import('./ChooseProductModal').then((m) => m.ChooseProductModal),
  { ssr: false }
);

interface ProductBundleBuilderProps {
  currentProduct: {
    id: string;
    title: string;
    slug: string;
    images?: Array<{ url: string }>;
  };
  currentVariant?: {
    id: string;
    title: string;
    sku: string;
    price: number;
    compare_at_price?: number | null;
  };
  selectedAttributes?: Record<string, string>;
}

const DEFAULT_TIERS: StorefrontBundleTier[] = [
  {
    id: 'bt-duo',
    name: 'Duo',
    required_items_count: 2,
    discount_percentage: 5.0,
    badge_text: 'POPULAR',
    subtitle: 'Mix & Match Any 2 Products From Our Collection',
    perks: ['SAVE 5%', 'Everyday Pair Saver'],
    has_free_delivery: false,
    display_order: 1,
    is_active: true,
  },
  {
    id: 'bt-trio',
    name: 'Trio',
    required_items_count: 3,
    discount_percentage: 10.0,
    badge_text: 'MOST POPULAR',
    subtitle: 'Mix & Match Any 3 Products From Our Collection',
    perks: ['SAVE 10%', 'FREE DELIVERY ALL OVER BANGLADESH', 'Fan Favorite Bundle'],
    has_free_delivery: true,
    display_order: 2,
    is_active: true,
  },
  {
    id: 'bt-4pack',
    name: '4 Pack',
    required_items_count: 4,
    discount_percentage: 12.0,
    badge_text: 'BEST VALUE',
    subtitle: 'Mix & Match Any 4 Products From Our Collection',
    perks: ['SAVE 12%', 'FREE DELIVERY ALL OVER BANGLADESH', 'Complete Wardrobe Upgrade'],
    has_free_delivery: true,
    display_order: 3,
    is_active: true,
  },
  {
    id: 'bt-5pack',
    name: '5 Pack',
    required_items_count: 5,
    discount_percentage: 15.0,
    badge_text: 'MAXIMUM VALUE',
    subtitle: 'Mix & Match Any 5 Products From Our Collection',
    perks: ['SAVE 15%', 'FREE DELIVERY ALL OVER BANGLADESH', 'Maximum Percentage Savings'],
    has_free_delivery: true,
    display_order: 4,
    is_active: true,
  },
];

export const ProductBundleBuilder: React.FC<ProductBundleBuilderProps> = ({
  currentProduct,
  currentVariant,
}) => {
  const { addItem, openDrawer } = useCart();
  const [tiers, setTiers] = useState<StorefrontBundleTier[]>(DEFAULT_TIERS);
  const [selectedTierId, setSelectedTierId] = useState<string>('bt-trio');
  const [slots, setSlots] = useState<Record<number, BundleProductSelection | null>>({});
  const [activeModalSlot, setActiveModalSlot] = useState<number | null>(null);
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  // Load tiers from backend if available
  useEffect(() => {
    const fetchTiers = async () => {
      try {
        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';
        const res = await fetch(`${apiBase}/storefront/bundle-tiers`);
        if (res.ok) {
          const data = await res.json();
          const list = data?.data !== undefined ? data.data : data;
          if (Array.isArray(list) && list.length > 0) {
            setTiers(list);
            const mostPopular = list.find((t) => t.required_items_count === 3) || list[0];
            setSelectedTierId(mostPopular.id);
          }
        }
      } catch (e) {
        // Fallback to DEFAULT_TIERS
      }
    };
    fetchTiers();
  }, []);

  const activeTier = tiers.find((t) => t.id === selectedTierId) || tiers[1] || DEFAULT_TIERS[1];
  const requiredCount = activeTier.required_items_count;
  const discountPct = activeTier.discount_percentage;

  // Sync Slot 1 Anchor with currently active product & variant
  const anchorPrice = currentVariant?.price || 1000;
  const anchorSavings = Math.round((anchorPrice * (discountPct / 100)) * 100) / 100;
  const anchorDiscounted = Math.max(0, anchorPrice - anchorSavings);
  const anchorImageUrl =
    currentProduct.images && currentProduct.images.length > 0
      ? currentProduct.images[0].url
      : 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=600&auto=format&fit=crop&q=80';

  const anchorSelection: BundleProductSelection = {
    productId: currentProduct.id,
    productTitle: currentProduct.title,
    productSlug: currentProduct.slug,
    imageUrl: anchorImageUrl,
    variantId: currentVariant?.id || 'default-variant',
    variantTitle: currentVariant?.title || 'Standard',
    sku: currentVariant?.sku || 'SKU-ANCHOR',
    originalPrice: anchorPrice,
    discountedPrice: anchorDiscounted,
    savings: anchorSavings,
  };

  // Count filled slots (Slot 1 is always filled)
  let filledCount = 1;
  for (let i = 2; i <= requiredCount; i++) {
    if (slots[i]) filledCount++;
  }

  const isUnlocked = filledCount >= requiredCount;
  const slotsRemaining = Math.max(0, requiredCount - filledCount);

  // Compute live bundle pricing totals
  let totalOriginal = anchorPrice;
  let totalDiscounted = anchorDiscounted;

  for (let i = 2; i <= requiredCount; i++) {
    const s = slots[i];
    if (s) {
      totalOriginal += s.originalPrice;
      const sSavings = Math.round((s.originalPrice * (discountPct / 100)) * 100) / 100;
      totalDiscounted += Math.max(0, s.originalPrice - sSavings);
    }
  }

  const totalSavings = Math.round((totalOriginal - totalDiscounted) * 100) / 100;

  const handleSlotSelect = (slotNum: number, sel: BundleProductSelection) => {
    setSlots((prev) => ({ ...prev, [slotNum]: sel }));
  };

  const handleSlotRemove = (slotNum: number) => {
    setSlots((prev) => {
      const next = { ...prev };
      delete next[slotNum];
      return next;
    });
  };

  const handleAddBundleToCart = async () => {
    if (!isUnlocked || isAddingToCart) return;

    setIsAddingToCart(true);
    try {
      // 1. Add Anchor item
      if (currentVariant?.id) {
        await addItem(currentVariant.id, 1);
      }

      // 2. Add each mix-and-match item
      for (let i = 2; i <= requiredCount; i++) {
        const item = slots[i];
        if (item && item.variantId) {
          await addItem(item.variantId, 1);
        }
      }

      // 3. Persist bundle session metadata for checkout free shipping
      if (typeof window !== 'undefined') {
        const bundleSession = {
          tierId: activeTier.id,
          tierName: activeTier.name,
          discountPercentage: activeTier.discount_percentage,
          hasFreeDelivery: activeTier.has_free_delivery,
          timestamp: Date.now(),
        };
        localStorage.setItem('ecom_active_bundle', JSON.stringify(bundleSession));
        if (activeTier.has_free_delivery) {
          localStorage.setItem('ecom_bundle_free_delivery', 'true');
        }
      }

      openDrawer();
    } catch (err) {
      console.error('Failed to add bundle to cart', err);
    } finally {
      setIsAddingToCart(false);
    }
  };

  return (
    <div className="mt-6 border-2 border-[var(--brand-primary)]/20 bg-gradient-to-b from-orange-50/20 via-white to-slate-50/40 rounded-2xl p-4 sm:p-5 shadow-sm space-y-5">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-orange-100/80 pb-3">
        <div className="flex items-center space-x-2">
          <div className="h-7 w-7 rounded-lg bg-[var(--brand-primary)] text-white flex items-center justify-center shadow-sm">
            <Layers className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-black tracking-wider uppercase text-slate-900 font-[var(--brand-font-heading)] flex items-center gap-2">
              Buy More & Save
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-[var(--brand-primary)]">
                AOV Multiplier
              </span>
            </h3>
            <p className="text-[11px] text-slate-500">
              Choose a combo bundle below to unlock escalating discounts & perks
            </p>
          </div>
        </div>

        {activeTier.has_free_delivery && (
          <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[11px] font-bold self-start sm:self-auto">
            <Truck className="h-3.5 w-3.5" />
            <span>Free Delivery Included</span>
          </div>
        )}
      </div>

      {/* Tier Selector Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {tiers.map((tier) => {
          const isSelected = tier.id === selectedTierId;
          return (
            <button
              key={tier.id}
              type="button"
              onClick={() => setSelectedTierId(tier.id)}
              className={`relative text-left p-2.5 sm:p-3 rounded-xl border-2 transition-all flex flex-col justify-between ${
                isSelected
                  ? 'border-[var(--brand-primary)] bg-white shadow-md ring-2 ring-[var(--brand-primary)]/20 scale-[1.02]'
                  : 'border-slate-200 bg-white/70 hover:border-slate-300 hover:bg-white'
              }`}
            >
              {tier.badge_text && (
                <span
                  className={`absolute -top-2.5 right-2 text-[9px] font-black px-2 py-0.5 rounded-md uppercase tracking-wide shadow-xs ${
                    isSelected
                      ? 'bg-[var(--brand-primary)] text-white'
                      : 'bg-slate-700 text-white'
                  }`}
                >
                  {tier.badge_text}
                </span>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-slate-900 font-[var(--brand-font-heading)]">
                    {tier.name}
                  </span>
                  <span className="text-[11px] font-mono text-slate-400">
                    {tier.required_items_count} Items
                  </span>
                </div>
                <div className="mt-1 flex items-baseline gap-1">
                  <span className="text-sm font-black text-[var(--brand-primary)] font-mono">
                    {tier.discount_percentage}% OFF
                  </span>
                </div>
              </div>

              <div className="mt-2 pt-2 border-t border-slate-100 flex items-center gap-1 text-[10px] font-semibold text-slate-500">
                {tier.has_free_delivery ? (
                  <span className="text-emerald-600 flex items-center gap-1">
                    <Truck className="h-3 w-3 shrink-0" /> Free Shipping
                  </span>
                ) : (
                  <span>Standard Shipping</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Tier Perks Highlights */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {activeTier.perks.map((perk, idx) => (
          <span
            key={idx}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 font-bold text-[11px]"
          >
            <Sparkles className="h-3 w-3 text-[var(--brand-primary)]" />
            {perk}
          </span>
        ))}
      </div>

      {/* Slots Section */}
      <div className="space-y-3">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {/* Slot 1: Anchor Product (Always Filled) */}
          <div className="relative bg-white border-2 border-[var(--brand-primary)]/40 rounded-xl p-2.5 flex flex-col justify-between shadow-xs">
            <span className="absolute top-2 left-2 text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-[var(--brand-primary)] text-white">
              Slot #1 (Current)
            </span>
            <div className="mt-4 aspect-square rounded-lg overflow-hidden bg-slate-100 mb-2 relative">
              <Image
                src={anchorSelection.imageUrl}
                alt={anchorSelection.productTitle}
                fill
                sizes="120px"
                className="object-cover"
              />
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 line-clamp-1">{anchorSelection.productTitle}</p>
              <p className="text-[10px] text-slate-400 line-clamp-1">{anchorSelection.variantTitle}</p>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-xs font-extrabold text-[var(--brand-primary)] font-mono">
                  ৳ {anchorSelection.discountedPrice.toLocaleString()}
                </span>
                <span className="text-[10px] line-through text-slate-400 font-mono">
                  ৳ {anchorSelection.originalPrice.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Slots 2..N: Dynamic Mix & Match Slots */}
          {Array.from({ length: requiredCount - 1 }).map((_, idx) => {
            const slotNum = idx + 2;
            const selection = slots[slotNum];

            if (selection) {
              const itemSavings = Math.round((selection.originalPrice * (discountPct / 100)) * 100) / 100;
              const itemDiscounted = Math.max(0, selection.originalPrice - itemSavings);

              return (
                <div
                  key={slotNum}
                  className="relative bg-white border border-slate-200 rounded-xl p-2.5 flex flex-col justify-between shadow-xs group"
                >
                  <span className="absolute top-2 left-2 text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                    Slot #{slotNum}
                  </span>
                  <div className="absolute top-2 right-2 flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setActiveModalSlot(slotNum)}
                      className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-500 transition"
                      title="Change Garment"
                    >
                      <RefreshCw className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleSlotRemove(slotNum)}
                      className="p-1 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 transition"
                      title="Remove from Slot"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="mt-5 aspect-square rounded-lg overflow-hidden bg-slate-100 mb-2 relative">
                    <Image
                      src={selection.imageUrl}
                      alt={selection.productTitle}
                      fill
                      sizes="120px"
                      className="object-cover"
                    />
                  </div>

                  <div>
                    <p className="text-xs font-bold text-slate-900 line-clamp-1">{selection.productTitle}</p>
                    <p className="text-[10px] text-slate-400 line-clamp-1">{selection.variantTitle}</p>
                    <div className="mt-1 flex items-baseline gap-1.5">
                      <span className="text-xs font-extrabold text-[var(--brand-primary)] font-mono">
                        ৳ {itemDiscounted.toLocaleString()}
                      </span>
                      <span className="text-[10px] line-through text-slate-400 font-mono">
                        ৳ {selection.originalPrice.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <button
                key={slotNum}
                type="button"
                onClick={() => setActiveModalSlot(slotNum)}
                className="group border-2 border-dashed border-slate-300 hover:border-[var(--brand-primary)] rounded-xl p-4 flex flex-col items-center justify-center text-center transition bg-slate-50/50 hover:bg-orange-50/30 min-h-[170px]"
              >
                <div className="h-9 w-9 rounded-full bg-white group-hover:bg-[var(--brand-primary)] group-hover:text-white text-slate-400 border border-slate-200 flex items-center justify-center transition shadow-xs">
                  <Plus className="h-4 w-4" />
                </div>
                <span className="mt-2 text-xs font-bold text-slate-800 group-hover:text-[var(--brand-primary)] transition">
                  Choose Product
                </span>
                <span className="text-[10px] text-slate-400 mt-0.5">Slot #{slotNum} Empty</span>
              </button>
            );
          })}
        </div>

        {/* Progress & Status Bar */}
        <div
          className={`p-3 rounded-xl flex items-center justify-between text-xs font-bold transition-all ${
            isUnlocked
              ? 'bg-emerald-500 text-white shadow-sm'
              : 'bg-slate-900 text-white'
          }`}
        >
          <div className="flex items-center space-x-2">
            {isUnlocked ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <Sparkles className="h-4 w-4 text-[var(--brand-primary)]" />
            )}
            <span>
              {isUnlocked
                ? `🎉 ${activeTier.name} Bundle Unlocked! (${filledCount}/${requiredCount} Filled) — Save ${discountPct}% OFF`
                : `⚡ SELECT ${slotsRemaining} MORE GARMENT${slotsRemaining > 1 ? 'S' : ''} TO UNLOCK BUNDLE (${filledCount}/${requiredCount} Filled)`}
            </span>
          </div>

          <span className="font-mono text-[11px] opacity-90">
            {filledCount} / {requiredCount}
          </span>
        </div>
      </div>

      {/* Pricing Summary & Action CTA */}
      <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-baseline space-x-2">
            <span className="text-xs text-slate-500 font-medium">Bundle Total:</span>
            <span className="text-lg font-black text-slate-900 font-mono">
              ৳ {totalDiscounted.toLocaleString()}
            </span>
            {totalSavings > 0 && (
              <span className="text-xs line-through text-slate-400 font-mono">
                ৳ {totalOriginal.toLocaleString()}
              </span>
            )}
          </div>
          {totalSavings > 0 && (
            <p className="text-[11px] font-bold text-emerald-600 mt-0.5">
              You save ৳ {totalSavings.toLocaleString()} ({discountPct}% OFF)
            </p>
          )}
        </div>

        <button
          type="button"
          disabled={!isUnlocked || isAddingToCart}
          onClick={handleAddBundleToCart}
          className={`px-6 py-3 rounded-[var(--brand-radius)] text-xs font-bold flex items-center justify-center space-x-2 transition shadow-md ${
            isUnlocked
              ? 'bg-[var(--brand-primary)] text-white hover:opacity-95 cursor-pointer'
              : 'bg-slate-200 text-slate-400 cursor-not-allowed'
          }`}
        >
          <ShoppingBag className="h-4 w-4" />
          <span>
            {isAddingToCart
              ? 'Adding Bundle...'
              : isUnlocked
              ? `Add ${activeTier.name} Bundle to Cart`
              : `Fill All ${requiredCount} Slots to Add`}
          </span>
        </button>
      </div>

      {/* Catalog Selector Modal */}
      {activeModalSlot !== null && (
        <ChooseProductModal
          isOpen={activeModalSlot !== null}
          slotNumber={activeModalSlot}
          discountPercentage={discountPct}
          onClose={() => setActiveModalSlot(null)}
          onSelect={(sel) => handleSlotSelect(activeModalSlot, sel)}
        />
      )}
    </div>
  );
};
