/**
 * Shipping types define the delivery districts and fees a store configures.
 * The storefront never hard-codes these values; they come from the store's API.
 */

/** A delivery district with its fee and the areas (thanas) inside it. */
export interface ShippingZone {
  district: string;
  zone: string;
  shipping_fee: number;
  thanas: string[];
}
