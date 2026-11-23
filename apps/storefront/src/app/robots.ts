import { MetadataRoute } from 'next';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { getStorefrontConfig } from '../lib/api';

/** Paths that shoppers do not need indexed, used when the store has no custom robots text. */
const DEFAULT_DISALLOW = ['/checkout', '/checkout/*', '/cart', '/orders/lookup', '/api/'];

/**
 * Reads the Allow and Disallow rules of the `User-agent: *` group from a store's
 * custom robots text. Other user-agent groups and directives are not applied.
 */
function parseCustomRobots(text: string): { allow: string[]; disallow: string[] } {
  const allow: string[] = [];
  const disallow: string[] = [];
  let inWildcardGroup = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split('#')[0].trim();
    const separator = line.indexOf(':');
    if (!line || separator < 0) continue;

    const key = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();

    if (key === 'user-agent') {
      inWildcardGroup = value === '*';
      continue;
    }
    if (!inWildcardGroup || !value) continue;
    if (key === 'allow') allow.push(value);
    if (key === 'disallow') disallow.push(value);
  }

  return { allow, disallow };
}

/**
 * Builds robots.txt rules for the current store. Uses the store's custom robots text
 * when it is set. An unregistered or deleted store returns 404. A failed store lookup
 * (API down or invalid response) is not caught here, so it fails the request with 500
 * instead of serving generic rules.
 */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const headersList = headers();
  const host = headersList.get('x-storefront-host') || '';
  if (!host) {
    notFound();
  }

  const config = await getStorefrontConfig(host);
  if (!config) {
    notFound();
  }

  const baseURL = `https://${host}`;
  const customRobots = config.seo?.robots_txt_custom?.trim() ?? '';

  if (customRobots.length > 0) {
    const parsed = parseCustomRobots(customRobots);
    return {
      rules: {
        userAgent: '*',
        allow: parsed.allow.length > 0 ? parsed.allow : '/',
        disallow: parsed.disallow,
      },
      sitemap: `${baseURL}/sitemap.xml`,
    };
  }

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: DEFAULT_DISALLOW,
    },
    sitemap: `${baseURL}/sitemap.xml`,
  };
}
