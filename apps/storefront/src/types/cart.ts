/**
 * Types representing shopping cart data structures on the storefront.
 */

export interface CartItem {
  id: string;
  variant_id: string;
  product_id: string;
  product_title: string;
  variant_title: string;
  sku: string;
  image_url: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  available_quantity: number;
}

export interface Cart {
  id: string;
  session_id: string;
  currency: string;
  items: CartItem[];
  item_count: number;
  subtotal: number;
  updated_at: string;
}
