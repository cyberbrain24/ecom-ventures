import React from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getStorefrontConfig } from '../lib/api';
import { getStorefrontProducts, getStorefrontCategories } from '../lib/catalog-api';
import { ProductCard } from '../components/catalog/ProductCard';
import { ArrowRight, Sparkles, ShieldCheck, Truck, RefreshCw, ShoppingBag, Layers } from 'lucide-react';

export default async function HomePage() {
  const headersList = headers();
  const host = headersList.get('x-storefront-host') || 'localhost';

  const [config, catalogData, categories] = await Promise.all([
    getStorefrontConfig(host),
    getStorefrontProducts(host, { page: '1' }),
    getStorefrontCategories(host),
  ]);

  if (!config) {
    return null;
  }

  const { store, theme } = config;
  const featuredProducts = catalogData.products.slice(0, 8);

  return (
    <div className="space-y-12 sm:space-y-20 lg:space-y-24">
      {/* Hero Presentation Section */}
      <section className="relative overflow-hidden bg-slate-50 py-12 sm:py-20 lg:py-28 border-b border-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl space-y-5 sm:space-y-6">
            <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-white border border-slate-200 text-xs font-semibold text-slate-700 shadow-xs">
              <Sparkles className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
              <span>Theme: {theme.name} (v{theme.version})</span>
            </div>

            <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-950 tracking-tight font-[var(--brand-font-heading)] leading-tight sm:leading-none">
              Welcome to {store.name}
            </h1>

            <p className="text-sm sm:text-base lg:text-lg text-slate-600 leading-relaxed">
              Explore our distinctive collections crafted with meticulous care and authenticity. Everything tailored for your personal lifestyle.
            </p>

            <div className="pt-2 flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Link
                href="/catalog"
                className="min-h-[44px] px-6 py-3 bg-[var(--brand-primary)] text-white text-sm font-semibold rounded-[var(--brand-radius)] shadow-sm hover:opacity-95 transition flex items-center justify-center space-x-2"
              >
                <span>Shop New Arrivals</span>
                <ArrowRight className="h-4 w-4" />
              </Link>

              <Link
                href="/catalog?collection=featured"
                className="min-h-[44px] px-6 py-3 bg-white text-slate-800 border border-slate-300 text-sm font-semibold rounded-[var(--brand-radius)] shadow-sm hover:bg-slate-50 transition flex items-center justify-center"
              >
                View Featured
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Featured Products Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between mb-6 sm:mb-8 gap-3 sm:gap-4">
          <div>
            <div className="inline-flex items-center space-x-1.5 text-xs font-bold text-[var(--brand-primary)] uppercase tracking-wider mb-1">
              <ShoppingBag className="h-4 w-4" />
              <span>Curated Selection</span>
            </div>
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-slate-950 font-[var(--brand-font-heading)] tracking-tight">
              Trending Products & New Arrivals
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Hand-picked bestsellers available for immediate dispatch in {store.name}.
            </p>
          </div>

          <Link
            href="/catalog"
            className="inline-flex items-center text-xs sm:text-sm font-semibold text-[var(--brand-primary)] hover:underline space-x-1 self-start sm:self-auto min-h-[44px] sm:min-h-0 py-2 sm:py-0"
          >
            <span>Explore Entire Catalog ({catalogData.total} items)</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {featuredProducts.length === 0 ? (
          <div className="py-16 text-center border border-dashed border-slate-200 rounded-2xl">
            <p className="text-sm text-slate-500">Products are currently loading...</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
            {featuredProducts.map((product) => (
              <ProductCard key={product.id} product={product} currency={store.currency} />
            ))}
          </div>
        )}
      </section>

      {/* Categories Showcase Bar: Touch-scrollable on mobile & tablet */}
      {categories.length > 0 && (
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
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6 py-6">
          <div className="flex items-start space-x-4 p-5 sm:p-6 rounded-2xl bg-slate-50/70 border border-slate-100">
            <div className="p-3 bg-[var(--brand-primary)] text-white rounded-xl shrink-0">
              <Truck className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">Swift Dispatch</h3>
              <p className="text-xs text-slate-600 mt-1">Reliable nationwide fulfillment to your doorstep.</p>
            </div>
          </div>

          <div className="flex items-start space-x-4 p-5 sm:p-6 rounded-2xl bg-slate-50/70 border border-slate-100">
            <div className="p-3 bg-[var(--brand-primary)] text-white rounded-xl shrink-0">
              <ShieldCheck className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">Authentic Quality</h3>
              <p className="text-xs text-slate-600 mt-1">100% verified original merchandise guaranteed.</p>
            </div>
          </div>

          <div className="flex items-start space-x-4 p-5 sm:p-6 rounded-2xl bg-slate-50/70 border border-slate-100">
            <div className="p-3 bg-[var(--brand-primary)] text-white rounded-xl shrink-0">
              <RefreshCw className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">Hassle-Free Returns</h3>
              <p className="text-xs text-slate-600 mt-1">Simple replacement procedures within 7 days.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
