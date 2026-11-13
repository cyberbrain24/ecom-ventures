import React, { Suspense } from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getStorefrontConfig } from '../lib/api';
import { getStorefrontCategories } from '../lib/catalog-api';
import { ThemeInjector } from '../components/layout/ThemeInjector';
import { StorefrontNavbar } from '../components/layout/StorefrontNavbar';
import { StorefrontFooter } from '../components/layout/StorefrontFooter';
import { CartProvider } from '../context/CartContext';
import { CartDrawer } from '../components/cart/CartDrawer';
import { AnalyticsScripts } from '../components/analytics/AnalyticsScripts';
import { NavigationRouteWatcher } from '../components/navigation/NavigationRouteWatcher';
import { MobileCategoryDrawer } from '../components/navigation/MobileCategoryDrawer';
import { MobileStickyNav } from '../components/navigation/MobileStickyNav';
import { AIFitCheckModal } from '../components/navigation/AIFitCheckModal';
import './globals.css';

/**
 * Generate 100% SEO-optimized dynamic metadata, favicon links, title templates,
 * OpenGraph, Twitter Cards, and search console verification tags.
 */
export async function generateMetadata(): Promise<Metadata> {
  const headersList = headers();
  const host = headersList.get('x-storefront-host') || 'localhost';
  const [config, categories] = await Promise.all([
    getStorefrontConfig(host),
    getStorefrontCategories(host),
  ]);

  if (!config) {
    return {
      title: 'Store Not Found | Ecom Ventures',
      description: 'The requested retail store could not be resolved.',
    };
  }

  const storeName = config.store.name;
  const rawTemplate = config.seo?.meta_title_template || '%s | ' + storeName;
  const titleTemplate = rawTemplate.replace('{store_name}', storeName);
  const defaultTitle = config.seo?.default_meta_title || `${storeName} | Official Online Store`;
  const defaultDesc =
    config.seo?.default_meta_description ||
    `Shop authentic, premium merchandise with doorstep delivery and verified quality at ${storeName}.`;
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
  const host = headersList.get('x-storefront-host') || 'localhost';
  const [config, categories] = await Promise.all([
    getStorefrontConfig(host),
    getStorefrontCategories(host),
  ]);

  // If brand cannot be resolved or is suspended, render fallback boundary
  if (!config) {
    return (
      <html lang="en">
        <body className="min-h-screen flex items-center justify-center bg-slate-50 text-slate-800 font-sans p-6">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center mx-auto text-xl font-bold font-mono">
              !
            </div>
            <h1 className="text-xl font-bold text-slate-900">Store Unavailable</h1>
            <p className="text-sm text-slate-600">
              The storefront domain <span className="font-mono font-semibold">{host}</span> is not mapped to an active retail brand in Ecom Ventures.
            </p>
          </div>
        </body>
      </html>
    );
  }

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
    <html lang="en" className="h-full">
      <head>
        <ThemeInjector themeConfig={config.theme.config} />
        {/* Dynamic Favicon & Touch Icon link tags for universal browser support */}
        <link rel="icon" href={faviconUrl} sizes="any" />
        {appleTouchUrl && <link rel="apple-touch-icon" href={appleTouchUrl} />}
        {/* Site-wide Schema.org Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgWebsiteSchema) }}
        />
      </head>
      <body className="min-h-screen flex flex-col bg-white text-slate-900 font-[var(--brand-font-body)] antialiased">
        {/* Brand Telemetry (GTM, GA4, Meta Pixel) */}
        <AnalyticsScripts />
        <CartProvider>
          <Suspense fallback={null}>
            <NavigationRouteWatcher />
          </Suspense>
          <StorefrontNavbar brand={config.store} themeConfig={config.theme.config} />
          <main className="flex-grow pb-[60px] md:pb-0">{children}</main>
          <StorefrontFooter brand={config.store} />
          <CartDrawer />
          <MobileCategoryDrawer categories={categories} />
          <AIFitCheckModal />
          <MobileStickyNav />
        </CartProvider>
      </body>
    </html>
  );
}
