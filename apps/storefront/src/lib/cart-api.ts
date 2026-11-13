import { Cart } from '../types/cart';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

/**
 * Fetch the active cart for the given session.
 */
export async function getCart(sessionId: string, host?: string): Promise<Cart | null> {
  const headers: Record<string, string> = {
    'X-Cart-Session': sessionId,
  };
  if (host) {
    headers['Host'] = host;
    headers['X-Forwarded-Host'] = host;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/storefront/cart`, {
      headers,
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const payload = await res.json();
    return (payload?.data !== undefined ? payload.data : payload) as Cart;
  } catch (err) {
    console.error('[Cart API] Failed to fetch cart:', err);
    return null;
  }
}

/**
 * Add a variant item to the cart session.
 */
export async function addCartItem(
  sessionId: string,
  variantId: string,
  quantity: number,
  host?: string
): Promise<Cart> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Cart-Session': sessionId,
  };
  if (host) {
    headers['Host'] = host;
    headers['X-Forwarded-Host'] = host;
  }

  const res = await fetch(`${API_BASE_URL}/storefront/cart/items`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ variant_id: variantId, quantity }),
  });

  if (!res.ok) {
    const errPayload = await res.json().catch(() => ({}));
    throw new Error(errPayload?.detail || errPayload?.message || 'Failed to add item to cart');
  }

  const payload = await res.json();
  return (payload?.data !== undefined ? payload.data : payload) as Cart;
}

/**
 * Adjust the quantity of an existing line item in the cart.
 */
export async function updateCartItemQuantity(
  sessionId: string,
  itemId: string,
  quantity: number,
  host?: string
): Promise<Cart> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Cart-Session': sessionId,
  };
  if (host) {
    headers['Host'] = host;
    headers['X-Forwarded-Host'] = host;
  }

  const res = await fetch(`${API_BASE_URL}/storefront/cart/items/${itemId}`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({ quantity }),
  });

  if (!res.ok) {
    const errPayload = await res.json().catch(() => ({}));
    throw new Error(errPayload?.detail || errPayload?.message || 'Failed to update item quantity');
  }

  const payload = await res.json();
  return (payload?.data !== undefined ? payload.data : payload) as Cart;
}

/**
 * Remove an item from the cart session.
 */
export async function removeCartItem(
  sessionId: string,
  itemId: string,
  host?: string
): Promise<Cart> {
  const headers: Record<string, string> = {
    'X-Cart-Session': sessionId,
  };
  if (host) {
    headers['Host'] = host;
    headers['X-Forwarded-Host'] = host;
  }

  const res = await fetch(`${API_BASE_URL}/storefront/cart/items/${itemId}`, {
    method: 'DELETE',
    headers,
  });

  if (!res.ok) {
    const errPayload = await res.json().catch(() => ({}));
    throw new Error(errPayload?.detail || errPayload?.message || 'Failed to remove item');
  }

  const payload = await res.json();
  return (payload?.data !== undefined ? payload.data : payload) as Cart;
}
