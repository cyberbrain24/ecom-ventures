import { CheckoutPayload, OrderReceipt, StorePaymentGateway } from '../types/checkout';
import { fetchStorefrontData, StorefrontApiError } from './api';

export async function getStorefrontPaymentGateways(host?: string): Promise<StorePaymentGateway[]> {
  const currentHost = host || (typeof window !== 'undefined' ? window.location.host : '');
  if (!currentHost) return [];
  try {
    const list = await fetchStorefrontData<StorePaymentGateway[]>(currentHost, '/storefront/payments/methods', {
      cache: 'no-store',
    });
    return Array.isArray(list) ? list : [];
  } catch (error) {
    console.warn('Failed to fetch payment methods from API, falling back to default', error);
    return [
      {
        id: 'COD',
        name: 'Cash on Delivery (COD)',
        description: 'Pay cash when the parcel is delivered to you.',
        is_default: true,
        is_active: true,
      },
    ];
  }
}

export async function submitCheckout(payload: CheckoutPayload, host?: string): Promise<OrderReceipt> {
  const currentHost = host || (typeof window !== 'undefined' ? window.location.host : '');
  if (!currentHost) {
    throw new Error('A store host is required to place an order.');
  }

  return fetchStorefrontData<OrderReceipt>(currentHost, '/storefront/checkout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Cart-Session': payload.session_id,
    },
    body: JSON.stringify(payload),
  });
}

export async function fetchOrderReceipt(host: string, orderNumber: string, verify: string): Promise<OrderReceipt | null> {
  try {
    return await fetchStorefrontData<OrderReceipt>(
      host,
      `/storefront/orders/${encodeURIComponent(orderNumber)}?verify=${encodeURIComponent(verify)}`,
      { cache: 'no-store' }
    );
  } catch (error) {
    if (error instanceof StorefrontApiError && error.status === 404) return null;
    throw error;
  }
}
