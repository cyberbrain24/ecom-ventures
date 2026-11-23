'use client';

import React, { useState } from 'react';
import { useCart } from '../../context/CartContext';
import { Tag } from 'lucide-react';
import { fetchStorefrontData } from '../../lib/api';

interface CheckoutSummaryProps {
  appliedCoupon: string | null;
  discountAmount: number;
  customerPhone?: string;
  customerEmail?: string;
  /** Shipping fee for the selected district from the store API, or null when no fee is available. */
  deliveryZoneFee: number | null;
  onApplyCoupon: (code: string, discount: number) => void;
  onRemoveCoupon: () => void;
}

/** Order summary for checkout. Shows only fees and totals supplied by the store API. */
export const CheckoutSummary: React.FC<CheckoutSummaryProps> = ({
  appliedCoupon,
  discountAmount,
  customerPhone,
  customerEmail,
  deliveryZoneFee,
  onApplyCoupon,
  onRemoveCoupon,
}) => {
  const { cart } = useCart();
  const [couponInput, setCouponInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!cart) return null;

  const total = deliveryZoneFee === null ? null : Math.max(0, cart.subtotal + deliveryZoneFee - discountAmount);

  const handleValidateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;

    setIsVerifying(true);
    setErrorMsg(null);

    try {
      const itemsPayload = cart.items.map((it: any) => ({
        product_id: it.product_id || '',
        variant_id: it.variant_id || it.id || '',
        category_id: it.category_id || '',
        title: it.product_title || '',
        price: it.unit_price,
        quantity: it.quantity,
        subtotal: it.unit_price * it.quantity,
      }));

      const payload = await fetchStorefrontData<{
        is_valid: boolean;
        code: string;
        discount_amount: number;
        message?: string;
      }>(window.location.host, '/storefront/promotions/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponInput.trim(),
          subtotal: cart.subtotal,
          shipping_fee: deliveryZoneFee || 0,
          customer_phone: customerPhone?.trim() || '',
          customer_email: customerEmail?.trim() || '',
          items: itemsPayload,
        }),
      });

      if (payload.is_valid) {
        onApplyCoupon(payload.code, payload.discount_amount);
        setCouponInput('');
      } else {
        setErrorMsg(payload.message || 'Invalid coupon code.');
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not verify coupon.');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <h3 className="text-base font-bold text-slate-900 font-[var(--brand-font-heading)]">
          Order Summary ({cart.item_count})
        </h3>
      </div>

      {/* Cart Line Items */}
      <div className="space-y-3.5 max-h-72 overflow-y-auto pr-1">
        {cart.items.map((item) => (
          <div key={item.id} className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-3">
              <span className="font-bold text-slate-400 font-mono w-4">{item.quantity}x</span>
              <div>
                <p className="font-semibold text-slate-900 line-clamp-1">{item.product_title}</p>
                <p className="text-[11px] text-slate-400">{item.variant_title}</p>
              </div>
            </div>
            <span className="font-mono font-bold text-slate-900">
              {cart.currency} {(item.unit_price * item.quantity).toFixed(2)}
            </span>
          </div>
        ))}
      </div>

      {/* Coupon Application Block */}
      <div className="border-t border-slate-200 pt-4">
        {appliedCoupon ? (
          <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 p-3 rounded-xl text-xs text-emerald-800">
            <div className="flex items-center space-x-2">
              <Tag className="h-4 w-4 text-emerald-600" />
              <span className="font-mono font-bold">{appliedCoupon}</span>
              <span>applied (-{cart.currency} {discountAmount.toFixed(2)})</span>
            </div>
            <button
              type="button"
              onClick={onRemoveCoupon}
              className="text-emerald-700 hover:text-emerald-900 font-bold ml-2"
            >
              Remove
            </button>
          </div>
        ) : (
          <form onSubmit={handleValidateCoupon} className="space-y-2">
            <div className="flex space-x-2">
              <input
                type="text"
                aria-label="Discount code or voucher"
                placeholder="Enter coupon code"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                className="flex-1 px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-mono outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
              />
              <button
                type="submit"
                disabled={isVerifying || !couponInput.trim()}
                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 disabled:opacity-50 transition"
              >
                {isVerifying ? 'Checking...' : 'Apply'}
              </button>
            </div>
            {errorMsg && <p className="text-[11px] text-rose-600">{errorMsg}</p>}
          </form>
        )}
      </div>

      {/* Price Calculations */}
      <div className="border-t border-slate-200 pt-4 space-y-2 text-xs">
        <div className="flex justify-between text-slate-600">
          <span>Subtotal</span>
          <span className="font-mono">{cart.currency} {cart.subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-slate-600">
          <span>Shipping Fee</span>
          {deliveryZoneFee === null ? (
            <span className="text-rose-600">Select a district</span>
          ) : (
            <span className="font-mono">{cart.currency} {deliveryZoneFee.toFixed(2)}</span>
          )}
        </div>
        {discountAmount > 0 && (
          <div className="flex justify-between text-emerald-700 font-semibold">
            <span>Promotional Discount</span>
            <span className="font-mono">-{cart.currency} {discountAmount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-base font-extrabold text-slate-950 pt-2 border-t border-slate-200">
          <span>Total</span>
          <span className="font-mono">{total === null ? 'Pending' : `${cart.currency} ${total.toFixed(2)}`}</span>
        </div>
      </div>
    </div>
  );
};
