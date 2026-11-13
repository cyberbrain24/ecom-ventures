import React, { useState, Suspense, lazy } from 'react';
import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingBag,
  Users,
  Tag,
  Truck,
  CreditCard,
  BarChart3,
  Settings,
  ExternalLink,
  Store,
  ChevronRight,
  Database,
  Palette,
  Menu,
  X,
  DollarSign,
  FileText
} from 'lucide-react';

import {
  StoreTab,
  StoreBrand,
  StoreProduct,
  StoreOrder,
  StoreCustomer,
  StoreCoupon,
  BundleTier,
  InventoryMovement,
  CourierConfig,
  PaymentGatewayConfig,
  MarketingConfig,
  StoreSettings,
  OrderStatus,
  StoreCategory,
  StoreAttribute,
  ProductBrand,
  CareInstruction,
  PaymentTransaction,
  ShipmentRecord,
  ThemeCustomizerConfig,
  AccountTransactionRecord,
  StoreExpenseRecord,
  StorePayoutRecord,
  PaymentReconciliationItem,
  StoreReview,
  StoreBlogPost,
  StoreBlogCategory
} from './types/store';

import {
  PILOT_STORES,
  INITIAL_PRODUCTS,
  INITIAL_ORDERS,
  INITIAL_CUSTOMERS,
  INITIAL_COUPONS,
  INITIAL_BUNDLE_TIERS,
  INITIAL_MOVEMENTS,
  INITIAL_COURIERS,
  INITIAL_PAYMENTS,
  INITIAL_MARKETING,
  INITIAL_SETTINGS,
  INITIAL_CATEGORIES,
  INITIAL_ATTRIBUTES,
  INITIAL_PRODUCT_BRANDS,
  INITIAL_CARE_INSTRUCTIONS,
  INITIAL_TRANSACTIONS,
  INITIAL_SHIPMENTS,
  INITIAL_THEMES,
  INITIAL_ACCOUNT_TRANSACTIONS,
  INITIAL_EXPENSES,
  INITIAL_PAYOUTS,
  INITIAL_RECONCILIATION,
  INITIAL_REVIEWS,
  INITIAL_BLOG_POSTS,
  INITIAL_BLOG_CATEGORIES
} from './data/initialData';

// Code-split dynamic view imports
const DashboardView = lazy(() => import('./components/DashboardView').then((m) => ({ default: m.DashboardView })));
const CatalogView = lazy(() => import('./components/CatalogView').then((m) => ({ default: m.CatalogView })));
const InventoryView = lazy(() => import('./components/InventoryView').then((m) => ({ default: m.InventoryView })));
const OrdersView = lazy(() => import('./components/OrdersView').then((m) => ({ default: m.OrdersView })));
const CustomersView = lazy(() => import('./components/CustomersView').then((m) => ({ default: m.CustomersView })));
const PromotionsView = lazy(() => import('./components/PromotionsView').then((m) => ({ default: m.PromotionsView })));
const BlogView = lazy(() => import('./components/BlogView').then((m) => ({ default: m.BlogView })));
const LogisticsView = lazy(() => import('./components/LogisticsView').then((m) => ({ default: m.LogisticsView })));
const PaymentsView = lazy(() => import('./components/PaymentsView').then((m) => ({ default: m.PaymentsView })));
const AccountsView = lazy(() => import('./components/AccountsView').then((m) => ({ default: m.AccountsView })));
const MarketingView = lazy(() => import('./components/MarketingView').then((m) => ({ default: m.MarketingView })));
const ThemeView = lazy(() => import('./components/ThemeView').then((m) => ({ default: m.ThemeView })));
const SettingsView = lazy(() => import('./components/SettingsView').then((m) => ({ default: m.SettingsView })));

