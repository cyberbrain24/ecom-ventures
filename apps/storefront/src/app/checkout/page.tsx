import React from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getStorefrontConfig } from '../../lib/api';
import { CheckoutForm } from '../../components/checkout/CheckoutForm';
import { notFound } from 'next/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const headersList = headers();
  const host = headersList.get('x-storefront-host') || 'localhost';
  const config = await getStorefrontConfig(host);

  return {
    title: `Checkout | ${config?.store.name || 'Store'}`,
    description: 'Safe and encrypted multi-tenant checkout.',
  };
}

export default async function CheckoutPage() {
  const headersList = headers();
  const host = headersList.get('x-storefront-host') || 'localhost';
  const config = await getStorefrontConfig(host);

  if (!config) {
    notFound();
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
      <div className="max-w-3xl mb-8">
        <h1 className="text-3xl font-extrabold text-slate-950 tracking-tight font-[var(--brand-font-heading)]">
          Secure Checkout
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Review your items, provide delivery details, and confirm your order for {config.store.name}.
        </p>
      </div>

      <CheckoutForm />
    </div>
  );
}
