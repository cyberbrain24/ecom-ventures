import { ShippingZone } from '../types/shipping';
import { StorefrontApiError, fetchStorefrontData } from './api';

/**
 * Loads the delivery districts and fees configured for the current store.
 * A 404 means the store has no delivery configuration, which is reported as a
 * specific error so checkout can block ordering instead of using a guessed fee.
 */
export async function getStorefrontShippingZones(host: string): Promise<ShippingZone[]> {
  let zones: ShippingZone[];
  try {
    zones = await fetchStorefrontData<ShippingZone[]>(host, '/storefront/shipping/zones', { cache: 'no-store' });
  } catch (error) {
    if (error instanceof StorefrontApiError && error.status === 404) {
      throw new StorefrontApiError('Delivery zones are not configured for this store.', 404);
    }
    throw error;
  }

  if (!Array.isArray(zones)) {
    throw new StorefrontApiError('The store API returned an invalid delivery zone list.', 502);
  }
  for (const zone of zones) {
    if (
      !zone ||
      typeof zone.district !== 'string' ||
      typeof zone.shipping_fee !== 'number' ||
      !Array.isArray(zone.thanas)
    ) {
      throw new StorefrontApiError('The store API returned an invalid delivery zone.', 502);
    }
  }
  return zones;
}
