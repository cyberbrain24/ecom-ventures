import React from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getStorefrontConfig } from '../../lib/api';
import { Truck, Clock, ShieldCheck, MapPin, ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';

export default async function ShippingPolicyPage() {
  const headersList = headers();
  const host = headersList.get('x-storefront-host') || '';
  const config = host ? await getStorefrontConfig(host) : null;

  if (!config) {
    notFound();
  }

  const { store } = config;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-12">
      <div className="space-y-3">
        <div className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[var(--brand-primary)]">
          <Truck className="h-4 w-4" />
          <span>Delivery Information</span>
        </div>
        <h1 className="text-3xl font-black text-slate-950 font-[var(--brand-font-heading)] tracking-tight">
          Shipping & Delivery Policy
        </h1>
        <p className="text-sm text-slate-500">
          How delivery works for orders placed with {store.name}.
        </p>
      </div>

      <div className="space-y-8 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-sm text-slate-700 leading-relaxed">
        <div className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Clock className="h-4 w-4 text-[var(--brand-primary)]" />
            <span>Delivery Timelines</span>
          </h2>
          <p className="text-xs text-slate-600">
            Delivery times depend on your district. {store.name} support can confirm the expected delivery time for a specific order.
          </p>
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-6">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <MapPin className="h-4 w-4 text-[var(--brand-primary)]" />
            <span>Delivery Charges</span>
          </h2>
          <p className="text-xs text-slate-600">
            The delivery charge for your district is shown at checkout before you place the order, and it is included in the order total you confirm.
          </p>
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-6">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <ShieldCheck className="h-4 w-4 text-[var(--brand-primary)]" />
            <span>Payment on Delivery</span>
          </h2>
          <p className="text-xs text-slate-600">
            The payment methods available for your order are listed at checkout. Inspect the parcel before you accept it and release payment.
          </p>
        </div>
      </div>

      <div className="flex justify-between items-center text-xs">
        <Link
          href="/catalog"
          className="inline-flex items-center text-[var(--brand-primary)] hover:underline font-semibold space-x-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Return to Catalog</span>
        </Link>
        <Link
          href="/orders/lookup"
          className="inline-flex items-center text-slate-600 hover:text-slate-900 font-semibold"
        >
          Track An Existing Order →
        </Link>
      </div>
    </div>
  );
}
