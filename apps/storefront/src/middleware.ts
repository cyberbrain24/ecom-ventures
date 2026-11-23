import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js Edge Middleware for multi-tenant domain resolution.
 * Takes the store host from the request (X-Forwarded-Host, then Host) and forwards it
 * to React Server Components in an internal header. There is no query-string or
 * default-tenant override: a request without a host resolves to an empty host, and the
 * layout renders the "Store Unavailable" page with that reason.
 */
export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);

  const rawHost = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';

  // Strip any port so the host matches the store domain registered in the platform database.
  const cleanHost = rawHost.split(':')[0].trim().toLowerCase();

  requestHeaders.set('x-storefront-host', cleanHost);
  requestHeaders.set('x-storefront-raw-host', rawHost);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * 1. /api routes
     * 2. /_next (Next.js internals)
     * 3. Static files (e.g. /favicon.ico, images)
     * robots.txt and sitemap.xml are NOT excluded: their store-aware routes need the host header.
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
