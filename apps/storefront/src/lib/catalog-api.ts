import { CatalogSearchResponse, PublicCategory } from '../types/catalog';
import { PublicProductDetail } from '../types/product';
import { StorefrontApiError, fetchStorefrontData } from './api';

/** Fetches the categories that are active in the database for the resolved store. */
export async function getStorefrontCategories(host: string): Promise<PublicCategory[]> {
  const categories = await fetchStorefrontData<PublicCategory[]>(host, '/storefront/catalog/categories', {
    next: { revalidate: 300, tags: [`storefront-categories-${host}`] },
  });
  if (!Array.isArray(categories)) {
    throw new StorefrontApiError('The store API returned an invalid category list.', 502);
  }
  return categories;
}

/** Searches products using the supplied filters and returns only database results. */
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
    /** "true" returns only featured products, in the merchant's featured order. */
    featured?: string;
    /** Page size; defaults to 24. The API accepts 1 to 100. */
    limit?: string;
  }
): Promise<CatalogSearchResponse> {
  const query = new URLSearchParams();
  if (params.featured) query.set('featured', params.featured);
  if (params.search) query.set('search', params.search);
  if (params.category) query.set('category', params.category);
  if (params.min_price) query.set('min_price', params.min_price);
  if (params.max_price) query.set('max_price', params.max_price);
  if (params.in_stock) query.set('in_stock', params.in_stock);
  if (params.sort) query.set('sort', params.sort);
  query.set('page', params.page || '1');
  query.set('limit', params.limit || '24');

  const result = await fetchStorefrontData<CatalogSearchResponse>(
    host,
    `/storefront/catalog/products?${query.toString()}`,
    { next: { revalidate: 60, tags: [`storefront-products-${host}`] } }
  );
  if (!result || !Array.isArray(result.products)) {
    throw new StorefrontApiError('The store API returned an invalid product list.', 502);
  }
  return result;
}

/** Loads one product from the current store; returns null only for a real 404. */
export async function getStorefrontProductBySlug(host: string, slug: string): Promise<PublicProductDetail | null> {
  try {
    const product = await fetchStorefrontData<PublicProductDetail>(
      host,
      `/storefront/catalog/products/${encodeURIComponent(slug)}`,
      { next: { revalidate: 60, tags: [`product-${slug}-${host}`] } }
    );
    if (!product || !product.title) {
      throw new StorefrontApiError('The store API returned an invalid product.', 502);
    }
    return product;
  } catch (error) {
    if (error instanceof StorefrontApiError && error.status === 404) return null;
    throw error;
  }
}
