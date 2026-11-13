import React from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getStorefrontConfig } from '../../lib/api';
import { Truck, Clock, ShieldCheck, MapPin, ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';

export default async function ShippingPolicyPage() {
  const headersList = headers();
  const host = headersList.get('x-storefront-host') || 'localhost';
  const config = await getStorefrontConfig(host);

  if (!config) {
    notFound();
  }

  const { store } = config;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-12">
      <div className="space-y-3">
        <div className="inline-flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[var(--brand-primary)]">
          <Truck className="h-4 w-4" />
          <span>Fulfillment Guidelines</span>
        </div>
        <h1 className="text-3xl font-black text-slate-950 font-[var(--brand-font-heading)] tracking-tight">
          Shipping & Delivery Policy
        </h1>
        <p className="text-sm text-slate-500">
          Everything you need to know about parcel delivery, timelines, and courier partners at {store.name}.
        </p>
      </div>

      <div className="space-y-8 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-sm text-slate-700 leading-relaxed">
        <div className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Clock className="h-4 w-4 text-[var(--brand-primary)]" />
            <span>Delivery Timelines</span>
          </h2>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600">
            <li><strong>Inside Dhaka Metro:</strong> 24 to 48 hours from the time of order confirmation.</li>
            <li><strong>Outside Dhaka / Nationwide:</strong> 48 to 72 hours via express delivery partners.</li>
            <li>Express same-day dispatch is available for urgent orders placed before 12:00 PM on business days.</li>
          </ul>
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-6">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <Truck className="h-4 w-4 text-[var(--brand-primary)]" />
            <span>Authorized Courier Partners</span>
          </h2>
          <p className="text-xs text-slate-600">
            {store.name} integrates with Bangladesh's premier logistics automation networks including <strong>Steadfast Courier</strong>, <strong>Pathao Courier</strong>, and <strong>RedX Logistics</strong>. Every parcel receives an automated digital tracking reference upon dispatch.
          </p>
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-6">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <MapPin className="h-4 w-4 text-[var(--brand-primary)]" />
            <span>Shipping Charges & Free Delivery</span>
          </h2>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600">
            <li>Standard delivery fee Inside Dhaka: ৳ 70</li>
            <li>Standard delivery fee Outside Dhaka: ৳ 130</li>
            <li><strong>Free Delivery:</strong> All orders over ৳ 3,000 qualify for 100% complimentary shipping.</li>
          </ul>
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-6">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <ShieldCheck className="h-4 w-4 text-[var(--brand-primary)]" />
            <span>Cash on Delivery (COD) Inquiries</span>
          </h2>
          <p className="text-xs text-slate-600">
            Cash on Delivery is available across all 64 districts in Bangladesh. Customers are requested to inspect the exterior condition of the parcel upon receiving before releasing payment to the delivery rider.
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
