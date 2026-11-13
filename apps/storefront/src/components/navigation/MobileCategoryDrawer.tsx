'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ArrowRight, Sparkles, ChevronRight, X, Flame } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { PublicCategory } from '../../types/catalog';

interface DepartmentDefinition {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  badge?: string;
  subcategories: {
    name: string;
    slug: string;
    imageUrl: string;
    silhouette: string;
  }[];
}

const DEFAULT_STREETWEAR_DEPARTMENTS: DepartmentDefinition[] = [
  {
    id: 'dept-upper',
    name: 'UPPER WEAR',
    slug: 'upper-wear',
    tagline: 'Heavyweight tees, drop-shoulder hoodies & knits',
    badge: 'Trending Drops',
    subcategories: [
      {
        name: 'Heavyweight Tees',
        slug: 'heavyweight-tees',
        imageUrl: 'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=300&auto=format&fit=crop&q=80',
        silhouette: '280 GSM Boxy',
      },
      {
        name: 'Graphic Hoodies',
        slug: 'graphic-hoodies',
        imageUrl: 'https://images.unsplash.com/photo-1556905055-8f358a7a47b2?w=300&auto=format&fit=crop&q=80',
        silhouette: 'Double-Faced Fleece',
      },
      {
        name: 'Boxy Drop-Shoulder',
        slug: 'boxy-tees',
        imageUrl: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=300&auto=format&fit=crop&q=80',
        silhouette: 'Relaxed Rib Neck',
      },
      {
        name: 'Oversized Shirts',
        slug: 'oversized-shirts',
        imageUrl: 'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=300&auto=format&fit=crop&q=80',
        silhouette: 'Camp Collar Cut',
      },
      {
        name: 'Knit Cardigans',
        slug: 'knitwear',
        imageUrl: 'https://images.unsplash.com/photo-1434389677669-e08b4cac3105?w=300&auto=format&fit=crop&q=80',
        silhouette: 'Textured Weave',
      },
      {
        name: 'Washed Crewnecks',
        slug: 'crewnecks',
        imageUrl: 'https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?w=300&auto=format&fit=crop&q=80',
        silhouette: 'Vintage Mineral Dye',
      },
    ],
  },
  {
    id: 'dept-bottom',
    name: 'BOTTOM WEAR',
    slug: 'bottom-wear',
    tagline: 'Baggy cargos, wide-leg denim & utility techwear',
    badge: 'Popular',
    subcategories: [
      {
        name: 'Baggy Cargos',
        slug: 'baggy-cargos',
        imageUrl: 'https://images.unsplash.com/photo-1624378439575-d8705ad7ae80?w=300&auto=format&fit=crop&q=80',
        silhouette: '6-Pocket Utility',
      },
      {
        name: 'Wide-Leg Denim',
        slug: 'wide-leg-denim',
        imageUrl: 'https://images.unsplash.com/photo-1541099649105-f69ad21f3246?w=300&auto=format&fit=crop&q=80',
        silhouette: 'Stacking Hem 14oz',
      },
      {
        name: 'Parachute Pants',
        slug: 'parachute-pants',
        imageUrl: 'https://images.unsplash.com/photo-1517445312882-bc9910d016b7?w=300&auto=format&fit=crop&q=80',
        silhouette: 'Cinch Bungee Hem',
      },
      {
        name: 'Techwear Joggers',
        slug: 'techwear-joggers',
        imageUrl: 'https://images.unsplash.com/photo-1552902865-b72c031ac5ea?w=300&auto=format&fit=crop&q=80',
        silhouette: 'Ripstop Weatherproof',
      },
      {
        name: 'Vintage Jorts',
        slug: 'shorts',
        imageUrl: 'https://images.unsplash.com/photo-1591195853828-11db59a44f6b?w=300&auto=format&fit=crop&q=80',
        silhouette: 'Below-Knee Raw Cut',
      },
    ],
  },
  {
    id: 'dept-winter',
    name: 'WINTER COMBOS & OUTERWEAR',
    slug: 'outerwear',
    tagline: 'Heavy puffers, varsity silhouettes & fleece',
    badge: 'Winter 2026',
    subcategories: [
      {
        name: 'Varsity Jackets',
        slug: 'varsity-jackets',
        imageUrl: 'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=300&auto=format&fit=crop&q=80',
        silhouette: 'Wool & Leather Contrast',
      },
      {
        name: 'Boxy Puffers',
        slug: 'puffer-jackets',
        imageUrl: 'https://images.unsplash.com/photo-1544022613-e87ca75a784a?w=300&auto=format&fit=crop&q=80',
        silhouette: '700-Fill Goose Down',
      },
      {
        name: 'Sherpa Fleece',
        slug: 'fleece',
        imageUrl: 'https://images.unsplash.com/photo-1578587018452-892bacefd3f2?w=300&auto=format&fit=crop&q=80',
        silhouette: 'Thermal High Pile',
      },
      {
        name: 'Tailored Blazers',
        slug: 'blazers',
        imageUrl: 'https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=300&auto=format&fit=crop&q=80',
        silhouette: 'Silk Lapel Structure',
      },
    ],
  },
  {
    id: 'dept-couture',
    name: 'COUTURE & OCCASION WEAR',
    slug: 'dresses',
    tagline: 'Mulberry silk gowns, chiffon drapes & festive edits',
    subcategories: [
      {
        name: 'Silk Gowns',
        slug: 'dresses',
        imageUrl: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=300&auto=format&fit=crop&q=80',
        silhouette: 'Mulberry Pure Silk',
      },
      {
        name: 'Chiffon Maxis',
        slug: 'chiffon-maxi',
        imageUrl: 'https://images.unsplash.com/photo-1515372039744-b8f02a3ae446?w=300&auto=format&fit=crop&q=80',
        silhouette: 'Flared Micro-Pleat',
      },
    ],
  },
  {
    id: 'dept-accessories',
    name: 'STREET ACCESSORIES & HEADWEAR',
    slug: 'accessories',
    tagline: 'Distressed caps, tactical slings & beanies',
    subcategories: [
      {
        name: 'Distressed Caps',
        slug: 'caps',
        imageUrl: 'https://images.unsplash.com/photo-1588850561407-ed78c282e89b?w=300&auto=format&fit=crop&q=80',
        silhouette: 'Washed Twill Fit',
      },
      {
        name: 'Chunky Beanies',
        slug: 'beanies',
        imageUrl: 'https://images.unsplash.com/photo-1576871337622-98d48d1cf531?w=300&auto=format&fit=crop&q=80',
        silhouette: 'Rib-Knit Fold',
      },
      {
        name: 'Crossbody Bags',
        slug: 'bags',
        imageUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=300&auto=format&fit=crop&q=80',
        silhouette: 'Cordura Tactical',
      },
    ],
  },
];

