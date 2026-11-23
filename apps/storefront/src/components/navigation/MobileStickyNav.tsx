'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, LayoutGrid, ShoppingBag, User, Music, Volume2 } from 'lucide-react';
import { useCart } from '../../context/CartContext';

export const MobileStickyNav: React.FC = () => {
  const pathname = usePathname();
  const { cart, isDrawerOpen, isCategoryDrawerOpen, toggleDrawer, toggleCategoryDrawer } = useCart();

  // Floating Music Player State
  const [isPlayingMusic, setIsPlayingMusic] = useState(false);
  const [showMusicButton, setShowMusicButton] = useState(false);

  // Defer music button rendering slightly on load to avoid mobile network contention
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowMusicButton(true);
    }, 2000); // 2-second deferral
    return () => clearTimeout(timer);
  }, []);

  // Checkout isolation: completely unmount bottom nav on checkout
  if (pathname.startsWith('/checkout')) {
    return null;
  }

  const isHomeActive = pathname === '/' && !isCategoryDrawerOpen && !isDrawerOpen;
  const isCategoryActive = isCategoryDrawerOpen || (pathname.startsWith('/catalog') && !isDrawerOpen);
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

  const handleMusicToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsPlayingMusic((prev) => !prev);
  };

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-[99999] bg-[var(--t-surface)]/95 backdrop-blur-xl border-t border-[var(--t-line)] shadow-[0_-4px_24px_rgba(0,0,0,0.25)] select-none transition-colors"
      aria-label="Mobile Bottom Navigation"
      style={{
        backgroundColor: 'var(--t-surface)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        height: 'calc(60px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="grid grid-cols-5 h-full items-center max-w-lg mx-auto px-1 relative">
        {/* 1. Home */}
        <Link
          href="/"
          className={`flex flex-col items-center justify-center h-full transition-colors active:scale-95 ${
            isHomeActive ? 'text-[var(--brand-secondary)] font-bold' : 'text-[var(--t-muted)] hover:text-[var(--t-text)]'
          }`}
          aria-label="Storefront Home"
        >
          <Home className={`h-5 w-5 ${isHomeActive ? 'text-[var(--brand-secondary)]' : ''}`} />
          <span className="text-[10px] tracking-tight mt-1 font-medium leading-none">Home</span>
        </Link>

        {/* 2. Category */}
        <button
          type="button"
          onClick={handleCategoryTouch}
          className={`flex flex-col items-center justify-center h-full transition-colors active:scale-95 ${
            isCategoryActive ? 'text-[var(--brand-secondary)] font-bold' : 'text-[var(--t-muted)] hover:text-[var(--t-text)]'
          }`}
          aria-label="Open Category Menu"
          aria-expanded={isCategoryDrawerOpen}
        >
          <LayoutGrid className={`h-5 w-5 ${isCategoryActive ? 'text-[var(--brand-secondary)]' : ''}`} />
          <span className="text-[10px] tracking-tight mt-1 font-medium leading-none">Category</span>
        </button>

        {/* 3. Floating Music Controller (Elevated Center Button) */}
        <div className="flex items-center justify-center h-full relative">
          {showMusicButton && (
            <button
              type="button"
              onClick={handleMusicToggle}
              className={`-top-3.5 absolute h-11 w-11 rounded-full shadow-lg flex items-center justify-center transition-all active:scale-90 border-2 ${
                isPlayingMusic
                  ? 'bg-[var(--brand-secondary)] text-[var(--t-on-secondary)] border-white animate-pulse'
                  : 'bg-[var(--brand-primary)] text-white border-[var(--brand-secondary)]'
              }`}
              aria-label="Toggle Storefront Soundtrack"
              title="Storefront Ambient Radio"
            >
              {isPlayingMusic ? <Volume2 className="h-5 w-5" /> : <Music className="h-5 w-5" />}
            </button>
          )}
        </div>

        {/* 4. Cart (Shopping Bag) */}
        <button
          type="button"
          onClick={handleCartTouch}
          className={`relative flex flex-col items-center justify-center h-full transition-colors active:scale-95 ${
            isCartActive ? 'text-[var(--brand-secondary)] font-bold' : 'text-[var(--t-muted)] hover:text-[var(--t-text)]'
          }`}
          aria-label="View Shopping Cart"
          aria-expanded={isDrawerOpen}
        >
          <div className="relative">
            <ShoppingBag className={`h-5 w-5 ${isCartActive ? 'text-[var(--brand-secondary)]' : ''}`} />
            {cart && cart.item_count > 0 && (
              <span className="absolute -top-1.5 -right-2 h-4 min-w-[16px] px-1 rounded-full bg-[var(--brand-secondary)] text-[var(--t-on-secondary)] text-[9.5px] font-black flex items-center justify-center shadow-xs">
                {cart.item_count}
              </span>
            )}
          </div>
          <span className="text-[10px] tracking-tight mt-1 font-medium leading-none">Cart</span>
        </button>

        {/* 5. Profile / Order Tracking */}
        <Link
          href="/orders/lookup"
          className={`flex flex-col items-center justify-center h-full transition-colors active:scale-95 ${
            isAccountActive ? 'text-[var(--brand-secondary)] font-bold' : 'text-[var(--t-muted)] hover:text-[var(--t-text)]'
          }`}
          aria-label="Customer Account & Order Lookup"
        >
          <User className={`h-5 w-5 ${isAccountActive ? 'text-[var(--brand-secondary)]' : ''}`} />
          <span className="text-[10px] tracking-tight mt-1 font-medium leading-none">Profile</span>
        </Link>
      </div>
    </nav>
  );
};
