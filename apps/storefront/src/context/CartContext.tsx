'use client';

import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { Cart } from '../types/cart';

interface CartContextType {
  cart: Cart | null;
  isLoading: boolean;
  isDrawerOpen: boolean;
  isCategoryDrawerOpen: boolean;
  isFitCheckOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  toggleDrawer: () => void;
  openCategoryDrawer: () => void;
  closeCategoryDrawer: () => void;
  toggleCategoryDrawer: () => void;
  openFitCheck: () => void;
  closeFitCheck: () => void;
  toggleFitCheck: () => void;
  closeAllDrawers: () => void;
  addItem: (variantId: string, quantity: number) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [cart, setCart] = useState<Cart | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isCategoryDrawerOpen, setIsCategoryDrawerOpen] = useState(false);
  const [isFitCheckOpen, setIsFitCheckOpen] = useState(false);
  const updateDebounceTimers = useRef<Record<string, NodeJS.Timeout>>({});

  // Mutual Exclusivity Helpers
  const openDrawer = () => {
    setIsCategoryDrawerOpen(false);
    setIsFitCheckOpen(false);
    setIsDrawerOpen(true);
  };

  const closeDrawer = () => {
    setIsDrawerOpen(false);
  };

  const toggleDrawer = () => {
    if (isDrawerOpen) {
      setIsDrawerOpen(false);
    } else {
      setIsCategoryDrawerOpen(false);
      setIsFitCheckOpen(false);
      setIsDrawerOpen(true);
    }
  };

  const openCategoryDrawer = () => {
    setIsDrawerOpen(false);
    setIsFitCheckOpen(false);
    setIsCategoryDrawerOpen(true);
  };

  const closeCategoryDrawer = () => {
    setIsCategoryDrawerOpen(false);
  };

  const toggleCategoryDrawer = () => {
    if (isCategoryDrawerOpen) {
      setIsCategoryDrawerOpen(false);
    } else {
      setIsDrawerOpen(false);
      setIsFitCheckOpen(false);
      setIsCategoryDrawerOpen(true);
    }
  };

  const openFitCheck = () => {
    setIsCategoryDrawerOpen(false);
    setIsDrawerOpen(false);
    setIsFitCheckOpen(true);
  };

  const closeFitCheck = () => {
    setIsFitCheckOpen(false);
  };

  const toggleFitCheck = () => {
    if (isFitCheckOpen) {
      setIsFitCheckOpen(false);
    } else {
      setIsCategoryDrawerOpen(false);
      setIsDrawerOpen(false);
      setIsFitCheckOpen(true);
    }
  };

  const closeAllDrawers = () => {
    setIsDrawerOpen(false);
    setIsCategoryDrawerOpen(false);
    setIsFitCheckOpen(false);
  };

  // Event Bus Synchronization: Listen for decoupled DOM events
  useEffect(() => {
    const handleToggleMenu = () => toggleCategoryDrawer();
    const handleOpenCategory = () => openCategoryDrawer();
    const handleCloseCategory = () => closeCategoryDrawer();
    const handleOpenCart = () => openDrawer();
    const handleCloseCart = () => closeDrawer();
    const handleToggleFit = () => toggleFitCheck();
    const handleCloseAll = () => closeAllDrawers();

    window.addEventListener('toggle-mobile-menu', handleToggleMenu);
    window.addEventListener('toggle-category-menu', handleToggleMenu);
    window.addEventListener('open-category-menu', handleOpenCategory);
    window.addEventListener('close-category-menu', handleCloseCategory);
    window.addEventListener('open-cart-drawer', handleOpenCart);
    window.addEventListener('close-cart-drawer', handleCloseCart);
    window.addEventListener('toggle-fit-check', handleToggleFit);
    window.addEventListener('close-all-drawers', handleCloseAll);

    return () => {
      window.removeEventListener('toggle-mobile-menu', handleToggleMenu);
      window.removeEventListener('toggle-category-menu', handleToggleMenu);
      window.removeEventListener('open-category-menu', handleOpenCategory);
      window.removeEventListener('close-category-menu', handleCloseCategory);
      window.removeEventListener('open-cart-drawer', handleOpenCart);
      window.removeEventListener('close-cart-drawer', handleCloseCart);
      window.removeEventListener('toggle-fit-check', handleToggleFit);
      window.removeEventListener('close-all-drawers', handleCloseAll);
    };
  }, [isDrawerOpen, isCategoryDrawerOpen, isFitCheckOpen]);

  // Get or persist unique cart session identifier
  const getSessionId = (): string => {
    if (typeof window === 'undefined') return '';
    let sess = localStorage.getItem('ecom_cart_session');
    if (!sess) {
      sess = 'sess_' + Math.random().toString(36).substring(2, 15) + Date.now().toString(36);
      localStorage.setItem('ecom_cart_session', sess);
    }
    return sess;
  };

  const fetchCart = async () => {
    const sessionId = getSessionId();
    if (!sessionId) return;
    try {
      const res = await fetch(`${API_BASE_URL}/storefront/cart`, {
        headers: { 'X-Cart-Session': sessionId },
      });
      if (res.ok) {
        const payload = await res.json();
        const data = payload?.data !== undefined ? payload.data : payload;
        setCart(data);
      }
    } catch (err) {
      console.error('Failed to load cart', err);
    }
  };

  useEffect(() => {
    fetchCart();
  }, []);

  const addItem = async (variantId: string, quantity: number) => {
    setIsLoading(true);
    const sessionId = getSessionId();
    try {
      const res = await fetch(`${API_BASE_URL}/storefront/cart/items`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Cart-Session': sessionId,
        },
        body: JSON.stringify({ variant_id: variantId, quantity }),
      });
      if (res.ok) {
        const payload = await res.json();
        const data = payload?.data !== undefined ? payload.data : payload;
        setCart(data);
        setIsDrawerOpen(true); // Open drawer on addition
      } else {
        const errData = await res.json().catch(() => ({}));
        alert(errData.detail || errData.message || 'Could not add item to cart.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    // 1. Instant optimistic UI feedback
    setCart((prev) => {
      if (!prev) return prev;
      if (quantity <= 0) {
        const nextItems = prev.items.filter((item) => item.id !== itemId);
        const subtotal = nextItems.reduce((acc, it) => acc + it.total_price, 0);
        const itemCount = nextItems.reduce((acc, it) => acc + it.quantity, 0);
        return { ...prev, items: nextItems, subtotal, item_count: itemCount };
      }
      const nextItems = prev.items.map((item) => {
        if (item.id === itemId) {
          const newTotal = item.unit_price * quantity;
          return { ...item, quantity, total_price: newTotal };
        }
        return item;
      });
      const subtotal = nextItems.reduce((acc, it) => acc + it.total_price, 0);
      const itemCount = nextItems.reduce((acc, it) => acc + it.quantity, 0);
      return { ...prev, items: nextItems, subtotal, item_count: itemCount };
    });

    // 2. Debounce backend sync by 300ms to eliminate network race conditions
    if (updateDebounceTimers.current[itemId]) {
      clearTimeout(updateDebounceTimers.current[itemId]);
    }

    updateDebounceTimers.current[itemId] = setTimeout(async () => {
      const sessionId = getSessionId();
      try {
        const res = await fetch(`${API_BASE_URL}/storefront/cart/items/${itemId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Cart-Session': sessionId,
          },
          body: JSON.stringify({ quantity }),
        });
        if (res.ok) {
          const payload = await res.json();
          const data = payload?.data !== undefined ? payload.data : payload;
          setCart(data);
        }
      } catch (err) {
        console.error('Failed to update cart quantity', err);
      }
    }, 300);
  };

  const removeItem = async (itemId: string) => {
    if (updateDebounceTimers.current[itemId]) {
      clearTimeout(updateDebounceTimers.current[itemId]);
    }
    // Optimistic item removal
    setCart((prev) => {
      if (!prev) return prev;
      const nextItems = prev.items.filter((item) => item.id !== itemId);
      const subtotal = nextItems.reduce((acc, it) => acc + it.total_price, 0);
      const itemCount = nextItems.reduce((acc, it) => acc + it.quantity, 0);
      return { ...prev, items: nextItems, subtotal, item_count: itemCount };
    });

    const sessionId = getSessionId();
    try {
      const res = await fetch(`${API_BASE_URL}/storefront/cart/items/${itemId}`, {
        method: 'DELETE',
        headers: { 'X-Cart-Session': sessionId },
      });
      if (res.ok) {
        const payload = await res.json();
        const data = payload?.data !== undefined ? payload.data : payload;
        setCart(data);
      }
    } catch (err) {
      console.error('Failed to delete cart item', err);
    }
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        isLoading,
        isDrawerOpen,
        isCategoryDrawerOpen,
        isFitCheckOpen,
        openDrawer,
        closeDrawer,
        toggleDrawer,
        openCategoryDrawer,
        closeCategoryDrawer,
        toggleCategoryDrawer,
        openFitCheck,
        closeFitCheck,
        toggleFitCheck,
        closeAllDrawers,
        addItem,
        updateQuantity,
        removeItem,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