interface MobileCategoryDrawerProps {
  categories?: PublicCategory[];
}

export const MobileCategoryDrawer: React.FC<MobileCategoryDrawerProps> = ({ categories = [] }) => {
  const { isCategoryDrawerOpen, closeCategoryDrawer, toggleFitCheck } = useCart();
  const router = useRouter();

  if (!isCategoryDrawerOpen) return null;

  const handleSubcategoryClick = (slug: string) => {
    closeCategoryDrawer();
    router.push(`/catalog?category=${slug}`);
  };

  const handleDepartmentClick = (slug: string) => {
    closeCategoryDrawer();
    router.push(`/catalog?category=${slug}`);
  };

  return (
    <>
      {/* 1. Backdrop (Click-outside dismissal) */}
      <div
        onClick={closeCategoryDrawer}
        className="fixed inset-0 z-[99988] bg-slate-950/60 backdrop-blur-xs md:hidden animate-in fade-in duration-200"
        aria-hidden="true"
      />

      {/* 2. Sandwiched Category Menu Viewport Drawer */}
      <div
        role="dialog"
        aria-label="Mobile Category Drawer"
        className="fixed left-0 right-0 z-[99990] md:hidden bg-slate-950/96 backdrop-blur-2xl border-y border-white/10 shadow-2xl flex flex-col animate-category-drawer overflow-hidden"
        style={{
          top: 'var(--storefront-header-height, 64px)',
          bottom: '52px',
          height: 'calc(100dvh - var(--storefront-header-height, 64px) - 52px)',
          maxHeight: 'calc(100dvh - var(--storefront-header-height, 64px) - 52px)',
        }}
      >
        {/* Drawer Quick Control Bar */}
        <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between bg-slate-900/50 flex-shrink-0">
          <div className="flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping" />
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-slate-300">
              Department Silhouettes
            </span>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => {
                closeCategoryDrawer();
                toggleFitCheck();
              }}
              className="px-2.5 py-1 rounded-full bg-gradient-to-r from-violet-600/30 to-cyan-500/30 border border-cyan-400/40 text-[10.5px] font-bold text-cyan-300 flex items-center gap-1 active:scale-95 transition"
            >
              <Sparkles className="h-3 w-3 text-cyan-400" />
              <span>AI Fit</span>
            </button>

            <button
              onClick={closeCategoryDrawer}
              className="p-1 rounded-full text-slate-400 hover:text-white transition"
              aria-label="Close categories"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Quick Navigation Pills for Complete Storefront Access */}
        <div className="px-3 py-2 border-b border-white/10 flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-shrink-0 bg-slate-900/40">
          {[
            { label: 'All Drops', href: '/catalog' },
            { label: 'New In', href: '/catalog?collection=new' },
            { label: 'Featured', href: '/catalog?collection=featured' },
            { label: 'Streetwear Blog', href: '/blog' },
            { label: 'Track Order', href: '/orders/lookup' },
            { label: 'About Brand', href: '/about' },
          ].map((pill) => (
            <Link
              key={pill.label}
              href={pill.href}
              onClick={closeCategoryDrawer}
              className="text-[10px] font-medium tracking-wide text-slate-300 hover:text-cyan-300 bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1 rounded-full whitespace-nowrap transition active:scale-95 flex-shrink-0"
            >
              {pill.label}
            </Link>
          ))}
        </div>

        {/* Scrollable Departments Canvas with Invisible Native Scrolling */}
        <div className="flex-1 overflow-y-auto no-scrollbar py-3 space-y-5">
          {/* Dynamic Store Categories from Merchant Catalog */}
          {categories && categories.length > 0 && (
            <div className="space-y-2">
              <div className="px-4 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <h3 className="text-xs font-black uppercase tracking-widest text-slate-200 flex items-center gap-1.5">
                    <span>STORE COLLECTIONS</span>
                  </h3>
                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-500/30">
                    Live
                  </span>
                </div>
                <Link
                  href="/catalog"
                  onClick={closeCategoryDrawer}
                  className="text-[10.5px] font-bold text-cyan-400 hover:text-cyan-300 transition flex items-center gap-0.5"
                >
                  <span>All</span>
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-1">
                {categories.map((cat) => (
                  <button
                    key={cat.id || cat.slug}
                    type="button"
                    onClick={() => handleSubcategoryClick(cat.slug)}
                    className="flex flex-col items-center flex-shrink-0 group focus:outline-none"
                    style={{ width: '82px' }}
                  >
                    <div className="w-[82px] h-[82px] rounded-xl overflow-hidden border border-white/15 bg-slate-900 group-active:scale-95 transition-transform duration-150 relative shadow-md flex items-center justify-center">
                      {cat.image_url ? (
                        <img
                          src={cat.image_url}
                          alt={cat.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900 text-cyan-400 font-black text-xl">
                          {cat.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />
                      <span className="absolute bottom-1 right-1 text-[8.5px] font-mono text-cyan-300/90 font-bold px-1 rounded bg-black/60 pointer-events-none">
                        Drop
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-200 group-hover:text-cyan-300 text-center leading-tight mt-1.5 line-clamp-2 transition-colors">
                      {cat.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {DEFAULT_STREETWEAR_DEPARTMENTS.map((dept) => (
            <div key={dept.id} className="space-y-2">
              {/* Department Header (Parent Category) */}
              <div className="px-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center space-x-2">
                    <h3
                      onClick={() => handleDepartmentClick(dept.slug)}
                      className="text-xs font-black uppercase tracking-widest text-slate-200 hover:text-cyan-400 transition cursor-pointer flex items-center gap-1.5"
                    >
                      <span>{dept.name}</span>
                      <ChevronRight className="h-3 w-3 text-slate-500" />
                    </h3>
                    {dept.badge && (
                      <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full bg-cyan-950/80 text-cyan-400 border border-cyan-500/30">
                        {dept.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-slate-400 font-medium line-clamp-1">{dept.tagline}</p>
                </div>

                <button
                  type="button"
                  onClick={() => handleDepartmentClick(dept.slug)}
                  className="text-[10.5px] font-bold text-cyan-400 hover:text-cyan-300 transition flex items-center gap-0.5 flex-shrink-0"
                >
                  <span>All</span>
                  <ArrowRight className="h-3 w-3" />
                </button>
              </div>

              {/* Subcategory Carousel Cards (Children) */}
              <div className="flex gap-3 overflow-x-auto no-scrollbar px-4 pb-1">
                {dept.subcategories.map((sub) => (
                  <button
                    key={sub.slug}
                    type="button"
                    onClick={() => handleSubcategoryClick(sub.slug)}
                    className="flex flex-col items-center flex-shrink-0 group focus:outline-none"
                    style={{ width: '82px' }}
                  >
                    {/* 1:1 Square Photographic Thumbnail */}
                    <div className="w-[82px] h-[82px] rounded-xl overflow-hidden border border-white/15 bg-slate-900 group-active:scale-95 transition-transform duration-150 relative shadow-md">
                      <img
                        src={sub.imageUrl}
                        alt={sub.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        loading="lazy"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />
                      <span className="absolute bottom-1 right-1 text-[8.5px] font-mono text-cyan-300/90 font-bold px-1 rounded bg-black/60 pointer-events-none">
                        Drop
                      </span>
                    </div>

                    {/* Two-Line Text Label & Silhouette Badge */}
                    <span className="text-[11px] font-bold text-slate-200 group-hover:text-cyan-300 text-center leading-tight mt-1.5 line-clamp-2 transition-colors">
                      {sub.name}
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono text-center leading-none mt-0.5 truncate max-w-[80px]">
                      {sub.silhouette}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* Quick Footer inside Drawer */}
          <div className="px-4 pt-2 pb-4">
            <Link
              href="/catalog"
              onClick={closeCategoryDrawer}
              className="w-full py-3 bg-gradient-to-r from-slate-900 to-slate-800 hover:from-slate-800 hover:to-slate-700 border border-white/10 rounded-xl flex items-center justify-center space-x-2 text-xs font-bold text-slate-200 shadow-md active:scale-98 transition"
            >
              <Flame className="h-4 w-4 text-amber-400" />
              <span>Browse Full Streetwear Catalog (All Drops)</span>
            </Link>
          </div>
        </div>
      </div>
    </>
  );
};
