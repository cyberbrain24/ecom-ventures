import React from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getStorefrontConfig } from '../../lib/api';
import { getStorefrontShippingZones } from '../../lib/shipping-api';
import { getStorefrontPaymentGateways } from '../../lib/checkout-api';
import { CheckoutForm } from '../../components/checkout/CheckoutForm';
import { notFound } from 'next/navigation';
import type { ShippingZone } from '../../types/shipping';
import type { StorePaymentGateway } from '../../types/checkout';

export async function generateMetadata(): Promise<Metadata> {
  const headersList = headers();
  const host = headersList.get('x-storefront-host') || '';
  const config = host ? await getStorefrontConfig(host) : null;

  return {
    title: config ? `Checkout | ${config.store.name}` : 'Checkout',
    description: `Checkout for ${config?.store.name ?? 'this store'}.`,
  };
}

/** Checkout page. Delivery zones come from the store API; a failed load is shown and blocks ordering. */
export default async function CheckoutPage() {
  const headersList = headers();
  const host = headersList.get('x-storefront-host') || '';
  const config = host ? await getStorefrontConfig(host) : null;

  if (!config) {
    notFound();
  }

  let zones: ShippingZone[] = [];
  let zonesError: string | null = null;
  try {
    zones = await getStorefrontShippingZones(host);
  } catch (error) {
    zonesError = error instanceof Error ? error.message : 'Delivery zones could not be loaded.';
  }

  let gateways: StorePaymentGateway[] = [];
  try {
    gateways = await getStorefrontPaymentGateways(host);
  } catch {
    gateways = [];
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      <div className="max-w-3xl mb-8">
        <h1 className="text-3xl font-extrabold text-slate-950 tracking-tight font-[var(--brand-font-heading)]">
          Checkout
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Review your items, provide delivery details, and confirm your order for {config.store.name}.
        </p>
      </div>

      <CheckoutForm zones={zones} zonesError={zonesError} gateways={gateways} />
    </div>
  );
}
