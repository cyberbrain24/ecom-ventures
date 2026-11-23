'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, X } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { PublicCategory } from '../../types/catalog';

interface MobileCategoryDrawerProps {
  /** Active categories of the current store, loaded from the store API. */
  categories?: PublicCategory[];
}

/**
 * Mobile category drawer. Shows only the store's active categories from the API;
 * when there are none, it says so.
 */
export const MobileCategoryDrawer: React.FC<MobileCategoryDrawerProps> = ({ categories = [] }) => {
  const { isCategoryDrawerOpen, closeCategoryDrawer } = useCart();
  const router = useRouter();

  if (!isCategoryDrawerOpen) return null;

  const handleCategoryClick = (slug: string) => {
    closeCategoryDrawer();
    router.push(`/catalog?category=${slug}`);
  };

  return (
    <>
      {/* 1. Backdrop (Click-outside dismissal) */}
      <div
        onClick={closeCategoryDrawer}
        className="fixed inset-0 z-[99988] bg-slate-950/60 backdrop-blur-xs lg:hidden animate-in fade-in duration-200"
        aria-hidden="true"
      />

      {/* 2. Category menu drawer (< 1024px) */}
      <div
        role="dialog"
        aria-label="Mobile Category Drawer"
        className="fixed left-0 right-0 z-[99990] lg:hidden bg-slate-950/96 backdrop-blur-2xl border-y border-white/10 shadow-2xl flex flex-col animate-category-drawer overflow-hidden"
        style={{
          top: 'var(--storefront-header-height, 64px)',
          bottom: '0px',
          height: 'calc(100dvh - var(--storefront-header-height, 64px))',
          maxHeight: 'calc(100dvh - var(--storefront-header-height, 64px))',
        }}
      >
        {/* Drawer Quick Control Bar */}
        <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between bg-slate-900/50 flex-shrink-0">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-300">Categories</span>
          <button
            onClick={closeCategoryDrawer}
            className="p-1 rounded-full text-slate-400 hover:text-white transition"
            aria-label="Close categories"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Quick Navigation Pills */}
        <div className="px-3 py-2 border-b border-white/10 flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-shrink-0 bg-slate-900/40">
          {[
            { label: 'All Products', href: '/catalog' },
            { label: 'Blog', href: '/blog' },
            { label: 'Track Order', href: '/orders/lookup' },
            { label: 'About', href: '/about' },
          ].map((pill) => (
            <Link
              key={pill.label}
              href={pill.href}
              onClick={closeCategoryDrawer}
              className="text-[10px] font-medium tracking-wide text-slate-300 hover:text-cyan-300 bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1 rounded-full whitespace-nowrap transition active:scale-95 flex-shrink-0"
            >
              {pill.label}
            </Link>
          ))}
        </div>

        {/* Scrollable category canvas */}
        <div className="flex-1 overflow-y-auto no-scrollbar py-3 space-y-5">
          {categories.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-xs text-slate-400">No categories yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="px-4 flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-widest text-slate-200">Shop by category</h3>
                <Link
                  href="/catalog"
                  onClick={closeCategoryDrawer}
                  className="text-[10.5px] font-bold text-cyan-400 hover:text-cyan-300 transition flex items-center gap-0.5"
                >
                  <span>All</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-1">
                {categories.map((cat) => (
                  <button
                    key={cat.id || cat.slug}
                    type="button"
                    onClick={() => handleCategoryClick(cat.slug)}
                    className="flex flex-col items-center flex-shrink-0 group focus:outline-none"
                    style={{ width: '82px' }}
                  >
                    <div className="w-[82px] h-[82px] rounded-xl overflow-hidden border border-white/15 bg-slate-900 group-active:scale-95 transition-transform duration-150 relative shadow-md flex items-center justify-center">
                      {cat.image_url ? (
                        <img
                          src={cat.image_url}
                          alt={cat.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 text-cyan-400 font-black text-xl">
                          {cat.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-200 group-hover:text-cyan-300 text-center leading-tight mt-1.5 line-clamp-2 transition-colors">
                      {cat.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
