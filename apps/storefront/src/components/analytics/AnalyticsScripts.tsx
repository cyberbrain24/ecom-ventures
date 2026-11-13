'use client';

import React, { useEffect, useState } from 'react';
import Script from 'next/script';

interface PublicMarketingConfig {
  meta_pixel_id?: string;
  ga4_measurement_id?: string;
  gtm_container_id?: string;
  google_ads_id?: string;
  is_pixel_enabled: boolean;
  is_ga4_enabled: boolean;
  is_gtm_enabled: boolean;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

/**
 * AnalyticsScripts dynamically fetches sanitized public marketing configuration
 * for the current active tenant brand and injects GTM, GA4, and Meta Pixel scripts.
 */
export const AnalyticsScripts: React.FC = () => {
  const [config, setConfig] = useState<PublicMarketingConfig | null>(null);

  useEffect(() => {
    const fetchAnalyticsConfig = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/storefront/marketing/config`);
        if (res.ok) {
          const data = await res.json();
          setConfig(data);
        }
      } catch (err) {
        console.warn('Analytics configuration could not be loaded.', err);
      }
    };
    fetchAnalyticsConfig();
  }, []);

  if (!config) return null;

  return (
    <>
      {/* 1. Google Tag Manager (GTM) */}
      {config.is_gtm_enabled && config.gtm_container_id && (
        <Script
          id="gtm-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
              new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
              j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
              'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
              })(window,document,'script','dataLayer','${config.gtm_container_id}');
            `,
          }}
        />
      )}

      {/* 2. Google Analytics 4 (GA4) */}
      {config.is_ga4_enabled && config.ga4_measurement_id && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${config.ga4_measurement_id}`}
            strategy="afterInteractive"
          />
          <Script
            id="ga4-script"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${config.ga4_measurement_id}', { page_path: window.location.pathname });
              `,
            }}
          />
        </>
      )}

      {/* 3. Meta Pixel (Facebook Pixel) */}
      {config.is_pixel_enabled && config.meta_pixel_id && (
        <Script
          id="meta-pixel-script"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              !function(f,b,e,v,n,t,s)
              {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
              n.callMethod.apply(n,arguments):n.queue.push(arguments)};
              if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
              n.queue=[];t=b.createElement(e);t.async=!0;
              t.src=v;s=b.getElementsByTagName(e)[0];
              s.parentNode.insertBefore(t,s)}(window, document,'script',
              'https://connect.facebook.net/en_US/fbevents.js');
              fbq('init', '${config.meta_pixel_id}');
              fbq('track', 'PageView');
            `,
          }}
        />
      )}
    </>
  );
};
