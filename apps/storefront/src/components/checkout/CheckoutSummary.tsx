'use client';

import React, { useState, useEffect } from 'react';
import { useCart } from '../../context/CartContext';
import { Tag, Truck, Sparkles } from 'lucide-react';

interface CheckoutSummaryProps {
  appliedCoupon: string | null;
  discountAmount: number;
  deliveryZoneFee?: number;
  onApplyCoupon: (code: string, discount: number) => void;
  onRemoveCoupon: () => void;
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

export const CheckoutSummary: React.FC<CheckoutSummaryProps> = ({
  appliedCoupon,
  discountAmount,
  deliveryZoneFee = 80.0,
  onApplyCoupon,
  onRemoveCoupon,
}) => {
  const { cart } = useCart();
  const [couponInput, setCouponInput] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isBundleFreeDelivery, setIsBundleFreeDelivery] = useState(false);
  const [activeBundleName, setActiveBundleName] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const freeDel = localStorage.getItem('ecom_bundle_free_delivery') === 'true';
      setIsBundleFreeDelivery(freeDel);
      try {
        const stored = localStorage.getItem('ecom_active_bundle');
        if (stored) {
          const parsed = JSON.parse(stored);
          setActiveBundleName(parsed.tierName);
        }
      } catch (e) {
        // Ignore parse error
      }
    }
  }, []);

  if (!cart) return null;

  // Waive shipping fee if bundle grants free delivery
  const shippingFee = isBundleFreeDelivery ? 0.0 : deliveryZoneFee;
  const total = Math.max(0, cart.subtotal + shippingFee - discountAmount);

  const handleValidateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!couponInput.trim()) return;

    setIsVerifying(true);
    setErrorMsg(null);

    try {
      const res = await fetch(`${API_BASE_URL}/storefront/promotions/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: couponInput.trim(),
          subtotal: cart.subtotal,
          shipping_fee: shippingFee,
        }),
      });

      const data = await res.json();
      const payload = data?.data !== undefined ? data.data : data;
      if (res.ok && payload.is_valid) {
        onApplyCoupon(payload.code, payload.discount_amount);
        setCouponInput('');
      } else {
        setErrorMsg(payload.message || 'Invalid coupon code');
      }
    } catch (err) {
      setErrorMsg('Could not verify coupon.');
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
        {isBundleFreeDelivery && (
          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100/80 px-2.5 py-0.5 rounded-full">
            <Truck className="h-3 w-3" />
            FREE DELIVERY
          </span>
        )}
      </div>

      {/* Bundle Perk Banner */}
      {isBundleFreeDelivery && (
        <div className="p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-center space-x-2.5 text-xs text-emerald-800">
          <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
          <span>
            <strong>{activeBundleName || 'Combo'} Perk Applied:</strong> Nationwide delivery fee waived (৳0.00).
          </span>
        </div>
      )}

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
          {isBundleFreeDelivery ? (
            <span className="font-mono font-bold text-emerald-600">FREE (৳ 0.00)</span>
          ) : (
            <span className="font-mono">{cart.currency} {shippingFee.toFixed(2)}</span>
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
          <span className="font-mono">{cart.currency} {total.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
};
