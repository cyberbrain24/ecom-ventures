import React from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getStorefrontConfig } from '../lib/api';
import { getStorefrontProducts, getStorefrontCategories } from '../lib/catalog-api';
import { ProductCard } from '../components/catalog/ProductCard';
import { FEATURED_SLOTS, FeaturedProducts } from '../components/home/FeaturedProducts';
import { ThemeHero } from '../components/home/ThemeHero';
import { ThemeStrip } from '../components/home/ThemeStrip';
import { resolveTheme } from '../lib/theme';
import { ArrowRight, ShieldCheck, Truck, RefreshCw, ShoppingBag, Layers, Sparkles, CheckCircle2 } from 'lucide-react';

export default async function HomePage() {
  const headersList = headers();
  const host = headersList.get('x-storefront-host') || '';

  if (!host) {
    return null;
  }

  const [config, catalogData, featuredData, categories] = await Promise.all([
    getStorefrontConfig(host),
    getStorefrontProducts(host, { page: '1', limit: '24' }),
    getStorefrontProducts(host, { page: '1', featured: 'true', limit: String(FEATURED_SLOTS) }),
    getStorefrontCategories(host),
  ]);

  if (!config) {
    return null;
  }

  const { store } = config;
  const { config: theme } = resolveTheme(config.theme.config);
  const isStreetwear = theme.variant === 'streetculture';
  const displayedProducts = isStreetwear ? catalogData.products : catalogData.products.slice(0, 8);

  return (
    <div className="sf-page space-y-12 sm:space-y-16 lg:space-y-20 bg-white">
      {/* Hero Presentation Section */}
      <ThemeHero
        hero={theme.hero}
        storeName={store.name}
        imageUrl={catalogData.products[0]?.featured_image_url || undefined}
      />
      <ThemeStrip variant={theme.variant} storeName={store.name} />

      {/* Featured Products Showcase */}
      <FeaturedProducts products={featuredData.products} currency={store.currency} storeName={store.name} />

      {/* High-Density Category Quick Filter Ticker (Streetwear Small-Text Grid Aesthetic) */}
      {isStreetwear && categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="border-2 border-black bg-white p-4 sm:p-5 shadow-[4px_4px_0px_#000000] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 pb-2.5 font-mono text-[10px] sm:text-xs uppercase tracking-widest text-neutral-600">
              <span className="font-bold text-black flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 bg-black rounded-full" />
                <span>// CATEGORY INDEX // EXPLORE CAPSULES</span>
              </span>
              <span className="text-neutral-500 font-mono text-[10px] hidden sm:inline">
                SELECT CATEGORY FOR FAST ACCESS
              </span>
            </div>

            <div className="flex flex-wrap gap-2 pt-1 font-mono">
              <Link
                href="/catalog"
                className="px-3 py-1.5 bg-black text-white text-[11px] font-bold uppercase tracking-wider transition-all hover:bg-neutral-800"
              >
                All Drops ({catalogData.total})
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/catalog?category=${cat.slug}`}
                  className="px-3 py-1.5 bg-white border border-black text-black text-[11px] font-bold uppercase tracking-wider transition-all hover:bg-black hover:text-white"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Main Catalog Products Grid: Small-Text Dense Layout */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-6 sm:mb-8 gap-3 sm:gap-4 border-b border-black/10 pb-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 text-[11px] font-mono font-bold text-black uppercase tracking-widest mb-1">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-600" />
              <span>// MERCHANDISE DISPATCH // {catalogData.total} ITEMS</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-black font-[var(--brand-font-heading)] tracking-tight">
              {isStreetwear ? `Live Archive Drops from ${store.name}` : `Products from ${store.name}`}
            </h2>
          </div>

          <Link
            href="/catalog"
            className="inline-flex items-center text-xs sm:text-sm font-mono font-bold text-black hover:underline space-x-1 self-start sm:self-auto py-2 sm:py-0 uppercase tracking-wider"
          >
            <span>Explore Entire Catalog ({catalogData.total}) →</span>
          </Link>
        </div>

        {displayedProducts.length === 0 ? (
          <div className="py-16 text-center border-2 border-dashed border-black/20 rounded-none bg-neutral-50 font-mono text-xs text-neutral-500">
            [ NO CURRENT CATALOG ITEMS AVAILABLE ]
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5">
            {displayedProducts.map((product) => (
              <ProductCard key={product.id} product={product} currency={store.currency} />
            ))}
          </div>
        )}
      </section>

      {/* Streetwear Editorial Content Grid (Sells Story & Technical Specs) */}
      {isStreetwear && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="border-2 border-black bg-white p-6 sm:p-8 shadow-[6px_6px_0px_#000000] space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/15 pb-4">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-widest font-extrabold bg-black text-white px-2 py-0.5 inline-block mb-1">
                  EDITORIAL // VOLUME 01
                </span>
                <h3 className="text-xl sm:text-2xl font-black font-[var(--brand-font-heading)] text-black uppercase tracking-tight">
                  Structural Garment Architecture & Street Manifesto
                </h3>
              </div>
              <Link
                href="/brand"
                className="font-mono text-xs font-bold text-black hover:underline uppercase tracking-wider"
              >
                Read Manifesto →
              </Link>
            </div>

            {/* 3-Column Small-Text Magazine Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 font-mono">
              <div className="p-4 sm:p-5 border border-black/20 bg-neutral-50 space-y-2">
                <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
                  PILLAR 01 // TEXTILE STANDARDS
                </div>
                <h4 className="text-sm font-bold text-black uppercase">240+ GSM Heavyweight Terry</h4>
                <p className="text-xs text-neutral-600 leading-relaxed font-sans">
                  Rigid double-needle collar construction that never buckles. Pre-shrunk cotton knits tailored for subcontinental wash resilience.
                </p>
              </div>

              <div className="p-4 sm:p-5 border border-black/20 bg-neutral-50 space-y-2">
                <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
                  PILLAR 02 // TAILORING SILHOUETTE
                </div>
                <h4 className="text-sm font-bold text-black uppercase">Boxy Asian Dropped Shoulder</h4>
                <p className="text-xs text-neutral-600 leading-relaxed font-sans">
                  Engineered specifically for Asian and subcontinental frames. Clean drape over sneakers with utility metal pocket accents.
                </p>
              </div>

              <div className="p-4 sm:p-5 border border-black/20 bg-neutral-50 space-y-2">
                <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-wider">
                  PILLAR 03 // DISPATCH COMMITMENT
                </div>
                <h4 className="text-sm font-bold text-black uppercase">24H Metro / 48H Nationwide</h4>
                <p className="text-xs text-neutral-600 leading-relaxed font-sans">
                  Direct warehouse dispatch via Steadfast courier. Complete cash on delivery with parcel inspection rights before payment.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Standard Categories Showcase Bar for Non-Streetwear Themes */}
      {!isStreetwear && categories.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-slate-50 rounded-2xl p-5 sm:p-8 border border-slate-100">
            <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 sm:mb-4">
              <Layers className="h-4 w-4 text-[var(--brand-primary)]" />
              <span>Browse by Category</span>
            </div>
            <div className="flex gap-2.5 overflow-x-auto no-scrollbar pb-1 sm:flex-wrap">
              {categories.map((cat) => (
                <Link
                  key={cat.id}
                  href={`/catalog?category=${cat.slug}`}
                  className="min-h-[44px] px-4 py-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-full text-xs font-semibold text-slate-800 transition shadow-xs shrink-0 flex items-center justify-center whitespace-nowrap"
                >
                  {cat.name}
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Brand Value Propositions */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
          <div className={`flex items-start space-x-4 p-5 sm:p-6 ${isStreetwear ? 'border-2 border-black bg-white shadow-[4px_4px_0px_#000000]' : 'rounded-2xl bg-slate-50/70 border border-slate-100'}`}>
            <div className={`p-3 ${isStreetwear ? 'bg-black text-white' : 'bg-[var(--brand-primary)] text-white rounded-xl'} shrink-0`}>
              <Truck className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-black font-[var(--brand-font-heading)]">Fast Courier Dispatch</h3>
              <p className="text-xs text-neutral-600 mt-1">24 to 48 Hours home delivery across all 64 districts in Bangladesh with Cash on Delivery.</p>
            </div>
          </div>

          <div className={`flex items-start space-x-4 p-5 sm:p-6 ${isStreetwear ? 'border-2 border-black bg-white shadow-[4px_4px_0px_#000000]' : 'rounded-2xl bg-slate-50/70 border border-slate-100'}`}>
            <div className={`p-3 ${isStreetwear ? 'bg-black text-white' : 'bg-[var(--brand-primary)] text-white rounded-xl'} shrink-0`}>
              <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-black font-[var(--brand-font-heading)]">Verified In-Stock Drops</h3>
              <p className="text-xs text-neutral-600 mt-1">Every listed piece is live in inventory and dispatched from local fulfillment centers.</p>
            </div>
          </div>

          <div className={`flex items-start space-x-4 p-5 sm:p-6 ${isStreetwear ? 'border-2 border-black bg-white shadow-[4px_4px_0px_#000000]' : 'rounded-2xl bg-slate-50/70 border border-slate-100'}`}>
            <div className={`p-3 ${isStreetwear ? 'bg-black text-white' : 'bg-[var(--brand-primary)] text-white rounded-xl'} shrink-0`}>
              <RefreshCw className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-black font-[var(--brand-font-heading)]">Hassle-Free Exchanges</h3>
              <p className="text-xs text-neutral-600 mt-1">Dedicated customer concierge to support size exchanges and delivery questions.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
