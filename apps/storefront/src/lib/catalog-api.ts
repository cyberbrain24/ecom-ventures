import { CatalogSearchResponse, PublicCategory, PublicProductCard } from '../types/catalog';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

const FALLBACK_CATEGORIES: PublicCategory[] = [
  { id: 'cat-1', name: 'Dresses', slug: 'dresses', description: 'Silk evening gowns and couture', display_order: 1 },
  { id: 'cat-2', name: 'Knitwear', slug: 'knitwear', description: 'Grade-A Cashmere cardigans and sweaters', display_order: 2 },
  { id: 'cat-3', name: 'Outerwear', slug: 'outerwear', description: 'Velvet and wool tailored jackets', display_order: 3 },
];

const FALLBACK_PRODUCTS: PublicProductCard[] = [
  {
    id: 'prod-001',
    title: 'Silk Evening Gown — Emerald Edition',
    slug: 'silk-evening-gown',
    summary: 'Pure Mulberry Silk evening gown hand-finished with delicate gold embroidery and drape neckline.',
    featured_image_url: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=600&auto=format&fit=crop&q=80',
    base_price: 18500,
    compare_at_price: 22000,
    has_discount: true,
    discount_percent: 16,
    in_stock: true,
    total_variants: 3,
    category_slug: 'dresses',
    category_name: 'Dresses',
    brand_name: 'Mior Atelier',
    brand_logo_url: 'https://images.unsplash.com/photo-1544441893-675973e31985?w=120&auto=format&fit=crop&q=80',
    is_featured: true,
    is_sold_out: false,
    created_at: '2026-10-28',
  },
  {
    id: 'prod-002',
    title: 'Cashmere Winter Knit Cardigan',
    slug: 'cashmere-winter-knit',
    summary: 'Grade-A 100% Himalayan cashmere wrap cardigan offering supreme warmth and cloud-like softness.',
    featured_image_url: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=600&auto=format&fit=crop&q=80',
    base_price: 12500,
    compare_at_price: 15000,
    has_discount: true,
    discount_percent: 17,
    in_stock: true,
    total_variants: 2,
    category_slug: 'knitwear',
    category_name: 'Knitwear',
    brand_name: 'Luxe Cashmere Co.',
    brand_logo_url: 'https://images.unsplash.com/photo-1576995853123-5a10305d93c0?w=120&auto=format&fit=crop&q=80',
    is_featured: true,
    is_sold_out: false,
    created_at: '2026-10-29',
  },
  {
    id: 'prod-003',
    title: 'Pleated Chiffon Formal Maxi',
    slug: 'pleated-chiffon-maxi',
    summary: 'Airy layered chiffon maxi dress with micro-pleated bodice and flowing flared silhouette.',
    featured_image_url: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=600&auto=format&fit=crop&q=80',
    base_price: 9800,
    compare_at_price: undefined,
    has_discount: false,
    in_stock: true,
    total_variants: 1,
    category_slug: 'dresses',
    category_name: 'Dresses',
    brand_name: 'Aura Silk Mills',
    brand_logo_url: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=120&auto=format&fit=crop&q=80',
    is_featured: false,
    is_sold_out: false,
    created_at: '2026-10-30',
  },
  {
    id: 'prod-004',
    title: 'Velvet Embroidered Blazer',
    slug: 'velvet-embroidered-blazer',
    summary: 'Bespoke deep emerald velvet blazer tailored with structured shoulders and silk satin lapels.',
    featured_image_url: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=600&auto=format&fit=crop&q=80',
    base_price: 16200,
    compare_at_price: undefined,
    has_discount: false,
    in_stock: false,
    total_variants: 1,
    category_slug: 'outerwear',
    category_name: 'Outerwear',
    brand_name: 'Mior Atelier',
    brand_logo_url: 'https://images.unsplash.com/photo-1544441893-675973e31985?w=120&auto=format&fit=crop&q=80',
    is_featured: true,
    is_sold_out: true, // Marked as Sold Out
    created_at: '2026-11-01',
  },
];

/**
 * Fetch hierarchical active categories for the storefront.
 */
export async function getStorefrontCategories(host: string): Promise<PublicCategory[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/storefront/catalog/categories`, {
      headers: {
        'Host': host,
        'X-Forwarded-Host': host,
        'X-Original-Host': host,
      },
      next: {
        revalidate: 300,
        tags: [`storefront-categories-${host}`],
      },
    });

    if (!res.ok) {
      return FALLBACK_CATEGORIES;
    }
    const payload = await res.json();
    const data = payload?.data !== undefined ? payload.data : payload;
    const list = (Array.isArray(data) ? data : []) as PublicCategory[];
    return list.length > 0 ? list : FALLBACK_CATEGORIES;
  } catch (error) {
    return FALLBACK_CATEGORIES;
  }
}

/**
 * Query public products with full faceted filtering parameters.
 */
export async function getStorefrontProducts(
  host: string,
  params: {
    search?: string;
    category?: string;
    min_price?: string;
    max_price?: string;
    in_stock?: string;
    sort?: string;
    page?: string;
  }
): Promise<CatalogSearchResponse> {
  const query = new URLSearchParams();
  if (params.search) query.append('search', params.search);
  if (params.category) query.append('category', params.category);
  if (params.min_price) query.append('min_price', params.min_price);
  if (params.max_price) query.append('max_price', params.max_price);
  if (params.in_stock) query.append('in_stock', params.in_stock);
  if (params.sort) query.append('sort', params.sort);
  query.append('page', params.page || '1');
  query.append('limit', '24');

  try {
    const res = await fetch(`${API_BASE_URL}/storefront/catalog/products?${query.toString()}`, {
      headers: {
        'Host': host,
        'X-Forwarded-Host': host,
        'X-Original-Host': host,
      },
      next: {
        revalidate: 60,
        tags: [`storefront-products-${host}`],
      },
    });

    if (!res.ok) {
      return buildFilteredFallback(params);
    }

    const payload = await res.json();
    const data = payload?.data !== undefined ? payload.data : payload;
    const prods = data?.products || [];
    if (prods.length === 0) {
      return buildFilteredFallback(params);
    }

    return (data || buildFilteredFallback(params)) as CatalogSearchResponse;
  } catch (error) {
    return buildFilteredFallback(params);
  }
}

function buildFilteredFallback(params: { search?: string; category?: string }): CatalogSearchResponse {
  let list = [...FALLBACK_PRODUCTS];
  if (params.search) {
    const s = params.search.toLowerCase();
    list = list.filter((p) => p.title.toLowerCase().includes(s) || (p.brand_name && p.brand_name.toLowerCase().includes(s)));
  }
  if (params.category) {
    list = list.filter((p) => p.category_slug === params.category);
  }

  return {
    products: list,
    total: list.length,
    page: 1,
    limit: 24,
    total_pages: 1,
    min_price: 9800,
    max_price: 18500,
  };
}