const ViewSkeleton: React.FC = () => (
  <div style={{ padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
    <div style={{ height: '32px', width: '220px', background: '#e2e8f0', borderRadius: '8px' }} />
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
      <div style={{ height: '96px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
      <div style={{ height: '96px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
      <div style={{ height: '96px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
    </div>
    <div style={{ height: '420px', background: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }} />
  </div>
);

export const App: React.FC = () => {
  const [activeBrandSlug, setActiveBrandSlug] = useState<string>('mior');
  const [activeTab, setActiveTab] = useState<StoreTab>('dashboard');

  // Multi-brand reactive datasets
  const [productsByStore, setProductsByStore] = useState<Record<string, StoreProduct[]>>(INITIAL_PRODUCTS);
  const [categoriesByStore, setCategoriesByStore] = useState<Record<string, StoreCategory[]>>(INITIAL_CATEGORIES);
  const [attributesByStore, setAttributesByStore] = useState<Record<string, StoreAttribute[]>>(INITIAL_ATTRIBUTES);
  const [brandsByStore, setBrandsByStore] = useState<Record<string, ProductBrand[]>>(INITIAL_PRODUCT_BRANDS);
  const [careInstructionsByStore, setCareInstructionsByStore] = useState<Record<string, CareInstruction[]>>(INITIAL_CARE_INSTRUCTIONS);
  const [ordersByStore, setOrdersByStore] = useState<Record<string, StoreOrder[]>>(INITIAL_ORDERS);
  const [customersByStore, setCustomersByStore] = useState<Record<string, StoreCustomer[]>>(INITIAL_CUSTOMERS);
  const [couponsByStore, setCouponsByStore] = useState<Record<string, StoreCoupon[]>>(INITIAL_COUPONS);
  const [bundleTiersByStore, setBundleTiersByStore] = useState<Record<string, BundleTier[]>>(INITIAL_BUNDLE_TIERS);
  const [movementsByStore, setMovementsByStore] = useState<Record<string, InventoryMovement[]>>(INITIAL_MOVEMENTS);
  const [couriersByStore, setCouriersByStore] = useState<Record<string, CourierConfig[]>>(INITIAL_COURIERS);
  const [shipmentsByStore, setShipmentsByStore] = useState<Record<string, ShipmentRecord[]>>(INITIAL_SHIPMENTS);
  const [paymentsByStore, setPaymentsByStore] = useState<Record<string, PaymentGatewayConfig[]>>(INITIAL_PAYMENTS);
  const [transactionsByStore, setTransactionsByStore] = useState<Record<string, PaymentTransaction[]>>(INITIAL_TRANSACTIONS);
  const [accountTransactionsByStore, setAccountTransactionsByStore] = useState<Record<string, AccountTransactionRecord[]>>(INITIAL_ACCOUNT_TRANSACTIONS);
  const [expensesByStore, setExpensesByStore] = useState<Record<string, StoreExpenseRecord[]>>(INITIAL_EXPENSES);
  const [payoutsByStore, setPayoutsByStore] = useState<Record<string, StorePayoutRecord[]>>(INITIAL_PAYOUTS);
  const [reconciliationByStore, setReconciliationByStore] = useState<Record<string, PaymentReconciliationItem[]>>(INITIAL_RECONCILIATION);
  const [marketingByStore, setMarketingByStore] = useState<Record<string, MarketingConfig>>(INITIAL_MARKETING);
  const [themesByStore, setThemesByStore] = useState<Record<string, ThemeCustomizerConfig>>(INITIAL_THEMES);
  const [settingsByStore, setSettingsByStore] = useState<Record<string, StoreSettings>>(INITIAL_SETTINGS);
  const [reviewsByStore, setReviewsByStore] = useState<Record<string, StoreReview[]>>(INITIAL_REVIEWS);
  const [blogPostsByStore, setBlogPostsByStore] = useState<Record<string, StoreBlogPost[]>>(INITIAL_BLOG_POSTS);
  const [blogCategoriesByStore, setBlogCategoriesByStore] = useState<Record<string, StoreBlogCategory[]>>(INITIAL_BLOG_CATEGORIES);

  const currentStore = PILOT_STORES.find((s) => s.slug === activeBrandSlug) || PILOT_STORES[0];

  // Scoped datasets for current store
  const currentProducts = productsByStore[activeBrandSlug] || [];
  const currentCategories = categoriesByStore[activeBrandSlug] || INITIAL_CATEGORIES.mior;
  const currentAttributes = attributesByStore[activeBrandSlug] || INITIAL_ATTRIBUTES.mior;
  const currentBrands = brandsByStore[activeBrandSlug] || INITIAL_PRODUCT_BRANDS.mior || [];
  const currentCareInstructions = careInstructionsByStore[activeBrandSlug] || INITIAL_CARE_INSTRUCTIONS.mior || [];
  const currentOrders = ordersByStore[activeBrandSlug] || [];
  const currentCustomers = customersByStore[activeBrandSlug] || [];
  const currentReviews = reviewsByStore[activeBrandSlug] || [];
  const currentCoupons = couponsByStore[activeBrandSlug] || [];
  const currentBundleTiers = bundleTiersByStore[activeBrandSlug] || [];
  const currentBlogPosts = blogPostsByStore[activeBrandSlug] || [];
  const currentBlogCategories = blogCategoriesByStore[activeBrandSlug] || [];
  const currentMovements = movementsByStore[activeBrandSlug] || [];
  const currentCouriers = couriersByStore[activeBrandSlug] || INITIAL_COURIERS.mior;
  const currentShipments = shipmentsByStore[activeBrandSlug] || INITIAL_SHIPMENTS.mior;
  const currentPayments = paymentsByStore[activeBrandSlug] || INITIAL_PAYMENTS.mior;
  const currentTransactions = transactionsByStore[activeBrandSlug] || INITIAL_TRANSACTIONS.mior;
  const currentAccountTransactions = accountTransactionsByStore[activeBrandSlug] || INITIAL_ACCOUNT_TRANSACTIONS.mior || [];
  const currentExpenses = expensesByStore[activeBrandSlug] || INITIAL_EXPENSES.mior || [];
  const currentPayouts = payoutsByStore[activeBrandSlug] || INITIAL_PAYOUTS.mior || [];
  const currentReconciliations = reconciliationByStore[activeBrandSlug] || INITIAL_RECONCILIATION.mior || [];
  const currentMarketing = marketingByStore[activeBrandSlug] || INITIAL_MARKETING.mior;
  const currentTheme = themesByStore[activeBrandSlug] || INITIAL_THEMES.mior;
  const currentSettings = settingsByStore[activeBrandSlug] || INITIAL_SETTINGS.mior;

  // Actions
  const handleAddProduct = (newProduct: StoreProduct) => {
    setProductsByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: [newProduct, ...(prev[activeBrandSlug] || [])],
    }));
  };

  const handleUpdateProduct = (updatedProduct: StoreProduct) => {
    setProductsByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).map((p) =>
        p.id === updatedProduct.id ? updatedProduct : p
      ),
    }));
  };

  const handleDeleteProduct = (productId: string) => {
    setProductsByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).filter((p) => p.id !== productId),
    }));
  };

  const handleAddCategory = (newCategory: StoreCategory) => {
    setCategoriesByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: [...(prev[activeBrandSlug] || []), newCategory],
    }));
  };

  const handleUpdateCategory = (updatedCategory: StoreCategory) => {
    setCategoriesByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).map((c) =>
        c.id === updatedCategory.id ? updatedCategory : c
      ),
    }));
  };

  const handleDeleteCategory = (categoryId: string) => {
    setCategoriesByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).filter((c) => c.id !== categoryId),
    }));
  };

  const handleAddAttribute = (newAttribute: StoreAttribute) => {
    setAttributesByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: [...(prev[activeBrandSlug] || []), newAttribute],
    }));
  };

  const handleUpdateAttribute = (updatedAttribute: StoreAttribute) => {
    setAttributesByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).map((a) =>
        a.id === updatedAttribute.id ? updatedAttribute : a
      ),
    }));
  };

  const handleDeleteAttribute = (attributeId: string) => {
    setAttributesByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).filter((a) => a.id !== attributeId),
    }));
  };

  const handleAddBrand = (newBrand: ProductBrand) => {
    setBrandsByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: [...(prev[activeBrandSlug] || []), newBrand],
    }));
  };

  const handleUpdateBrand = (updatedBrand: ProductBrand) => {
    setBrandsByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).map((b) =>
        b.id === updatedBrand.id ? updatedBrand : b
      ),
    }));
  };

  const handleDeleteBrand = (brandId: string) => {
    setBrandsByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).filter((b) => b.id !== brandId),
    }));
  };

  const handleAddCareInstruction = (newCare: CareInstruction) => {
    setCareInstructionsByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: [...(prev[activeBrandSlug] || []), newCare],
    }));
  };

  const handleUpdateCareInstruction = (updatedCare: CareInstruction) => {
    setCareInstructionsByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).map((c) =>
        c.id === updatedCare.id ? updatedCare : c
      ),
    }));
  };

  const handleDeleteCareInstruction = (careId: string) => {
    setCareInstructionsByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).filter((c) => c.id !== careId),
    }));
  };

  const handleAdjustStock = (productId: string, delta: number, reason: string) => {
    const prod = currentProducts.find((p) => p.id === productId);
    if (!prod) return;

    const newBalance = Math.max(0, prod.inventoryCount + delta);
    setProductsByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).map((p) =>
        p.id === productId ? { ...p, inventoryCount: newBalance } : p
      ),
    }));

    const newMovement: InventoryMovement = {
      id: `mov-${Date.now()}`,
      productId,
      productTitle: prod.title,
      sku: prod.sku,
      change: delta,
      balance: newBalance,
      reason: reason as any,
      timestamp: new Date().toLocaleString(),
    };

    setMovementsByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: [newMovement, ...(prev[activeBrandSlug] || [])],
    }));
  };

  const handleUpdateOrderStatus = (
    orderId: string,
    newStatus: OrderStatus,
    courier?: 'Steadfast' | 'Pathao' | 'RedX',
    tracking?: string,
    consignmentId?: string
  ) => {
    setOrdersByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).map((o) => {
        if (o.id !== orderId) return o;
        return {
          ...o,
          status: newStatus,
          courierName: courier || o.courierName,
          trackingNumber: tracking || o.trackingNumber,
          consignmentId: consignmentId || o.consignmentId,
        };
      }),
    }));

    if (newStatus === 'SHIPPED' && courier && tracking) {
      const order = currentOrders.find((o) => o.id === orderId);
      if (order) {
        const newShipment: ShipmentRecord = {
          id: `shp-${Date.now()}`,
          orderNumber: order.orderNumber,
          carrier: courier,
          trackingNumber: tracking,
          recipientName: order.customerName,
          recipientCity: order.city,
          status: 'IN_TRANSIT',
          shippedAt: new Date().toISOString().split('T')[0],
          estimatedDelivery: new Date(Date.now() + 86400000).toISOString().split('T')[0],
        };
        setShipmentsByStore((prev) => ({
          ...prev,
          [activeBrandSlug]: [newShipment, ...(prev[activeBrandSlug] || [])],
        }));
      }
    }
  };

  const handleCreateOrder = (newOrder: StoreOrder) => {
    setOrdersByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: [newOrder, ...(prev[activeBrandSlug] || [])],
    }));
  };

  const handleUpdateOrder = (updatedOrder: StoreOrder) => {
    setOrdersByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).map((o) =>
        o.id === updatedOrder.id ? updatedOrder : o
      ),
    }));
  };

  const handleDeleteOrder = (orderId: string) => {
    setOrdersByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).filter((o) => o.id !== orderId),
    }));
  };

  const handleAddCallNote = (orderId: string, noteText: string) => {
    setOrdersByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).map((o) => {
        if (o.id !== orderId) return o;
        const newNote = {
          id: `cn-${Date.now()}`,
          staffName: 'Store Staff',
          note: noteText,
          createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
        };
        return {
          ...o,
          callNotes: [...(o.callNotes || []), newNote],
        };
      }),
    }));
  };

  const handleAddCoupon = (newCoupon: StoreCoupon) => {
    setCouponsByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: [newCoupon, ...(prev[activeBrandSlug] || [])],
    }));
  };

  const handleUpdateCoupon = (updatedCoupon: StoreCoupon) => {
    setCouponsByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).map((c) =>
        c.id === updatedCoupon.id ? updatedCoupon : c
      ),
    }));
  };

  const handleDeleteCoupon = (couponId: string) => {
    setCouponsByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).filter((c) => c.id !== couponId),
    }));
  };

  const handleToggleCoupon = (couponId: string) => {
    setCouponsByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).map((c) =>
        c.id === couponId ? { ...c, isActive: !c.isActive } : c
      ),
    }));
  };

  const handleAddBundleTier = (newTier: BundleTier) => {
    setBundleTiersByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: [...(prev[activeBrandSlug] || []), newTier],
    }));
  };

  const handleUpdateBundleTier = (updatedTier: BundleTier) => {
    setBundleTiersByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).map((t) =>
        t.id === updatedTier.id ? updatedTier : t
      ),
    }));
  };

  const handleDeleteBundleTier = (tierId: string) => {
    setBundleTiersByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).filter((t) => t.id !== tierId),
    }));
  };

  const handleToggleBundleTier = (tierId: string) => {
    setBundleTiersByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).map((t) =>
        t.id === tierId ? { ...t, isActive: !t.isActive } : t
      ),
    }));
  };

  const handleAddCustomer = (newCustomer: StoreCustomer) => {
    setCustomersByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: [newCustomer, ...(prev[activeBrandSlug] || [])],
    }));
  };

  const handleUpdateCustomer = (updatedCustomer: StoreCustomer) => {
    setCustomersByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).map((c) =>
        c.id === updatedCustomer.id ? updatedCustomer : c
      ),
    }));
  };

  const handleDeleteCustomer = (customerId: string) => {
    setCustomersByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).filter((c) => c.id !== customerId),
    }));
  };

  const handleAddReview = (newReview: StoreReview) => {
    setReviewsByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: [newReview, ...(prev[activeBrandSlug] || [])],
    }));
  };

  const handleUpdateReview = (updatedReview: StoreReview) => {
    setReviewsByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).map((r) =>
        r.id === updatedReview.id ? updatedReview : r
      ),
    }));
  };

  const handleDeleteReview = (reviewId: string) => {
    setReviewsByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).filter((r) => r.id !== reviewId),
    }));
  };

  const handleToggleCourier = (provider: string) => {
    setCouriersByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).map((c) =>
        c.provider === provider ? { ...c, isActive: !c.isActive } : c
      ),
    }));
  };

  const handleToggleGateway = (gatewayId: string) => {
    setPaymentsByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).map((g) =>
        g.id === gatewayId ? { ...g, isEnabled: !g.isEnabled } : g
      ),
    }));
  };

  const handleSaveMarketing = (cfg: MarketingConfig) => {
    setMarketingByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: cfg,
    }));
  };

  const handleSaveTheme = (th: ThemeCustomizerConfig) => {
    setThemesByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: th,
    }));
  };

  const handleSaveSettings = (st: StoreSettings) => {
    setSettingsByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: st,
    }));
  };

  const handleAddExpense = (newExp: StoreExpenseRecord) => {
    setExpensesByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: [newExp, ...(prev[activeBrandSlug] || [])],
    }));
  };

  const handleDeleteExpense = (expId: string) => {
    setExpensesByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).filter((e) => e.id !== expId),
    }));
  };

  const handleAddBlogPost = (newPost: StoreBlogPost) => {
    setBlogPostsByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: [newPost, ...(prev[activeBrandSlug] || [])],
    }));
  };

  const handleUpdateBlogPost = (updatedPost: StoreBlogPost) => {
    setBlogPostsByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).map((p) =>
        p.id === updatedPost.id ? updatedPost : p
      ),
    }));
  };

  const handleDeleteBlogPost = (postId: string) => {
    setBlogPostsByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).filter((p) => p.id !== postId),
    }));
  };

  const handleAddBlogCategory = (newCategory: StoreBlogCategory) => {
    setBlogCategoriesByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: [...(prev[activeBrandSlug] || []), newCategory],
    }));
  };

  const handleUpdateBlogCategory = (updatedCategory: StoreBlogCategory) => {
    setBlogCategoriesByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).map((c) =>
        c.id === updatedCategory.id ? updatedCategory : c
      ),
    }));
  };

  const handleDeleteBlogCategory = (categoryId: string) => {
    setBlogCategoriesByStore((prev) => ({
      ...prev,
      [activeBrandSlug]: (prev[activeBrandSlug] || []).filter((c) => c.id !== categoryId),
    }));
  };

  // Badges calculation
  const pendingOrdersCount = currentOrders.filter(
    (o) => o.status === 'PENDING' || o.status === 'CONFIRMED'
  ).length;
  const lowStockCount = currentProducts.filter((p) => p.inventoryCount < 10).length;
  const discrepanciesCount = currentReconciliations.filter((r) => !r.reconciled).length;

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleTabSelect = (tab: StoreTab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <div className="app-container">
      {/* Mobile Top Navigation Bar (< 1024px Viewports) */}
      <header className="mobile-header-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="mobile-hamburger-btn"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="brand-icon-box" style={{ width: '28px', height: '28px', fontSize: '0.82rem' }}>
              {currentStore.name.substring(0, 1)}
            </div>
            <div style={{ lineHeight: 1.15 }}>
              <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#ffffff', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentStore.name}
              </div>
              <div style={{ fontSize: '0.66rem', color: '#10b981', fontWeight: 600 }}>ACTIVE STORE</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={activeBrandSlug}
            onChange={(e) => setActiveBrandSlug(e.target.value)}
            className="mobile-store-select"
          >
            {PILOT_STORES.map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </select>
          <a
            href={`http://localhost:3002?brand=${currentStore.slug}`}
            target="_blank"
            rel="noreferrer"
            className="mobile-storefront-btn"
            title="Open Live Storefront"
          >
            <ExternalLink size={16} />
          </a>
        </div>
      </header>

      {/* Mobile Backdrop Overlay */}
      {mobileMenuOpen && (
        <div
          onClick={() => setMobileMenuOpen(false)}
          className="mobile-sidebar-backdrop"
          aria-hidden="true"
        />
      )}

      {/* Left Sidebar / Off-Canvas Drawer */}
      <aside className={`sidebar ${mobileMenuOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-brand-section">
          <div style={{ display: 'flex', alignItems: 'center', justifySelf: 'stretch', justifyContent: 'space-between' }}>
            <div className="brand-badge">
              <div className="brand-icon-box">{currentStore.name.substring(0, 1)}</div>
              <div>
                <div className="brand-title">{currentStore.name}</div>
                <div className="brand-subtitle">
                  <Store size={12} /> Store Workspace
                </div>
              </div>
            </div>

            {/* Mobile Close Button */}
            <button
              onClick={() => setMobileMenuOpen(false)}
              className="mobile-sidebar-close-btn"
              aria-label="Close navigation"
            >
              <X size={18} />
            </button>
          </div>

          {/* Pilot Brand Context Switcher */}
          <select
            value={activeBrandSlug}
            onChange={(e) => setActiveBrandSlug(e.target.value)}
            className="brand-selector-dropdown"
          >
            {PILOT_STORES.map((s) => (
              <option key={s.slug} value={s.slug}>
                Store: {s.name} ({s.slug})
              </option>
            ))}
          </select>

          {/* Compact Storefront Action Link */}
          <a
            href={`http://localhost:3002?brand=${currentStore.slug}`}
            target="_blank"
            rel="noreferrer"
            style={{
              marginTop: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: '7px 12px',
              backgroundColor: '#131b2e',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              borderRadius: 'var(--radius-sm)',
              color: '#38bdf8',
              fontSize: '0.78rem',
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'all 0.15s ease',
            }}
          >
            <span>View Live Storefront</span>
            <ExternalLink size={13} />
          </a>
        </div>

        {/* Navigation Sections */}
        <nav className="sidebar-nav">
          <div className="nav-section-title">Overview</div>
          <button
            onClick={() => handleTabSelect('dashboard')}
            className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
          >
            <div className="nav-item-inner">
              <LayoutDashboard size={14} />
              <span>Dashboard</span>
            </div>
          </button>

          <div className="nav-section-title">Store Catalog</div>
          <button
            onClick={() => handleTabSelect('catalog')}
            className={`nav-item ${activeTab === 'catalog' ? 'active' : ''}`}
          >
            <div className="nav-item-inner">
              <Package size={14} />
              <span>Products & Matrix</span>
            </div>
            <span className="nav-pill">{currentProducts.length}</span>
          </button>

          <button
            onClick={() => handleTabSelect('inventory')}
            className={`nav-item ${activeTab === 'inventory' ? 'active' : ''}`}
          >
            <div className="nav-item-inner">
              <Boxes size={14} />
              <span>Inventory & Stocks</span>
            </div>
            {lowStockCount > 0 && (
              <span className="nav-pill" style={{ background: '#7f1d1d', color: '#fca5a5' }}>
                {lowStockCount} low
              </span>
            )}
          </button>

          <div className="nav-section-title">Sales & Orders</div>
          <button
            onClick={() => handleTabSelect('orders')}
            className={`nav-item ${activeTab === 'orders' ? 'active' : ''}`}
          >
            <div className="nav-item-inner">
              <ShoppingBag size={14} />
              <span>Orders & Pipeline</span>
            </div>
            {pendingOrdersCount > 0 && <span className="nav-pill">{pendingOrdersCount}</span>}
          </button>

          <button
            onClick={() => handleTabSelect('customers')}
            className={`nav-item ${activeTab === 'customers' ? 'active' : ''}`}
          >
            <div className="nav-item-inner">
              <Users size={14} />
              <span>Customer Directory</span>
            </div>
            <span className="nav-pill">{currentCustomers.length}</span>
          </button>

          <div className="nav-section-title">Growth & Automation</div>
          <button
            onClick={() => handleTabSelect('promotions')}
            className={`nav-item ${activeTab === 'promotions' ? 'active' : ''}`}
          >
            <div className="nav-item-inner">
              <Tag size={14} />
              <span>Promotions & Coupons</span>
            </div>
            <span className="nav-pill">{currentCoupons.length}</span>
          </button>

          <button
            onClick={() => handleTabSelect('logistics')}
            className={`nav-item ${activeTab === 'logistics' ? 'active' : ''}`}
          >
            <div className="nav-item-inner">
              <Truck size={14} />
              <span>Courier Logistics</span>
            </div>
            <span className="nav-pill">{currentShipments.length}</span>
          </button>

          <button
            onClick={() => handleTabSelect('payments')}
            className={`nav-item ${activeTab === 'payments' ? 'active' : ''}`}
          >
            <div className="nav-item-inner">
              <CreditCard size={14} />
              <span>Gateways & Ledger</span>
            </div>
          </button>

          <button
            onClick={() => handleTabSelect('accounts')}
            className={`nav-item ${activeTab === 'accounts' ? 'active' : ''}`}
          >
            <div className="nav-item-inner">
              <DollarSign size={14} />
              <span>Accounts & P&L</span>
            </div>
            {discrepanciesCount > 0 && (
              <span className="nav-pill" style={{ background: '#7f1d1d', color: '#fca5a5' }}>
                {discrepanciesCount} alert
              </span>
            )}
          </button>

          <button
            onClick={() => handleTabSelect('marketing')}
            className={`nav-item ${activeTab === 'marketing' ? 'active' : ''}`}
          >
            <div className="nav-item-inner">
              <BarChart3 size={14} />
              <span>Marketing Telemetry</span>
            </div>
          </button>

          <button
            onClick={() => handleTabSelect('blog')}
            className={`nav-item ${activeTab === 'blog' ? 'active' : ''}`}
          >
            <div className="nav-item-inner">
              <FileText size={14} />
              <span>Blog & SEO Hub</span>
            </div>
            <span className="nav-pill">{currentBlogPosts.length}</span>
          </button>

          <div className="nav-section-title">Branding & System</div>
          <button
            onClick={() => handleTabSelect('theme')}
            className={`nav-item ${activeTab === 'theme' ? 'active' : ''}`}
          >
            <div className="nav-item-inner">
              <Palette size={14} />
              <span>Theme Appearance</span>
            </div>
          </button>

          <button
            onClick={() => handleTabSelect('settings')}
            className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          >
            <div className="nav-item-inner">
              <Settings size={14} />
              <span>Store Settings & Staff</span>
            </div>
          </button>
        </nav>

        {/* Operator Profile & Store Status Footer */}
        <div
          className="sidebar-footer"
          style={{
            padding: '14px 16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            backgroundColor: '#060911',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '10px',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#059669',
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: '0.8rem',
                flexShrink: 0,
              }}
            >
              AD
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#f1f5f9',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                admin@{currentStore.slug}.com
              </div>
              <div
                style={{
                  fontSize: '0.7rem',
                  color: '#10b981',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                }}
              >
                STORE_OWNER
              </div>
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '0.74rem',
              color: '#94a3b8',
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              paddingTop: '8px',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981' }} />
              Store Status
            </span>
            <span style={{ color: '#10b981', fontWeight: 700 }}>ONLINE</span>
          </div>
        </div>
      </aside>

      {/* Main Content Pane - Big and Expansive to Sell */}
      <main className="main-content" style={{ backgroundColor: '#EAEEF2' }}>
        {/* Dynamic Tab Body with immediate full-height rendering */}
        <div className="content-body" style={{ backgroundColor: '#EAEEF2' }}>
          <Suspense fallback={<ViewSkeleton />}>
            {activeTab === 'dashboard' && (
              <DashboardView
                currentStore={currentStore}
                orders={currentOrders}
                products={currentProducts}
                onNavigateTab={(tab) => setActiveTab(tab)}
                onUpdateOrderStatus={handleUpdateOrderStatus}
              />
            )}

            {activeTab === 'catalog' && (
              <CatalogView
                currentStore={currentStore}
                products={currentProducts}
                categories={currentCategories}
                attributes={currentAttributes}
                brands={currentBrands}
                careInstructions={currentCareInstructions}
                onAddProduct={handleAddProduct}
                onUpdateProduct={handleUpdateProduct}
                onDeleteProduct={handleDeleteProduct}
                onAddCategory={handleAddCategory}
                onUpdateCategory={handleUpdateCategory}
                onDeleteCategory={handleDeleteCategory}
                onAddAttribute={handleAddAttribute}
                onUpdateAttribute={handleUpdateAttribute}
                onDeleteAttribute={handleDeleteAttribute}
                onAddBrand={handleAddBrand}
                onUpdateBrand={handleUpdateBrand}
                onDeleteBrand={handleDeleteBrand}
                onAddCareInstruction={handleAddCareInstruction}
                onUpdateCareInstruction={handleUpdateCareInstruction}
                onDeleteCareInstruction={handleDeleteCareInstruction}
              />
            )}

            {activeTab === 'inventory' && (
              <InventoryView
                currentStore={currentStore}
                products={currentProducts}
                movements={currentMovements}
                onAdjustStock={handleAdjustStock}
              />
            )}

            {activeTab === 'orders' && (
              <OrdersView
                currentStore={currentStore}
                orders={currentOrders}
                products={currentProducts}
                onUpdateOrderStatus={handleUpdateOrderStatus}
                onCreateOrder={handleCreateOrder}
                onUpdateOrder={handleUpdateOrder}
                onDeleteOrder={handleDeleteOrder}
                onAddCallNote={handleAddCallNote}
              />
            )}

            {activeTab === 'customers' && (
              <CustomersView
                currentStore={currentStore}
                customers={currentCustomers}
                products={currentProducts}
                reviews={currentReviews}
                onAddCustomer={handleAddCustomer}
                onUpdateCustomer={handleUpdateCustomer}
                onDeleteCustomer={handleDeleteCustomer}
                onAddReview={handleAddReview}
                onUpdateReview={handleUpdateReview}
                onDeleteReview={handleDeleteReview}
              />
            )}

            {activeTab === 'promotions' && (
              <PromotionsView
                currentStore={currentStore}
                coupons={currentCoupons}
                bundleTiers={currentBundleTiers}
                onAddCoupon={handleAddCoupon}
                onUpdateCoupon={handleUpdateCoupon}
                onDeleteCoupon={handleDeleteCoupon}
                onToggleCoupon={handleToggleCoupon}
                onAddBundleTier={handleAddBundleTier}
                onUpdateBundleTier={handleUpdateBundleTier}
                onDeleteBundleTier={handleDeleteBundleTier}
                onToggleBundleTier={handleToggleBundleTier}
              />
            )}

            {activeTab === 'logistics' && (
              <LogisticsView
                currentStore={currentStore}
                couriers={currentCouriers}
                shipments={currentShipments}
                onToggleCourier={handleToggleCourier}
              />
            )}

            {activeTab === 'payments' && (
              <PaymentsView
                currentStore={currentStore}
                gateways={currentPayments}
                transactions={currentTransactions}
                onToggleGateway={handleToggleGateway}
              />
            )}

            {activeTab === 'accounts' && (
              <AccountsView
                currentStore={currentStore}
                transactions={currentAccountTransactions}
                expenses={currentExpenses}
                payouts={currentPayouts}
                reconciliations={currentReconciliations}
                onAddExpense={handleAddExpense}
                onDeleteExpense={handleDeleteExpense}
              />
            )}

            {activeTab === 'marketing' && (
              <MarketingView
                currentStore={currentStore}
                marketing={currentMarketing}
                onSaveMarketing={handleSaveMarketing}
              />
            )}

            {activeTab === 'blog' && (
              <BlogView
                currentStore={currentStore}
                posts={currentBlogPosts}
                categories={currentBlogCategories}
                onAddPost={handleAddBlogPost}
                onUpdatePost={handleUpdateBlogPost}
                onDeletePost={handleDeleteBlogPost}
                onAddCategory={handleAddBlogCategory}
                onUpdateCategory={handleUpdateBlogCategory}
                onDeleteCategory={handleDeleteBlogCategory}
              />
            )}

            {activeTab === 'theme' && (
              <ThemeView
                currentStore={currentStore}
                themeConfig={currentTheme}
                onSaveTheme={handleSaveTheme}
              />
            )}

            {activeTab === 'settings' && (
              <SettingsView
                currentStore={currentStore}
                settings={currentSettings}
                onSaveSettings={handleSaveSettings}
              />
            )}
          </Suspense>
        </div>
      </main>
    </div>
  );
};

export default App;
