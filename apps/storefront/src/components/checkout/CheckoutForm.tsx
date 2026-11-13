'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '../../context/CartContext';
import { submitCheckout } from '../../lib/checkout-api';
import { CheckoutPayload } from '../../types/checkout';
import { CheckoutSummary } from './CheckoutSummary';
import { ShieldCheck, Truck, CreditCard, MapPin, AlertCircle } from 'lucide-react';

interface LocationZone {
  district: string;
  zone: 'DHAKA_CITY' | 'DHAKA_SUBURBAN' | 'NATIONAL';
  shippingFee: number;
  thanas: string[];
}

const LOGISTICS_DISTRICTS: LocationZone[] = [
  {
    district: 'Dhaka City',
    zone: 'DHAKA_CITY',
    shippingFee: 80.0,
    thanas: [
      'Banani',
      'Gulshan',
      'Dhanmondi',
      'Mirpur',
      'Uttara',
      'Mohakhali',
      'Motijheel',
      'Badda',
      'Mohammadpur',
      'Tejgaon',
      'Khilgaon',
      'Lalbagh',
      'Paltan',
      'Shahbagh',
      'Bashundhara R/A',
      'Rampura',
      'Malibagh',
      'Shantinagar',
      'Wari',
    ],
  },
  {
    district: 'Dhaka Sub-Urban',
    zone: 'DHAKA_SUBURBAN',
    shippingFee: 110.0,
    thanas: ['Savar', 'Ashulia', 'Keraniganj', 'Dhamrai', 'Nawabganj', 'Dohar'],
  },
  {
    district: 'Gazipur',
    zone: 'DHAKA_SUBURBAN',
    shippingFee: 110.0,
    thanas: ['Gazipur Sadar', 'Tongi', 'Kaliakair', 'Kapasia', 'Sreepur', 'Kaliganj'],
  },
  {
    district: 'Narayanganj',
    zone: 'DHAKA_SUBURBAN',
    shippingFee: 110.0,
    thanas: ['Narayanganj Sadar', 'Fatullah', 'Siddhirganj', 'Bandar', 'Araihazar', 'Sonargaon', 'Rupganj'],
  },
  {
    district: 'Chattogram',
    zone: 'NATIONAL',
    shippingFee: 130.0,
    thanas: ['Agrabad', 'Kotwali', 'Panchlaish', 'Nasirabad', 'Halishahar', 'Khulshi', 'GEC', 'Pahartali', 'Bakolia', 'Chawkbazar'],
  },
  {
    district: 'Sylhet',
    zone: 'NATIONAL',
    shippingFee: 130.0,
    thanas: ['Sylhet Sadar', 'Amberkhana', 'Zindabazar', 'Shahi Eidgah', 'Subidbazar', 'South Surma', 'Beanibazar', 'Golapganj'],
  },
  {
    district: 'Rajshahi',
    zone: 'NATIONAL',
    shippingFee: 130.0,
    thanas: ['Boalia', 'Motihar', 'Rajpara', 'Shah Makhdum', 'Paba', 'Durgapur', 'Godagari'],
  },
  {
    district: 'Khulna',
    zone: 'NATIONAL',
    shippingFee: 130.0,
    thanas: ['Khulna Sadar', 'Sonadanga', 'Khalishpur', 'Daulatpur', 'Khan Jahan Ali', 'Rupsha', 'Dumuria'],
  },
  {
    district: 'Barishal',
    zone: 'NATIONAL',
    shippingFee: 130.0,
    thanas: ['Kotwali', 'Airport', 'Kawnia', 'Bandar', 'Babuganj', 'Bakerganj'],
  },
  {
    district: 'Rangpur',
    zone: 'NATIONAL',
    shippingFee: 130.0,
    thanas: ['Kotwali', 'Tajhat', 'Mahiganj', 'Parashuram', 'Haragach', 'Pirgachha', 'Badarganj'],
  },
  {
    district: 'Mymensingh',
    zone: 'NATIONAL',
    shippingFee: 130.0,
    thanas: ['Kotwali', 'Trishal', 'Muktagachha', 'Bhaluka', 'Gafargaon', 'Fulbaria'],
  },
  {
    district: 'Cumilla',
    zone: 'NATIONAL',
    shippingFee: 130.0,
    thanas: ['Cumilla Adarsha Sadar', 'Cumilla Sadar Dakshin', 'Daudkandi', 'Chandina', 'Debidwar', 'Laksam'],
  },
  {
    district: 'Cox\'s Bazar',
    zone: 'NATIONAL',
    shippingFee: 130.0,
    thanas: ['Cox\'s Bazar Sadar', 'Ramu', 'Chakaria', 'Teknaf', 'Ukhiya', 'Maheshkhali'],
  },
  {
    district: 'Bogura',
    zone: 'NATIONAL',
    shippingFee: 130.0,
    thanas: ['Bogura Sadar', 'Sherpur', 'Shibganj', 'Sariakandi', 'Gabtali', 'Kahaloo'],
  },
];

