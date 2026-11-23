import { MetadataRoute } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { getStorefrontConfig } from '../lib/api';
import { getStorefrontCategories, getStorefrontProducts } from '../lib/catalog-api';
import { getStorefrontBlogPosts } from '../lib/blog-api';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const headersList = headers();
  const host = headersList.get('x-storefront-host') || '';
  if (!host) {
    notFound();
  }

  // A deleted or unregistered store has no sitemap. API failures still propagate as 500.
  const config = await getStorefrontConfig(host);
  if (!config) {
    notFound();
  }
  const baseURL = `https://${host}`;

  const now = new Date();

  // Core static pages
  const staticRoutes: MetadataRoute.Sitemap = [
    {
      url: baseURL,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    {
      url: `${baseURL}/catalog`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${baseURL}/blog`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${baseURL}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${baseURL}/shipping-policy`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${baseURL}/returns`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ];

  try {
    const [categories, catalogRes, blogRes] = await Promise.all([
      getStorefrontCategories(host),
      getStorefrontProducts(host, { limit: '100' } as any),
      getStorefrontBlogPosts(host, { limit: '100' }),
    ]);

    const categoryRoutes: MetadataRoute.Sitemap = (categories || []).map((cat) => ({
      url: `${baseURL}/catalog?category=${cat.slug}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    }));

    const productRoutes: MetadataRoute.Sitemap = (catalogRes?.products || []).map((prod) => ({
      url: `${baseURL}/product/${prod.slug}`,
      lastModified: prod.created_at ? new Date(prod.created_at) : now,
      changeFrequency: 'daily',
      priority: 0.9,
    }));

    const blogRoutes: MetadataRoute.Sitemap = (blogRes?.posts || []).map((post) => ({
      url: `${baseURL}/blog/${post.slug}`,
      lastModified: post.published_at ? new Date(post.published_at) : now,
      changeFrequency: 'weekly',
      priority: 0.7,
    }));

    return [...staticRoutes, ...categoryRoutes, ...productRoutes, ...blogRoutes];
  } catch (e) {
    return staticRoutes;
  }
}

