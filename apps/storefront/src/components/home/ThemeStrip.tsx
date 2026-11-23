import React from 'react';
import Link from 'next/link';
import type { ThemeVariant } from '../../lib/theme';

interface ThemeStripProps {
  variant: ThemeVariant;
  storeName: string;
}

/**
 * Secondary strip under the hero. Streetculture shows a marquee of store navigation words. Innerwear shows
 * a text-only reassurance strip linking to the policy and order pages that exist for every store. Other
 * variants render nothing. The strip never states a claim the store has not published.
 */
export const ThemeStrip: React.FC<ThemeStripProps> = ({ variant, storeName }) => {
  if (variant === 'streetculture') {
    const tickerItems = [
      '// WORLDWIDE STREETWEAR CULTURE',
      'HEAVYWEIGHT 280+ GSM FABRICS',
      'BOX-FIT & OVERSIZED SILHOUETTES',
      'LIMITED DROP RUNS',
      'DHAKA & ALL BD 48H DISPATCH',
      'AUTHENTIC MERCH ONLY',
    ];
    return (
      <div className="sf-marquee overflow-hidden select-none" aria-label="Street highlights">
        <div className="sf-marquee-track flex w-max whitespace-nowrap py-1">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 items-center space-x-6 sm:space-x-10" aria-hidden={copy === 1 ? true : undefined}>
              {tickerItems.map((word, idx) => (
                <span key={`${copy}-${idx}`} className="sf-marquee-item inline-flex items-center gap-3">
                  <span className="text-[var(--t-accent)] font-mono text-base">✦</span>
                  <span>{word}</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'innerwear') {
    return (
      <nav className="sf-container sf-reassure" aria-label="Customer information">
        <ul className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          <li>
            <Link href="/shipping-policy" className="sf-reassure-item">
              Shipping policy
            </Link>
          </li>
          <li>
            <Link href="/returns" className="sf-reassure-item">
              Returns policy
            </Link>
          </li>
          <li>
            <Link href="/orders/lookup" className="sf-reassure-item">
              Track your order
            </Link>
          </li>
        </ul>
      </nav>
    );
  }

  if (variant === 'gadget') {
    const techPills = [
      '// 100% OFFICIAL & AUTHENTIC GADGETS',
      'ORIGINAL BRAND REPLACEMENT WARRANTY',
      'EXPRESS 24H–48H HOME DELIVERY',
      'PRE-DELIVERY INSPECTION & TESTING',
      'INSTANT COD AVAILABLE NATIONWIDE',
    ];
    return (
      <div className="sf-gadget-marquee overflow-hidden select-none" aria-label="Gadget store highlights">
        <div className="sf-marquee-track flex w-max whitespace-nowrap py-1">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex shrink-0 items-center space-x-6 sm:space-x-10" aria-hidden={copy === 1 ? true : undefined}>
              {techPills.map((word, idx) => (
                <span key={`${copy}-${idx}`} className="sf-gadget-pill inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                  <span>{word}</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'inner-fashion') {
    return (
      <nav className="sf-container sf-reassure-couture py-4" aria-label="Inner Fashion Guarantees">
        <ul className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <li className="sf-couture-pill">
            <span className="sf-couture-icon">✦</span>
            <span>100% Breathable Silk & Microfiber</span>
          </li>
          <li className="sf-couture-pill">
            <span className="sf-couture-icon">✦</span>
            <span>Seamless Second-Skin Sculpting</span>
          </li>
          <li className="sf-couture-pill">
            <span className="sf-couture-icon">✦</span>
            <span>100% Discreet & Tamper-Proof Packaging</span>
          </li>
          <li className="sf-couture-pill">
            <span className="sf-couture-icon">✦</span>
            <span>Hassle-Free Fitting Exchange</span>
          </li>
        </ul>
      </nav>
    );
  }

  if (variant === 'traditional-fashion') {
    return (
      <nav className="sf-container sf-traditional-strip py-4" aria-label="Heritage & Craftsmanship Standards">
        <ul className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <li className="sf-traditional-pill">
            <span className="sf-traditional-zari">⚜</span>
            <span>100% Authentic Handloom & Weave</span>
          </li>
          <li className="sf-traditional-pill">
            <span className="sf-traditional-zari">⚜</span>
            <span>Pure Zari & Jamdani Craftsmanship</span>
          </li>
          <li className="sf-traditional-pill">
            <span className="sf-traditional-zari">⚜</span>
            <span>Heirloom Festive & Bridal Edits</span>
          </li>
          <li className="sf-traditional-pill">
            <span className="sf-traditional-zari">⚜</span>
            <span>Quality Checked Before Dispatch</span>
          </li>
        </ul>
      </nav>
    );
  }

  return null;
};
