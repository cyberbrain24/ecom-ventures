import React from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getStorefrontConfig } from '../../lib/api';
import { RefreshCw, CheckCircle2, ShieldCheck, Mail, ArrowLeft } from 'lucide-react';
import { notFound } from 'next/navigation';

export default async function ReturnsPolicyPage() {
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
          <RefreshCw className="h-4 w-4" />
          <span>Returns & Exchanges</span>
        </div>
        <h1 className="text-3xl font-black text-slate-950 font-[var(--brand-font-heading)] tracking-tight">
          Return, Exchange & Refund Policy
        </h1>
        <p className="text-sm text-slate-500">
          How to request a return, exchange or refund for an order from {store.name}.
        </p>
      </div>

      <div className="space-y-8 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm text-sm text-slate-700 leading-relaxed">
        <div className="space-y-3">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <CheckCircle2 className="h-4 w-4 text-[var(--brand-primary)]" />
            <span>Return and Exchange Terms</span>
          </h2>
          <p className="text-xs text-slate-600">
            Return and exchange eligibility is confirmed by {store.name} support after the order is reviewed. Contact support before sending any item back.
          </p>
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-6">
          <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
            <RefreshCw className="h-4 w-4 text-[var(--brand-primary)]" />
            <span>Refund Method and Timeline</span>
          </h2>
          <p className="text-xs text-slate-600">
            The refund method and timeline for each order are confirmed by {store.name} support after the returned item is inspected.
          </p>
        </div>

        <div className="space-y-3 border-t border-slate-100 pt-6 bg-slate-50 p-6 rounded-xl border border-slate-200">
          <h2 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
            <Mail className="h-4 w-4 text-[var(--brand-primary)]" />
            <span>How to Initiate a Return</span>
          </h2>
          <p className="text-xs text-slate-600">
            {store.contact_email ? (
              <>
                Contact support at <strong className="font-mono text-slate-900">{store.contact_email}</strong>
                {store.contact_phone && (
                  <>
                    {' '}or call <strong className="font-mono text-slate-900">{store.contact_phone}</strong>
                  </>
                )}{' '}
                with your order reference number and photographs of the item.
              </>
            ) : (
              <>Use the order lookup page with your order reference to request help with a return.</>
            )}
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
