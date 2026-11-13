'use client';

import React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { X } from 'lucide-react';

interface CatalogToolbarProps {
  total: number;
}

export const CatalogToolbar: React.FC<CatalogToolbarProps> = ({ total }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentSort = searchParams.get('sort') || 'featured';
  const category = searchParams.get('category');
  const search = searchParams.get('search');
  const minPrice = searchParams.get('min_price');
  const maxPrice = searchParams.get('max_price');
  const inStock = searchParams.get('in_stock');

  const updateSort = (sortVal: string) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    current.set('sort', sortVal);
    current.set('page', '1');
    router.push(`${pathname}?${current.toString()}`);
  };

  const removeFilter = (key: string) => {
    const current = new URLSearchParams(Array.from(searchParams.entries()));
    current.delete(key);
    current.set('page', '1');
    router.push(`${pathname}?${current.toString()}`);
  };

  const hasActiveFilters = Boolean(category || search || minPrice || maxPrice || inStock);

  return (
    <div className="space-y-4 pb-6 border-b border-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Results Counter */}
        <p className="text-xs text-slate-500 font-medium">
          Showing <span className="font-bold text-slate-900">{total}</span> {total === 1 ? 'item' : 'items'}
        </p>

        {/* Sort Dropdown */}
        <div className="flex items-center space-x-2 self-end sm:self-auto">
          <span className="text-xs text-slate-500">Sort by:</span>
          <select
            value={currentSort}
            onChange={(e) => updateSort(e.target.value)}
            className="text-xs font-semibold text-slate-800 bg-white border border-slate-200 rounded-md px-3 py-1.5 outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
          >
            <option value="featured">Featured Collection</option>
            <option value="newest">Newest Arrivals</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* Active Filter Pills */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-xs text-slate-400 font-medium">Active Filters:</span>
          {search && (
            <button
              onClick={() => removeFilter('search')}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs hover:bg-slate-200 transition"
            >
              <span>Search: "{search}"</span>
              <X className="h-3 w-3" />
            </button>
          )}
          {category && (
            <button
              onClick={() => removeFilter('category')}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs hover:bg-slate-200 transition"
            >
              <span>Category: {category}</span>
              <X className="h-3 w-3" />
            </button>
          )}
          {(minPrice || maxPrice) && (
            <button
              onClick={() => {
                removeFilter('min_price');
                removeFilter('max_price');
              }}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs hover:bg-slate-200 transition"
            >
              <span>Price: {minPrice || '0'} - {maxPrice || '∞'}</span>
              <X className="h-3 w-3" />
            </button>
          )}
          {inStock && (
            <button
              onClick={() => removeFilter('in_stock')}
              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs hover:bg-slate-200 transition"
            >
              <span>In Stock</span>
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}
    </div>
  );
};
