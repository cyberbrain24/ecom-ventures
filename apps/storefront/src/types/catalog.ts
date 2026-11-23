/**
 * Types representing public catalog models on the storefront application.
 */

export interface PublicCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  image_url?: string;
  og_image_url?: string;
  display_order: number;
  meta_title?: string;
  meta_description?: string;
  focus_keyword?: string;
  canonical_url?: string;
  meta_robots?: string;
  children?: PublicCategory[];
}

export interface PublicProductCard {
  id: string;
  title: string;
  slug: string;
  summary?: string;
  featured_image_url: string;
  base_price: number;
  compare_at_price?: number;
  has_discount: boolean;
  discount_percent?: number;
  in_stock: boolean;
  total_variants: number;
  category_slug?: string;
  category_name?: string;
  brand_name?: string;
  brand_logo_url?: string;
  is_featured?: boolean;
  is_sold_out?: boolean;
  rating_average?: number;
  rating_count?: number;
  created_at: string;
}

export interface CatalogSearchResponse {
  products: PublicProductCard[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  min_price: number;
  max_price: number;
}

export * from './product';

