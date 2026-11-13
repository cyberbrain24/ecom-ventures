import React from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getStorefrontConfig } from '../../lib/api';
import { RefreshCw, CheckCircle2, ShieldCheck, Mail, ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';

export default async function ReturnsPolicyPage() {
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
          <RefreshCw className="h-4 w-4" />
          <span>Customer Protection Guarantee</span>
        </div>
        <h1 className="text-3xl font-black text-slate-950 font-[var(--brand-font-heading)] tracking-tight">
          Return, Exchange & Refund Policy
        </h1>
        <p className="text-sm text-slate-500">
          Straightforward replacement terms ensuring risk-free shopping at {store.name}.
        </p>
      </div>

      <div className="space-y-8 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-sm text-slate-700 leading-relaxed">
        <div className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 text-[var(--brand-primary)]" />
            <span>7-Day Replacement Window</span>
          </h2>
          <p className="text-xs text-slate-600">
            You may request an exchange or return for any merchandise within <strong>7 calendar days</strong> of receiving your parcel. The item must be unused, unwashed, in its original packaging with all brand tags intact.
          </p>
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-6">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <ShieldCheck className="h-4 w-4 text-[var(--brand-primary)]" />
            <span>Eligible Grounds for Return</span>
          </h2>
          <ul className="list-disc pl-5 space-y-1.5 text-xs text-slate-600">
            <li>Item delivered in physically damaged or defective condition.</li>
            <li>Received incorrect variant (wrong size, color, or model).</li>
            <li>Incomplete order missing components or accessories.</li>
          </ul>
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-6">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 text-[var(--brand-primary)]" />
            <span>Refund Processing Timelines</span>
          </h2>
          <p className="text-xs text-slate-600">
            Approved refunds for digital payments (bKash, Nagad, Credit/Debit cards) will be remitted to the original payment channel within 3 to 7 working days following receipt and inspection at our fulfillment facility. Cash on Delivery refunds will be settled via bKash or Nagad transfer.
          </p>
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-6 bg-slate-50 p-6 rounded-xl border border-slate-200">
          <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <Mail className="h-4 w-4 text-[var(--brand-primary)]" />
            <span>How to Initiate a Return</span>
          </h2>
          <p className="text-xs text-slate-600">
            Contact our concierge team at <strong className="font-mono text-slate-900">{store.contact_email}</strong> or call our support line at <strong className="font-mono text-slate-900">{store.contact_phone || '+880 1711 000000'}</strong> with your order reference number and photographic evidence of the item.
          </p>
        </div>
      </div>

      <div className="flex justify-between items-center text-xs">
        <Link
          href="/catalog"
          className="inline-flex items-center text-[var(--brand-primary)] hover:underline font-semibold space-x-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Continue Shopping</span>
        </Link>
        <Link
          href="/orders/lookup"
          className="inline-flex items-center text-slate-600 hover:text-slate-900 font-semibold"
        >
          Track Order Status →
        </Link>
      </div>
    </div>
  );
}
