/**
 * Builds a browser URL for a store's primary domain. Local development hosts
 * (localhost, *.localhost, 127.0.0.1) use http and append the Next.js storefront port
 * (defaults to 3002 if unspecified); every other host uses https.
 */

const LOCAL_HOSTNAMES = ['localhost', '127.0.0.1'];

/**
 * Returns an absolute storefront URL for a domain value, or null when no domain is set.
 *
 * @param domain - Domain as stored on the store record, for example "shop.example.com"
 * @returns Absolute URL with https (or http for local development hosts), or null
 */
export function storefrontUrl(domain: string | null | undefined): string | null {
  const trimmed = (domain ?? '').trim().replace(/^https?:\/\//i, '').replace(/\/+$/, '');
  if (!trimmed) {
    return null;
  }
  const parts = trimmed.split(':');
  const hostname = parts[0].toLowerCase();
  const hasPort = parts.length > 1 && Boolean(parts[1]);
  const isLocal = LOCAL_HOSTNAMES.includes(hostname) || hostname.endsWith('.localhost');

  if (isLocal) {
    if (!hasPort) {
      const devPort = ((import.meta as any).env?.VITE_STOREFRONT_DEV_PORT as string | undefined) || '5200';
      return `http://${trimmed}:${devPort}`;
    }
    return `http://${trimmed}`;
  }

  return `https://${trimmed}`;
}
