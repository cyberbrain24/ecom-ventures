import React from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getStorefrontConfig } from '../../../lib/api';
import { getStorefrontProductBySlug } from '../../../lib/catalog-api';
import { ProductDetailView } from '../../../components/product/ProductDetailView';

interface ProductPageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const host = headers().get('x-storefront-host') || '';
  const [config, product] = await Promise.all([
    getStorefrontConfig(host),
    getStorefrontProductBySlug(host, params.slug),
  ]);
  if (!product) return { title: 'Product Not Found' };

  const storeName = config?.store.name || product.brand_name || 'Store';
  const title = product.meta_title || `${product.title} | ${storeName}`;
  const description =
    product.meta_description ||
    product.summary ||
    `Shop ${product.title} from ${storeName}.`;
  const canonicalUrl = product.canonical_url || `https://${host}/product/${product.slug}`;
  const image = product.og_image_url || product.featured_image_url;

  return {
    title,
    description,
    keywords: [
      ...(product.focus_keyword ? [product.focus_keyword] : []),
      ...(product.category_name ? [product.category_name] : []),
      storeName,
      product.title,
    ],
    alternates: { canonical: canonicalUrl },
    robots: product.meta_robots || 'index, follow',
    openGraph: {
      title,
      description,
      url: canonicalUrl,
      type: 'website',
      images: image ? [{ url: image, alt: product.title }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: image ? [image] : [],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const host = headers().get('x-storefront-host') || '';
  const [config, product] = await Promise.all([
    getStorefrontConfig(host),
    getStorefrontProductBySlug(host, params.slug),
  ]);
  if (!config || !product) notFound();

  const currentUrl = `https://${host}/product/${product.slug}`;
  const inStock = product.variants.some((variant) => variant.in_stock);
  const ratingCount = product.rating_count ?? product.ratingCount ?? 0;
  const ratingAverage = product.rating_average ?? product.ratingAverage ?? 0;
  const productSchema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    image: [...product.images.map((image) => image.url), ...(product.featured_image_url ? [product.featured_image_url] : [])],
    description: product.description || product.summary || product.title,
    sku: product.sku || product.id,
    brand: { '@type': 'Brand', name: product.brand_name || product.brandName || config.store.name },
    offers: {
      '@type': 'Offer',
      url: currentUrl,
      priceCurrency: config.store.currency,
      price: product.base_price,
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  };

  if (ratingCount > 0) {
    productSchema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: ratingAverage,
      reviewCount: ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  const categorySlug = product.category_slug || product.categorySlug;
  const categoryName = product.category_name || product.categoryName || categorySlug;
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `https://${host}` },
      { '@type': 'ListItem', position: 2, name: 'Catalog', item: `https://${host}/catalog` },
      ...(categorySlug
        ? [
            {
              '@type': 'ListItem',
              position: 3,
              name: categoryName,
              item: `https://${host}/catalog?category=${categorySlug}`,
            },
            { '@type': 'ListItem', position: 4, name: product.title, item: currentUrl },
          ]
        : [{ '@type': 'ListItem', position: 3, name: product.title, item: currentUrl }]),
    ],
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <ProductDetailView product={product} currency={config.store.currency} />
      </div>
    </>
  );
}
