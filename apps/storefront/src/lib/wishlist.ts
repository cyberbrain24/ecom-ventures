export interface WishlistItem {
  id: string;
  title: string;
  slug: string;
  price: number;
  featured_image_url?: string | null;
  category_name?: string | null;
  brand_name?: string | null;
  variant_id?: string;
}

export function getWishlistStorageKey(): string {
  if (typeof window === 'undefined') return 'ecom_wishlist';
  const host = window.location.host.split(':')[0];
  return `ecom_wishlist_${host}`;
}

export function getStoredWishlist(): WishlistItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(getWishlistStorageKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveWishlist(items: WishlistItem[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(getWishlistStorageKey(), JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('ecom_wishlist_updated', { detail: items }));
  } catch {}
}

export function isInWishlist(productIdOrSlug: string): boolean {
  const items = getStoredWishlist();
  return items.some((item) => item.id === productIdOrSlug || item.slug === productIdOrSlug);
}

export function toggleWishlistItem(item: WishlistItem): boolean {
  const items = getStoredWishlist();
  const exists = items.some((it) => it.id === item.id || it.slug === item.slug);
  let updated: WishlistItem[];
  if (exists) {
    updated = items.filter((it) => it.id !== item.id && it.slug !== item.slug);
  } else {
    updated = [item, ...items];
  }
  saveWishlist(updated);
  return !exists;
}

export function removeWishlistItem(id: string): void {
  const items = getStoredWishlist();
  const updated = items.filter((item) => item.id !== id && item.slug !== id);
  saveWishlist(updated);
}

export function clearWishlist(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(getWishlistStorageKey());
    window.dispatchEvent(new CustomEvent('ecom_wishlist_updated', { detail: [] }));
  } catch {}
}
