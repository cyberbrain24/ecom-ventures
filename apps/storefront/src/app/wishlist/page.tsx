'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '../../context/CartContext';
import { ShoppingBag, Trash2, Heart, ArrowRight } from 'lucide-react';
import {
  WishlistItem,
  getStoredWishlist,
  removeWishlistItem,
  clearWishlist,
} from '../../lib/wishlist';

export default function WishlistPage() {
  const { addItem } = useCart();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [mounted, setMounted] = useState(false);

  const loadItems = () => {
    setItems(getStoredWishlist());
  };

  useEffect(() => {
    setMounted(true);
    loadItems();

    const handleUpdate = () => {
      loadItems();
    };

    window.addEventListener('ecom_wishlist_updated', handleUpdate);
    return () => {
      window.removeEventListener('ecom_wishlist_updated', handleUpdate);
    };
  }, []);

  const handleRemove = (id: string) => {
    removeWishlistItem(id);
    loadItems();
  };

  const handleClear = () => {
    if (!confirm('Clear all items from your saved wishlist?')) return;
    clearWishlist();
    loadItems();
  };

  const handleMoveToBag = (item: WishlistItem) => {
    const targetId = item.variant_id || item.id;
    if (targetId) {
      addItem(targetId, 1).catch(() => {});
    }
    handleRemove(item.id);
  };

  if (!mounted) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-8 min-h-[400px]">
        <div className="h-8 w-48 bg-slate-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-rose-600 mb-1">
            <Heart className="h-4 w-4 fill-rose-600" />
            <span>Saved Items</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 font-[var(--brand-font-heading)] tracking-tight">
            My Wishlist ({items.length} {items.length === 1 ? 'Item' : 'Items'})
          </h1>
        </div>

        {items.length > 0 && (
          <button
            onClick={handleClear}
            className="text-xs font-bold text-slate-500 hover:text-rose-600 transition self-start sm:self-auto cursor-pointer"
          >
            Clear Entire Wishlist
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="py-20 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200 space-y-4">
          <Heart className="h-12 w-12 text-slate-300 mx-auto" />
          <h2 className="text-lg font-bold text-slate-900">Your wishlist is currently empty.</h2>
          <p className="text-sm text-slate-500 max-w-sm mx-auto">
            Explore our collection and click the heart icon on any product to save your favorite items here.
          </p>
          <Link
            href="/catalog"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-[var(--brand-primary)] text-white text-xs font-bold uppercase tracking-wider hover:opacity-90 transition shadow-sm"
          >
            <span>Browse Catalog</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="divide-y divide-slate-100">
            {items.map((item) => (
              <div
                key={item.id}
                className="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
              >
                <div className="flex items-center gap-4">
                  <div className="relative w-20 h-24 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                    {item.featured_image_url ? (
                      <Image
                        src={item.featured_image_url}
                        alt={item.title}
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-400">
                        <ShoppingBag className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                  <div>
                    {item.category_name && (
                      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-0.5">
                        {item.category_name}
                      </div>
                    )}
                    <Link
                      href={`/product/${item.slug}`}
                      className="text-sm sm:text-base font-bold text-slate-900 hover:underline"
                    >
                      {item.title}
                    </Link>
                    <div className="text-sm font-mono font-bold text-slate-800 mt-1">
                      ৳{item.price.toLocaleString()} BDT
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                  <button
                    onClick={() => handleMoveToBag(item)}
                    className="px-4 py-2 rounded-xl bg-[var(--brand-primary)] text-white text-xs font-bold uppercase tracking-wider hover:opacity-90 transition flex items-center gap-2 shadow-xs cursor-pointer"
                  >
                    <ShoppingBag className="h-3.5 w-3.5" />
                    <span>Move to Bag</span>
                  </button>
                  <button
                    onClick={() => handleRemove(item.id)}
                    className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                    title="Remove item"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
