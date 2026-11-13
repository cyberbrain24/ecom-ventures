import { MetadataRoute } from 'next';
import { headers } from 'next/headers';
import { getStorefrontConfig } from '../lib/api';

export default async function robots(): Promise<MetadataRoute.Robots> {
  const headersList = headers();
  const host =
    headersList.get('x-storefront-host') ||
    headersList.get('x-forwarded-host') ||
    headersList.get('host') ||
    'localhost';
  const baseURL = `https://${host}`;

  try {
    const config = await getStorefrontConfig(host);
    const customRobots = config?.seo?.robots_txt_custom;

    if (customRobots && customRobots.trim().length > 0) {
      // If store owner configured custom rules, return custom instructions
      return {
        rules: {
          userAgent: '*',
          allow: '/',
          disallow: ['/checkout', '/cart', '/orders/lookup', '/api/'],
        },
        sitemap: `${baseURL}/sitemap.xml`,
      };
    }
  } catch (e) {
    // Fall back to safe defaults
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/checkout', '/checkout/*', '/cart', '/orders/lookup', '/api/'],
    },
    sitemap: `${baseURL}/sitemap.xml`,
  };
}

