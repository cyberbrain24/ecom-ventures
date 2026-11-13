/**
 * Types representing Multi-Item Bundle Tiers ("Buy More & Save") on the storefront.
 */

export interface StorefrontBundleTier {
  id: string;
  name: string; // 'Duo', 'Trio', '4 Pack', '5 Pack'
  required_items_count: number;
  discount_percentage: number;
  badge_text?: string;
  subtitle?: string;
  perks: string[];
  has_free_delivery: boolean;
  display_order: number;
  is_active: boolean;
}

export interface BundleProductSelection {
  productId: string;
  productTitle: string;
  productSlug: string;
  imageUrl: string;
  variantId: string;
  variantTitle: string;
  sku: string;
  originalPrice: number;
  discountedPrice: number;
  savings: number;
  color?: string;
  size?: string;
}

export interface BundleSlotState {
  slotNumber: number;
  isAnchor: boolean;
  selection: BundleProductSelection | null;
}

