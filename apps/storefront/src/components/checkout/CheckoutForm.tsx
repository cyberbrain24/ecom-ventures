'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '../../context/CartContext';
import { submitCheckout } from '../../lib/checkout-api';
import { CheckoutPayload, StorePaymentGateway } from '../../types/checkout';
import { ShippingZone } from '../../types/shipping';
import { CheckoutSummary } from './CheckoutSummary';
import {
  ShieldCheck,
  Truck,
  MapPin,
  AlertCircle,
  ShoppingBag,
  ChevronDown,
  Smartphone,
  CreditCard,
  Globe,
} from 'lucide-react';

interface CheckoutFormProps {
  /** Delivery districts and fees loaded from the store API. */
  zones: ShippingZone[];
  /** Why the zones could not be loaded. When set, ordering is blocked. */
  zonesError: string | null;
  /** Active payment gateways configured for this store. Deactivated ones are excluded/hidden. */
  gateways?: StorePaymentGateway[];
}

/**
 * Checkout form. Districts, areas and fees come only from the store's delivery
 * configuration. When that configuration is unavailable, the form shows the reason
 * and does not allow the order to be placed.
 */
export const CheckoutForm: React.FC<CheckoutFormProps> = ({ zones, zonesError, gateways }) => {
  const router = useRouter();
  const { cart } = useCart();

  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [mobileSummaryOpen, setMobileSummaryOpen] = useState(false);

  const [selectedDistrict, setSelectedDistrict] = useState<string>(zones[0]?.district ?? '');
  const [selectedThana, setSelectedThana] = useState<string>(zones[0]?.thanas[0] ?? '');

  // Filter only active gateways (deactivated ones are completely hidden on checkout)
  const activeGateways = (gateways && gateways.length > 0)
    ? gateways.filter((g) => g.is_active !== false)
    : [
        {
          id: 'COD',
          name: 'Cash on Delivery (COD)',
          description: 'Pay cash when the parcel is delivered to you.',
          is_default: true,
          is_active: true,
        },
      ];

  const defaultGw = activeGateways.find((g) => g.is_default) || activeGateways[0];

  const [formData, setFormData] = useState({
    customer_email: '',
    customer_phone: '',
    customer_name: '',
    street_address: '',
    apartment_suite: '',
    postal_code: '',
    payment_method: defaultGw ? defaultGw.id : 'COD',
    notes: '',
  });

  // Auto-select the default active payment gateway when gateways load or change
  useEffect(() => {
    if (activeGateways.length > 0) {
      const def = activeGateways.find((g) => g.is_default) || activeGateways[0];
      const isCurrentActive = activeGateways.some(
        (g) => g.id.toUpperCase() === formData.payment_method.toUpperCase()
      );
      if (def && (!formData.payment_method || !isCurrentActive)) {
        setFormData((prev) => ({ ...prev, payment_method: def.id }));
      }
    }
  }, [gateways]);

  // Pillar 1: Silent Non-Intrusive Client Telemetry (1,200ms debounce on valid 01XXXXXXXXX)
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const cleanPhone = formData.customer_phone.replace(/\D/g, '');
    const isValidPhone = /^01[3-9]\d{8}$/.test(cleanPhone);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (isValidPhone && cart && cart.items.length > 0) {
      debounceRef.current = setTimeout(() => {
        try {
          const sessionToken = cart.session_id || `sess_${cleanPhone}`;
          fetch('/api/v1/orders/abandoned/capture', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              session_token: sessionToken,
              phone: cleanPhone,
              customer_name: formData.customer_name.trim(),
              customer_email: formData.customer_email.trim(),
              district: selectedDistrict,
              thana: selectedThana,
              address: [formData.street_address, formData.apartment_suite].filter(Boolean).join(', ').trim(),
              cart_items: cart.items,
              cart_total: cart.subtotal,
            }),
            keepalive: true,
          }).catch(() => {
            // Non-intrusive: silent failure, zero customer disruption
          });
        } catch {
          // Zero customer disruption
        }
      }, 1200);
    }

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [
    formData.customer_phone,
    formData.customer_name,
    formData.customer_email,
    formData.street_address,
    formData.apartment_suite,
    selectedDistrict,
    selectedThana,
    cart,
  ]);

  const activeZone = zones.find((zone) => zone.district === selectedDistrict) ?? null;
  const currentDeliveryFee = zonesError || !activeZone ? null : activeZone.shipping_fee;
  const canPlaceOrder = currentDeliveryFee !== null;

  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDistrict = e.target.value;
    setSelectedDistrict(newDistrict);
    const zone = zones.find((item) => item.district === newDistrict);
    setSelectedThana(zone?.thanas[0] ?? '');
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canPlaceOrder) {
      setErrorMsg('Delivery fees are not available for this store, so the order cannot be placed.');
      return;
    }
    if (!cart || cart.items.length === 0) {
      setErrorMsg('Your cart is empty.');
      return;
    }

    // Strict 11-digit Bangladesh phone validation
    const cleanPhone = formData.customer_phone.replace(/\D/g, '');
    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      setErrorMsg('Please enter a valid 11-digit Bangladeshi mobile number (e.g. 01712345678 or 01912345678).');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    const fullStreetAddress = `${formData.street_address}${selectedThana ? `, ${selectedThana}` : ''}`;

    const payload: CheckoutPayload = {
      session_id: cart.session_id,
      customer_email: formData.customer_email.trim(),
      customer_phone: cleanPhone,
      customer_name: formData.customer_name.trim(),
      shipping_address: {
        recipient_name: formData.customer_name.trim(),
        phone: cleanPhone,
        street_address: fullStreetAddress,
        apartment_suite: formData.apartment_suite || undefined,
        city: selectedDistrict,
        postal_code: formData.postal_code || undefined,
        country: 'Bangladesh',
      },
      payment_method: formData.payment_method,
      coupon_code: appliedCoupon || undefined,
      notes: formData.notes || undefined,
    };

    try {
      const receipt = await submitCheckout(payload);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(`order_verify_${receipt.order_number}`, formData.customer_email);
        try {
          const hostKey = window.location.host.split(':')[0];
          const storageKey = `ecom_recent_orders_${hostKey}`;
          const existing = JSON.parse(localStorage.getItem(storageKey) || '[]');
          const newOrder = {
            order_number: receipt.order_number,
            created_at: receipt.created_at || new Date().toISOString(),
            status: receipt.status || 'PENDING',
            total_amount: receipt.total_amount,
            currency: receipt.currency || 'BDT',
            item_count: receipt.items?.length || 1,
            first_item_title: receipt.items?.[0]?.product_title || 'Store Item',
            verify_contact: formData.customer_phone || formData.customer_email,
            recipient_name: formData.customer_name,
            payment_method: formData.payment_method,
          };
          localStorage.setItem(
            storageKey,
            JSON.stringify([newOrder, ...existing.filter((o: any) => o.order_number !== receipt.order_number)].slice(0, 10))
          );
        } catch {
          // ignore
        }
      }
      router.push(`/order-confirmed/${receipt.order_number}?verify=${encodeURIComponent(formData.customer_email)}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Checkout failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
      {/* Mobile/Tablet Collapsible Order Summary Bar (< 1024px) */}
      <div className="lg:hidden col-span-1 border border-slate-200 rounded-xl overflow-hidden bg-slate-50 shadow-xs">
        <button
          type="button"
          onClick={() => setMobileSummaryOpen(!mobileSummaryOpen)}
          className="w-full min-h-[48px] px-4 py-3 flex items-center justify-between text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200/80 transition"
        >
          <div className="flex items-center gap-2">
            <ShoppingBag className="h-4 w-4 text-[var(--brand-primary)]" />
            <span>{mobileSummaryOpen ? 'Hide order summary' : 'Show order summary & coupon'}</span>
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${mobileSummaryOpen ? 'rotate-180' : ''}`} />
          </div>
          <span className="font-mono text-sm font-extrabold text-slate-900">
            ৳{((cart?.subtotal || 0) + (currentDeliveryFee || 0) - discountAmount).toFixed(2)}
          </span>
        </button>

        {mobileSummaryOpen && (
          <div className="p-4 border-t border-slate-200 bg-white">
            <CheckoutSummary
              appliedCoupon={appliedCoupon}
              discountAmount={discountAmount}
              deliveryZoneFee={currentDeliveryFee}
              customerPhone={formData.customer_phone}
              customerEmail={formData.customer_email}
              onApplyCoupon={(code, discount) => {
                setAppliedCoupon(code);
                setDiscountAmount(discount);
              }}
              onRemoveCoupon={() => {
                setAppliedCoupon(null);
                setDiscountAmount(0);
              }}
            />
          </div>
        )}
      </div>

      {/* Left Column: Customer and Shipping Form */}
      <div className="lg:col-span-7 space-y-8">
        {errorMsg && (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center space-x-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Contact Information */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 border-b pb-2 font-[var(--brand-font-heading)]">
            1. Contact Details
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Email Address *</label>
              <input
                type="email"
                name="customer_email"
                required
                placeholder="you@domain.com"
                value={formData.customer_email}
                onChange={handleChange}
                aria-label="Email Address"
                className="mt-1 w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-[var(--brand-radius)] text-xs outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700">Mobile Phone Number (11 Digits) *</label>
              <input
                type="tel"
                name="customer_phone"
                required
                placeholder="017XXXXXXXX"
                maxLength={11}
                value={formData.customer_phone}
                onChange={handleChange}
                aria-label="Phone Number"
                className="mt-1 w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-[var(--brand-radius)] text-xs font-mono outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
              />
            </div>
          </div>
        </div>

        {/* Delivery Location */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 font-[var(--brand-font-heading)]">
              2. Delivery Address
            </h2>
            {currentDeliveryFee !== null && (
              <span className="text-[11px] font-bold text-[var(--brand-primary)]">
                Delivery fee: ৳{currentDeliveryFee.toFixed(2)}
              </span>
            )}
          </div>

          {zonesError ? (
            <div role="alert" className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-start space-x-2">
              <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
              <span>
                Delivery districts and fees could not be loaded for this store: {zonesError} Orders cannot be placed until
                delivery is configured.
              </span>
            </div>
          ) : zones.length === 0 ? (
            <div role="alert" className="p-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-start space-x-2">
              <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
              <span>No delivery districts are configured for this store. Orders cannot be placed.</span>
            </div>
          ) : null}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700">Full Name *</label>
              <input
                type="text"
                name="customer_name"
                required
                placeholder="Receiver full name"
                value={formData.customer_name}
                onChange={handleChange}
                aria-label="Receiver name"
                className="mt-1 w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-[var(--brand-radius)] text-xs outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
              />
            </div>

            {zones.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">District *</label>
                  <select
                    value={selectedDistrict}
                    onChange={handleDistrictChange}
                    aria-label="Select District"
                    disabled={Boolean(zonesError)}
                    className="mt-1 w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-[var(--brand-radius)] text-xs font-medium outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                  >
                    {zones.map((zone) => (
                      <option key={zone.district} value={zone.district}>
                        {zone.district} (৳{zone.shipping_fee.toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                {activeZone && activeZone.thanas.length > 0 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700">Area *</label>
                    <select
                      value={selectedThana}
                      onChange={(e) => setSelectedThana(e.target.value)}
                      aria-label="Select Thana"
                      className="mt-1 w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-[var(--brand-radius)] text-xs font-medium outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                    >
                      {activeZone.thanas.map((th) => (
                        <option key={th} value={th}>
                          {th}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700">Detailed Street Address *</label>
              <input
                type="text"
                name="street_address"
                required
                placeholder="House #, Road #, Sector, Area details"
                value={formData.street_address}
                onChange={handleChange}
                aria-label="House, Road, Area details"
                className="mt-1 w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-[var(--brand-radius)] text-xs outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Apartment / Flat (Optional)</label>
                <input
                  type="text"
                  name="apartment_suite"
                  placeholder="e.g. 4B, Level 4"
                  value={formData.apartment_suite}
                  onChange={handleChange}
                  className="mt-1 w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-[var(--brand-radius)] text-xs outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700">Postal Code (Optional)</label>
                <input
                  type="text"
                  name="postal_code"
                  placeholder="e.g. 1212"
                  value={formData.postal_code}
                  onChange={handleChange}
                  aria-label="Postal Code"
                  className="mt-1 w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-[var(--brand-radius)] text-xs outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700">Delivery Instructions / Notes (Optional)</label>
              <textarea
                name="notes"
                rows={2}
                placeholder="e.g. Please call before delivery"
                value={formData.notes}
                onChange={handleChange}
                aria-label="Special delivery instructions"
                className="mt-1 w-full px-3.5 py-2 bg-white border border-slate-300 rounded-[var(--brand-radius)] text-xs outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
              />
            </div>
          </div>
        </div>

        {/* Payment Method: only active payment methods configured in Store Admin are rendered */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 font-[var(--brand-font-heading)]">
              3. Payment Method
            </h2>
            <span className="text-[11px] text-slate-500 font-medium">
              {activeGateways.length} payment {activeGateways.length === 1 ? 'option' : 'options'} available
            </span>
          </div>

          {activeGateways.length === 0 ? (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>No payment methods are currently active for this store. Please contact the store administrator.</span>
            </div>
          ) : (
            <div className="space-y-2.5">
              {activeGateways.map((gw) => {
                const isSelected = formData.payment_method.toUpperCase() === gw.id.toUpperCase();
                const cleanId = gw.id.toUpperCase();
                const icon =
                  cleanId === 'COD' ? (
                    <Truck className="h-5 w-5" />
                  ) : cleanId === 'BKASH' || cleanId === 'NAGAD' ? (
                    <Smartphone className="h-5 w-5" />
                  ) : cleanId === 'STRIPE' ? (
                    <Globe className="h-5 w-5" />
                  ) : (
                    <CreditCard className="h-5 w-5" />
                  );

                return (
                  <label
                    key={gw.id}
                    className={`flex items-start space-x-3.5 p-3.5 border rounded-xl cursor-pointer transition ${
                      isSelected
                        ? 'bg-emerald-50/40 border-[var(--brand-primary)] ring-1 ring-[var(--brand-primary)]/30'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment_method"
                      value={gw.id}
                      checked={isSelected}
                      onChange={handleChange}
                      className="mt-1 text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
                    />
                    <div className="shrink-0 mt-0.5 text-[var(--brand-primary)]">
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-bold text-slate-900">{gw.name}</p>
                        {gw.is_default && (
                          <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 bg-emerald-100 text-emerald-800 rounded border border-emerald-200">
                            Default
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5">{gw.description}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>

        {/* Submit Order Action Button */}
        <button
          type="submit"
          disabled={isSubmitting || !cart || cart.items.length === 0 || !canPlaceOrder || activeGateways.length === 0}
          className="w-full py-4 bg-[var(--brand-primary)] text-white font-bold text-sm rounded-[var(--brand-radius)] shadow-lg hover:opacity-95 transition disabled:opacity-50 flex items-center justify-center space-x-2"
        >
          <ShieldCheck className="h-5 w-5" />
          <span>{isSubmitting ? 'Placing Order...' : 'Place Order'}</span>
        </button>
      </div>

      {/* Right Column: Order Summary Sidebar (Desktop >= 1024px) */}
      <div className="hidden lg:block lg:col-span-5 sticky top-28">
        <CheckoutSummary
          appliedCoupon={appliedCoupon}
          discountAmount={discountAmount}
          deliveryZoneFee={currentDeliveryFee}
          customerPhone={formData.customer_phone}
          customerEmail={formData.customer_email}
          onApplyCoupon={(code, discount) => {
            setAppliedCoupon(code);
            setDiscountAmount(discount);
          }}
          onRemoveCoupon={() => {
            setAppliedCoupon(null);
            setDiscountAmount(0);
          }}
        />
      </div>
    </form>
  );
};
