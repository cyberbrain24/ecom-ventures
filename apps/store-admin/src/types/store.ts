export interface StoreStaff {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  email: string;
  role: string;
  isActive: boolean;
  createdAt?: string;
}

export type StoreTab =
  | 'dashboard'
  | 'catalog'
  | 'inventory'
  | 'orders'
  | 'tasks'
  | 'analytics'
  | 'meta-ads'
  | 'customers'
  | 'promotions'
  | 'blog'
  | 'logistics'
  | 'shipping'
  | 'payments'
  | 'accounts'
  | 'marketing'
  | 'music'
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

  // SEO fields
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

export interface ThemePaletteColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  text: string;
  muted: string;
}

export interface ThemeTypographyConfig {
  heading: string;
  body: string;
  headingWeight: '400' | '500' | '600' | '700' | '800' | '900';
  letterSpacing: 'tight' | 'normal' | 'wide' | 'expanded';
  textTransform: 'none' | 'uppercase' | 'capitalize';
  fontSizeScale: 'compact' | 'standard' | 'airy';
}

export interface ThemeCustomizerConfig {
  themeName: string;
  themeSlug?: string;
  primaryColor: string;
  secondaryColor: string;
  headingFont: string;
  bodyFont: string;
  borderRadius: 'none' | 'sm' | 'md' | 'lg' | 'full';
  headerLayout: 'standard' | 'centered' | 'minimal';
  showAnnouncement: boolean;
  announcementText: string;
  colors: ThemePaletteColors;
  typography: ThemeTypographyConfig;
}

export interface StoreBrand {
  id: string;
  name: string;
  slug: string;
  status?: string;
  currency: string;
  timezone: string;
  dbName?: string;
  primaryDomain: string;
  themeSlug?: string;
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
  | 'PLACED'
  | 'REVIEW'
  | 'PENDING'
  | 'DELAYED'
  | 'HOLD'
  | 'CONFIRMED'
  | 'PROCESSING'
  | 'APPROVAL_PENDING'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'PARTIALLY_DELIVERED'
  | 'RETURNED'
  | 'CANCELLED'
  | 'MANUALLY_CANCELLED';

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
  is_urgent?: boolean;
  is_ready?: boolean;
  is_print_ready?: boolean;
  courier_risk_level?: string;
  courier_delivery_ratio?: number;
  delay_blocker_reason?: string;
  cancellation_root_cause?: string;
  return_root_cause?: string;
  is_partial_split?: boolean;
  parent_order_id?: string;
  createdAt: string;
}

export interface FulfillmentQueueItem {
  order: StoreOrder;
  aging_hours: number;
  aging_tier: 'NORMAL' | 'WARNING' | 'HIGH_DELAY' | 'CRITICAL';
  is_delayed_hub_alert: boolean;
}

export interface FulfillmentQueueSummary {
  total_queue_count: number;
  urgent_count: number;
  ready_to_ship_count: number;
  print_pending_count: number;
  delayed_alert_count: number;
}

export interface FulfillmentQueueResponse {
  items: FulfillmentQueueItem[];
  summary: FulfillmentQueueSummary;
  total: number;
  page: number;
  limit: number;
}

// OrderPulse Diagnostic Types
export interface OrderPulseAgingSummary {
  total_delayed_count: number;
  aging_24_to_48h_count: number;
  aging_48_to_72h_count: number;
  critical_over_72h_count: number;
  blocker_counts: Record<string, number>;
}

export interface OrderPulseCancellationSummary {
  pre_dispatch_count: number;
  post_dispatch_count: number;
  pre_dispatch_causes: Record<string, number>;
  post_dispatch_causes: Record<string, number>;
  top_pre_reason: string;
  friction_rate: number;
}

export interface CatalogRDMatrixItem {
  variant_id: string;
  sku: string;
  product_title: string;
  variant_title: string;
  image_url?: string;
  returned_quantity: number;
  primary_root_cause: string;
  reason_breakdown: Record<string, number>;
}

export interface OrderPulseDiagnosticsResponse {
  aging_summary: OrderPulseAgingSummary;
  cancellation_summary: OrderPulseCancellationSummary;
  partial_recovered_bdt: number;
  partial_count: number;
  top_partial_reason: string;
  catalog_rd_matrix: CatalogRDMatrixItem[];
}

