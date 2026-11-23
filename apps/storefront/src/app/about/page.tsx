import React from 'react';
import Link from 'next/link';
import { headers } from 'next/headers';
import { getStorefrontConfig } from '../../lib/api';
import { Sparkles, ArrowRight, Mail, Phone } from 'lucide-react';
import { notFound } from 'next/navigation';

export default async function AboutPage() {
  const headersList = headers();
  const host = headersList.get('x-storefront-host') || '';
  const config = host ? await getStorefrontConfig(host) : null;

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

        {store.description && (
          <p className="text-base text-slate-600 leading-relaxed">{store.description}</p>
        )}
      </div>

      {/* Direct Contact & Support */}
      <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm space-y-6">
        <h3 className="text-lg font-bold text-slate-900 border-b border-slate-100 pb-4">
          Customer Concierge & Inquiries
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          <div className="flex items-center space-x-3 text-slate-700">
            <div className="h-9 w-9 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <p className="font-semibold text-slate-900">Support Email</p>
              <p className="text-slate-500 font-mono mt-0.5">{store.contact_email || 'Not provided'}</p>
            </div>
          </div>

          {store.contact_phone && (
            <div className="flex items-center space-x-3 text-slate-700">
              <div className="h-9 w-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                <Phone className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Phone</p>
                <p className="text-slate-500 font-mono mt-0.5">{store.contact_phone}</p>
              </div>
            </div>
          )}
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
