import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getStorefrontConfig } from '../lib/api';
import { getStorefrontCategories } from '../lib/catalog-api';
import type { StorefrontConfigResponse } from '../types/storefront';
import { ThemeInjector } from '../components/layout/ThemeInjector';
import { resolveTheme } from '../lib/theme';
import { StorefrontNavbar } from '../components/layout/StorefrontNavbar';
import { StorefrontFooter } from '../components/layout/StorefrontFooter';
import { CartProvider } from '../context/CartContext';
import { MusicProvider } from '../context/MusicContext';
import { FloatingPlayer } from '../components/music/FloatingPlayer';
import { CartDrawer } from '../components/cart/CartDrawer';
import { AnalyticsScripts } from '../components/analytics/AnalyticsScripts';
import { NavigationRouteWatcher } from '../components/navigation/NavigationRouteWatcher';
import { MobileCategoryDrawer } from '../components/navigation/MobileCategoryDrawer';
import { MobileStickyNav } from '../components/navigation/MobileStickyNav';
import './globals.css';

/** Result of resolving the request host: either the live store config or the reason it is unavailable. */
type StoreResolution =
  | { config: StorefrontConfigResponse; unavailableReason: null }
  | { config: null; unavailableReason: string };

/**
 * Resolves the store for the request host. Unknown hosts and API failures both return
 * a visible reason; nothing is substituted with another store's data.
 */
