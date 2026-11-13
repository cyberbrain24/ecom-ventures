import React from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getStorefrontConfig } from '../../lib/api';
import { Sparkles, ShieldCheck, Heart, Award, ArrowRight, Mail, Phone, MapPin } from 'lucide-react';
import { notFound } from 'next/navigation';

export default async function AboutPage() {
  const headersList = headers();
  const host = headersList.get('x-storefront-host') || 'localhost';
  const config = await getStorefrontConfig(host);

  if (!config) {
    notFound();
  }

  const { store } = config;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-20 space-y-16">
      {/* Hero */}
      <div className="text-center space-y-4 max-w-2xl mx-auto">
        <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
          <Sparkles className="h-3.5 w-3.5 text-[var(--brand-primary)]" />
          <span>Our Heritage & Brand Philosophy</span>
        </div>

        <h1 className="text-3xl sm:text-5xl font-black text-slate-950 font-[var(--brand-font-heading)] tracking-tight">
          About {store.name}
        </h1>

        <p className="text-base text-slate-600 leading-relaxed">
          {store.description ||
            `Dedicated to curating the finest merchandise with verified authenticity, sustainable ethics, and unparalleled customer satisfaction.`}
        </p>
      </div>

      {/* Brand Pillars */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 space-y-3">
          <div className="h-10 w-10 rounded-xl bg-[var(--brand-primary)] text-white flex items-center justify-center">
            <Award className="h-5 w-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Artisan Craftsmanship</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Every product in our catalog undergoes rigorous multi-point quality inspections to ensure uncompromising longevity and aesthetic perfection.
          </p>
        </div>

        <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 space-y-3">
          <div className="h-10 w-10 rounded-xl bg-[var(--brand-primary)] text-white flex items-center justify-center">
            <Heart className="h-5 w-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900">Ethical Sourcing</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            We partner directly with certified local craftsmen and verified distributors to eliminate middlemen and empower regional communities.
          </p>
        </div>

        <div className="bg-slate-50 p-8 rounded-2xl border border-slate-100 space-y-3">
          <div className="h-10 w-10 rounded-xl bg-[var(--brand-primary)] text-white flex items-center justify-center">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <h3 className="text-base font-bold text-slate-900">100% Genuine Guarantee</h3>
          <p className="text-xs text-slate-600 leading-relaxed">
            Authenticity is our pledge. Enjoy confidence with every purchase backed by our hassle-free return and exchange procedures.
          </p>
        </div>
      </div>

      {/* Direct Contact & Support */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-6">
        <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-4">
          Customer Concierge & Inquiries
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
          <div className="flex items-center space-x-3 text-slate-700">
            <div className="h-9 w-9 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">Support Email</p>
              <p className="text-slate-500 font-mono mt-0.5">{store.contact_email}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-slate-700">
            <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
              <Phone className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">Direct Helpline</p>
              <p className="text-slate-500 font-mono mt-0.5">{store.contact_phone || '+880 1711 000000'}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3 text-slate-700">
            <div className="h-9 w-9 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
              <MapPin className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">Headquarters</p>
              <p className="text-slate-500 mt-0.5">Dhaka, Bangladesh</p>
            </div>
          </div>
        </div>

        <div className="pt-4 flex justify-center">
          <Link
            href="/catalog"
            className="px-6 py-3 bg-[var(--brand-primary)] text-white text-xs font-semibold rounded-[var(--brand-radius)] hover:opacity-95 transition flex items-center space-x-2"
          >
            <span>Browse {store.name} Collections</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
