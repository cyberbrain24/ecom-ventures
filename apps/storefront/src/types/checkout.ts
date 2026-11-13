/**
 * Types representing storefront checkout requests and digital receipts.
 */

export interface CheckoutCustomerAddress {
  recipient_name: string;
  phone: string;
  street_address: string;
  apartment_suite?: string;
  city: string;
  state_province?: string;
  postal_code?: string;
  country: string;
}

export interface CheckoutPayload {
  session_id: string;
  customer_email: string;
  customer_phone: string;
  customer_name: string;
  shipping_address: CheckoutCustomerAddress;
  payment_method: string;
  coupon_code?: string;
  notes?: string;
}

export interface OrderReceiptItem {
  variant_id: string;
  product_title: string;
  variant_title: string;
  sku: string;
  unit_price: number;
  quantity: number;
  total_price: number;
}

export interface OrderReceipt {
  id: string;
  order_number: string;
  customer_email: string;
  customer_phone: string;
  status: string;
  payment_status: string;
  payment_method: string;
  currency: string;
  subtotal: number;
  shipping_fee: number;
  discount_amount: number;
  total_amount: number;
  shipping_address: CheckoutCustomerAddress;
  items: OrderReceiptItem[];
  created_at: string;
}
