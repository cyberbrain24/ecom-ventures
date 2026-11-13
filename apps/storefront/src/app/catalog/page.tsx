import React from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getStorefrontConfig } from '../../lib/api';
import { getStorefrontCategories, getStorefrontProducts } from '../../lib/catalog-api';
import { ProductCard } from '../../components/catalog/ProductCard';
import { CatalogFilters } from '../../components/catalog/CatalogFilters';
import { CatalogToolbar } from '../../components/catalog/CatalogToolbar';
import { ShoppingBag, Sparkles } from 'lucide-react';

interface CatalogPageProps {
  searchParams: {
    search?: string;
    category?: string;
    size?: string;
    min_price?: string;
    max_price?: string;
    in_stock?: string;
    sort?: string;
    page?: string;
  };
}

export async function generateMetadata({ searchParams }: CatalogPageProps): Promise<Metadata> {
  const headersList = headers();
  const host = headersList.get('x-storefront-host') || 'localhost';
  const [config, categories] = await Promise.all([
    getStorefrontConfig(host),
    getStorefrontCategories(host),
  ]);

  const storeName = config?.store.name || 'Store';
  const selectedCat = searchParams.category
    ? categories.find((c) => c.slug === searchParams.category)
    : null;

  let title = `Catalog & All Products | ${storeName}`;
  let description = `Explore authentic premium merchandise curated for ${storeName}. High quality with swift delivery.`;
  let canonicalUrl = `https://${host}/catalog`;

  if (selectedCat) {
    title = selectedCat.meta_title || `${selectedCat.name} Collection | ${storeName}`;
    description =
      selectedCat.meta_description ||
      `Shop our exclusive ${selectedCat.name} range at ${storeName}. Verified quality guarantee.`;
    canonicalUrl = selectedCat.canonical_url || `https://${host}/catalog?category=${selectedCat.slug}`;
  } else if (searchParams.search) {
    title = `Search results for "${searchParams.search}" | ${storeName}`;
  }

  // Prevent duplicate content penalty when multiple transient facet parameters are applied
  const hasFilterParams = Boolean(searchParams.min_price || searchParams.max_price || searchParams.sort);
  const robots = hasFilterParams ? 'noindex, follow' : 'index, follow';

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    robots,
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const headersList = headers();
  const host = headersList.get('x-storefront-host') || 'localhost';

  // Parallel server-side data fetching
  const [config, categories, catalogData] = await Promise.all([
    getStorefrontConfig(host),
    getStorefrontCategories(host),
    getStorefrontProducts(host, searchParams),
  ]);

  if (!config) {
    return null;
  }

  const selectedCat = searchParams.category
    ? categories.find((c) => c.slug === searchParams.category)
    : null;

  const currentUrl = `https://${host}/catalog${searchParams.category ? `?category=${searchParams.category}` : ''}`;

  // Schema.org CollectionPage & BreadcrumbList structured data
  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: selectedCat ? `${selectedCat.name} Collection` : 'All Products Catalog',
    description: selectedCat?.description || `Authentic merchandise curated for ${config.store.name}.`,
    url: currentUrl,
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: (catalogData.products || []).slice(0, 10).map((prod, idx) => ({
        '@type': 'ListItem',
        position: idx + 1,
        url: `https://${host}/product/${prod.slug}`,
        name: prod.title,
      })),
    },
  };

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `https://${host}`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Catalog',
        item: `https://${host}/catalog`,
      },
      ...(selectedCat
        ? [
            {
              '@type': 'ListItem',
              position: 3,
              name: selectedCat.name,
              item: currentUrl,
            },
          ]
        : []),
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-14">
        {/* Page Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 font-[var(--brand-font-heading)] tracking-tight">
            {selectedCat ? `${selectedCat.name} Collection` : 'All Products'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            {selectedCat?.description ||
              `Explore authentic merchandise curated specifically for ${config.store.name}.`}
          </p>
        </div>

        {/* Main Grid Layout: Sidebar Filters + Products Grid */}
        <div className="flex flex-col lg:flex-row gap-6 lg:gap-10 items-start">
          {/* Faceted Filter: Persistent on Desktop, Slide-Over Drawer Trigger on Mobile/Tablet */}
          <CatalogFilters
            categories={categories}
            minPrice={catalogData.min_price}
            maxPrice={catalogData.max_price}
          />

          {/* Catalog Main Content */}
          <div className="flex-1 w-full min-w-0">
            <CatalogToolbar total={catalogData.total} />

            {searchParams.size && (
              <div className="mt-4 p-3.5 bg-gradient-to-r from-violet-950 via-slate-900 to-cyan-950 border border-cyan-500/40 rounded-xl text-white flex items-center justify-between shadow-md animate-in fade-in">
                <div className="flex items-center space-x-2.5">
                  <div className="h-7 w-7 rounded-full bg-cyan-500/20 text-cyan-300 flex items-center justify-center border border-cyan-400/30">
                    <Sparkles className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>AI Fit Filter Active</span>
                      <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-cyan-400 text-slate-950 font-black">
                        SIZE {searchParams.size.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[10.5px] text-slate-400">
                      Showing streetwear drops curated for your customized silhouette match.
                    </p>
                  </div>
                </div>
                <a
                  href={`/catalog${searchParams.category ? `?category=${searchParams.category}` : ''}`}
                  className="text-[11px] font-bold text-slate-300 hover:text-white px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 transition flex-shrink-0"
                >
                  Reset
                </a>
              </div>
            )}

            {catalogData.products.length === 0 ? (
              <div className="py-20 sm:py-24 text-center border border-dashed border-slate-200 rounded-2xl mt-6">
                <ShoppingBag className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-base font-bold text-slate-800">No products found</h3>
                <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                  No items match your selected filter criteria. Try adjusting your search query or price range.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 pt-4 sm:pt-6">
                {catalogData.products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    currency={config.store.currency}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
