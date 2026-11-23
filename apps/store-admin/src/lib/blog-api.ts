import { authorizedRequest } from './api';
import { StoreBlogCategory, StoreBlogPost } from '../types/store';

export async function fetchBlogCategories(): Promise<StoreBlogCategory[]> {
  try {
    const res = await authorizedRequest<any>('/blog/categories');
    const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
    return list.map((item: any) => ({
      id: item.id,
      name: item.name,
      slug: item.slug,
      description: item.description || '',
      metaTitle: item.meta_title || item.metaTitle || '',
      metaDescription: item.meta_description || item.metaDescription || '',
      displayOrder: Number(item.display_order ?? item.displayOrder ?? 0),
      isActive: Boolean(item.is_active ?? item.isActive ?? true),
      postCount: item.post_count || item.postCount || 0,
    }));
  } catch {
    return [];
  }
}

export async function createBlogCategory(cat: {
  name: string;
  slug: string;
  description?: string;
}): Promise<void> {
  await authorizedRequest<void>('/blog/categories', {
    method: 'POST',
    body: JSON.stringify(cat),
  });
}

export async function deleteBlogCategory(id: string): Promise<void> {
  await authorizedRequest<void>(`/blog/categories/${id}`, {
    method: 'DELETE',
  });
}

export async function fetchBlogPosts(): Promise<StoreBlogPost[]> {
  try {
    const res = await authorizedRequest<any>('/blog/posts');
    const raw = res?.data ?? res;
    const list = Array.isArray(raw?.posts) ? raw.posts : Array.isArray(raw) ? raw : [];
    return list.map((item: any) => ({
      id: item.id,
      categoryId: item.category_id || item.categoryId,
      categoryName: item.category_name || item.categoryName,
      categorySlug: item.category_slug || item.categorySlug,
      title: item.title,
      slug: item.slug,
      excerpt: item.excerpt || '',
      content: item.content || '',
      featuredImageUrl: item.featured_image_url || item.featuredImageUrl || '',
      featuredImageAlt: item.featured_image_alt || item.featuredImageAlt || '',
      authorName: item.author_name || item.authorName || 'Admin',
      authorAvatarUrl: item.author_avatar_url || item.authorAvatarUrl || '',
      status: item.status || 'DRAFT',
      publishedAt: item.published_at || item.publishedAt,
      readingTimeMinutes: item.reading_time_minutes || item.readingTimeMinutes || 3,
      viewCount: item.view_count || item.viewCount || 0,
      tags: item.tags || [],
      metaTitle: item.meta_title || item.metaTitle || '',
      metaDescription: item.meta_description || item.metaDescription || '',
      focusKeyword: item.focus_keyword || item.focusKeyword || '',
      secondaryKeywords: item.secondary_keywords || item.secondaryKeywords || [],
      canonicalUrl: item.canonical_url || item.canonicalUrl || '',
      metaRobots: item.meta_robots || item.metaRobots || 'index, follow',
      ogTitle: item.og_title || item.ogTitle || '',
      ogDescription: item.og_description || item.ogDescription || '',
      ogImageUrl: item.og_image_url || item.ogImageUrl || '',
      twitterTitle: item.twitter_title || item.twitterTitle || '',
      twitterDescription: item.twitter_description || item.twitterDescription || '',
    }));
  } catch {
    return [];
  }
}

export async function createBlogPost(post: {
  title: string;
  slug: string;
  content: string;
  excerpt?: string;
  category_id?: string;
  status?: string;
  meta_title?: string;
  meta_description?: string;
  focus_keyword?: string;
}): Promise<void> {
  await authorizedRequest<void>('/blog/posts', {
    method: 'POST',
    body: JSON.stringify(post),
  });
}

export async function deleteBlogPost(id: string): Promise<void> {
  await authorizedRequest<void>(`/blog/posts/${id}`, {
    method: 'DELETE',
  });
}
