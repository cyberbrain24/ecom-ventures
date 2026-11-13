'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useCart } from '../../context/CartContext';
import { X, Plus, Minus, Trash2, ShoppingBag, ArrowRight, Layers, Truck, Sparkles } from 'lucide-react';

export const CartDrawer: React.FC = () => {
  const { cart, isDrawerOpen, closeDrawer, updateQuantity, removeItem } = useCart();
  const [activeBundle, setActiveBundle] = useState<{
    tierName: string;
    discountPercentage: number;
    hasFreeDelivery: boolean;
  } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('ecom_active_bundle');
        if (stored) {
          setActiveBundle(JSON.parse(stored));
        }
      } catch (e) {
        // Ignore parse error
      }
    }
  }, [isDrawerOpen]);

  if (!isDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/40 backdrop-blur-xs flex justify-end">
      <div className="w-full sm:max-w-md bg-white h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
        {/* Header with 44x44px close button */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShoppingBag className="h-5 w-5 text-[var(--brand-primary)]" />
            <h3 className="text-base font-bold text-slate-900">
              Shopping Cart ({cart?.item_count || 0})
            </h3>
          </div>
          <button
            onClick={closeDrawer}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition focus:outline-none"
            aria-label="Close cart drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Active Bundle Banner Perk if present */}
        {activeBundle && cart && cart.items.length > 0 && (
          <div className="bg-orange-50/80 border-b border-orange-100 px-4 py-2.5 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2 text-slate-800 font-bold">
              <Layers className="h-4 w-4 text-[var(--brand-primary)]" />
              <span>{activeBundle.tierName} Bundle Active ({activeBundle.discountPercentage}% OFF)</span>
            </div>
            {activeBundle.hasFreeDelivery && (
              <span className="inline-flex items-center gap-1 text-[10px] font-black text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-full">
                <Truck className="h-3 w-3" />
                FREE SHIPPING
              </span>
            )}
          </div>
        )}

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
          {!cart || cart.items.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <ShoppingBag className="h-12 w-12 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">Your cart is empty</p>
              <button
                onClick={closeDrawer}
                className="min-h-[44px] inline-flex items-center px-4 py-2 text-xs text-[var(--brand-primary)] font-bold hover:underline"
              >
                Continue Browsing
              </button>
            </div>
          ) : (
            cart.items.map((item) => (
              <div
                key={item.id}
                className="flex items-start space-x-3 sm:space-x-4 border-b border-slate-100 pb-4"
              >
                {item.image_url ? (
                  <div className="relative h-16 w-16 sm:h-20 sm:w-20 rounded-[var(--brand-radius)] overflow-hidden bg-slate-50 border shrink-0">
                    <Image
                      src={item.image_url}
                      alt={item.product_title}
                      fill
                      sizes="80px"
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-[var(--brand-radius)] bg-slate-100 border flex items-center justify-center shrink-0 text-slate-400">
                    <ShoppingBag className="h-6 w-6" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                    {item.product_title}
                  </h4>
                  <p className="text-[11px] text-slate-400 truncate mt-0.5">
                    {item.variant_title}
                  </p>

                  {/* Bundle Item Tag */}
                  {activeBundle && (
                    <div className="mt-1">
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-orange-100/70 text-[var(--brand-primary)]">
                        <Sparkles className="h-2.5 w-2.5" />
                        Bundle: {activeBundle.tierName} ({activeBundle.discountPercentage}% OFF)
                      </span>
                    </div>
                  )}

                  <p className="text-xs sm:text-sm font-bold text-slate-900 font-mono mt-1">
                    {cart.currency} {item.unit_price.toFixed(2)}
                  </p>

                  <div className="flex items-center justify-between mt-2.5">
                    <div className="flex items-center border border-slate-200 rounded-lg bg-slate-50/50">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="h-8 w-8 flex items-center justify-center hover:bg-slate-100 text-slate-600 rounded-l-lg transition"
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="px-2 text-xs font-mono font-semibold">
                        {item.quantity}
                      </span>
                      <button
                        disabled={item.quantity >= item.available_quantity}
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="h-8 w-8 flex items-center justify-center hover:bg-slate-100 text-slate-600 disabled:opacity-30 rounded-r-lg transition"
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>

                    <button
                      onClick={() => removeItem(item.id)}
                      className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-400 hover:text-rose-600 transition rounded-lg hover:bg-rose-50"
                      title="Remove item"
                      aria-label="Remove item"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Subtotal & Checkout Button */}
        {cart && cart.items.length > 0 && (
          <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Subtotal</span>
              <span className="text-base font-bold text-slate-950 font-mono">
                {cart.currency} {cart.subtotal.toFixed(2)}
              </span>
            </div>

            {activeBundle?.hasFreeDelivery && (
              <div className="flex items-center justify-between text-xs text-emerald-600 font-bold">
                <span className="flex items-center gap-1">
                  <Truck className="h-3.5 w-3.5" />
                  Delivery Perk
                </span>
                <span>FREE Nationwide</span>
              </div>
            )}

            <p className="text-[11px] text-slate-400">
              Shipping and taxes calculated at checkout.
            </p>
            <Link
              href="/checkout"
              onClick={closeDrawer}
              className="w-full min-h-[48px] py-3.5 bg-[var(--brand-primary)] text-white text-sm font-semibold rounded-[var(--brand-radius)] shadow-sm hover:opacity-95 transition flex items-center justify-center space-x-2"
            >
              <span>Proceed to Checkout</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
