export type StoreTab = 
  | 'dashboard'
  | 'catalog'
  | 'inventory'
  | 'orders'
  | 'customers'
  | 'promotions'
  | 'blog'
  | 'logistics'
  | 'payments'
  | 'accounts'
  | 'marketing'
  | 'theme'
  | 'settings';

export interface StoreBlogCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  metaTitle: string;
  metaDescription: string;
  displayOrder: number;
  isActive: boolean;
  postCount?: number;
}

export interface SEOAnalysisData {
  score: number;
  titleLength: number;
  titleStatus: 'GOOD' | 'TOO_SHORT' | 'TOO_LONG';
  metaDescriptionLength: number;
  metaDescStatus: 'GOOD' | 'TOO_SHORT' | 'TOO_LONG';
  focusKeywordInTitle: boolean;
  focusKeywordInMeta: boolean;
  focusKeywordInSlug: boolean;
  focusKeywordInContent: boolean;
  hasFeaturedImageAlt: boolean;
  wordCount: number;
  readingTime: number;
  recommendations: string[];
}

export interface StoreBlogPost {
  id: string;
  categoryId?: string;
  categoryName?: string;
  categorySlug?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featuredImageUrl: string;
  featuredImageAlt: string;
  authorName: string;
  authorAvatarUrl: string;
  status: 'DRAFT' | 'PUBLISHED' | 'SCHEDULED' | 'ARCHIVED';
  publishedAt?: string;
  readingTimeMinutes: number;
  viewCount: number;
  tags: string[];

  // 100% SEO Focused Fields
  metaTitle: string;
  metaDescription: string;
  focusKeyword: string;
  secondaryKeywords: string[];
  canonicalUrl: string;
  metaRobots: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImageUrl: string;
  schemaType: 'BlogPosting' | 'Article' | 'NewsArticle';
  seoScore: number;
  seoAnalysis: SEOAnalysisData;

  createdAt: string;
  updatedAt: string;
}

export interface StoreCategory {
  id: string;
  name: string;
  slug: string;
  description: string;
  productCount: number;
  displayOrder: number;
  isActive: boolean;
  metaTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
  canonicalUrl?: string;
  metaRobots?: string;
}

export interface StoreAttribute {
  id: string;
  name: string;
  code: string;
  displayType: 'SELECT' | 'COLOR_SWATCH' | 'BUTTON';
  values: { id: string; value: string; displayValue: string; colorHex?: string }[];
}

export interface PaymentTransaction {
  id: string;
  orderNumber: string;
  gateway: 'bKash' | 'Nagad' | 'SSLCommerz' | 'Stripe' | 'COD';
  transactionReference: string;
  amount: number;
  status: 'SUCCESS' | 'PENDING' | 'FAILED' | 'REFUNDED';
  timestamp: string;
}

export interface ShipmentRecord {
  id: string;
  orderNumber: string;
  carrier: 'Steadfast' | 'Pathao' | 'RedX';
  trackingNumber: string;
  recipientName: string;
  recipientCity: string;
  status: 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED';
  shippedAt: string;
  estimatedDelivery: string;
}

export interface ThemeCustomizerConfig {
  themeName: string;
  primaryColor: string;
  secondaryColor: string;
  headingFont: string;
  bodyFont: string;
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'full';
  headerLayout: 'standard' | 'centered' | 'minimal';
  showAnnouncement: boolean;
  announcementText: string;
}

export interface StoreBrand {
  id: string;
  name: string;
  slug: string;
  currency: string;
  timezone: string;
  dbName: string;
  primaryDomain: string;
  themeSlug: string;
}

export interface ProductBrand {
  id: string;
  name: string;
  slug: string;
  logoUrl: string;
  origin?: string;
  description?: string;
  websiteUrl?: string;
  productCount: number;
  isActive: boolean;
}

export interface CareInstruction {
  id: string;
  title: string;
  materialCategory: string; // e.g. Silk, Wool/Cashmere, Leather, Cotton/Denim
  instructions: string[]; // List of care instructions
  careSymbols?: string[]; // e.g. ['wash-30', 'no-bleach', 'iron-low', 'no-tumble-dry']
  description?: string;
  isActive: boolean;
}

