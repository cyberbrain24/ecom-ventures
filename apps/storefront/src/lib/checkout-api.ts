import { CheckoutPayload, OrderReceipt } from '../types/checkout';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

export async function submitCheckout(payload: CheckoutPayload, host?: string): Promise<OrderReceipt> {
  const currentHost = host || (typeof window !== 'undefined' ? window.location.host : '');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Cart-Session': payload.session_id,
  };
  if (currentHost) {
    headers['Host'] = currentHost;
    headers['X-Forwarded-Host'] = currentHost;
  }

  const res = await fetch(`${API_BASE_URL}/storefront/checkout`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.detail || 'Failed to place order. Please check item availability.');
  }

  const data = await res.json();
  return (data?.data !== undefined ? data.data : data) as OrderReceipt;
}

export async function fetchOrderReceipt(host: string, orderNumber: string, verify: string): Promise<OrderReceipt | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/storefront/orders/${orderNumber}?verify=${encodeURIComponent(verify)}`, {
      headers: {
        'Host': host,
        'X-Forwarded-Host': host,
      },
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return (data?.data !== undefined ? data.data : data) as OrderReceipt;
  } catch (err) {
    console.error('Failed to lookup order receipt', err);
    return null;
  }
}
