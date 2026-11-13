import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js Edge Middleware for multi-tenant domain resolution.
 * Captures the incoming Host header from the request or reverse proxy (Nginx)
 * and forwards it downstream in custom request headers for React Server Components.
 */
export function middleware(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);

  // Extract brand override query param if testing locally (?brand=mior or ?brand=artisan)
  const url = request.nextUrl;
  const brandParam = url.searchParams.get('brand') || url.searchParams.get('store');

  // Extract host from standard Host or proxy headers
  const forwardedHost = request.headers.get('x-forwarded-host');
  const host = forwardedHost || request.headers.get('host') || 'mior.localhost';

  // Normalize host: strip port if running locally
  let cleanHost = host.split(':')[0];

  // If accessed via plain localhost / 127.0.0.1, default to pilot brand or specified ?brand= query
  if (cleanHost === 'localhost' || cleanHost === '127.0.0.1') {
    if (brandParam) {
      cleanHost = `${brandParam.toLowerCase()}.localhost`;
    } else {
      cleanHost = 'mior.localhost';
    }
  }

  // Set downstream internal header
  requestHeaders.set('x-storefront-host', cleanHost);
  requestHeaders.set('x-storefront-raw-host', host);

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
     * 3. /_static (inside /public)
     * 4. Static files (e.g. /favicon.ico, sitemap.xml, robots.txt, images)
     */
    '/((?!api|_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
};
