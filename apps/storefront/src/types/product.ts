/**
 * Types representing product detail and variant models on the storefront application.
 */

export interface ProductImage {
  id: string;
  product_id?: string;
  url: string;
  alt_text?: string;
  altText?: string;
  sort_order?: number;
  is_primary?: boolean;
}

export interface AttributeValue {
  id: string;
  attribute_id?: string;
  value: string;
  display_value?: string;
  displayValue?: string;
  color_hex?: string | null;
  colorHex?: string | null;
  sort_order?: number;
}

export interface PublicAttributeOption {
  id: string;
  name: string;
  code: string;
  display_type?: string;
  displayType?: string;
  values: AttributeValue[];
}

export interface PublicVariantDetail {
  id: string;
  sku: string;
  title: string;
  price: number;
  compare_at_price?: number | null;
  compareAtPrice?: number | null;
  weight_grams?: number;
  in_stock: boolean;
  inStock?: boolean;
  available_quantity: number;
  availableQuantity?: number;
  attribute_value_ids: string[];
  attributeValueIDs?: string[];
  image_ids: string[];
  imageIDs?: string[];
  image_url?: string;
  imageUrl?: string;
}

export interface PublicProductDetail {
  id: string;
  title: string;
  slug: string;
  sku?: string;
  summary?: string;
  description?: string;
  base_price: number;
  basePrice?: number;
  compare_at_price?: number | null;
  compareAtPrice?: number | null;
  featured_image_url: string;
  featuredImageURL?: string;
  category_slug?: string | null;
  category_name?: string | null;
  categorySlug?: string | null;
  categoryName?: string | null;
  meta_title?: string;
  meta_description?: string;
  focus_keyword?: string;
  canonical_url?: string;
  meta_robots?: string;
  og_image_url?: string;
  // Advanced features:
  brand_name?: string;
  brandName?: string;
  brand_logo_url?: string;
  brandLogoUrl?: string;
  brand_origin?: string;
  brandOrigin?: string;
  care_instruction_title?: string;
  careInstructionTitle?: string;
  care_instructions?: string[];
  careInstructions?: string[];
  is_featured?: boolean;
  isFeatured?: boolean;
  is_sold_out?: boolean;
  isSoldOut?: boolean;
  rating_average?: number;
  ratingAverage?: number;
  rating_count?: number;
  ratingCount?: number;
  images: ProductImage[];
  attributes: PublicAttributeOption[];
  variants: PublicVariantDetail[];
  created_at?: string;
}

export interface PublicReview {
  id: string;
  product_id: string;
  customer_name: string; // privacy masked e.g. "Tanvir R."
  rating: number; // 1-5
  title: string;
  comment: string;
  is_verified_purchase: boolean;
  is_featured: boolean;
  images: string[];
  created_at: string;
}

export interface RatingBreakdownSummary {
  product_id: string;
  average_rating: number;
  review_count: number;
  rating_breakdown: Record<number, number>;
  photo_count: number;
  verified_buyer_count: number;
}

