import React from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getStorefrontConfig } from '../../lib/api';
import { getStorefrontCategories, getStorefrontProducts } from '../../lib/catalog-api';
import { PublicCategory } from '../../types/catalog';
import { ProductCard } from '../../components/catalog/ProductCard';
import { CatalogFilters } from '../../components/catalog/CatalogFilters';
import { CatalogToolbar } from '../../components/catalog/CatalogToolbar';
import { ShoppingBag } from 'lucide-react';

interface CatalogPageProps {
  searchParams: {
    search?: string;
    category?: string;
    min_price?: string;
    max_price?: string;
    in_stock?: string;
    sort?: string;
    page?: string;
  };
}

function findCategory(cats: PublicCategory[], slug: string): PublicCategory | null {
  for (const c of cats) {
    if (c.slug === slug) return c;
    if (c.children && c.children.length > 0) {
      const match = findCategory(c.children, slug);
      if (match) return match;
    }
  }
  return null;
}

export async function generateMetadata({ searchParams }: CatalogPageProps): Promise<Metadata> {
  const headersList = headers();
  const host = headersList.get('x-storefront-host') || '';
  const [config, categories] = await Promise.all([
    getStorefrontConfig(host),
    getStorefrontCategories(host),
  ]);

  const storeName = config?.store.name || 'Store';
  const selectedCat = searchParams.category
    ? findCategory(categories, searchParams.category)
    : null;

  let title = `Catalog & All Products | ${storeName}`;
  let description = `Browse the product catalog of ${storeName}.`;
  let canonicalUrl = `https://${host}/catalog`;
  let ogImage = config?.seo?.default_og_image_url || config?.store?.logo_url || '';
  let keywords: string[] | undefined = undefined;
  let robots = 'index, follow';

  if (selectedCat) {
    title = selectedCat.meta_title || `${selectedCat.name} Collection | ${storeName}`;
    description =
      selectedCat.meta_description ||
      `Shop our ${selectedCat.name} range at ${storeName}.`;
    canonicalUrl = selectedCat.canonical_url || `https://${host}/catalog?category=${selectedCat.slug}`;
    if (selectedCat.og_image_url || selectedCat.image_url) {
      ogImage = selectedCat.og_image_url || selectedCat.image_url || '';
    }
    if (selectedCat.focus_keyword) {
      keywords = [selectedCat.focus_keyword, selectedCat.name, storeName];
    }
    if (selectedCat.meta_robots) {
      robots = selectedCat.meta_robots;
    }
  } else if (searchParams.search) {
    title = `Search results for "${searchParams.search}" | ${storeName}`;
  }

  // Prevent duplicate content penalty when multiple transient facet parameters are applied
  const hasFilterParams = Boolean(searchParams.min_price || searchParams.max_price || searchParams.sort);
  if (hasFilterParams) {
    robots = 'noindex, follow';
  }

  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: canonicalUrl,
    },
    robots,
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'website',
      images: ogImage ? [{ url: ogImage, alt: title }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export default async function CatalogPage({ searchParams }: CatalogPageProps) {
  const headersList = headers();
  const host = headersList.get('x-storefront-host') || '';

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
    ? findCategory(categories, searchParams.category)
    : null;

  const currentUrl = `https://${host}/catalog${searchParams.category ? `?category=${searchParams.category}` : ''}`;

  // Schema.org CollectionPage & BreadcrumbList structured data
  const collectionSchema = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: selectedCat?.meta_title || (selectedCat ? `${selectedCat.name} Collection` : 'All Products Catalog'),
    description: selectedCat?.meta_description || selectedCat?.description || `Products from ${config.store.name}.`,
    url: selectedCat?.canonical_url || currentUrl,
    image: selectedCat?.og_image_url || selectedCat?.image_url || undefined,
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
              `Browse the products available from ${config.store.name}.`}
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
