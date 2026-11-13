import React from 'react';
import Link from 'next/link';
import { StorefrontBrand } from '../../types/storefront';

interface StorefrontFooterProps {
  brand: StorefrontBrand;
}

export const StorefrontFooter: React.FC<StorefrontFooterProps> = ({ brand }) => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-slate-950 text-slate-400 text-sm border-t border-slate-800 mt-16 sm:mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 lg:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 sm:gap-10">
          {/* Brand Info */}
          <div className="space-y-3 sm:space-y-4">
            <h4 className="text-white text-base font-bold font-[var(--brand-font-heading)]">
              {brand.name}
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Premium retail offerings curated for discerning tastes. Powered by unified commerce infrastructure.
            </p>
            {brand.contact_phone && (
              <p className="text-xs text-slate-400">Customer Support: {brand.contact_phone}</p>
            )}
          </div>

          {/* Quick Links */}
          <div className="space-y-3">
            <h5 className="text-white text-xs font-bold uppercase tracking-wider">Quick Navigation</h5>
            <ul className="space-y-1.5 text-xs">
              <li>
                <Link href="/catalog" className="inline-block py-1 hover:text-white transition">
                  All Products
                </Link>
              </li>
              <li>
                <Link href="/catalog?collection=new" className="inline-block py-1 hover:text-white transition">
                  New Arrivals
                </Link>
              </li>
              <li>
                <Link href="/blog" className="inline-block py-1 hover:text-white transition">
                  Editorial & Blog
                </Link>
              </li>
              <li>
                <Link href="/about" className="inline-block py-1 hover:text-white transition">
                  Brand Story
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Care */}
          <div className="space-y-3">
            <h5 className="text-white text-xs font-bold uppercase tracking-wider">Customer Care</h5>
            <ul className="space-y-1.5 text-xs">
              <li>
                <Link href="/orders/lookup" className="inline-block py-1 hover:text-white transition">
                  Track Order
                </Link>
              </li>
              <li>
                <Link href="/shipping-policy" className="inline-block py-1 hover:text-white transition">
                  Shipping Policy
                </Link>
              </li>
              <li>
                <Link href="/returns" className="inline-block py-1 hover:text-white transition">
                  Return Policy
                </Link>
              </li>
            </ul>
          </div>

          {/* Regional & Social */}
          <div className="space-y-3">
            <h5 className="text-white text-xs font-bold uppercase tracking-wider">Regional Settings</h5>
            <p className="text-xs text-slate-400">
              Currency: <span className="text-white font-mono font-semibold">{brand.currency}</span>
            </p>
            <div className="flex space-x-4 pt-1">
              {brand.facebook_url && (
                <a
                  href={brand.facebook_url}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[44px] min-w-[44px] inline-flex items-center text-slate-400 hover:text-white transition text-xs"
                >
                  Facebook
                </a>
              )}
              {brand.instagram_url && (
                <a
                  href={brand.instagram_url}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[44px] min-w-[44px] inline-flex items-center text-slate-400 hover:text-white transition text-xs"
                >
                  Instagram
                </a>
              )}
            </div>
          </div>
        </div>

        <div className="mt-10 sm:mt-12 pt-6 sm:pt-8 border-t border-slate-900 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2">
          <p>© {currentYear} {brand.name}. All rights reserved.</p>
          <p className="font-mono text-[11px]">Ecom Ventures Multi-Tenant Platform</p>
        </div>
      </div>
    </footer>
  );
};