export interface PartialSplitItem {
  item_id: string;
  action: 'ACCEPT' | 'RETURN';
  return_reason?: string;
}

export interface PartialSplitRequest {
  items: PartialSplitItem[];
  notes?: string;
}

// Meta Ads & Attribution Platform Types
export interface MetaAttributionScorecard {
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  discrepancy_rate: number;
  storefront_orders: number;
  tracked_touchpoints: number;
  meta_capi_received: number;
  intake_events: number;
  quarantined_events: number;
}

export interface ExecutiveFinancialMetrics {
  delivered_roas: number;
  net_contribution_bdt: number;
  delivered_revenue_bdt: number;
  delivered_orders_count: number;
  ad_spend_bdt: number;
  ad_spend_usd: number;
}

export interface CampaignAttributionRow {
  campaign_id: string;
  campaign_name: string;
  ad_spend_bdt: number;
  ad_spend_usd: number;
  attributed_placed_orders: number;
  placed_revenue_bdt: number;
  delivered_orders: number;
  delivered_revenue_bdt: number;
  delivery_rate: number;
  cogs_bdt: number;
  courier_cost_bdt: number;
  return_penalty_bdt: number;
  net_ad_profit_bdt: number;
  real_roas: number;
  is_unprofitable: boolean;
}

export interface MetaCAPIAuditLogRow {
  id: string;
  order_id?: string;
  event_name: string;
  event_id: string;
  status: 'SUCCESS' | 'SKIPPED' | 'FAILED' | 'QUARANTINED';
  http_code: number;
  age_hours: number;
  is_age_quarantined: boolean;
  dispatched_at: string;
}

export interface MetaAttributionDashboardResponse {
  scorecard: MetaAttributionScorecard;
  financials: ExecutiveFinancialMetrics;
  campaigns: CampaignAttributionRow[];
  audit_logs: MetaCAPIAuditLogRow[];
  active_model: 'last_paid_ad' | 'first_touch' | 'linear' | 'position_based';
}

// OrderPulse Diagnostic Types
export interface OrderPulseAgingSummary {
  total_delayed_count: number;
  aging_24_to_48h_count: number;
  aging_48_to_72h_count: number;
  critical_over_72h_count: number;
  blocker_counts: Record<string, number>;
}

export interface OrderPulseCancellationSummary {
  pre_dispatch_count: number;
  post_dispatch_count: number;
  pre_dispatch_causes: Record<string, number>;
  post_dispatch_causes: Record<string, number>;
  top_pre_reason: string;
  friction_rate: number;
}

export interface CatalogRDMatrixItem {
  variant_id: string;
  sku: string;
  product_title: string;
  variant_title: string;
  image_url?: string;
  returned_quantity: number;
  primary_root_cause: string;
  reason_breakdown: Record<string, number>;
}

export interface OrderPulseDiagnosticsResponse {
  aging_summary: OrderPulseAgingSummary;
  cancellation_summary: OrderPulseCancellationSummary;
  partial_recovered_bdt: number;
  partial_count: number;
  top_partial_reason: string;
  catalog_rd_matrix: CatalogRDMatrixItem[];
}

export interface PartialSplitItem {
  item_id: string;
  action: 'ACCEPT' | 'RETURN';
  return_reason?: string;
}

export interface PartialSplitRequest {
  items: PartialSplitItem[];
  notes?: string;
}

// Meta Ads & Attribution Platform Types
export interface MetaAttributionScorecard {
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL';
  discrepancy_rate: number;
  storefront_orders: number;
  tracked_touchpoints: number;
  meta_capi_received: number;
  intake_events: number;
  quarantined_events: number;
}

export interface ExecutiveFinancialMetrics {
  delivered_roas: number;
  net_contribution_bdt: number;
  delivered_revenue_bdt: number;
  delivered_orders_count: number;
  ad_spend_bdt: number;
  ad_spend_usd: number;
}

export interface CampaignAttributionRow {
  campaign_id: string;
  campaign_name: string;
  ad_spend_bdt: number;
  ad_spend_usd: number;
  attributed_placed_orders: number;
  placed_revenue_bdt: number;
  delivered_orders: number;
  delivered_revenue_bdt: number;
  delivery_rate: number;
  cogs_bdt: number;
  courier_cost_bdt: number;
  return_penalty_bdt: number;
  net_ad_profit_bdt: number;
  real_roas: number;
  is_unprofitable: boolean;
}

