import React from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getStorefrontConfig } from '../../lib/api';
import { resolveTheme } from '../../lib/theme';
import { ShieldCheck, Truck, Clock, Sparkles } from 'lucide-react';
import { notFound } from 'next/navigation';

export async function generateMetadata(): Promise<Metadata> {
  const headersList = headers();
  const host = headersList.get('x-storefront-host') || '';
  const config = await getStorefrontConfig(host);
  const storeName = config?.store.name || 'Store';

  return {
    title: `Our Brand Manifesto & Heritage | ${storeName}`,
    description: `Discover the origins, technical craftsmanship, standards, and design philosophy behind ${storeName}.`,
    alternates: {
      canonical: `https://${host}/brand`,
    },
  };
}

export default async function BrandStoryPage() {
  const headersList = headers();
  const host = headersList.get('x-storefront-host') || '';
  const config = await getStorefrontConfig(host);

  if (!config) {
    notFound();
  }

  const { store } = config;
  const storeName = store.name;
  const resolved = resolveTheme(config.theme.config);
  const variant = resolved.config.variant;

  // Variant-specific Brand Narratives
  const brandThemes: Record<
    string,
    { headline: string; philosophyTitle: string; philosophyP1: string; philosophyP2: string }
  > = {
    gadget: {
      headline: 'Next-Generation Electronics & Smart Ecosystems',
      philosophyTitle: 'The Engineering & Performance Philosophy',
      philosophyP1: `${storeName} was engineered to bring genuine, cutting-edge consumer hardware and smart lifestyle tech to discerning enthusiasts across Bangladesh. We reject grey-market uncertainty in favor of authentic distributor warranties, strict hardware bench-testing, and certified device safety standards.`,
      philosophyP2:
        'Every device and accessory is vetted for performance benchmarks: high-efficiency chipsets, premium thermal dissipation, military-grade enclosure materials, and seamless device interoperability.',
    },
    innerwear: {
      headline: 'Intimate Architecture & Second-Skin Luxury',
      philosophyTitle: 'The Fit, Comfort & Fabric Ethos',
      philosophyP1: `${storeName} was founded with a devoted commitment to intimate wellness and everyday silhouette perfection. We reject irritating seams and synthetic discomfort in favor of cloud-soft microfibers, breathable organic cotton, and body-sculpting ergonomic contouring.`,
      philosophyP2:
        'Every piece is crafted for uncompromised confidence: seamless laser-cut edging, adaptive elastic bands that never pinch, and breathable moisture-wicking foundations engineered for subcontinental climates.',
    },
    'inner-fashion': {
      headline: 'Intimate Elegance & Everyday Silhouette Mastery',
      philosophyTitle: 'The Sensual Silhouette & Textile Philosophy',
      philosophyP1: `${storeName} harmonizes delicate aesthetics with supportive daily comfort. We design intimates and loungewear that celebrate natural curves through gentle contouring, hypoallergenic premium blends, and thoughtful detailing.`,
      philosophyP2:
        'Our designs prioritize longevity and whisper-light support: reinforced stitching, gentle wireless architecture, and exquisite lace and mesh finishes made to endure effortless daily wear.',
    },
    'traditional-fashion': {
      headline: 'Timeless Heritage & Artisanal Royal Couture',
      philosophyTitle: 'The Artisanal Weave & Craft Ethos',
      philosophyP1: `${storeName} honors generations of subcontinental textile mastery. We blend royal festive couture with modern wearable refinement, collaborating with skilled weavers and master embroiderers to create timeless ethnic heirlooms.`,
      philosophyP2:
        'Each ensemble represents deliberate artistry: authentic zardozi needlework, pure silks, hand-dyed muslins, and intricate motifs tailored to bring unmatched grace to special moments and celebrations.',
    },
    jewelry: {
      headline: 'Artisanal Radiance & Heirloom Craftsmanship',
      philosophyTitle: 'The Precious Metal & Gemstone Philosophy',
      philosophyP1: `${storeName} creates radiant fine jewelry and curated adornments that balance timeless elegance with contemporary sophistication. We source premium metals, lustrous stones, and ethical materials to celebrate life’s most meaningful milestones.`,
      philosophyP2:
        'Every piece undergoes meticulous bench finishing: micro-pave prong settings, durable high-polish electroplating, and structural integrity designed to remain treasured heirlooms for generations.',
    },
    streetculture: {
      headline: 'Worldwide Streetwear Culture from Dhaka',
      philosophyTitle: 'The Architectural Silhouette Philosophy',
      philosophyP1: `${storeName} was founded with an obsessive focus on structural garment architecture. We reject transient fast-fashion cycles in favor of heavyweight 240+ GSM French Terry, bespoke washing techniques, and dropped-shoulder silhouettes engineered specifically for modern subcontinental frames.`,
      philosophyP2:
        'Every cut is treated as an engineering drawing: ribbed double-needle collar construction that never buckles, reinforced utility stitching, and premium metal hardware on all cargo pockets.',
    },
    fashion: {
      headline: 'Contemporary Ready-to-Wear & Everyday Refinement',
      philosophyTitle: 'The Tailoring & Modern Wardrobe Ethos',
      philosophyP1: `${storeName} creates elevated wardrobe essentials designed for effortless versatility. We believe in high-grade natural fibers, mindful craftsmanship, and timeless silhouettes that transition gracefully from day to evening.`,
      philosophyP2:
        'Every garment focuses on drape, tactile hand-feel, and enduring build quality: precision stitching, comfortable stretch resilience, and thoughtful finishing details that stand the test of time.',
    },
  };

  const narrative = brandThemes[variant] || brandThemes.fashion;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20 space-y-12">
      {/* Brand Header */}
      <div className="text-center space-y-4">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 text-white text-xs font-bold uppercase tracking-widest">
          <Sparkles className="h-3.5 w-3.5 text-amber-400" />
          <span>Brand Manifesto</span>
        </div>
        <h1 className="text-3xl sm:text-5xl font-extrabold text-slate-950 font-[var(--brand-font-heading)] tracking-tight">
          {narrative.headline}
        </h1>
        <p className="text-sm sm:text-base text-slate-600 max-w-xl mx-auto font-mono">
          Official Manifesto & Standards of {storeName}
        </p>
      </div>

      {/* Editorial Body */}
      <div className="prose prose-slate max-w-none space-y-8 text-slate-800 leading-relaxed text-sm sm:text-base">
        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-slate-950 uppercase tracking-wide border-b border-slate-200 pb-2">
            1. {narrative.philosophyTitle}
          </h2>
          <p>{narrative.philosophyP1}</p>
          <p>{narrative.philosophyP2}</p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-slate-950 uppercase tracking-wide border-b border-slate-200 pb-2">
            2. Logistics SLA & Delivery Commitment
          </h2>
          <p>
            In partnership with reliable logistics networks, all orders placed with {storeName} adhere to strict dispatch standards:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 not-prose my-6">
            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Clock className="h-4 w-4 text-[var(--brand-primary)]" />
                <span>Inside Dhaka Metro</span>
              </div>
              <p className="text-xs text-slate-600">
                24 to 48 Hours express home delivery. Inspect parcel on arrival with full Cash on Delivery supported.
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
                <Truck className="h-4 w-4 text-[var(--brand-primary)]" />
                <span>Nationwide Districts & Thanas</span>
              </div>
              <p className="text-xs text-slate-600">
                48 to 72 Hours guaranteed courier dispatch across all 64 districts and 500+ thanas in Bangladesh.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl sm:text-2xl font-black text-slate-950 uppercase tracking-wide border-b border-slate-200 pb-2">
            3. Customer Concierge & Inquiries
          </h2>
          <div className="not-prose p-6 rounded-3xl bg-slate-900 text-white space-y-4">
            <div className="text-sm font-bold uppercase tracking-wider text-amber-400">
              {storeName} Concierge Desk
            </div>
            <div className="text-xs text-slate-300 space-y-1 font-mono">
              <div>Customer Hotline: {store.contact_phone || '+880 1700-000000'}</div>
              <div>Official Inquiries: {store.contact_email || `support@${host}`}</div>
              {store.description && <div className="pt-2 text-slate-400">{store.description}</div>}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
