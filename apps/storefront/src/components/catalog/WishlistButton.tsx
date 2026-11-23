'use client';

import React, { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';
import { WishlistItem, isInWishlist, toggleWishlistItem } from '../../lib/wishlist';

interface WishlistButtonProps {
  item: WishlistItem;
  className?: string;
  iconClassName?: string;
  ariaLabel?: string;
}

export const WishlistButton: React.FC<WishlistButtonProps> = ({
  item,
  className = '',
  iconClassName = 'h-4 w-4',
  ariaLabel = 'Save to wishlist',
}) => {
  const [isSaved, setIsSaved] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setIsSaved(isInWishlist(item.id || item.slug));

    const handleUpdate = () => {
      setIsSaved(isInWishlist(item.id || item.slug));
    };

    window.addEventListener('ecom_wishlist_updated', handleUpdate);
    return () => {
      window.removeEventListener('ecom_wishlist_updated', handleUpdate);
    };
  }, [item.id, item.slug]);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const active = toggleWishlistItem(item);
    setIsSaved(active);
  };

  if (!mounted) {
    return (
      <button
        type="button"
        className={`p-2 rounded-full transition-all duration-200 ${className}`}
        aria-label={ariaLabel}
      >
        <Heart className={`${iconClassName} text-slate-400`} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className={`p-2 rounded-full transition-all duration-200 ${className} ${
        isSaved
          ? 'bg-rose-50 text-rose-600 shadow-sm'
          : 'bg-white/80 backdrop-blur-xs text-slate-600 hover:text-rose-600 hover:bg-white shadow-xs'
      }`}
      aria-label={isSaved ? 'Remove from wishlist' : ariaLabel}
      title={isSaved ? 'Saved to Wishlist' : 'Save to Wishlist'}
    >
      <Heart
        className={`${iconClassName} transition-colors ${
          isSaved ? 'fill-rose-600 text-rose-600' : 'text-slate-600 group-hover:text-rose-600'
        }`}
      />
    </button>
  );
};
