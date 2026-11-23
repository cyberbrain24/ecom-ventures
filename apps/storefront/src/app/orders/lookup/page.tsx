'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Search, Package, Truck, CheckCircle2, Clock, AlertCircle, ArrowLeft, ExternalLink } from 'lucide-react';
import { OrderReceipt } from '../../../types/checkout';
import { fetchStorefrontData, StorefrontApiError } from '../../../lib/api';

export default function OrderLookupPage() {
  const [orderNumber, setOrderNumber] = useState('');
  const [verifyContact, setVerifyContact] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [receipt, setReceipt] = useState<OrderReceipt | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderNumber.trim() || !verifyContact.trim()) return;

    setIsLoading(true);
    setErrorMsg('');
    setReceipt(null);

    try {
      const currentHost = window.location.host;
      const order = await fetchStorefrontData<OrderReceipt>(
        currentHost,
        `/storefront/orders/${encodeURIComponent(orderNumber.trim())}?verify=${encodeURIComponent(verifyContact.trim())}`,
        { cache: 'no-store' }
      );
      setReceipt(order);
    } catch (err) {
      if (err instanceof StorefrontApiError && err.status === 404) {
        setErrorMsg('Order not found. Please verify the order reference number and contact info.');
      } else {
        setErrorMsg(err instanceof Error ? err.message : 'Failed to look up the order.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const steps = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED'];
  const currentStepIndex = receipt ? steps.indexOf(receipt.status) : -1;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-10">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="h-14 w-14 bg-[var(--brand-primary)] text-white rounded-2xl flex items-center justify-center mx-auto shadow-md">
          <Truck className="h-7 w-7" />
        </div>
        <h1 className="text-3xl font-black text-slate-950 font-[var(--brand-font-heading)] tracking-tight">
          Track Your Order
        </h1>
        <p className="text-sm text-slate-500 max-w-md mx-auto">
          Enter your order reference number and contact info (phone or email) to check real-time fulfillment status.
        </p>
      </div>

      {/* Lookup Form */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm max-w-xl mx-auto">
        <form onSubmit={handleLookup} className="space-y-4">
          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start space-x-2">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Order Reference Number
            </label>
            <input
              type="text"
              required
              placeholder="e.g. ORD-XXXXXX"
              value={orderNumber}
              onChange={(e) => setOrderNumber(e.target.value)}
              className="w-full px-4 py-2.5 text-sm font-mono border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Contact Phone or Email
            </label>
            <input
              type="text"
              required
              placeholder="Phone (+88017...) or email used during checkout"
              value={verifyContact}
              onChange={(e) => setVerifyContact(e.target.value)}
              className="w-full px-4 py-2.5 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)]"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-3 bg-[var(--brand-primary)] hover:opacity-95 text-white text-sm font-semibold rounded-xl shadow-sm transition disabled:opacity-50 flex items-center justify-center space-x-2"
          >
            <Search className="h-4 w-4" />
            <span>{isLoading ? 'Checking Pipeline...' : 'Locate Order & Milestones'}</span>
          </button>
        </form>
      </div>

      {/* Order Status Display */}
      {receipt && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-sm space-y-8 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b pb-6 gap-4">
            <div>
              <span className="text-xs font-mono font-bold text-[var(--brand-primary)] bg-teal-50 px-2.5 py-1 rounded border border-teal-200">
                Order #{receipt.order_number}
              </span>
              <p className="text-xs text-slate-500 mt-2">
                Placed on {new Date(receipt.created_at).toLocaleString()}
              </p>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-xs text-slate-400 block">Total Amount</span>
              <span className="text-xl font-bold font-mono text-slate-900">
                {receipt.currency} {receipt.total_amount.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 block">Payment: {receipt.payment_method}</span>
            </div>
          </div>

          {/* Stepper Pipeline */}
          <div className="py-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-6">
              Fulfillment Journey
            </h3>
            <div className="grid grid-cols-5 gap-2 text-center">
              {steps.map((st, i) => {
                const isPassed = currentStepIndex >= i;
                const isCurrent = currentStepIndex === i;
                return (
                  <div key={st} className="space-y-2">
                    <div
                      className={`h-9 w-9 rounded-full mx-auto flex items-center justify-center text-xs font-bold transition ${
                        isPassed
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-400'
                      } ${isCurrent ? 'ring-4 ring-emerald-100' : ''}`}
                    >
                      {isPassed ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                    </div>
                    <span
                      className={`text-[11px] block font-semibold ${
                        isPassed ? 'text-slate-900' : 'text-slate-400'
                      }`}
                    >
                      {st}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Logistics & Delivery Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-xl border border-slate-200 text-xs">
            <div>
              <p className="font-bold text-slate-800 uppercase tracking-wider mb-2">
                Shipping Destination
              </p>
              <p className="font-semibold text-slate-900">{receipt.shipping_address.recipient_name}</p>
              <p className="text-slate-600 mt-0.5">{receipt.shipping_address.street_address}</p>
              <p className="text-slate-600">{receipt.shipping_address.city}, Bangladesh</p>
              <p className="text-slate-500 mt-1">Phone: {receipt.shipping_address.phone}</p>
            </div>

            <div>
              <p className="font-bold text-slate-800 uppercase tracking-wider mb-2">
                Shipment
              </p>
              <p className="text-slate-600">
                Courier tracking is not connected to this store yet. Contact support for the delivery status of this order.
              </p>
            </div>
          </div>

          {/* Ordered Products Table */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Purchased Items ({receipt.items.length})
            </h3>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {receipt.items.map((it) => (
                <div key={it.sku} className="p-4 flex items-center justify-between text-xs bg-white">
                  <div>
                    <p className="font-semibold text-slate-900">{it.product_title}</p>
                    <p className="text-slate-400 text-[11px] font-mono mt-0.5">
                      SKU: {it.sku} • Qty: {it.quantity}
                    </p>
                  </div>
                  <span className="font-mono font-bold text-slate-900">
                    {receipt.currency} {it.total_price.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Return back to catalog */}
      <div className="text-center">
        <Link
          href="/catalog"
          className="inline-flex items-center text-xs font-semibold text-[var(--brand-primary)] hover:underline space-x-1"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Store Catalog</span>
        </Link>
      </div>
    </div>
  );
}
