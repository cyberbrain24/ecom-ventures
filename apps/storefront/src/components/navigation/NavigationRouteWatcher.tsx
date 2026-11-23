'use client';

import { useEffect } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCart } from '../../context/CartContext';

/**
 * NavigationRouteWatcher ensures any open drawer (Category Drawer or Cart Drawer)
 * is automatically dismissed upon page transitions.
 */
export const NavigationRouteWatcher: React.FC = () => {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { closeAllDrawers } = useCart();

  useEffect(() => {
    closeAllDrawers();
  }, [pathname, searchParams]);

  return null;
};

