/**
 * Store portfolio types, detailed models, provisioning contracts, and pagination models.
 */

export type StoreStatus = 'PROVISIONING' | 'ACTIVE' | 'MAINTENANCE' | 'SUSPENDED' | 'ARCHIVED';

export type ProvisioningStepStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export interface ProvisioningLog {
  id: string;
  store_id: string;
  step: string;
  step_order: number;
  status: ProvisioningStepStatus;
  details: Record<string, unknown>;
  error_message?: string;
  started_at: string;
  completed_at?: string;
}

export interface DomainRecord {
  id: string;
  store_id: string;
  domain: string;
  is_primary: boolean;
  is_custom: boolean;
  ssl_status: 'PENDING' | 'ACTIVE' | 'FAILED' | 'REVOKED';
  created_at: string;
  updated_at: string;
}

export interface StoreDetail {
  id: string;
  name: string;
  slug: string;
  description?: string;
  logo_url?: string;
  status: StoreStatus;
  db_host: string;
  db_port: number;
  db_name: string;
  db_user: string;
  db_sslmode: string;
  contact_email: string;
  contact_phone?: string;
  currency: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface StoreDetailResponse {
  store: StoreDetail;
  domains: DomainRecord[];
  active_theme?: {
    id: string;
    name: string;
    slug: string;
    version: string;
  };
}

export interface StoreSummary {
  id: string;
  name: string;
  slug: string;
  status: StoreStatus;
  primary_domain: string;
  active_theme: string;
  contact_email: string;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface PaginatedStoresResponse {
  success: boolean;
  data: StoreSummary[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface CreateStorePayload {
  name: string;
  slug: string;
  description: string;
  theme_slug: string;
  contact_email: string;
  contact_phone: string;
  currency: string;
  timezone: string;
  primary_domain: string;
  initial_owner: {
    email: string;
    password: string;
    first_name: string;
    last_name: string;
  };
}

// =================== PORTFOLIO ACCOUNTS & BILLING TYPES ===================

export interface PortfolioFinancialMetrics {
  totalGMV: number;
  totalNetCashFlow: number;
  totalPlatformFeesEarned: number;
  totalActiveStores: number;
  totalOrdersProcessed: number;
  averageOrderValue: number;
  pendingPayoutsAmount?: number;
  currency: string;
}

export interface BrandRevenueLeaderboardItem {
  rank: number;
  storeId: string;
  storeName: string;
  storeSlug: string;
  grossSales: number;
  netRevenue: number;
  orderCount: number;
  aov: number;
  cogs: number;
  totalExpenses: number;
  netProfit: number;
  operatingMarginPct: number;
  platformFeePaid: number;
  growthPct: number;
  status: string;
}

export interface BrandBillingRecord {
  id: string;
  storeId: string;
  storeName: string;
  storeSlug: string;
  invoiceNumber: string;
  billingCycle: 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
  baseFee: number;
  revenueSharePercentage: number;
  revenueShareAmount: number;
  hostingAllocation: number;
  totalDue: number;
  currency: string;
  status: 'PAID' | 'INVOICED' | 'OVERDUE';
  dueDate: string;
  paidAt?: string;
  createdAt: string;
}

export interface GatewayCostAllocation {
  gatewayName: string;
  totalVolume: number;
  effectiveFeeRate: number;
  totalCommissions: number;
  activeBrandCount: number;
  settlementSpeed: string;
}

