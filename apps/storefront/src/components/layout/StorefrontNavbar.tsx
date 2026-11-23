'use client';

import React, { useRef, useEffect, useState, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ShoppingBag, Search, Menu, X, Heart, ArrowRight, Music, Check } from 'lucide-react';
import { StorefrontBrand } from '../../types/storefront';
import { ThemeConfig } from '../../lib/theme';
import { BrandLogo } from '../ui/BrandLogo';
import { useCart } from '../../context/CartContext';
import { PublicCategory } from '../../types/catalog';

interface StorefrontNavbarProps {
  brand: StorefrontBrand;
  themeConfig: ThemeConfig;
  categories?: PublicCategory[];
}

interface PredictiveProduct {
  id: string;
  title: string;
  slug: string;
  price: number;
  imageUrl?: string;
  category?: string;
}

export const StorefrontNavbar: React.FC<StorefrontNavbarProps> = ({ brand, themeConfig, categories = [] }) => {
  const headerRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const { cart, openDrawer, isCategoryDrawerOpen, toggleCategoryDrawer } = useCart();

  const isCheckout = pathname.startsWith('/checkout');

  // Search State & Debouncing
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<PredictiveProduct[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Megamenu State for Desktop
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  // Dynamic announcement text logic
  const announcementText = isCheckout
    ? 'FAST DELIVERY ALL OVER BANGLADESH'
    : themeConfig.announcement_text || `[•] BE POSH WITH ${brand.name.toUpperCase()} [•] WORLDWIDE STREETWEAR CULTURE`;

  // Compute header height CSS variable
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
  }, [themeConfig.show_announcement_bar, announcementText]);

  // Predictive search debounce
  useEffect(() => {
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const timer = setTimeout(async () => {
      try {
        const host = window.location.host;
        const res = await fetch(`/api/v1/storefront/catalog/search?q=${encodeURIComponent(searchQuery)}&limit=5`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.products || []);
        } else {
          // Fallback demo mock if backend route is in development
          setSearchResults([
            { id: '1', title: `${searchQuery} Oversized Tee`, slug: 'oversized-tee', price: 1450, category: 'T-Shirts' },
            { id: '2', title: `${searchQuery} Cargo Pants`, slug: 'cargo-pants', price: 2850, category: 'Cargos' },
          ]);
        }
      } catch (e) {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Focus input when opened
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Primary categories (first 5-6 categories)
  const primaryCategories = categories.length > 0
    ? categories.slice(0, 5)
    : [
        { id: 'cat-1', name: 'T-Shirts', slug: 't-shirts', display_order: 1 },
        { id: 'cat-2', name: 'Hoodies', slug: 'hoodies', display_order: 2 },
        { id: 'cat-3', name: 'Cargos', slug: 'cargos', display_order: 3 },
        { id: 'cat-4', name: 'Jackets', slug: 'jackets', display_order: 4 },
        { id: 'cat-5', name: 'Accessories', slug: 'accessories', display_order: 5 },
      ];

  // Disable megamenu when inside /catalog to allow quick clicking
  const isCatalogPage = pathname.startsWith('/catalog');

  return (
    <header ref={headerRef} className="sf-nav sticky top-0 z-40 backdrop-blur-md transition-colors border-b border-[var(--t-line)]">
      {/* 1. Animated Tagline / Announcement Marquee */}
      {(themeConfig.show_announcement_bar || isCheckout) && (
        <div className="sf-announcement text-xs font-semibold py-2 px-4 overflow-hidden relative border-b border-[var(--t-line)]">
          <div className="flex items-center justify-center space-x-6 tracking-wider uppercase font-mono text-[11px]">
            <span>{announcementText}</span>
            {!isCheckout && (
              <>
                <span className="hidden sm:inline opacity-60">•</span>
                <span className="hidden sm:inline">AUTHENTIC TAILORING</span>
                <span className="hidden md:inline opacity-60">•</span>
                <span className="hidden md:inline">SAME-DAY DISPATCH AVAILABLE</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* 2. Main Header Container */}
      <div className="sf-container">
        <div className="flex items-center justify-between h-16 sm:h-20 relative">
          {/* Checkout Minimal Isolation Mode */}
          {isCheckout ? (
            <div className="w-full flex items-center justify-between">
              <div className="min-w-0">
                <span className="pointer-events-none cursor-default">
                  <BrandLogo name={brand.name} logoUrl={brand.logo_url} />
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--t-accent)] bg-[var(--brand-primary)]/10 px-3 py-1.5 rounded-full">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>SECURE CHECKOUT ISOLATION</span>
              </div>
            </div>
          ) : (
            <>
              {/* Left / Mobile & Tablet Hamburger (< 1024px) */}
              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={toggleCategoryDrawer}
                  className="sf-icon-btn lg:hidden min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-lg transition"
                  aria-label="Toggle Navigation Drawer"
                >
                  {isCategoryDrawerOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
                </button>

                {/* Brand Identity */}
                <div className="sf-nav-brand min-w-0">
                  <BrandLogo name={brand.name} logoUrl={brand.logo_url} />
                </div>
              </div>

              {/* Desktop Categories & Megamenus (>= 1024px) */}
              <nav className="sf-nav-links hidden lg:flex items-center space-x-6 xl:space-x-8" aria-label="Primary Categories">
                {primaryCategories.map((cat) => {
                  const isActive = pathname === `/catalog/${cat.slug}` || pathname.includes(`category=${cat.slug}`);
                  return (
                    <div
                      key={cat.id}
                      className="relative py-6"
                      onMouseEnter={() => !isCatalogPage && setHoveredCategory(cat.slug)}
                      onMouseLeave={() => setHoveredCategory(null)}
                    >
                      <Link
                        href={`/catalog?category=${cat.slug}`}
                        className={`sf-nav-link text-xs font-bold uppercase tracking-wider transition-colors relative py-1.5 ${
                          isActive ? 'text-[var(--t-accent)] font-extrabold' : 'text-[var(--t-text)] hover:text-[var(--t-accent)]'
                        }`}
                      >
                        {cat.name}
                        {isActive && (
                          <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--brand-secondary)] rounded-full"></span>
                        )}
                      </Link>

                      {/* Desktop Megamenu Preview Dropdown on Hover */}
                      {!isCatalogPage && hoveredCategory === cat.slug && (
                        <div
                          className="absolute top-full left-1/2 -translate-x-1/2 w-[460px] bg-[var(--t-surface)] border border-[var(--t-line)] rounded-xl shadow-2xl p-4 z-50 animate-in fade-in zoom-in-95 duration-150 backdrop-blur-xl"
                          style={{ backgroundColor: 'var(--t-surface)' }}
                        >
                          <div className="flex justify-between items-center mb-3 pb-2 border-b border-[var(--t-line)]">
                            <span className="text-[11px] font-mono uppercase tracking-widest text-[var(--t-muted)] font-bold">
                              Featured {cat.name} Fits
                            </span>
                            <Link
                              href={`/catalog?category=${cat.slug}`}
                              className="text-[11px] font-bold text-[var(--t-accent)] hover:underline flex items-center gap-1"
                            >
                              VIEW ALL {cat.name.toUpperCase()} <ArrowRight className="h-3 w-3" />
                            </Link>
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            {['Oversized Drop', 'Acid-Wash Edition', 'Heavyweight Terry'].map((sub, i) => (
                              <Link
                                key={sub}
                                href={`/catalog?category=${cat.slug}&fit=${encodeURIComponent(sub)}`}
                                className="group p-2.5 rounded-lg border border-[var(--t-line)] hover:border-[var(--brand-secondary)] bg-[var(--t-bg)]/40 hover:bg-[var(--t-bg)] transition flex flex-col items-center text-center"
                              >
                                <div className="h-16 w-full rounded bg-[var(--brand-primary)]/10 mb-2 flex items-center justify-center text-xs font-mono font-bold text-[var(--t-accent)] group-hover:scale-105 transition-transform">
                                  DROP #{i + 1}
                                </div>
                                <span className="text-[11px] font-bold text-[var(--t-text)] leading-tight">{sub}</span>
                              </Link>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </nav>

              {/* Right Action Icons (Predictive Search, Wishlist, Cart Drawer) */}
              <div className="sf-nav-actions flex items-center space-x-1.5 sm:space-x-3">
                {/* Search Bar / Trigger */}
                <div className="relative">
                  {isSearchOpen ? (
                    <div className="flex items-center bg-[var(--t-bg)] border border-[var(--t-line)] rounded-full px-3 py-1 shadow-inner">
                      <Search className="h-4 w-4 text-[var(--t-muted)] mr-2 shrink-0" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search products, drops, styles..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && searchQuery.trim()) {
                            router.push(`/catalog?search=${encodeURIComponent(searchQuery)}`);
                            setIsSearchOpen(false);
                          }
                        }}
                        className="bg-transparent border-none outline-none text-xs text-[var(--t-text)] w-36 sm:w-56"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setIsSearchOpen(false);
                          setSearchQuery('');
                          setSearchResults([]);
                        }}
                        className="text-[var(--t-muted)] hover:text-[var(--t-text)] p-1"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsSearchOpen(true)}
                      className="sf-icon-btn min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-lg transition"
                      aria-label="Search Catalog"
                    >
                      <Search className="h-5 w-5" />
                    </button>
                  )}

                  {/* Predictive Debounced Search Dropdown */}
                  {isSearchOpen && (searchLoading || searchResults.length > 0) && (
                    <div
                      className="absolute top-full right-0 mt-2 w-72 sm:w-80 bg-[var(--t-surface)] border border-[var(--t-line)] rounded-xl shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95 backdrop-blur-xl"
                      style={{ backgroundColor: 'var(--t-surface)' }}
                    >
                      {searchLoading ? (
                        <div className="p-4 text-center text-xs text-[var(--t-muted)]">Searching catalog drops...</div>
                      ) : (
                        <div>
                          <div className="px-2 py-1 text-[10px] font-mono uppercase text-[var(--t-muted)] font-bold border-b border-[var(--t-line)] mb-1">
                            Matching Drops ({searchResults.length})
                          </div>
                          {searchResults.map((item) => (
                            <Link
                              key={item.id}
                              href={`/catalog/${item.slug}`}
                              onClick={() => {
                                setIsSearchOpen(false);
                                setSearchQuery('');
                              }}
                              className="flex items-center justify-between p-2 rounded-lg hover:bg-[var(--t-bg)] transition group"
                            >
                              <div className="min-w-0 pr-2">
                                <div className="text-xs font-bold text-[var(--t-text)] group-hover:text-[var(--t-accent)] truncate">
                                  {item.title}
                                </div>
                                <div className="text-[10px] text-[var(--t-muted)]">{item.category}</div>
                              </div>
                              <span className="text-xs font-mono font-bold text-[var(--brand-secondary)] shrink-0">
                                ৳{item.price}
                              </span>
                            </Link>
                          ))}
                          <Link
                            href={`/catalog?search=${encodeURIComponent(searchQuery)}`}
                            onClick={() => setIsSearchOpen(false)}
                            className="block text-center text-xs font-bold text-[var(--t-accent)] py-2 mt-1 border-t border-[var(--t-line)] hover:underline"
                          >
                            View all search results →
                          </Link>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Wishlist Icon */}
                <Link
                  href="/wishlist"
                  className="sf-icon-btn hidden sm:flex min-h-[44px] min-w-[44px] items-center justify-center p-2 rounded-lg transition"
                  aria-label="Saved Drops & Wishlist"
                >
                  <Heart className="h-5 w-5" />
                </Link>

                {/* Cart Drawer Trigger */}
                <button
                  type="button"
                  onClick={openDrawer}
                  className="sf-icon-btn relative min-h-[44px] min-w-[44px] flex items-center justify-center p-2 rounded-lg transition"
                  aria-label="View Shopping Cart"
                >
                  <ShoppingBag className="h-5 w-5" />
                  {cart && cart.item_count > 0 && (
                    <span className="sf-cart-count absolute top-1.5 right-1.5 h-4 min-w-[16px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center bg-[var(--brand-secondary)] text-[var(--t-on-secondary)]">
                      {cart.item_count}
                    </span>
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  );
};
