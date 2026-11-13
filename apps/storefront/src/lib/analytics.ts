/**
 * Universal client-side telemetry dispatcher broadcasting ecommerce events
 * to Meta Pixel, Google Analytics (gtag), and Google Tag Manager (dataLayer).
 */

declare global {
  interface Window {
    fbq?: (...args: any[]) => void;
    gtag?: (...args: any[]) => void;
    dataLayer?: any[];
  }
}

export interface AnalyticsEventParams {
  content_name?: string;
  content_category?: string;
  content_ids?: string[];
  content_type?: string;
  value?: number;
  currency?: string;
  num_items?: number;
  order_id?: string;
}

/**
 * Dispatch an ecommerce event across all configured tracking libraries.
 * @param eventName Standard event: "ViewContent", "AddToCart", "InitiateCheckout", "Purchase"
 * @param params Event parameters including price, items, and currency
 * @param eventId Optional deduplication identifier matching server-side CAPI
 */
export function trackStorefrontEvent(
  eventName: 'ViewContent' | 'AddToCart' | 'InitiateCheckout' | 'Purchase',
  params: AnalyticsEventParams = {},
  eventId?: string
) {
  if (typeof window === 'undefined') return;

  // 1. Meta Pixel
  if (typeof window.fbq === 'function') {
    if (eventId) {
      window.fbq('track', eventName, params, { eventID: eventId });
    } else {
      window.fbq('track', eventName, params);
    }
  }

  // 2. Google Analytics (gtag)
  if (typeof window.gtag === 'function') {
    const gaEventMap: Record<string, string> = {
      ViewContent: 'view_item',
      AddToCart: 'add_to_cart',
      InitiateCheckout: 'begin_checkout',
      Purchase: 'purchase',
    };
    const gaEvent = gaEventMap[eventName] || eventName;
    window.gtag('event', gaEvent, {
      transaction_id: params.order_id,
      value: params.value,
      currency: params.currency,
      items: params.content_ids?.map((id) => ({ item_id: id })),
    });
  }

  // 3. Google Tag Manager (dataLayer)
  if (Array.isArray(window.dataLayer)) {
    window.dataLayer.push({
      event: eventName,
      ecommerce: params,
      eventId: eventId,
    });
  }
}
