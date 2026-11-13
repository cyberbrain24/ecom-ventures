import React from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getStorefrontConfig } from '../../../lib/api';
import { ProductDetailView } from '../../../components/product/ProductDetailView';
import { PublicProductDetail } from '../../../types/catalog';

interface ProductPageProps {
  params: { slug: string };
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

const FALLBACK_PRODUCT_DETAILS: Record<string, PublicProductDetail> = {
  'silk-evening-gown': {
    id: 'prod-001',
    title: 'Silk Evening Gown — Emerald Edition',
    slug: 'silk-evening-gown',
    sku: 'MIO-DRS-01',
    summary: 'Pure Mulberry Silk evening gown hand-finished with delicate gold embroidery and drape neckline.',
    description: `Indulge in royal sophistication with our signature Silk Evening Gown. Hand-tailored from genuine 100% Mulberry silk, this piece is lined with breathable silk habotai and structured with internal boning for a contouring silhouette.\n\nKey Highlights:\n• Premium pure mulberry silk fabric\n• Hand-appliquéd gold metallic thread accents\n• Fully lined with invisible back zip closure\n• Flattering cowl neckline and floor-sweeping train`,
    base_price: 18500,
    compare_at_price: 22000,
    featured_image_url: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=600&auto=format&fit=crop&q=80',
    category_slug: 'dresses',
    category_name: 'Dresses',
    brand_name: 'Mior Atelier',
    brand_logo_url: 'https://images.unsplash.com/photo-1544441893-675973e31985?w=120&auto=format&fit=crop&q=80',
    brand_origin: 'Dhaka, Bangladesh',
    care_instruction_title: 'Pure Silk & Delicate Fabrics',
    care_instructions: [
      'Dry clean recommended or gentle hand wash in lukewarm water (below 30°C)',
      'Use mild PH-neutral silk detergent; do not wring or twist fabric',
      'Dry flat on a clean dry towel away from direct sunlight and heat',
      'Steam iron on reverse using lowest heat setting or silk mode (max 110°C)',
      'Never use chlorine bleach or enzyme-based stain removers',
    ],
    is_featured: true,
    is_sold_out: false,
    images: [
      { id: 'img-1', url: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=600&auto=format&fit=crop&q=80', is_primary: true },
      { id: 'img-2', url: 'https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=600&auto=format&fit=crop&q=80', is_primary: false },
    ],
    attributes: [
      {
        id: 'attr-size',
        name: 'Size Selection',
        code: 'size',
        displayType: 'BUTTON',
        display_type: 'BUTTON',
        values: [
          { id: 'val-s', value: 's', displayValue: 'Small (S)', display_value: 'Small (S)' },
          { id: 'val-m', value: 'm', displayValue: 'Medium (M)', display_value: 'Medium (M)' },
          { id: 'val-l', value: 'l', displayValue: 'Large (L)', display_value: 'Large (L)' },
        ],
      },
      {
        id: 'attr-color',
        name: 'Colorway',
        code: 'color',
        displayType: 'COLOR_SWATCH',
        display_type: 'COLOR_SWATCH',
        values: [
          { id: 'val-emerald', value: 'emerald', displayValue: 'Emerald Green', display_value: 'Emerald Green', colorHex: '#047857' },
        ],
      },
    ],
    variants: [
      {
        id: 'v1',
        sku: 'MIO-DRS-01-S-EMR',
        title: 'Small / Emerald',
        price: 18500,
        compare_at_price: 22000,
        in_stock: true,
        available_quantity: 8,
        attribute_value_ids: ['val-s', 'val-emerald'],
        image_ids: ['img-1'],
        image_url: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=600&auto=format&fit=crop&q=80',
      },
      {
        id: 'v2',
        sku: 'MIO-DRS-01-M-EMR',
        title: 'Medium / Emerald',
        price: 18500,
        compare_at_price: 22000,
        in_stock: true,
        available_quantity: 10,
        attribute_value_ids: ['val-m', 'val-emerald'],
        image_ids: ['img-1'],
        image_url: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=600&auto=format&fit=crop&q=80',
      },
      {
        id: 'v3',
        sku: 'MIO-DRS-01-L-EMR',
        title: 'Large / Emerald',
        price: 18500,
        compare_at_price: 22000,
        in_stock: true,
        available_quantity: 6,
        attribute_value_ids: ['val-l', 'val-emerald'],
        image_ids: ['img-2'],
        image_url: 'https://images.unsplash.com/photo-1539008835657-9e8e9680c956?w=600&auto=format&fit=crop&q=80',
      },
    ],
  },
  'cashmere-winter-knit': {
    id: 'prod-002',
    title: 'Cashmere Winter Knit Cardigan',
    slug: 'cashmere-winter-knit',
    sku: 'MIO-KNT-02',
    summary: 'Grade-A 100% Himalayan cashmere wrap cardigan offering supreme warmth and cloud-like softness.',
    description: `Spun from the finest underfleece of Himalayan mountain goats, this wrap cardigan provides exceptional warmth with virtually zero weight. Designed with ribbed cuffs and an optional matching tie sash.\n\nKey Highlights:\n• 100% Grade-A Mongolian cashmere\n• Hand-linked seams for durable comfort\n• Ultra-soft non-scratchy skin feel\n• Modern relaxed silhouette with dropped shoulders`,
    base_price: 12500,
    compare_at_price: 15000,
    featured_image_url: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&auto=format&fit=crop&q=80',
    category_slug: 'knitwear',
    category_name: 'Knitwear',
    brand_name: 'Luxe Cashmere Co.',
    brand_logo_url: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=120&auto=format&fit=crop&q=80',
    brand_origin: 'Kathmandu, Nepal',
    care_instruction_title: 'Grade-A Cashmere & Fine Knitwear',
    care_instructions: [
      'Hand wash only in cold water with gentle cashmere wash',
      'Submerge for 5 minutes, gently swirl, do not rub fibers together',
      'Roll in a towel to absorb excess water without wringing',
      'Reshape garment while damp and dry flat on drying rack',
      'Store folded with cedar balls; never hang on hangers',
    ],
    is_featured: true,
    is_sold_out: false,
    images: [
      { id: 'img-knt-1', url: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&auto=format&fit=crop&q=80', is_primary: true },
    ],
    attributes: [
      {
        id: 'attr-color-knt',
        name: 'Color Tone',
        code: 'color',
        displayType: 'COLOR_SWATCH',
        display_type: 'COLOR_SWATCH',
        values: [
          { id: 'val-champagne', value: 'champagne', displayValue: 'Champagne Gold', display_value: 'Champagne Gold', colorHex: '#fef08a' },
          { id: 'val-noir', value: 'noir', displayValue: 'Noir Black', display_value: 'Noir Black', colorHex: '#0f172a' },
        ],
      },
    ],
    variants: [
      {
        id: 'v4',
        sku: 'MIO-KNT-02-CH-FREE',
        title: 'Champagne / Free Size',
        price: 12500,
        compare_at_price: 15000,
        in_stock: true,
        available_quantity: 25,
        attribute_value_ids: ['val-champagne'],
        image_ids: ['img-knt-1'],
        image_url: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&auto=format&fit=crop&q=80',
      },
      {
        id: 'v5',
        sku: 'MIO-KNT-02-NO-FREE',
        title: 'Noir / Free Size',
        price: 12500,
        compare_at_price: 15000,
        in_stock: true,
        available_quantity: 20,
        attribute_value_ids: ['val-noir'],
        image_ids: ['img-knt-1'],
        image_url: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&auto=format&fit=crop&q=80',
      },
    ],
  },
  'velvet-embroidered-blazer': {
    id: 'prod-004',
    title: 'Velvet Embroidered Blazer',
    slug: 'velvet-embroidered-blazer',
    sku: 'MIO-OUT-04',
    summary: 'Bespoke deep emerald velvet blazer tailored with structured shoulders and silk satin lapels.',
    description: `A masterclass in contemporary tailoring, this velvet blazer features peaked silk-satin lapels, horn buttons, and tonal cuff embroideries. Currently completely sold out in our pilot run.`,
    base_price: 16200,
    compare_at_price: undefined,
    featured_image_url: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&auto=format&fit=crop&q=80',
    category_slug: 'outerwear',
    category_name: 'Outerwear',
    brand_name: 'Mior Atelier',
    brand_logo_url: 'https://images.unsplash.com/photo-1544441893-675973e31985?w=120&auto=format&fit=crop&q=80',
    brand_origin: 'Dhaka, Bangladesh',
    care_instruction_title: 'Velvet & Structured Tailoring',
    care_instructions: [
      'Professional dry clean only by garment care specialists',
      'Brush lightly with a velvet brush along the grain after wear',
      'Hang on broad contoured wooden hangers to preserve shoulder structure',
      'Steam from inside; never press hot iron plate directly onto velvet pile',
    ],
    is_featured: true,
    is_sold_out: true, // Marked as Sold Out
    images: [
      { id: 'img-out-1', url: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&auto=format&fit=crop&q=80', is_primary: true },
    ],
    attributes: [],
    variants: [
      {
        id: 'v-out-1',
        sku: 'MIO-OUT-04-STD',
        title: 'Standard Tailored Fit',
        price: 16200,
        in_stock: false,
        available_quantity: 0,
        attribute_value_ids: [],
        image_ids: ['img-out-1'],
        image_url: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&auto=format&fit=crop&q=80',
      },
    ],
  },
};

async function getProductBySlug(host: string, slug: string): Promise<PublicProductDetail | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/storefront/catalog/products/${slug}`, {
      headers: {
        'Host': host,
        'X-Forwarded-Host': host,
      },
      next: { revalidate: 60, tags: [`product-${slug}-${host}`] },
    });

    if (res.ok) {
      const payload = await res.json();
      const data = (payload?.data !== undefined ? payload.data : payload) as PublicProductDetail;
      if (data && data.title) {
        return data;
      }
    }
  } catch (err) {
    // Fall through to fallback
  }

  // Gracefully fallback to enriched demo details if backend endpoint returned error or not found
  return FALLBACK_PRODUCT_DETAILS[slug] || null;
}

export async function generateMetadata({ params }: ProductPageProps): Promise<Metadata> {
  const headersList = headers();
  const host = headersList.get('x-storefront-host') || 'localhost';
  const [config, product] = await Promise.all([
    getStorefrontConfig(host),
    getProductBySlug(host, params.slug),
  ]);

  if (!product) {
    return { title: 'Product Not Found | Store' };
  }

  const storeName = config?.store.name || product.brand_name || 'Store';
  const metaTitle = product.meta_title || `${product.title} | ${storeName}`;
  const metaDesc =
    product.meta_description ||
    product.summary ||
    `Shop ${product.title} with verified quality guarantee and fast doorstep delivery at ${storeName}.`;
  const canonicalUrl = product.canonical_url || `https://${host}/product/${product.slug}`;
  const featuredImg = product.og_image_url || product.featuredImageURL || product.featured_image_url;

  const keywords = [
    ...(product.focus_keyword ? [product.focus_keyword] : []),
    ...(product.category_name ? [product.category_name] : []),
    storeName,
    product.title,
  ];

  return {
    title: metaTitle,
    description: metaDesc,
    keywords,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: product.meta_robots || 'index, follow',
    openGraph: {
      title: metaTitle,
      description: metaDesc,
      url: canonicalUrl,
      type: 'website',
      images: featuredImg ? [{ url: featuredImg, alt: product.title }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: metaTitle,
      description: metaDesc,
      images: featuredImg ? [featuredImg] : [],
    },
  };
}

export default async function ProductPage({ params }: ProductPageProps) {
  const headersList = headers();
  const host = headersList.get('x-storefront-host') || 'localhost';

  const [config, product] = await Promise.all([
    getStorefrontConfig(host),
    getProductBySlug(host, params.slug),
  ]);

  if (!config || !product) {
    notFound();
  }

  const currentUrl = `https://${host}/product/${product.slug}`;
  const price = product.base_price || product.basePrice || 0;
  const inStock = product.variants ? product.variants.some((v) => v.in_stock) : true;
  const ratingCount = product.rating_count || product.ratingCount || 0;
  const ratingAvg = product.rating_average || product.ratingAverage || 5.0;

  // Rich Schema.org Product JSON-LD structured data
  const productSchema: Record<string, any> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.title,
    image: (product.images || []).map((img) => img.url).concat([product.featured_image_url || product.featuredImageURL || '']).filter(Boolean),
    description: product.description || product.summary || product.title,
    sku: product.sku || product.id,
    brand: {
      '@type': 'Brand',
      name: product.brand_name || product.brandName || config.store.name,
    },
    offers: {
      '@type': 'Offer',
      url: currentUrl,
      priceCurrency: config.store.currency,
      price: price,
      availability: inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  };

  if (ratingCount > 0) {
    productSchema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: ratingAvg,
      reviewCount: ratingCount,
      bestRating: 5,
      worstRating: 1,
    };
  }

  // Schema.org BreadcrumbList structured data
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
      ...(product.category_slug
        ? [
            {
              '@type': 'ListItem',
              position: 3,
              name: product.category_name || product.category_slug,
              item: `https://${host}/catalog?category=${product.category_slug}`,
            },
            {
              '@type': 'ListItem',
              position: 4,
              name: product.title,
              item: currentUrl,
            },
          ]
        : [
            {
              '@type': 'ListItem',
              position: 3,
              name: product.title,
              item: currentUrl,
            },
          ]),
    ],
  };

  return (
    <>
      {/* Schema.org Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        <ProductDetailView product={product} currency={config.store.currency} />
      </div>
    </>
  );
}