export interface ProductVariant {
  id: string;
  sku: string;
  title: string;
  price: number;
  compareAtPrice?: number;
  inventoryCount: number;
  attributes: Record<string, string>;
  imageUrl?: string; // variant-specific image selected from uploaded images
}

export interface StoreProduct {
  id: string;
  title: string;
  slug: string;
  sku: string;
  price: number;
  compareAtPrice?: number;
  inventoryCount: number;
  category: string;
  status: 'ACTIVE' | 'DRAFT' | 'ARCHIVED';
  variants: ProductVariant[];
  createdAt: string;
  // Advanced features requested:
  brandId?: string;
  brandName?: string;
  brandLogoUrl?: string;
  careInstructionId?: string;
  careInstructionTitle?: string;
  careInstructionText?: string[];
  isFeatured?: boolean;
  isSoldOut?: boolean;
  productType?: 'SINGLE' | 'VARIABLE';
  images?: string[];
  imageUrl?: string;
  description?: string;
  // Comprehensive SEO Subsystem Fields
  metaTitle?: string;
  metaDescription?: string;
  focusKeyword?: string;
  canonicalUrl?: string;
  metaRobots?: string;
  ogImageUrl?: string;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  productTitle: string;
  sku: string;
  change: number;
  balance: number;
  reason: 'RESTOCK' | 'ORDER_FULFILLMENT' | 'DAMAGE' | 'MANUAL_CORRECTION';
  timestamp: string;
}

export type OrderStatus = 
  | 'PENDING' 
  | 'CONFIRMED' 
  | 'PROCESSING' 
  | 'SHIPPED' 
  | 'DELIVERED' 
  | 'CANCELLED';

export interface OrderItem {
  id: string;
  productTitle: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  productImage?: string;
}

export interface OrderRiskFlag {
  code: 'invalid_phone' | 'profile_mismatch' | 'high_value_cod' | 'repeat_offender' | string;
  severity: 'WARNING' | 'DANGER' | 'INFO';
  label: string;
  description: string;
}

export interface OrderCallNote {
  id: string;
  staffName: string;
  note: string;
  createdAt: string;
}

export interface StoreOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  crmProfilePhone?: string;
  shippingAddress: string;
  city: string;
  district?: string;
  thana?: string;
  items: OrderItem[];
  subtotal: number;
  shippingFee: number;
  discountAmount: number;
  totalAmount: number;
  paidAmount: number;
  dueAmount: number;
  status: OrderStatus;
  paymentMethod: 'BKASH' | 'NAGAD' | 'COD' | 'STRIPE';
  paymentStatus: 'PAID' | 'PENDING' | 'REFUNDED' | 'UNPAID' | 'PARTIALLY_PAID';
  courierName?: 'Steadfast' | 'Pathao' | 'RedX';
  trackingNumber?: string;
  consignmentId?: string;
  specialNote?: string;
  riskFlags?: OrderRiskFlag[];
  callNotes?: OrderCallNote[];
  createdAt: string;
}

export interface StoreCustomer {
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  totalOrders: number;
  lifetimeValue: number;
  lastOrderDate: string;
}

export interface StoreCoupon {
  id: string;
  code: string;
  discountType: 'PERCENTAGE' | 'FIXED';
  discountValue: number;
  minOrderAmount: number;
  usageCount: number;
  usageLimit: number;
  isActive: boolean;
  expiresAt: string;
}

