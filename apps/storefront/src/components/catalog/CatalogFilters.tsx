'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { PublicCategory } from '../../types/catalog';
import { SlidersHorizontal, X, Check, RotateCcw } from 'lucide-react';

interface CatalogFiltersProps {
  categories: PublicCategory[];
  minPrice: number;
  maxPrice: number;
}

export const CatalogFilters: React.FC<CatalogFiltersProps> = ({ categories, minPrice, maxPrice }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);

  const activeCategory = searchParams.get('category') || '';
  const [minVal, setMinVal] = useState(searchParams.get('min_price') || '');
  const [maxVal, setMaxVal] = useState(searchParams.get('max_price') || '');
  const inStockOnly = searchParams.get('in_stock') === 'true';

  const activeFilterCount = [
    activeCategory ? 1 : 0,
    searchParams.get('min_price') || searchParams.get('max_price') ? 1 : 0,
    inStockOnly ? 1 : 0,
    searchParams.get('search') ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  const updateParam = (key: string, value: string | null) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    if (value === null || value === '') {
      current.delete(key);
    } else {
      current.set(key, value);
    }
    current.set('page', '1'); // Reset to page 1 on filter alteration
    router.push(`${pathname}?${current.toString()}`);
  };

  const handlePriceFilter = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    if (minVal) current.set('min_price', minVal);
    else current.delete('min_price');

    if (maxVal) current.set('max_price', maxVal);
    else current.delete('max_price');

    current.set('page', '1');
    router.push(`${pathname}?${current.toString()}`);
    setMobileDrawerOpen(false);
  };

  const handleResetFilters = () => {
    setMinVal('');
    setMaxVal('');
    router.push(pathname);
    setMobileDrawerOpen(false);
  };

  // Reusable filter content used in both Desktop Sidebar and Mobile Drawer
  const filterContent = (
    <div className="space-y-6 sm:space-y-8">
      {/* Categories Hierarchy */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b pb-2 mb-3">
          Categories
        </h4>
        <ul className="space-y-1 text-sm">
          <li>
            <button
              onClick={() => {
                updateParam('category', null);
                if (mobileDrawerOpen) setMobileDrawerOpen(false);
              }}
              className={`w-full text-left min-h-[44px] sm:min-h-[36px] flex items-center px-3 rounded-lg transition ${
                activeCategory === ''
                  ? 'bg-slate-100 font-bold text-[var(--brand-primary)]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span>All Categories</span>
              {activeCategory === '' && <Check className="ml-auto h-4 w-4" />}
            </button>
          </li>
          {categories.map((cat) => (
            <li key={cat.id}>
              <button
                onClick={() => {
                  updateParam('category', cat.slug);
                  if (mobileDrawerOpen) setMobileDrawerOpen(false);
                }}
                className={`w-full text-left min-h-[44px] sm:min-h-[36px] flex items-center px-3 rounded-lg transition ${
                  activeCategory === cat.slug
                    ? 'bg-slate-100 font-bold text-[var(--brand-primary)]'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span>{cat.name}</span>
                {activeCategory === cat.slug && <Check className="ml-auto h-4 w-4" />}
              </button>
              {cat.children && cat.children.length > 0 && (
                <ul className="pl-4 mt-1 space-y-1 text-xs">
                  {cat.children.map((sub) => (
                    <li key={sub.id}>
                      <button
                        onClick={() => {
                          updateParam('category', sub.slug);
                          if (mobileDrawerOpen) setMobileDrawerOpen(false);
                        }}
                        className={`w-full text-left min-h-[40px] flex items-center px-2.5 rounded-lg transition ${
                          activeCategory === sub.slug
                            ? 'font-bold text-[var(--brand-primary)] bg-slate-50'
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <span>{sub.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* Price Range Filter */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b pb-2 mb-3">
          Price Range
        </h4>
        <form onSubmit={handlePriceFilter} className="space-y-3">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-[10px] text-slate-400 font-medium block mb-1">Min Price</label>
              <input
                type="number"
                aria-label="Minimum price"
                placeholder={minPrice ? String(minPrice) : '0'}
                value={minVal}
                onChange={(e) => setMinVal(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-mono outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 font-medium block mb-1">Max Price</label>
              <input
                type="number"
                aria-label="Maximum price"
                placeholder={maxPrice ? String(maxPrice) : '∞'}
                value={maxVal}
                onChange={(e) => setMaxVal(e.target.value)}
                className="w-full h-10 px-3 border border-slate-200 rounded-lg text-xs font-mono outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
              />
            </div>
          </div>
          <button
            type="submit"
            className="w-full min-h-[44px] py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition flex items-center justify-center"
          >
            Apply Price Range
          </button>
        </form>
      </div>

      {/* In-Stock Availability Toggle */}
      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b pb-2 mb-3">
          Availability
        </h4>
        <label className="min-h-[44px] flex items-center space-x-3 cursor-pointer px-1 rounded-lg hover:bg-slate-50 transition">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => {
              updateParam('in_stock', e.target.checked ? 'true' : null);
              if (mobileDrawerOpen) setMobileDrawerOpen(false);
            }}
            className="h-4 w-4 rounded border-slate-300 text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
          />
          <span className="text-xs font-medium text-slate-700">In Stock Only</span>
        </label>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile & Tablet Filter Drawer Trigger Button */}
      <div className="lg:hidden w-full mb-4">
        <button
          onClick={() => setMobileDrawerOpen(true)}
          className="w-full min-h-[44px] px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 flex items-center justify-between transition shadow-xs"
        >
          <div className="flex items-center space-x-2">
            <SlidersHorizontal className="h-4 w-4 text-[var(--brand-primary)]" />
            <span>Faceted Filters & Refinements</span>
          </div>
          {activeFilterCount > 0 ? (
            <span className="h-5 w-5 rounded-full bg-[var(--brand-primary)] text-white text-[10px] font-bold flex items-center justify-center">
              {activeFilterCount}
            </span>
          ) : (
            <span className="text-slate-400 font-normal">Tap to filter</span>
          )}
        </button>
      </div>

      {/* Desktop Persistent Sidebar (≥ 1024px) */}
      <aside className="hidden lg:block w-64 space-y-8 flex-shrink-0">
        {filterContent}
      </aside>

      {/* Mobile & Tablet Full-Screen Slide-Over Filter Drawer (< 1024px) */}
      {mobileDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/40 backdrop-blur-xs flex justify-end lg:hidden">
          <div className="w-full max-w-sm sm:max-w-md bg-white h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
            {/* Drawer Header with 44px close button */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <SlidersHorizontal className="h-5 w-5 text-[var(--brand-primary)]" />
                <h3 className="text-base font-bold text-slate-900">
                  Filters & Refinements
                </h3>
                {activeFilterCount > 0 && (
                  <span className="ml-1.5 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                    {activeFilterCount} active
                  </span>
                )}
              </div>
              <button
                onClick={() => setMobileDrawerOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-slate-500 hover:text-slate-800 rounded-full hover:bg-slate-100 transition focus:outline-none"
                aria-label="Close filters drawer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Filter Options */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6">
              {filterContent}
            </div>

            {/* Drawer Sticky Footer with Reset & Apply Actions */}
            <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center gap-3">
              <button
                type="button"
                onClick={handleResetFilters}
                className="min-h-[44px] px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100 transition flex items-center justify-center gap-1.5 shrink-0"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Reset</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handlePriceFilter();
                  setMobileDrawerOpen(false);
                }}
                className="flex-1 min-h-[44px] py-2.5 px-4 bg-[var(--brand-primary)] text-white text-xs font-bold rounded-xl shadow-sm hover:opacity-95 transition flex items-center justify-center"
              >
                View Results
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
