import React from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { ThemeHero as ThemeHeroStyle } from '../../lib/theme';

interface ThemeHeroProps {
  /** Hero style from the resolved theme. Chooses the markup; the copy and link are the same for every style. */
  hero: ThemeHeroStyle;
  storeName: string;
  /** A real product image from the store's catalogue, used when present. No sample product is ever shown. */
  imageUrl?: string;
}

/** Shared call to action that links to the catalogue. Colours come from the theme tokens. */
const ShopLink: React.FC<{ className?: string }> = ({ className = '' }) => (
  <Link href="/catalog" className={`sf-cta ${className}`}>
    <span>Shop All Products</span>
    <ArrowRight className="h-4 w-4" aria-hidden="true" />
  </Link>
);

/** Image area for a hero. Renders a quiet gradient panel when the catalogue has no image yet. */
const HeroMedia: React.FC<{ imageUrl?: string; className: string; sizes: string }> = ({ imageUrl, className, sizes }) => (
  <div className={`relative overflow-hidden ${className}`}>
    {imageUrl ? (
      <Image src={imageUrl} alt="" fill sizes={sizes} priority className="object-cover object-center" />
    ) : (
      <div className="sf-hero-fallback absolute inset-0" aria-hidden="true" />
    )}
  </div>
);

/**
 * Home page hero. It renders one of four markups: editorial split layout, bold streetwear with oversized
 * type and a diagonal slab, soft minimal with a centred gradient, or luxe showcase with a spotlight and
 * gold hairlines. The copy and the catalogue link are identical in every style.
 */
