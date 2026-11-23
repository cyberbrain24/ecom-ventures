'use client';

import React from 'react';
import { Layers } from 'lucide-react';

/**
 * "Buy More & Save" panel. Bundle tiers are not yet applied to cart or order totals
 * by the store API, so bundles cannot be ordered. The panel says so instead of showing
 * a discount that is computed in the browser or stored locally.
 */
export const ProductBundleBuilder: React.FC = () => {
  return (
    <div role="status" className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5 space-y-2">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
        <Layers className="h-4 w-4 text-slate-500" />
        <span>Buy More &amp; Save</span>
      </div>
      <p className="text-xs text-slate-600">
        Bundle offers are not available to order yet. Add this product to your cart on its own.
      </p>
    </div>
  );
};
