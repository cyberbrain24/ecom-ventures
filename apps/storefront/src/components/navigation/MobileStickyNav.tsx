'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid, Sparkles, ShoppingBag, User } from 'lucide-react';
import { useCart } from '../../context/CartContext';

export const MobileStickyNav: React.FC = () => {
  const pathname = usePathname();
  const {
    cart,
    isDrawerOpen,
    isCategoryDrawerOpen,
    isFitCheckOpen,
    toggleDrawer,
    toggleCategoryDrawer,
    toggleFitCheck,
  } = useCart();

  const isHomeActive = pathname === '/' && !isCategoryDrawerOpen && !isDrawerOpen && !isFitCheckOpen;
  const isCategoryActive = isCategoryDrawerOpen || (pathname.startsWith('/catalog') && !isDrawerOpen && !isFitCheckOpen);
  const isCartActive = isDrawerOpen;
  const isAccountActive = (pathname.startsWith('/orders') || pathname.startsWith('/track')) && !isDrawerOpen && !isCategoryDrawerOpen;

  const handleCategoryTouch = (e: React.MouseEvent) => {
    e.preventDefault();
    toggleCategoryDrawer();
  };

  const handleCartTouch = (e: React.MouseEvent) => {
    e.preventDefault();
    toggleDrawer();
  };

  const handleFitCheckTouch = (e: React.MouseEvent) => {
    e.preventDefault();
    toggleFitCheck();
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-[99999] h-[52px] bg-slate-950/94 backdrop-blur-xl border-t border-white/10 shadow-[0_-4px_24px_rgba(0,0,0,0.45)] select-none"
      aria-label="Mobile Bottom Navigation"
    >
      <div className="grid grid-cols-5 h-full items-center max-w-lg mx-auto px-1">
        {/* 1. Home */}
        <Link
          href="/"
          className={`flex flex-col items-center justify-center h-full transition-colors active:scale-95 ${
            isHomeActive ? 'text-white font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
          aria-label="Storefront Home"
        >
          <Home className={`h-5 w-5 ${isHomeActive ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]' : ''}`} />
          <span className="text-[9.5px] tracking-tight mt-0.5 font-medium leading-none">Home</span>
        </Link>

        {/* 2. Category (Touch Intercepted) */}
        <button
          type="button"
          onClick={handleCategoryTouch}
          className={`flex flex-col items-center justify-center h-full transition-colors active:scale-95 ${
            isCategoryActive ? 'text-white font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
          aria-label="Open Category Menu"
          aria-expanded={isCategoryDrawerOpen}
        >
          <LayoutGrid className={`h-5 w-5 ${isCategoryActive ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]' : ''}`} />
          <span className="text-[9.5px] tracking-tight mt-0.5 font-medium leading-none">Category</span>
        </button>

        {/* 3. AI Fit Check (The Centerpiece: 48px Floating Hero Orb) */}
        <div className="flex flex-col items-center justify-center relative">
          <button
            type="button"
            onClick={handleFitCheckTouch}
            className="w-12 h-12 rounded-full -translate-y-3.5 bg-gradient-to-tr from-violet-600 via-indigo-500 to-cyan-400 text-white flex items-center justify-center shadow-[0_0_20px_rgba(99,102,241,0.6)] fit-check-orb border-2 border-slate-950 active:scale-90 transition-transform focus:outline-none"
            aria-label="AI Fit Check Assistant"
            title="Launch AI Fit Check"
          >
            <Sparkles className="h-5 w-5 text-white animate-pulse" />
          </button>
          <span className="text-[9px] font-extrabold tracking-tight text-cyan-300 -translate-y-2 leading-none uppercase">
            Fit Check
          </span>
        </div>

        {/* 4. Cart (Real-Time Badge) */}
        <button
          type="button"
          onClick={handleCartTouch}
          className={`relative flex flex-col items-center justify-center h-full transition-colors active:scale-95 ${
            isCartActive ? 'text-white font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
          aria-label="View Shopping Cart"
          aria-expanded={isDrawerOpen}
        >
          <div className="relative">
            <ShoppingBag className={`h-5 w-5 ${isCartActive ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]' : ''}`} />
            {cart && cart.item_count > 0 && (
              <span className="absolute -top-1.5 -right-2 h-4 min-w-[16px] px-1 rounded-full bg-gradient-to-r from-emerald-400 to-teal-400 text-slate-950 text-[9.5px] font-black flex items-center justify-center shadow-xs animate-in zoom-in-75">
                {cart.item_count}
              </span>
            )}
          </div>
          <span className="text-[9.5px] tracking-tight mt-0.5 font-medium leading-none">Cart</span>
        </button>

        {/* 5. Account / Order Lookup */}
        <Link
          href="/orders/lookup"
          className={`flex flex-col items-center justify-center h-full transition-colors active:scale-95 ${
            isAccountActive ? 'text-white font-bold' : 'text-slate-400 hover:text-slate-200'
          }`}
          aria-label="Customer Account & Order Lookup"
        >
          <User className={`h-5 w-5 ${isAccountActive ? 'text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.6)]' : ''}`} />
          <span className="text-[9.5px] tracking-tight mt-0.5 font-medium leading-none">Account</span>
        </Link>
      </div>
    </nav>
  );
};