export const ThemeHero: React.FC<ThemeHeroProps> = ({ hero, storeName, imageUrl }) => {
  const lede = `Browse the current range of products available from ${storeName}.`;

  if (hero === 'bold-streetwear') {
    return (
      <section className="sf-hero sf-hero--bold-streetwear relative overflow-hidden bg-white" aria-labelledby="hero-title">
        {/* Subtle Architectural Grid Background Overlay */}
        <div className="sf-street-grid absolute inset-0 pointer-events-none opacity-40 -z-0" aria-hidden="true" />

        <div className="sf-container relative z-10 py-8 sm:py-12 lg:py-16">
          {/* Top Micro Technical Header Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-black/10 pb-3 mb-6 sm:mb-8 font-mono text-[10px] sm:text-xs text-neutral-600 uppercase tracking-widest">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="font-bold text-black">// SYSTEM: ACTIVE DROP</span>
              <span className="hidden sm:inline text-neutral-300">•</span>
              <span className="hidden sm:inline">DHAKA ARCHIVE [23.81° N, 90.41° E]</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 bg-black text-white font-bold text-[9px] tracking-widest">
                CAPSULE S26
              </span>
              <span className="text-neutral-500 hidden md:inline">240+ GSM HEAVYWEIGHT</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Content Column */}
            <div className="lg:col-span-7 space-y-6">
              <div className="space-y-2">
                <span className="inline-block px-2.5 py-1 bg-black text-white font-mono text-[10px] uppercase tracking-widest font-extrabold">
                  // WORLDWIDE STREETWEAR CULTURE
                </span>
                <h1
                  id="hero-title"
                  className="sf-hero-title sf-hero-title--xxl font-black tracking-tight text-black select-none"
                >
                  {storeName}
                </h1>
              </div>

              {/* Aesthetic Small-Text Specs Slab */}
              <div className="sf-hero-slab border-2 border-black bg-white p-5 sm:p-7 shadow-[6px_6px_0px_#000000] space-y-4">
                <div className="flex items-center justify-between border-b border-black/10 pb-2.5 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                  <span>SPECIFICATION SHEET</span>
                  <span className="font-bold text-black">OFFICIAL MERCHANDISE</span>
                </div>

                <p className="sf-hero-lede font-medium text-xs sm:text-sm text-neutral-700 leading-relaxed">
                  Engineered heavyweight streetwear crafted for contemporary subcontinental fits. Drop shoulders, double-needle ribbing, and structural cut-and-sew architecture.
                </p>

                {/* Small Text Grid Details */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1 font-mono text-[10px]">
                  <div className="p-2 bg-neutral-50 border border-neutral-200 rounded-none">
                    <span className="text-neutral-400 block text-[9px] uppercase">Fabric</span>
                    <strong className="text-black font-bold">240+ GSM Terry</strong>
                  </div>
                  <div className="p-2 bg-neutral-50 border border-neutral-200 rounded-none">
                    <span className="text-neutral-400 block text-[9px] uppercase">Silhouette</span>
                    <strong className="text-black font-bold">Boxy / Oversized</strong>
                  </div>
                  <div className="p-2 bg-neutral-50 border border-neutral-200 rounded-none col-span-2 sm:col-span-1">
                    <span className="text-neutral-400 block text-[9px] uppercase">Fulfillment</span>
                    <strong className="text-black font-bold">24-48H Express</strong>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex flex-wrap items-center gap-3">
                  <ShopLink />
                  <Link
                    href="/catalog"
                    className="sf-cta-outline min-h-[44px] px-5 py-2.5 border-2 border-black bg-white text-black font-mono font-bold text-xs uppercase tracking-wider inline-flex items-center justify-center transition-all hover:bg-black hover:text-white hover:shadow-[3px_3px_0px_#000000]"
                  >
                    View All Drops →
                  </Link>
                </div>
              </div>

              {/* Micro Live Stats Bar */}
              <div className="flex items-center gap-6 pt-1 font-mono text-[11px] text-neutral-600">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-black">4.9 ★</span>
                  <span className="text-neutral-400">Verified Fit</span>
                </div>
                <span className="text-neutral-300">•</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-black">100%</span>
                  <span className="text-neutral-400">Cotton Terry</span>
                </div>
                <span className="text-neutral-300">•</span>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-black">COD</span>
                  <span className="text-neutral-400">Available</span>
                </div>
              </div>
            </div>

            {/* Right Column: Creative Lookbook Art Block */}
            <div className="lg:col-span-5">
              <div className="relative border-2 border-black bg-white p-3 shadow-[8px_8px_0px_#000000] space-y-3">
                <div className="flex items-center justify-between font-mono text-[10px] uppercase text-neutral-500 pb-1 border-b border-black/10">
                  <span className="font-bold text-black">FIG 01 // LOOKBOOK HERO</span>
                  <span>[ S26 CAPSULE ]</span>
                </div>

                <div className="relative aspect-[4/5] w-full overflow-hidden bg-neutral-100 border border-black/15">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={storeName}
                      fill
                      sizes="(max-width: 1024px) 100vw, 450px"
                      priority
                      className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center font-mono text-xs text-neutral-400">
                      [ NO MEDIA ]
                    </div>
                  )}

                  <div className="absolute top-2.5 left-2.5 bg-black text-white text-[9px] font-mono font-bold px-2 py-0.5 uppercase tracking-widest">
                    DROP STATUS: LIVE
                  </div>
                  <div className="absolute bottom-2.5 right-2.5 bg-white/90 backdrop-blur-xs border border-black text-black text-[9px] font-mono font-bold px-2 py-0.5 uppercase tracking-widest shadow-xs">
                    HEAVYWEIGHT TERRY
                  </div>
                </div>

                <div className="flex items-center justify-between font-mono text-[10px] text-neutral-600 pt-1">
                  <span>DHAKA STREET CULTURE</span>
                  <Link href="/catalog" className="font-bold text-black hover:underline uppercase">
                    Browse Lookbook ↗
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (hero === 'soft-minimal') {
    return (
      <section className="sf-hero sf-hero--soft-minimal" aria-labelledby="hero-title">
        <div className="sf-container flex flex-col items-center text-center space-y-6">
          <p className="sf-eyebrow">Welcome to</p>
          <h1 id="hero-title" className="sf-hero-title max-w-2xl">
            {storeName}
          </h1>
          <p className="sf-hero-lede max-w-xl">{lede}</p>
          <ShopLink />
          {imageUrl && (
            <HeroMedia
              imageUrl={imageUrl}
              className="sf-hero-soft-media mt-6 w-full max-w-sm aspect-[4/5]"
              sizes="(max-width: 640px) 90vw, 384px"
            />
          )}
        </div>
      </section>
    );
  }

  if (hero === 'luxe-showcase') {
    return (
      <section className="sf-hero sf-hero--luxe-showcase relative overflow-hidden" aria-labelledby="hero-title">
        <div className="sf-spotlight absolute inset-0" aria-hidden="true" />
        <div className="sf-container relative z-10 flex flex-col items-center text-center space-y-6">
          <span className="sf-hairline block w-24" aria-hidden="true" />
          <p className="sf-eyebrow">Welcome to</p>
          <h1 id="hero-title" className="sf-hero-title max-w-3xl">
            {storeName}
          </h1>
          <span className="sf-hairline block w-24" aria-hidden="true" />
          <p className="sf-hero-lede max-w-xl">{lede}</p>
          <ShopLink />
          {imageUrl && (
            <HeroMedia
              imageUrl={imageUrl}
              className="sf-frame mt-8 w-full max-w-sm aspect-[4/5]"
              sizes="(max-width: 640px) 90vw, 384px"
            />
          )}
        </div>
      </section>
    );
  }

  if (hero === 'tech-matrix') {
    return (
      <section className="sf-hero sf-hero--tech-matrix relative overflow-hidden" aria-labelledby="hero-title">
        {/* Futuristic circuit grid background */}
        <div className="sf-circuit-grid absolute inset-0 pointer-events-none opacity-25" aria-hidden="true" />
        <div className="sf-cyber-glow absolute -top-24 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-cyan-500/15 blur-[120px] pointer-events-none rounded-full" aria-hidden="true" />

        <div className="sf-container relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12 items-center py-12 sm:py-16">
          <div className="md:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-50 border border-cyan-200 text-cyan-700 font-mono text-xs font-semibold tracking-wider uppercase">
              <span className="h-2 w-2 rounded-full bg-cyan-500 animate-ping" />
              <span>NEXT-GEN GEAR & ELECTRONICS</span>
            </div>

            <h1 id="hero-title" className="sf-hero-title font-extrabold text-3xl sm:text-5xl lg:text-6xl tracking-tight text-slate-900">
              Elevate Your Setup with <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-600 to-blue-600">{storeName}</span>
            </h1>

            <p className="sf-hero-lede max-w-xl text-slate-600 text-sm sm:text-base leading-relaxed">
              Curated premium tech, smart audio, workspace accessories, and high-performance electronics with verified warranty and express delivery across Bangladesh.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <ShopLink className="sf-cta-tech px-6 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-lg transition shadow-lg shadow-cyan-500/20" />
              <Link
                href="/catalog?category=accessories"
                className="px-5 py-3 rounded-lg border border-slate-300 hover:border-cyan-500 text-slate-700 hover:text-cyan-700 font-semibold text-xs tracking-wider uppercase transition bg-white"
              >
                View Best Sellers
              </Link>
            </div>

            {/* Quick Tech Specs / USPs */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-200 max-w-md">
              <div>
                <div className="text-base sm:text-lg font-mono font-bold text-cyan-700">100%</div>
                <div className="text-[11px] text-slate-500 uppercase font-mono">Authentic</div>
              </div>
              <div>
                <div className="text-base sm:text-lg font-mono font-bold text-cyan-700">Official</div>
                <div className="text-[11px] text-slate-500 uppercase font-mono">Warranty</div>
              </div>
              <div>
                <div className="text-base sm:text-lg font-mono font-bold text-cyan-700">24-48h</div>
                <div className="text-[11px] text-slate-500 uppercase font-mono">Fast Delivery</div>
              </div>
            </div>
          </div>

          <div className="md:col-span-5 flex justify-center">
            {imageUrl ? (
              <HeroMedia
                imageUrl={imageUrl}
                className="sf-gadget-hero-media relative w-full max-w-md aspect-square rounded-2xl overflow-hidden border border-cyan-500/30 shadow-2xl shadow-cyan-950/60"
                sizes="(max-width: 768px) 90vw, 450px"
              />
            ) : (
              <div className="w-full max-w-md aspect-square rounded-2xl bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-900 border border-slate-700/60 flex items-center justify-center p-8 text-center shadow-xl">
                <div className="space-y-3">
                  <div className="h-16 w-16 mx-auto rounded-2xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 flex items-center justify-center font-mono font-bold text-xl">
                    ⚡
                  </div>
                  <h3 className="font-bold text-white text-lg font-mono">{storeName}</h3>
                  <p className="text-xs text-slate-400">Browse modern gadgets and smart accessories.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (hero === 'sensual-couture') {
    return (
      <section className="sf-hero sf-hero--sensual-couture relative overflow-hidden" aria-labelledby="hero-title">
        {/* Soft champagne & rose silk backlight */}
        <div className="sf-silk-glow absolute inset-0 pointer-events-none opacity-60" aria-hidden="true" />

        <div className="sf-container relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-14 items-center py-12 sm:py-20">
          <div className="md:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#fce7ef] border border-[#f43f5e]/20 text-[#881337] font-sans text-xs font-bold tracking-widest uppercase">
              <span>✦</span>
              <span>HAUTE INTIMATES & BODY SCULPT</span>
            </div>

            <h1 id="hero-title" className="sf-hero-title font-serif text-3xl sm:text-5xl lg:text-6xl tracking-tight text-[#4a0e2e] leading-[1.1]">
              The Art of Underwear <br className="hidden sm:inline" />
              <span className="italic font-normal text-[#9f1239]">Refined for You</span>
            </h1>

            <p className="sf-hero-lede max-w-lg text-[#65203f] text-sm sm:text-base leading-relaxed">
              Explore luxury innerwear fashion blending delicate French lace, featherlight second-skin microfiber, and sculpting contour silhouettes designed for effortless all-day confidence.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <ShopLink className="sf-cta-couture px-7 py-3.5 bg-[#4a0e2e] hover:bg-[#34071f] text-white font-medium rounded-full transition shadow-lg shadow-[#4a0e2e]/20" />
              <Link
                href="/catalog?category=lingerie"
                className="px-6 py-3.5 rounded-full border border-[#be123c]/30 hover:border-[#4a0e2e] text-[#4a0e2e] hover:bg-[#ffe4e6]/50 font-medium text-xs tracking-wider uppercase transition"
              >
                Explore Lingerie Sets
              </Link>
            </div>

            <div className="pt-4 flex items-center gap-6 border-t border-[#f43f5e]/15 text-xs text-[#881337] font-medium">
              <span className="flex items-center gap-1.5">
                <span className="text-[#be123c]">✓</span> Certified Hypoallergenic
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-[#be123c]">✓</span> 100% Discreet Delivery
              </span>
              <span className="flex items-center gap-1.5">
                <span className="text-[#be123c]">✓</span> Accurate BD Size Chart
              </span>
            </div>
          </div>

          <div className="md:col-span-6 flex justify-center">
            {imageUrl ? (
              <HeroMedia
                imageUrl={imageUrl}
                className="sf-couture-hero-media relative w-full max-w-md aspect-[4/5] rounded-[2rem] overflow-hidden border border-[#f43f5e]/20 shadow-2xl shadow-[#881337]/10"
                sizes="(max-width: 768px) 90vw, 480px"
              />
            ) : (
              <div className="w-full max-w-md aspect-[4/5] rounded-[2rem] bg-gradient-to-tr from-[#ffe4e6] via-[#fdf2f8] to-[#fff1f2] border border-[#f43f5e]/20 flex items-center justify-center p-8 text-center shadow-xl">
                <div className="space-y-4">
                  <div className="h-16 w-16 mx-auto rounded-full bg-white text-[#9f1239] shadow-md flex items-center justify-center font-serif text-2xl font-bold">
                    ❦
                  </div>
                  <h3 className="font-serif font-bold text-[#4a0e2e] text-2xl tracking-wide">{storeName}</h3>
                  <p className="text-xs text-[#881337] max-w-xs leading-relaxed">
                    Sensual inner fashion, sculpted silhouettes, and luxury lingerie sets.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (hero === 'royal-heritage') {
    return (
      <section className="sf-hero sf-hero--royal-heritage relative overflow-hidden" aria-labelledby="hero-title">
        {/* Subtle royal ornamental background glow */}
        <div className="sf-heritage-glow absolute inset-0 pointer-events-none opacity-40" aria-hidden="true" />

        <div className="sf-container relative z-10 grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-14 items-center py-12 sm:py-20">
          <div className="md:col-span-7 space-y-6">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#fdf6e7] border border-[#c59b27]/30 text-[#855e10] font-serif text-xs font-semibold tracking-widest uppercase">
              <span className="text-[#c59b27]">⚜</span>
              <span>HERITAGE WEAVES & BRIDAL COUTURE</span>
            </div>

            <h1 id="hero-title" className="sf-hero-title font-serif text-3xl sm:text-5xl lg:text-6xl tracking-tight text-[#6b1124] leading-[1.12]">
              Timeless Traditions <br className="hidden sm:inline" />
              <span className="italic font-normal text-[#c59b27]">Woven in Elegance</span>
            </h1>

            <p className="sf-hero-lede max-w-xl text-[#4a2830] text-sm sm:text-base leading-relaxed">
              Celebrate timeless grace with authentic handloom sarees, intricately embellished lehengas, bespoke shalwar kameez, and heirloom Jamdani silk crafted by master artisans across Bengal.
            </p>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <ShopLink className="sf-cta-heritage px-7 py-3.5 bg-[#6b1124] hover:bg-[#520919] text-[#faf7f2] font-medium rounded-md transition shadow-lg shadow-[#6b1124]/25" />
              <Link
                href="/catalog?category=sarees"
                className="px-6 py-3.5 rounded-md border border-[#c59b27]/50 hover:border-[#6b1124] text-[#6b1124] hover:bg-[#fdf6e7]/60 font-medium text-xs tracking-wider uppercase transition"
              >
                Explore Saree Collections
              </Link>
            </div>

            {/* Heritage Artisanship Highlights */}
            <div className="grid grid-cols-3 gap-3 pt-5 border-t border-[#c59b27]/20 max-w-lg">
              <div>
                <div className="text-base sm:text-lg font-serif font-bold text-[#6b1124]">Authentic</div>
                <div className="text-[11px] text-[#8a7378] uppercase">Handloom Weaves</div>
              </div>
              <div>
                <div className="text-base sm:text-lg font-serif font-bold text-[#6b1124]">Pure Zari</div>
                <div className="text-[11px] text-[#8a7378] uppercase">Metallic Threads</div>
              </div>
              <div>
                <div className="text-base sm:text-lg font-serif font-bold text-[#6b1124]">Bespoke</div>
                <div className="text-[11px] text-[#8a7378] uppercase">Festive Custom Tailoring</div>
              </div>
            </div>
          </div>

          <div className="md:col-span-5 flex justify-center">
            {imageUrl ? (
              <HeroMedia
                imageUrl={imageUrl}
                className="sf-heritage-hero-media relative w-full max-w-md aspect-[4/5] rounded-xl overflow-hidden border-2 border-[#c59b27]/40 shadow-2xl shadow-[#6b1124]/15"
                sizes="(max-width: 768px) 90vw, 450px"
              />
            ) : (
              <div className="w-full max-w-md aspect-[4/5] rounded-xl bg-gradient-to-tr from-[#fbf4e6] via-[#faf7f2] to-[#f4ebe1] border-2 border-[#c59b27]/40 flex items-center justify-center p-8 text-center shadow-xl">
                <div className="space-y-4">
                  <div className="h-16 w-16 mx-auto rounded-full bg-[#6b1124] text-[#c59b27] shadow-lg flex items-center justify-center font-serif text-2xl font-bold border-2 border-[#c59b27]">
                    ⚜
                  </div>
                  <h3 className="font-serif font-bold text-[#6b1124] text-2xl tracking-wide">{storeName}</h3>
                  <p className="text-xs text-[#8a7378] max-w-xs leading-relaxed">
                    Exclusive handloom sarees, festive lehengas, and heritage traditional wear.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  // Editorial: split layout with a thin rule and an image-led panel.
  return (
    <section className="sf-hero sf-hero--editorial" aria-labelledby="hero-title">
      <div className="sf-container grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center">
        <div className="md:col-span-6 space-y-6">
          <p className="sf-eyebrow">The Collection</p>
          <span className="sf-rule block" aria-hidden="true" />
          <h1 id="hero-title" className="sf-hero-title">
            Welcome to <em className="not-italic sf-hero-em">{storeName}</em>
          </h1>
          <p className="sf-hero-lede max-w-md">{lede}</p>
          <ShopLink />
        </div>
        <HeroMedia
          imageUrl={imageUrl}
          className="md:col-span-6 sf-hero-media aspect-[4/5] md:aspect-[5/6]"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
      </div>
    </section>
  );
};