export interface BundleTier {
  id: string;
  name: string;
  requiredItemsCount: number;
  discountPercentage: number;
  badgeText?: string;
  subtitle?: string;
  perks: string[];
  hasFreeDelivery: boolean;
  displayOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface CourierConfig {
  provider: 'Steadfast' | 'Pathao' | 'RedX';
  apiKey: string;
  secretKey: string;
  isActive: boolean;
  autoDispatch: boolean;
  webhookStatus: 'ACTIVE' | 'UNCONFIGURED';
}

export interface PaymentGatewayConfig {
  id: 'bkash' | 'nagad' | 'sslcommerz' | 'stripe' | 'cod';
  name: string;
  isEnabled: boolean;
  isSandbox: boolean;
  merchantId: string;
  supportedCurrencies: string[];
}

export interface MarketingConfig {
  metaPixelId: string;
  metaCapiToken: string;
  ga4MeasurementId: string;
  gtmContainerId: string;
  trackPageView: boolean;
  trackAddToCart: boolean;
  trackPurchase: boolean;
}

export interface StoreSettings {
  brandName: string;
  contactEmail: string;
  contactPhone: string;
  currency: string;
  timezone: string;
  shippingInsideDhaka: number;
  shippingOutsideDhaka: number;
  orderPrefix: string;
  returnPolicyDays: number;
  // Comprehensive SEO, Favicon & Webmaster Settings
  metaTitleTemplate?: string;
  defaultMetaTitle?: string;
  defaultMetaDescription?: string;
  defaultKeywords?: string;
  faviconUrl?: string;
  appleTouchIconUrl?: string;
  defaultOgImageUrl?: string;
  twitterHandle?: string;
  googleSiteVerification?: string;
  bingSiteVerification?: string;
  pinterestVerification?: string;
  robotsTxtCustom?: string;
  sitemapEnabled?: boolean;
}

// =================== ACCOUNTS & RECONCILIATION MODULE TYPES ===================

export interface AccountTransactionRecord {
  id: string;
  orderId?: string;
  orderNumber: string;
  gateway: 'bKash' | 'Nagad' | 'SSLCommerz' | 'Stripe' | 'COD';
  gatewayTransactionId: string;
  grossAmount: number;
  gatewayFee: number;
  shippingDeduction: number;
  netPayout: number;
  currency: string;
  status: 'PAID' | 'REFUNDED' | 'FAILED' | 'PENDING';
  settlementStatus: 'SETTLED' | 'UNSETTLED' | 'DISCREPANCY';
  customerName: string;
  timestamp: string;
  notes?: string;
}

export interface StoreExpenseRecord {
  id: string;
  category: 'Packaging' | 'Meta Ads' | 'Courier Handling' | 'Studio / Photo' | 'Operations' | 'Inventory Logistics' | 'Other';
  title: string;
  amount: number;
  currency: string;
  receiptUrl?: string;
  loggedBy: string;
  expenseDate: string; // YYYY-MM-DD
  notes?: string;
}

export interface StorePayoutRecord {
  id: string;
  payoutReference: string;
  amount: number;
  currency: string;
  gateway: string;
  destinationBank: string;
  accountNumberMask: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  period: string;
  processedAt: string;
  notes?: string;
}

export interface PaymentReconciliationItem {
  orderNumber: string;
  customerName: string;
  gateway: string;
  gatewayStatus: string;
  storeOrderStatus: string;
  expectedAmount: number;
  receivedAmount: number;
  discrepancyAmount: number;
  reconciled: boolean;
  issueReason?: string;
  timestamp: string;
}

export interface ProfitLossStatement {
  period: string; // e.g. "November 2026"
  grossSales: number;
  discountsAndReturns: number;
  gatewayFees: number;
  shippingCosts: number;
  netRevenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  expensesByCategory: Record<string, number>;
  totalExpenses: number;
  netProfit: number;
  netMarginPct: number;
  currency: string;
}

export interface AccountsOverviewMetrics {
  grossRevenue: number;
  totalGatewayFees: number;
  totalShippingDeducted: number;
  netRevenue: number;
  totalExpenses: number;
  totalPayoutsReceived: number;
  estimatedCOGS: number;
  netProfit: number;
  operatingMarginPct: number;
  currency: string;
  pendingSettlements: number;
  discrepanciesCount: number;
}

// =================== PRODUCT REVIEWS & REPUTATION ENGINE TYPES ===================

export type ReviewStatus = 'PENDING' | 'APPROVED' | 'FEATURED' | 'ARCHIVED';

export interface ReviewImage {
  id: string;
  reviewId: string;
  imageUrl: string;
  thumbnailUrl?: string;
  displayOrder: number;
}

export interface StoreReview {
  id: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  productImage?: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  orderId?: string;
  isVerifiedPurchase: boolean;
  rating: number; // 1 - 5
  title: string;
  comment: string;
  status: ReviewStatus;
  isFeatured: boolean;
  displayOrder: number;
  staffNotes?: string;
  images: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ReviewStats {
  totalReviews: number;
  averageRating: number;
  pendingCount: number;
  approvedCount: number;
  featuredCount: number;
  photoReviewsCount: number;
  ratingBreakdown: Record<number, number>;
}