async function resolveStore(host: string): Promise<StoreResolution> {
  if (!host) {
    return { config: null, unavailableReason: 'The request did not include a store host name.' };
  }
  try {
    const config = await getStorefrontConfig(host);
    if (!config) {
      return { config: null, unavailableReason: 'No active store is registered for this domain.' };
    }
    return { config, unavailableReason: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { config: null, unavailableReason: `The store configuration could not be loaded: ${message}` };
  }
}

/**
 * Generate SEO metadata, favicon links, title templates, OpenGraph and Twitter
 * tags from the store's own configuration.
 */
export async function generateMetadata(): Promise<Metadata> {
  const headersList = headers();
  const host = headersList.get('x-storefront-host') || '';
  const { config } = await resolveStore(host);

  if (!config) {
    return {
      title: 'Store Unavailable',
      description: 'This store is not available.',
    };
  }

  const storeName = config.store.name;
  const rawTemplate = config.seo?.meta_title_template || '%s | ' + storeName;
  const titleTemplate = rawTemplate.replace('{store_name}', storeName);
  const defaultTitle = config.seo?.default_meta_title || storeName;
  const defaultDesc = config.seo?.default_meta_description || `Shop online at ${storeName}.`;
  const keywords = config.seo?.default_keywords
    ? config.seo.default_keywords.split(',').map((k) => k.trim())
    : [storeName, 'ecommerce', 'online store', 'shopping'];

  const faviconUrl = config.seo?.favicon_url || config.store.logo_url || '/favicon.ico';
  const appleTouchUrl = config.seo?.apple_touch_icon_url || config.seo?.favicon_url || config.store.logo_url;
  const ogImageUrl = config.seo?.default_og_image_url || config.store.logo_url;

  return {
    metadataBase: new URL(`https://${host}`),
    title: {
      template: titleTemplate,
      default: defaultTitle,
    },
    description: defaultDesc,
    keywords,
    icons: {
      icon: [{ url: faviconUrl }],
      apple: appleTouchUrl ? [{ url: appleTouchUrl }] : undefined,
      shortcut: [{ url: faviconUrl }],
    },
    verification: {
      google: config.seo?.google_site_verification || undefined,
      other: {
        ...(config.seo?.bing_site_verification ? { 'msvalidate.01': config.seo.bing_site_verification } : {}),
        ...(config.seo?.pinterest_verification ? { 'p:domain_verify': config.seo.pinterest_verification } : {}),
      },
    },
    openGraph: {
      type: 'website',
      siteName: storeName,
      title: defaultTitle,
      description: defaultDesc,
      url: `https://${host}`,
      images: ogImageUrl ? [{ url: ogImageUrl }] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: defaultTitle,
      description: defaultDesc,
      creator: config.seo?.twitter_handle || undefined,
      images: ogImageUrl ? [ogImageUrl] : [],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = headers();
  const host = headersList.get('x-storefront-host') || '';
  const { config, unavailableReason } = await resolveStore(host);

  // An unknown host or a failed configuration load renders an honest unavailable page with the reason.
  if (!config) {
    return (
      <html lang="en">
        <body className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-800 font-sans p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto text-xl font-bold font-mono">
              !
            </div>
            <h1 className="text-xl font-bold text-slate-900">Store Unavailable</h1>
            <p className="text-sm text-slate-600">{unavailableReason}</p>
            {host && (
              <p className="text-xs text-slate-500">
                Domain: <span className="font-mono font-semibold">{host}</span>
              </p>
            )}
            {process.env.NODE_ENV !== 'production' && (
              <div className="pt-4 border-t border-slate-100 text-left">
                <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Available Local Brand Stores:</p>
                <div className="space-y-1.5 font-mono text-xs">
                  <a href="http://poshplex.localhost:5200" className="block text-teal-600 hover:underline">→ poshplex.localhost:5200 (POSHPLEX)</a>
                  <a href="http://poshgadget.localhost:5200" className="block text-teal-600 hover:underline">→ poshgadget.localhost:5200 (POSH GADGET)</a>
                  <a href="http://innerposh.localhost:5200" className="block text-teal-600 hover:underline">→ innerposh.localhost:5200 (INNERPOSH)</a>
                  <a href="http://posh-girl.localhost:5200" className="block text-teal-600 hover:underline">→ posh-girl.localhost:5200 (POSH GIRL)</a>
                  <a href="http://mior.localhost:5200" className="block text-teal-600 hover:underline">→ mior.localhost:5200 (MIOR)</a>
                </div>
              </div>
            )}
          </div>
        </body>
      </html>
    );
  }

  const categories = await getStorefrontCategories(host);
  const resolvedTheme = resolveTheme(config.theme.config);
  const showThemeNotice = resolvedTheme.source === 'fallback' && process.env.NODE_ENV !== 'production';

  const faviconUrl = config.seo?.favicon_url || config.store.logo_url || '/favicon.ico';
  const appleTouchUrl = config.seo?.apple_touch_icon_url || config.seo?.favicon_url || config.store.logo_url;

  // Schema.org WebSite & Organization structured data
  const orgWebsiteSchema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `https://${host}/#organization`,
        name: config.store.name,
        url: `https://${host}`,
        logo: {
          '@type': 'ImageObject',
          url: config.store.logo_url || faviconUrl,
        },
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: config.store.contact_phone || '',
          contactType: 'customer service',
          email: config.store.contact_email,
        },
      },
      {
        '@type': 'WebSite',
        '@id': `https://${host}/#website`,
        url: `https://${host}`,
        name: config.store.name,
        description: config.seo?.default_meta_description || config.store.description,
        publisher: { '@id': `https://${host}/#organization` },
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `https://${host}/catalog?search={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  };

  return (
    <html lang="en" className="h-full" data-theme={resolvedTheme.config.variant}>
      <head>
        <ThemeInjector theme={resolvedTheme.config} invalidFields={resolvedTheme.invalidFields} />
        {/* Dynamic Favicon & Touch Icon link tags for universal browser support */}
        <link rel="icon" href={faviconUrl} sizes="any" />
        {appleTouchUrl && <link rel="apple-touch-icon" href={appleTouchUrl} />}
        {/* Site-wide Schema.org Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgWebsiteSchema) }}
        />
      </head>
      <body className="sf-body min-h-screen flex flex-col font-[var(--brand-font-body)] antialiased">
        {/* Brand Telemetry (GTM, GA4, Meta Pixel) */}
        <AnalyticsScripts />
        {showThemeNotice && (
          <div role="status" className="sf-dev-notice text-xs px-4 py-2 text-center">
            Development notice: this store has no theme configuration ({resolvedTheme.fallbackReason}). The neutral
            Fashion design is shown.
          </div>
        )}
        <CartProvider>
          <MusicProvider>
            <Suspense fallback={null}>
              <NavigationRouteWatcher />
            </Suspense>
            <StorefrontNavbar brand={config.store} themeConfig={resolvedTheme.config} categories={categories} />
            <main className="flex-grow pb-[60px] md:pb-0">{children}</main>
            <StorefrontFooter brand={config.store} />
            <CartDrawer />
            <MobileCategoryDrawer categories={categories} />
            <MobileStickyNav />
            <FloatingPlayer />
          </MusicProvider>
        </CartProvider>
      </body>
    </html>
  );
}
