import {
  StorefrontBlogCategory,
  StorefrontBlogPostDetail,
  StorefrontBlogListResponse,
} from '../types/blog';
import { StorefrontApiError, fetchStorefrontData } from './api';

/** Loads published editorial categories from the current store's database. */
export async function getStorefrontBlogCategories(host: string): Promise<StorefrontBlogCategory[]> {
  const categories = await fetchStorefrontData<StorefrontBlogCategory[]>(host, '/storefront/blog/categories', {
    next: { revalidate: 60, tags: [`blog-categories-${host}`] },
  });
  if (!Array.isArray(categories)) {
    throw new StorefrontApiError('The store API returned an invalid blog category list.', 502);
  }
  return categories;
}

/** Loads paginated published posts; an empty list is a valid database result. */
export async function getStorefrontBlogPosts(
  host: string,
  params: {
    category?: string;
    search?: string;
    page?: string;
    limit?: string;
  }
): Promise<StorefrontBlogListResponse> {
  const query = new URLSearchParams();
  if (params.category) query.set('category', params.category);
  if (params.search) query.set('search', params.search);
  query.set('page', params.page || '1');
  query.set('limit', params.limit || '9');

  const result = await fetchStorefrontData<StorefrontBlogListResponse>(
    host,
    `/storefront/blog/posts?${query.toString()}`,
    { next: { revalidate: 60, tags: [`blog-posts-${host}`] } }
  );
  if (!result || !Array.isArray(result.posts) || !result.meta) {
    throw new StorefrontApiError('The store API returned an invalid blog post list.', 502);
  }
  return result;
}

/** Loads a published post by slug; returns null only when the backend responds with 404. */
export async function getStorefrontBlogPostBySlug(
  host: string,
  slug: string
): Promise<StorefrontBlogPostDetail | null> {
  try {
    const post = await fetchStorefrontData<StorefrontBlogPostDetail>(
      host,
      `/storefront/blog/posts/${encodeURIComponent(slug)}`,
      { next: { revalidate: 60, tags: [`blog-post-${slug}-${host}`] } }
    );
    if (!post || !post.title) {
      throw new StorefrontApiError('The store API returned an invalid blog post.', 502);
    }
    return post;
  } catch (error) {
    if (error instanceof StorefrontApiError && error.status === 404) return null;
    throw error;
  }
}