export const CheckoutForm: React.FC = () => {
  const router = useRouter();
  const { cart } = useCart();

  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Cascading Location Selector State
  const [selectedDistrict, setSelectedDistrict] = useState<string>('Dhaka City');
  const [selectedThana, setSelectedThana] = useState<string>('Banani');

  const [formData, setFormData] = useState({
    customer_email: '',
    customer_phone: '',
    customer_name: '',
    street_address: '',
    apartment_suite: '',
    postal_code: '',
    payment_method: 'COD',
    notes: '',
  });

  const activeZone = LOGISTICS_DISTRICTS.find((d) => d.district === selectedDistrict) || LOGISTICS_DISTRICTS[0];
  const currentDeliveryFee = activeZone.shippingFee;

  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newDistrict = e.target.value;
    setSelectedDistrict(newDistrict);
    const zone = LOGISTICS_DISTRICTS.find((d) => d.district === newDistrict);
    if (zone && zone.thanas.length > 0) {
      setSelectedThana(zone.thanas[0]);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      }
      router.push(`/order-confirmed/${receipt.order_number}?verify=${encodeURIComponent(formData.customer_email)}`);
    } catch (err: any) {
      setErrorMsg(err.message || 'Checkout failed. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
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

        {/* 2-Step Cascading Delivery Location Engine */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 font-[var(--brand-font-heading)]">
              2. Delivery Address & Logistics Zone
            </h2>
            <span className="text-[11px] font-bold text-[var(--brand-primary)]">
              Courier Delivery: ৳{currentDeliveryFee.toFixed(2)}
            </span>
          </div>

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

            {/* 2-Step Cascading Selector */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700">District / Logistics Zone *</label>
                <select
                  value={selectedDistrict}
                  onChange={handleDistrictChange}
                  aria-label="Select District"
                  className="mt-1 w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-[var(--brand-radius)] text-xs font-medium outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
                >
                  <optgroup label="Dhaka Metropolitan (৳80.00)">
                    <option value="Dhaka City">Dhaka City (Fast 24h COD)</option>
                  </optgroup>
                  <optgroup label="Dhaka Peripheral (৳110.00)">
                    <option value="Dhaka Sub-Urban">Dhaka Sub-Urban (Savar, Keraniganj)</option>
                    <option value="Gazipur">Gazipur District</option>
                    <option value="Narayanganj">Narayanganj District</option>
                  </optgroup>
                  <optgroup label="National Courier Zone (৳130.00)">
                    <option value="Chattogram">Chattogram</option>
                    <option value="Sylhet">Sylhet</option>
                    <option value="Rajshahi">Rajshahi</option>
                    <option value="Khulna">Khulna</option>
                    <option value="Barishal">Barishal</option>
                    <option value="Rangpur">Rangpur</option>
                    <option value="Mymensingh">Mymensingh</option>
                    <option value="Cumilla">Cumilla</option>
                    <option value="Cox's Bazar">Cox's Bazar</option>
                    <option value="Bogura">Bogura</option>
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700">Thana / Delivery Area *</label>
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
            </div>

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

            <div className="grid grid-cols-2 gap-4">
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
                placeholder="e.g. Please call before delivery, deliver after 2 PM"
                value={formData.notes}
                onChange={handleChange}
                aria-label="Special delivery instructions"
                className="mt-1 w-full px-3.5 py-2 bg-white border border-slate-300 rounded-[var(--brand-radius)] text-xs outline-none focus:ring-1 focus:ring-[var(--brand-primary)]"
              />
            </div>
          </div>
        </div>

        {/* Payment Method Selector */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 border-b pb-2 font-[var(--brand-font-heading)]">
            3. Payment Method
          </h2>
          <div className="space-y-2.5">
            <label className="flex items-center space-x-3 p-3.5 border rounded-xl cursor-pointer bg-white hover:border-[var(--brand-primary)] transition ring-1 ring-[var(--brand-primary)]/20">
              <input
                type="radio"
                name="payment_method"
                value="COD"
                checked={formData.payment_method === 'COD'}
                onChange={handleChange}
                className="text-[var(--brand-primary)] focus:ring-[var(--brand-primary)]"
              />
              <Truck className="h-5 w-5 text-[var(--brand-primary)]" />
              <div>
                <p className="text-xs font-bold text-slate-900">Cash on Delivery (COD)</p>
                <p className="text-[11px] text-slate-500">Pay cash upon parcel delivery to your doorstep anywhere in Bangladesh.</p>
              </div>
            </label>

            <label className="flex items-center space-x-3 p-3.5 border rounded-xl cursor-pointer bg-slate-50/50 opacity-80 hover:border-slate-300 transition">
              <input
                type="radio"
                name="payment_method"
                value="ONLINE"
                disabled
                className="text-slate-400"
              />
              <CreditCard className="h-5 w-5 text-slate-400" />
              <div>
                <p className="text-xs font-bold text-slate-600">Online Mobile Banking & Cards (bKash / Nagad / Visa)</p>
                <p className="text-[11px] text-slate-400">Enabling in Phase 25 gateway integration.</p>
              </div>
            </label>
          </div>
        </div>

        {/* Submit Order Action Button */}
        <button
          type="submit"
          disabled={isSubmitting || !cart || cart.items.length === 0}
          className="w-full py-4 bg-[var(--brand-primary)] text-white font-bold text-sm rounded-[var(--brand-radius)] shadow-lg hover:opacity-95 transition disabled:opacity-50 flex items-center justify-center space-x-2"
        >
          <ShieldCheck className="h-5 w-5" />
          <span>{isSubmitting ? 'Finalizing Order...' : 'Confirm & Place Order'}</span>
        </button>
      </div>

      {/* Right Column: Order Summary Sidebar */}
      <div className="lg:col-span-5 sticky top-28">
        <CheckoutSummary
          appliedCoupon={appliedCoupon}
          discountAmount={discountAmount}
          deliveryZoneFee={currentDeliveryFee}
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
