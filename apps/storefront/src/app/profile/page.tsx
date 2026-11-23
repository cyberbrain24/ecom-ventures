'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Package, Truck, User, MapPin, Search, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';
import { OrderReceipt } from '../../types/checkout';

interface SavedOrderSummary {
  order_number: string;
  created_at: string;
  status: string;
  total_amount: number;
  currency: string;
  item_count: number;
  first_item_title: string;
  verify_contact: string;
  recipient_name?: string;
  payment_method?: string;
}

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<'orders' | 'tracking' | 'addresses'>('orders');
  const [mounted, setMounted] = useState(false);

  // Live order tracking query
  const [trackPhone, setTrackPhone] = useState('');
  const [trackOrderNumber, setTrackOrderNumber] = useState('');
  const [trackingResult, setTrackingResult] = useState<OrderReceipt | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);

  // Profile data cached in localStorage
  const [profile, setProfile] = useState<{
    name: string;
    phone: string;
    address: string;
    district: string;
  }>({ name: '', phone: '', address: '', district: 'Dhaka City' });
  const [profileSavedMsg, setProfileSavedMsg] = useState(false);

  // Recent orders list
  const [recentOrders, setRecentOrders] = useState<SavedOrderSummary[]>([]);

  const getHostKey = () => (typeof window !== 'undefined' ? window.location.host.split(':')[0] : 'default');

  useEffect(() => {
    setMounted(true);
    try {
      const hostKey = getHostKey();
      const storedProfile = localStorage.getItem(`ecom_user_profile_${hostKey}`) || localStorage.getItem('ecom_user_profile');
      if (storedProfile) {
        const parsed = JSON.parse(storedProfile);
        setProfile(parsed);
        if (parsed.phone) {
          setTrackPhone(parsed.phone);
        }
      }

      const storedOrders = localStorage.getItem(`ecom_recent_orders_${hostKey}`);
      if (storedOrders) {
        setRecentOrders(JSON.parse(storedOrders));
      }
    } catch {
      // Ignore
    }
  }, []);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const hostKey = getHostKey();
      localStorage.setItem(`ecom_user_profile_${hostKey}`, JSON.stringify(profile));
      localStorage.setItem('ecom_user_profile', JSON.stringify(profile));
      setProfileSavedMsg(true);
      setTimeout(() => setProfileSavedMsg(false), 4000);
    } catch {
      // Ignore
    }
  };

  const handleTrackOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOrder = trackOrderNumber.trim();
    const cleanVerify = trackPhone.trim();

    if (!cleanOrder) return;
    if (!cleanVerify) {
      setTrackingError('Contact phone or email is required to verify order ownership.');
      return;
    }

    setTrackingLoading(true);
    setTrackingError(null);
    setTrackingResult(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const cleanApi = apiUrl.replace(/\/+$/, '');
      const baseApi = cleanApi.endsWith('/api/v1') ? cleanApi : `${cleanApi}/api/v1`;
      const host = window.location.host;

      const res = await fetch(
        `${baseApi}/storefront/orders/${encodeURIComponent(cleanOrder)}?verify=${encodeURIComponent(cleanVerify)}`,
        {
          headers: {
            'X-Storefront-Host': host,
            'X-Original-Host': host,
            'X-Forwarded-Host': host,
          },
        }
      );

      if (!res.ok) {
        if (res.status === 404) {
          setTrackingError(`Order "${cleanOrder}" could not be found or contact details did not match.`);
        } else {
          setTrackingError(`Could not retrieve order details (HTTP ${res.status}). Please try again.`);
        }
        return;
      }

      const json = await res.json();
      const receipt: OrderReceipt = json.data || json;
      setTrackingResult(receipt);

      // Save to recent orders
      try {
        const hostKey = getHostKey();
        const existing = recentOrders.filter((o) => o.order_number !== receipt.order_number);
        const newSummary: SavedOrderSummary = {
          order_number: receipt.order_number,
          created_at: receipt.created_at,
          status: receipt.status,
          total_amount: receipt.total_amount,
          currency: receipt.currency || 'BDT',
          item_count: receipt.items?.length || 1,
          first_item_title: receipt.items?.[0]?.product_title || 'Item',
          verify_contact: cleanVerify,
          recipient_name: receipt.shipping_address?.recipient_name,
          payment_method: receipt.payment_method,
        };
        const updated = [newSummary, ...existing].slice(0, 10);
        setRecentOrders(updated);
        localStorage.setItem(`ecom_recent_orders_${hostKey}`, JSON.stringify(updated));
      } catch {
        // Ignore
      }
    } catch (err: any) {
      setTrackingError(err.message || 'Failed to track order. Please try again.');
    } finally {
      setTrackingLoading(false);
    }
  };

  const startTrackingOrder = (order: SavedOrderSummary) => {
    setTrackOrderNumber(order.order_number);
    setTrackPhone(order.verify_contact || profile.phone || '');
    setActiveTab('tracking');
    setTrackingResult(null);
    setTrackingError(null);
  };

  if (!mounted) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 min-h-[400px]">
        <div className="h-8 w-48 bg-slate-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-10">
      {/* Title */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-950 font-[var(--brand-font-heading)] tracking-tight">
          Customer Profile & Order Tracker
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Review recent orders, verify real-time parcel fulfillment, and configure auto-fill checkout details.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Account Navigation Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-1">
            <button
              onClick={() => setActiveTab('orders')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition cursor-pointer ${
                activeTab === 'orders'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Package className="h-4 w-4" />
              <span>Order History</span>
            </button>

            <button
              onClick={() => setActiveTab('tracking')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition cursor-pointer ${
                activeTab === 'tracking'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Truck className="h-4 w-4" />
              <span>Live Courier Tracker</span>
            </button>

            <button
              onClick={() => setActiveTab('addresses')}
              className={`w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition cursor-pointer ${
                activeTab === 'addresses'
                  ? 'bg-slate-900 text-white'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <MapPin className="h-4 w-4" />
              <span>Delivery Profile</span>
            </button>

            <Link
              href="/wishlist"
              className="w-full text-left px-3.5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-2.5 transition"
            >
              <User className="h-4 w-4" />
              <span>My Wishlist</span>
            </Link>
          </div>

          <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 text-xs text-slate-600 space-y-2">
            <div className="font-bold uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              <span>100% Privacy Standard</span>
            </div>
            <p className="leading-relaxed">
              Your profile data is stored securely in your browser storage. Checkout addresses are automatically injected without external trackers.
            </p>
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          {/* TAB 1: ORDER HISTORY */}
          {activeTab === 'orders' && (
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <h2 className="text-lg font-bold text-slate-950 font-[var(--brand-font-heading)]">
                  Order History & Past Purchases
                </h2>
                <button
                  onClick={() => setActiveTab('tracking')}
                  className="text-xs font-bold text-[var(--brand-primary)] hover:underline cursor-pointer"
                >
                  Track by Order Number →
                </button>
              </div>

              {recentOrders.length === 0 ? (
                <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-3">
                  <Package className="h-10 w-10 text-slate-300 mx-auto" />
                  <h3 className="text-sm font-bold text-slate-800">No recent orders saved on this device</h3>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    When you place an order, it will appear here for fast status checks. You can also locate an existing order anytime using our tracker.
                  </p>
                  <div className="pt-2 flex justify-center gap-3">
                    <button
                      onClick={() => setActiveTab('tracking')}
                      className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold transition hover:bg-slate-800 cursor-pointer"
                    >
                      Track Order
                    </button>
                    <Link
                      href="/catalog"
                      className="px-4 py-2 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold transition hover:bg-slate-200"
                    >
                      Browse Catalog
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentOrders.map((ord) => (
                    <div
                      key={ord.order_number}
                      className="border border-slate-200 rounded-xl p-5 space-y-4 hover:border-slate-300 transition"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div>
                          <div className="text-xs text-slate-500 font-mono font-bold">
                            ORDER #{ord.order_number}
                          </div>
                          <div className="text-sm font-bold text-slate-900 mt-0.5">
                            {ord.first_item_title}{' '}
                            {ord.item_count > 1 ? `(+${ord.item_count - 1} more items)` : ''}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-800">
                            {ord.status}
                          </span>
                          <button
                            onClick={() => startTrackingOrder(ord)}
                            className="px-3 py-1 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition cursor-pointer"
                          >
                            Track
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
                        <div>
                          <span className="text-slate-400 block">Placed Date</span>
                          <span className="font-semibold text-slate-800">
                            {new Date(ord.created_at).toLocaleDateString(undefined, {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Payment Method</span>
                          <span className="font-semibold text-slate-800">{ord.payment_method || 'COD'}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Verified Contact</span>
                          <span className="font-semibold text-slate-800 truncate block">
                            {ord.verify_contact || '—'}
                          </span>
                        </div>
                        <div>
                          <span className="text-slate-400 block">Total Due</span>
                          <span className="font-bold text-slate-900">
                            ৳{ord.total_amount?.toLocaleString() || '0'} {ord.currency}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LIVE COURIER TRACKER */}
          {activeTab === 'tracking' && (
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
              <h2 className="text-lg font-bold text-slate-950 font-[var(--brand-font-heading)]">
                Real-Time Order & Courier Tracker
              </h2>

              <form onSubmit={handleTrackOrder} className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Order Reference Number *
                  </label>
                  <input
                    type="text"
                    value={trackOrderNumber}
                    onChange={(e) => setTrackOrderNumber(e.target.value)}
                    placeholder="e.g. ORD-XXXXXX"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Contact Phone or Email (Used at Checkout) *
                  </label>
                  <input
                    type="text"
                    value={trackPhone}
                    onChange={(e) => setTrackPhone(e.target.value)}
                    placeholder="e.g. 017XXXXXXXX or email@domain.com"
                    required
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
                  />
                </div>

                <button
                  type="submit"
                  disabled={trackingLoading}
                  className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Search className="h-4 w-4" />
                  <span>{trackingLoading ? 'Checking Pipeline...' : 'Track Parcel'}</span>
                </button>
              </form>

              {trackingError && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{trackingError}</span>
                </div>
              )}

              {trackingResult && (
                <div className="border border-emerald-200 bg-emerald-50/50 rounded-xl p-6 space-y-5 animate-in fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-emerald-200/60 pb-4">
                    <div className="flex items-center gap-2 text-emerald-900 font-bold text-base">
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                      <span>Order Status: {trackingResult.status}</span>
                    </div>
                    <span className="font-mono text-xs font-bold text-emerald-800 bg-white px-2.5 py-1 rounded-md border border-emerald-200 self-start sm:self-auto">
                      Ref: #{trackingResult.order_number}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-700">
                    <div>
                      <span className="text-slate-400 block font-mono text-[11px]">Recipient</span>
                      <strong className="text-slate-900">
                        {trackingResult.shipping_address?.recipient_name || 'Customer'}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-mono text-[11px]">Contact Phone</span>
                      <strong className="text-slate-900 font-mono">
                        {trackingResult.shipping_address?.phone || trackPhone}
                      </strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-mono text-[11px]">Delivery Destination</span>
                      <span className="text-slate-800">
                        {trackingResult.shipping_address?.street_address},{' '}
                        {trackingResult.shipping_address?.city}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-400 block font-mono text-[11px]">Payment Option & Total</span>
                      <span className="text-slate-800 font-bold">
                        {trackingResult.payment_method} · ৳{trackingResult.total_amount?.toLocaleString()}{' '}
                        {trackingResult.currency}
                      </span>
                    </div>
                  </div>

                  {trackingResult.items && trackingResult.items.length > 0 && (
                    <div className="border-t border-emerald-200/60 pt-3">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 mb-2">
                        Purchased Items ({trackingResult.items.length})
                      </div>
                      <div className="space-y-1.5">
                        {trackingResult.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs">
                            <span className="font-medium text-slate-800">
                              {item.product_title}{' '}
                              {item.variant_title ? `(${item.variant_title})` : ''} × {item.quantity}
                            </span>
                            <span className="font-mono font-bold text-slate-900">
                              ৳{item.total_price?.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: SAVED ADDRESSES */}
          {activeTab === 'addresses' && (
            <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
              <h2 className="text-lg font-bold text-slate-950 font-[var(--brand-font-heading)]">
                Default Delivery Profile & Fast Checkout Auto-Fill
              </h2>

              {profileSavedMsg && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <span>Delivery details saved! Your checkout form will now be automatically pre-filled.</span>
                </div>
              )}

              <form onSubmit={handleSaveProfile} className="space-y-4 max-w-xl">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                  <input
                    type="text"
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    placeholder="e.g. Imran Kabir"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile Phone (01XXXXXXXXX)</label>
                  <input
                    type="tel"
                    value={profile.phone}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    placeholder="017xxxxxxxx"
                    maxLength={11}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Delivery Street Address</label>
                  <textarea
                    rows={3}
                    value={profile.address}
                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                    placeholder="House, Road, Area, Landmark..."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold uppercase tracking-wider hover:bg-slate-800 transition cursor-pointer"
                >
                  Save Delivery Profile
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