export interface MetaCAPIAuditLogRow {
  id: string;
  order_id?: string;
  event_name: string;
  event_id: string;
  status: 'SUCCESS' | 'SKIPPED' | 'FAILED' | 'QUARANTINED';
  http_code: number;
  age_hours: number;
  is_age_quarantined: boolean;
  dispatched_at: string;
}

export interface MetaAttributionDashboardResponse {
  scorecard: MetaAttributionScorecard;
  financials: ExecutiveFinancialMetrics;
  campaigns: CampaignAttributionRow[];
  audit_logs: MetaCAPIAuditLogRow[];
  active_model: 'last_paid_ad' | 'first_touch' | 'linear' | 'position_based';
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
  isDefault: boolean;
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
  legalBusinessName?: string;
  contactEmail: string;
  contactPhone: string;
  currency: string;
  timezone: string;
  shippingInsideDhaka: number;
  shippingOutsideDhaka: number;
  orderPrefix: string;
  returnPolicyDays: number;
  taxRatePercent?: number;
  pricesIncludeTax?: boolean;
  // Visual Branding & Media
  logoUrl?: string;
  desktopHeroBannerUrl?: string;
  mobileHeroBannerUrl?: string;
  siteDescription?: string;
  footerContent?: string;
  primaryColor?: string;
  secondaryColor?: string;
  fontHeading?: string;
  fontBody?: string;
  // Social Channels
  whatsappPhone?: string;
  facebookUrl?: string;
  instagramUrl?: string;
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

// =================== ABANDONED CHECKOUT RECOVERY TYPES ===================

export type AbandonedCheckoutStatus =
  | 'pending'
  | 'called_busy'
  | 'called_followup'
  | 'declined'
  | 'converted';

export interface AbandonedCartItem {
  variant_id: string;
  product_title?: string;
  variant_title?: string;
  sku?: string;
  unit_price: number;
  quantity: number;
}

export interface AbandonedCheckoutRecord {
  id: string;
  session_token: string;
  phone: string;
  customer_name: string;
  customer_email: string;
  district: string;
  thana: string;
  address: string;
  cart_items: AbandonedCartItem[];
  cart_total: number;
  status: AbandonedCheckoutStatus;
  call_notes: string;
  scheduled_callback_at?: string;
  agent_id?: string;
  converted_order_id?: string;
  created_at: string;
  updated_at: string;
}

export interface AbandonedSummary {
  total_count: number;
  pending_count: number;
  called_busy_count: number;
  called_followup_count: number;
  declined_count: number;
  converted_count: number;
}

export interface PaginatedAbandonedResponse {
  items: AbandonedCheckoutRecord[];
  summary: AbandonedSummary;
  total: number;
  page: number;
  limit: number;
}

export interface MusicConfig {
  id: number;
  is_active: boolean;
  updated_at: string;
}

export interface MusicTrack {
  id: string;
  title: string;
  audio_file?: string | null;
  audio_url?: string | null;
  served_audio_url?: string | null;
  is_active: boolean;
  sort_order: number;
  duration_seconds?: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateMusicTrackRequest {
  title: string;
  audio_file?: string | null;
  audio_url?: string | null;
  is_active?: boolean;
  sort_order?: number;
  duration_seconds?: number | null;
}

export interface UpdateMusicTrackRequest {
  title?: string;
  audio_file?: string | null;
  audio_url?: string | null;
  is_active?: boolean;
  sort_order?: number;
  duration_seconds?: number | null;
}

export interface TaskCategory {
  id: string;
  name: string;
  color: string;
  task_count: number;
  created_at: string;
}

export interface StaffSummary {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
}

export interface StoreTask {
  id: string;
  title: string;
  description?: string | null;
  category_id?: string | null;
  category?: TaskCategory | null;
  assignee_id: string;
  assignee: StaffSummary;
  created_by_id?: string | null;
  created_by?: StaffSummary | null;
  status: 'pending' | 'completed';
  completion_comment?: string | null;
  created_at: string;
  completed_at?: string | null;
  updated_at: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  category_id?: string;
  assignee_id: string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  category_id?: string;
  assignee_id?: string;
}

export interface CompleteTaskRequest {
  completion_comment: string;
}

export interface CreateCategoryRequest {
  name: string;
  color: string;
}



