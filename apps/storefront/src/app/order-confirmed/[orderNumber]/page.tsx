import React from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getStorefrontConfig } from '../../../lib/api';
import { fetchOrderReceipt } from '../../../lib/checkout-api';
import { CheckCircle2, ArrowRight, Home } from 'lucide-react';

interface OrderConfirmationProps {
  params: { orderNumber: string };
  searchParams: { verify?: string };
}

export default async function OrderConfirmedPage({ params, searchParams }: OrderConfirmationProps) {
  const headersList = headers();
  const host = headersList.get('x-storefront-host') || 'localhost';

  const [config, receipt] = await Promise.all([
    getStorefrontConfig(host),
    fetchOrderReceipt(host, params.orderNumber, searchParams.verify || ''),
  ]);

  if (!config) notFound();

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-8">
      {/* Confirmation Hero Card */}
      <div className="text-center space-y-3 bg-emerald-50/60 border border-emerald-200/60 p-8 rounded-3xl">
        <div className="h-16 w-16 bg-emerald-600 text-white rounded-full flex items-center justify-center mx-auto shadow-md">
          <CheckCircle2 className="h-9 w-9" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-950 font-[var(--brand-font-heading)] tracking-tight">
          Thank you for your order!
        </h1>
        <p className="text-xs text-slate-600 max-w-md mx-auto">
          We have received your order and initiated processing. A confirmation SMS/Email has been dispatched to your contact details.
        </p>
        <div className="pt-2">
          <span className="inline-block px-4 py-1.5 bg-white border border-emerald-300 rounded-full text-xs font-mono font-bold text-emerald-800 shadow-sm">
            Order Reference: {params.orderNumber}
          </span>
        </div>
      </div>

      {/* Order Snapshot & Receipt Details */}
      {receipt && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
          <div className="flex items-center justify-between border-b pb-4">
            <div>
              <p className="text-xs text-slate-400 font-medium">Placed Date</p>
              <p className="text-xs font-bold text-slate-800 mt-0.5">
                {new Date(receipt.created_at).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Payment Option</p>
              <p className="text-xs font-bold text-slate-800 mt-0.5">{receipt.payment_method}</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 font-medium">Order Status</p>
              <span className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 mt-0.5">
                {receipt.status}
              </span>
            </div>
          </div>

          {/* Purchased Items */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Purchased Items
            </h3>
            <div className="divide-y divide-slate-100">
              {receipt.items.map((it) => (
                <div key={it.sku} className="py-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-slate-900">{it.product_title}</span>
                    <span className="text-slate-400 block text-[11px]">{it.variant_title} (Qty: {it.quantity})</span>
                  </div>
                  <span className="font-mono font-bold text-slate-900">
                    {receipt.currency} {it.total_price.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Delivery Location */}
          <div className="border-t pt-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-1">
              Shipping Destination
            </h3>
            <p className="text-xs text-slate-600">
              {receipt.shipping_address.recipient_name} — {receipt.shipping_address.street_address}, {receipt.shipping_address.city}
            </p>
          </div>

          {/* Receipt Math Totals */}
          <div className="border-t pt-4 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal</span>
              <span className="font-mono">{receipt.currency} {receipt.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>Shipping Fee</span>
              <span className="font-mono">{receipt.currency} {receipt.shipping_fee.toFixed(2)}</span>
            </div>
            {receipt.discount_amount > 0 && (
              <div className="flex justify-between text-emerald-700 font-semibold">
                <span>Promotional Discount</span>
                <span className="font-mono">-{receipt.currency} {receipt.discount_amount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-slate-950 pt-2 border-t">
              <span>Total Paid / Due</span>
              <span className="font-mono">{receipt.currency} {receipt.total_amount.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="flex justify-center space-x-4">
        <Link
          href="/"
          className="px-6 py-3 bg-[var(--brand-primary)] text-white text-xs font-bold rounded-[var(--brand-radius)] shadow-sm hover:opacity-95 transition flex items-center space-x-2"
        >
          <Home className="h-4 w-4" />
          <span>Return to Homepage</span>
        </Link>
        <Link
          href="/catalog"
          className="px-6 py-3 bg-white border border-slate-300 text-slate-700 text-xs font-bold rounded-[var(--brand-radius)] shadow-sm hover:bg-slate-50 transition flex items-center space-x-2"
        >
          <span>Continue Shopping</span>
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}
