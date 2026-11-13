'use client';

import React, { useRef, useEffect } from 'react';
import Link from 'next/link';
import { ShoppingBag, Search, Menu, X } from 'lucide-react';
import { StorefrontBrand, ThemeCustomConfig } from '../../types/storefront';
import { BrandLogo } from '../ui/BrandLogo';
import { useCart } from '../../context/CartContext';

interface StorefrontNavbarProps {
  brand: StorefrontBrand;
  themeConfig: ThemeCustomConfig;
}

export const StorefrontNavbar: React.FC<StorefrontNavbarProps> = ({ brand, themeConfig }) => {
  const headerRef = useRef<HTMLElement>(null);
  const { cart, openDrawer, isCategoryDrawerOpen, toggleCategoryDrawer } = useCart();

  // Dynamically compute exact header height so mobile drawer sandwiched geometry aligns pixel-perfectly
  useEffect(() => {
    const updateHeaderHeight = () => {
      if (headerRef.current) {
        const height = headerRef.current.offsetHeight;
        document.documentElement.style.setProperty('--storefront-header-height', `${height}px`);
      }
    };

    updateHeaderHeight();
    window.addEventListener('resize', updateHeaderHeight);
    return () => window.removeEventListener('resize', updateHeaderHeight);
  }, [themeConfig.show_announcement_bar, themeConfig.announcement_text]);

  const navLinks = [
    { label: 'Catalog', href: '/catalog' },
    { label: 'New Arrivals', href: '/catalog?collection=new' },
    { label: 'Featured', href: '/catalog?collection=featured' },
    { label: 'Blog', href: '/blog' },
    { label: 'Track Order', href: '/orders/lookup' },
    { label: 'About', href: '/about' },
  ];

  return (
    <header
      ref={headerRef}
      className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-100 transition-colors"
    >
      {/* Announcement Bar */}
      {themeConfig.show_announcement_bar && themeConfig.announcement_text && (
        <div className="bg-[var(--brand-primary)] text-white text-xs font-medium py-2 px-4 text-center">
          {themeConfig.announcement_text}
        </div>
      )}

      {/* Main Header Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          {/* Brand Identity / Logo */}
          <div className="flex-shrink-0">
            <BrandLogo name={brand.name} logoUrl={brand.logo_url} />
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-sm font-medium text-slate-700 hover:text-[var(--brand-primary)] transition"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right Action Icons */}
          <div className="flex items-center space-x-1 sm:space-x-3">
            <Link
              href="/catalog?search=true"
              className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-slate-700 hover:text-[var(--brand-primary)] transition rounded-full hover:bg-slate-100"
              aria-label="Search Catalog"
            >
              <Search className="h-5 w-5" />
            </Link>

            <button
              onClick={openDrawer}
              className="relative min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-slate-700 hover:text-[var(--brand-primary)] transition rounded-full hover:bg-slate-100 focus:outline-none"
              aria-label="View Shopping Cart"
            >
              <ShoppingBag className="h-5 w-5" />
              <span className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-[var(--brand-primary)] text-white text-[10px] font-bold flex items-center justify-center shadow-xs">
                {cart?.item_count || 0}
              </span>
            </button>

            {/* Mobile Category Drawer Toggle Button (Min 44x44px touch target) */}
            <button
              onClick={toggleCategoryDrawer}
              className={`md:hidden min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-lg transition active:scale-95 ${
                isCategoryDrawerOpen
                  ? 'bg-slate-900 text-cyan-400'
                  : 'text-slate-700 hover:text-slate-900 hover:bg-slate-100'
              }`}
              aria-label="Toggle Mobile Category Drawer"
              aria-expanded={isCategoryDrawerOpen}
            >
              {isCategoryDrawerOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
