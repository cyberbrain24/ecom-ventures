'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronDown, Send, ShieldCheck, Check } from 'lucide-react';
import { StorefrontBrand } from '../../types/storefront';

interface StorefrontFooterProps {
  brand: StorefrontBrand;
}

export const StorefrontFooter: React.FC<StorefrontFooterProps> = ({ brand }) => {
  const pathname = usePathname();
  const currentYear = new Date().getFullYear();

  // 1. Checkout Isolation: Completely unmount footer on checkout to eliminate exit friction
  if (pathname.startsWith('/checkout')) {
    return null;
  }

  // Mobile Accordion open state for 3 link columns
  const [openSection, setOpenSection] = useState<'shop' | 'about' | 'legal' | null>(null);
  const toggleSection = (sec: 'shop' | 'about' | 'legal') => {
    setOpenSection((prev) => (prev === sec ? null : sec));
  };

  // Newsletter Form State
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !email.includes('@')) return;
    setSubscribed(true);
    setEmail('');
    setTimeout(() => setSubscribed(false), 5000);
  };

  return (
    <footer className="sf-footer text-sm mt-16 sm:mt-24 border-t border-[var(--t-line)] select-none">
      <div className="sf-container sf-footer-inner pt-10 sm:pt-16 pb-24 sm:pb-16">
        {/* ============================================================== */}
        {/* DESKTOP 4-COLUMN GRID / MOBILE STACK                           */}
        {/* ============================================================== */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12">
          {/* Column 1 (Brand Manifesto & Newsletter - 1.2fr on desktop) */}
          <div className="md:col-span-5 space-y-4">
            <h4 className="text-xl sm:text-2xl font-black tracking-tight uppercase font-[var(--brand-font-heading)] text-[var(--t-on-primary)]">
              {brand.name}
            </h4>
            <p className="text-xs leading-relaxed max-w-sm text-[var(--t-on-primary)]/80">
              {brand.description || `Explore ${brand.name} — Curated collections, verified quality, and fast home delivery across Bangladesh.`}
            </p>

            {/* Newsletter Subscription Box */}
            <div className="pt-2">
              <span className="block text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--t-on-primary)] mb-2">
                Join the Movement
              </span>
              {subscribed ? (
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-950/40 border border-emerald-500/30 px-3 py-2 rounded-[var(--brand-radius)] max-w-sm">
                  <Check className="h-4 w-4" />
                  <span>You are subscribed to exclusive drop lookbooks.</span>
                </div>
              ) : (
                <form onSubmit={handleSubscribe} className="flex max-w-sm gap-2">
                  <input
                    type="email"
                    required
                    placeholder="Enter your email address..."
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="flex-1 bg-white/10 border border-white/20 rounded-[var(--brand-radius)] px-3.5 py-2 text-xs text-[var(--t-on-primary)] placeholder-white/50 outline-none focus:border-[var(--brand-secondary)] transition"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-[var(--brand-secondary)] hover:bg-[var(--brand-secondary)]/90 text-[var(--t-on-secondary)] font-bold text-xs uppercase tracking-wider rounded-[var(--brand-radius)] transition flex items-center gap-1.5 shrink-0"
                  >
                    <span>Subscribe</span>
                    <Send className="h-3 w-3" />
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Column 2 (Shop Links - Desktop & Mobile Accordion) */}
          <div className="md:col-span-2 border-t md:border-t-0 border-white/10 pt-4 md:pt-0">
            <button
              type="button"
              onClick={() => toggleSection('shop')}
              className="w-full flex justify-between items-center md:cursor-default"
            >
              <h5 className="sf-footer-label text-xs font-bold uppercase tracking-widest text-[var(--t-on-primary)]">
                Shop
              </h5>
              <ChevronDown
                className={`h-4 w-4 md:hidden transition-transform ${openSection === 'shop' ? 'rotate-180' : ''}`}
              />
            </button>
            <ul
              className={`space-y-2 mt-3 text-xs md:block ${openSection === 'shop' ? 'block' : 'hidden'}`}
            >
              <li>
                <Link href="/catalog" className="sf-footer-link inline-block transition">
                  All Products
                </Link>
              </li>
              <li>
                <Link href="/catalog?collection=new" className="sf-footer-link inline-block transition">
                  New Arrivals
                </Link>
              </li>
              <li>
                <Link href="/catalog?collection=featured" className="sf-footer-link inline-block transition">
                  Featured Drops
                </Link>
              </li>
              <li>
                <Link href="/reviews" className="sf-footer-link inline-block transition">
                  Customer Reviews
                </Link>
              </li>
              <li>
                <Link href="/profile" className="sf-footer-link inline-block transition">
                  Members Profile
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 3 (About Links - Desktop & Mobile Accordion) */}
          <div className="md:col-span-2 border-t md:border-t-0 border-white/10 pt-4 md:pt-0">
            <button
              type="button"
              onClick={() => toggleSection('about')}
              className="w-full flex justify-between items-center md:cursor-default"
            >
              <h5 className="sf-footer-label text-xs font-bold uppercase tracking-widest text-[var(--t-on-primary)]">
                About
              </h5>
              <ChevronDown
                className={`h-4 w-4 md:hidden transition-transform ${openSection === 'about' ? 'rotate-180' : ''}`}
              />
            </button>
            <ul
              className={`space-y-2 mt-3 text-xs md:block ${openSection === 'about' ? 'block' : 'hidden'}`}
            >
              <li>
                <Link href="/about" className="sf-footer-link inline-block transition">
                  Our Story
                </Link>
              </li>
              <li>
                <Link href="/blog" className="sf-footer-link inline-block transition">
                  Lookbook &amp; Blog
                </Link>
              </li>
              <li>
                <Link href="/about" className="sf-footer-link inline-block transition">
                  Store Locator
                </Link>
              </li>
              <li>
                <Link href="/orders/lookup" className="sf-footer-link inline-block transition">
                  Customer Care
                </Link>
              </li>
            </ul>
          </div>

          {/* Column 4 (Legal Links - Desktop & Mobile Accordion) */}
          <div className="md:col-span-3 border-t md:border-t-0 border-white/10 pt-4 md:pt-0">
            <button
              type="button"
              onClick={() => toggleSection('legal')}
              className="w-full flex justify-between items-center md:cursor-default"
            >
              <h5 className="sf-footer-label text-xs font-bold uppercase tracking-widest text-[var(--t-on-primary)]">
                Legal & Policies
              </h5>
              <ChevronDown
                className={`h-4 w-4 md:hidden transition-transform ${openSection === 'legal' ? 'rotate-180' : ''}`}
              />
            </button>
            <ul
              className={`space-y-2 mt-3 text-xs md:block ${openSection === 'legal' ? 'block' : 'hidden'}`}
            >
              <li>
                <Link href="/shipping-policy" className="sf-footer-link inline-block transition">
                  Shipping &amp; Delivery
                </Link>
              </li>
              <li>
                <Link href="/returns" className="sf-footer-link inline-block transition">
                  Return &amp; Exchange Policy
                </Link>
              </li>
              <li>
                <Link href="/shipping-policy" className="sf-footer-link inline-block transition">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/shipping-policy" className="sf-footer-link inline-block transition">
                  Terms &amp; Conditions
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar: Copyright & Accepted Payment Methods */}
        <div className="mt-12 pt-6 border-t border-white/15 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs text-[var(--t-on-primary)]/70">
          <div>
            &copy; {currentYear} {brand.name}. All rights reserved.
          </div>
          <div className="flex items-center gap-2 font-mono text-[11px]">
            <span>ACCEPTED PAYMENTS:</span>
            <span className="font-bold text-[var(--t-on-primary)] bg-white/10 px-2 py-0.5 rounded">bKash</span>
            <span className="font-bold text-[var(--t-on-primary)] bg-white/10 px-2 py-0.5 rounded">Nagad</span>
            <span className="font-bold text-[var(--t-on-primary)] bg-white/10 px-2 py-0.5 rounded">Cash on Delivery</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
