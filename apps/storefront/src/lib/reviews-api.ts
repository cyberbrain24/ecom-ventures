import { PublicReview, RatingBreakdownSummary } from '../types/product';
import { fetchStorefrontData } from './api';

export interface StorefrontReviewsResponse {
  summary: RatingBreakdownSummary;
  reviews: PublicReview[];
  photo_urls: string[];
}

/** Loads approved reviews and rating summaries from the current store's database. */
export async function fetchProductReviews(
  productSlug: string,
  productId?: string,
  page = 1,
  limit = 10,
  host?: string
): Promise<StorefrontReviewsResponse> {
  const currentHost = host || (typeof window !== 'undefined' ? window.location.host : '');
  if (!currentHost) throw new Error('A store host is required to load product reviews.');

  const query = new URLSearchParams({
    product_id: productId || productSlug,
    page: String(page),
    limit: String(limit),
  });
  return fetchStorefrontData<StorefrontReviewsResponse>(
    currentHost,
    `/storefront/reviews/products/${encodeURIComponent(productSlug)}?${query.toString()}`
  );
}

/** Submits a review and propagates authentication or persistence failures to the caller. */
export async function submitCustomerReview(
  productSlug: string,
  payload: {
    product_id: string;
    rating: number;
    title: string;
    comment: string;
    images?: string[];
    order_id?: string;
  },
  host?: string
): Promise<{ success: boolean; message: string }> {
  const currentHost = host || (typeof window !== 'undefined' ? window.location.host : '');
  if (!currentHost) throw new Error('A store host is required to submit a review.');

  const result = await fetchStorefrontData<{ review: PublicReview; message: string }>(
    currentHost,
    `/storefront/reviews/products/${encodeURIComponent(productSlug)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }
  );
  if (!result || !result.message) {
    throw new Error('The store API did not confirm the review submission.');
  }
  return { success: true, message: result.message };
}
