import React, { useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  Award,
  Receipt,
  Download,
  CreditCard,
  Building,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileSpreadsheet,
  PieChart,
  BarChart2,
  ArrowUpRight,
  ShieldCheck,
  ChevronRight,
  Store,
} from 'lucide-react';
import {
  PortfolioFinancialMetrics,
  BrandRevenueLeaderboardItem,
  BrandBillingRecord,
  GatewayCostAllocation,
} from '../types/store';

const INITIAL_METRICS: PortfolioFinancialMetrics = {
  totalGMV: 3450000.0,
  totalNetCashFlow: 2950000.0,
  totalPlatformFeesEarned: 172500.0,
  totalActiveStores: 3,
  totalOrdersProcessed: 428,
  averageOrderValue: 8060.75,
  pendingPayoutsAmount: 48500.0,
  currency: 'BDT',
};

const INITIAL_LEADERBOARD: BrandRevenueLeaderboardItem[] = [
  {
    rank: 1,
    storeId: 'f4a89f27-78ec-40fd-a735-675a3de145ed',
    storeName: 'Mior Fashion',
    storeSlug: 'mior',
    grossSales: 1850000.0,
    netRevenue: 1620000.0,
    orderCount: 215,
    aov: 8604.65,
    cogs: 740000.0,
    totalExpenses: 310000.0,
    netProfit: 570000.0,
    operatingMarginPct: 30.81,
    platformFeePaid: 92500.0,
    growthPct: 18.4,
    status: 'ACTIVE',
  },
  {
    rank: 2,
    storeId: 'e4599b45-21d4-4bb0-b74a-8d19ab489f1a',
    storeName: 'Artisan Leather & Fragrance',
    storeSlug: 'artisan',
    grossSales: 980000.0,
    netRevenue: 855000.0,
    orderCount: 132,
    aov: 7424.24,
    cogs: 392000.0,
    totalExpenses: 185000.0,
    netProfit: 278000.0,
    operatingMarginPct: 28.37,
    platformFeePaid: 49000.0,
    growthPct: 12.1,
    status: 'ACTIVE',
  },
  {
    rank: 3,
    storeId: '117a29e1-14b6-4bbd-bca5-f9124be3b85d',
    storeName: 'Urban Movement Footwear',
    storeSlug: 'urban',
    grossSales: 620000.0,
    netRevenue: 545000.0,
    orderCount: 81,
    aov: 7654.32,
    cogs: 248000.0,
    totalExpenses: 124000.0,
    netProfit: 173000.0,
    operatingMarginPct: 27.9,
    platformFeePaid: 31000.0,
    growthPct: 24.5,
    status: 'ACTIVE',
  },
];

const INITIAL_BILLING: BrandBillingRecord[] = [
  {
    id: 'inv-2026-11-001',
    storeId: 'f4a89f27-78ec-40fd-a735-675a3de145ed',
    storeName: 'Mior Fashion',
    storeSlug: 'mior',
    invoiceNumber: 'INV-EV-2026-11-01',
    billingCycle: 'MONTHLY',
    baseFee: 25000.0,
    revenueSharePercentage: 5.0,
    revenueShareAmount: 92500.0,
    hostingAllocation: 5000.0,
    totalDue: 122500.0,
    currency: 'BDT',
    status: 'PAID',
    dueDate: '2026-11-10',
    paidAt: '2026-11-01',
    createdAt: '2026-10-31',
  },
  {
    id: 'inv-2026-11-002',
    storeId: 'e4599b45-21d4-4bb0-b74a-8d19ab489f1a',
    storeName: 'Artisan Leather & Fragrance',
    storeSlug: 'artisan',
    invoiceNumber: 'INV-EV-2026-11-02',
    billingCycle: 'MONTHLY',
    baseFee: 25000.0,
    revenueSharePercentage: 5.0,
    revenueShareAmount: 49000.0,
    hostingAllocation: 5000.0,
    totalDue: 79000.0,
    currency: 'BDT',
    status: 'INVOICED',
    dueDate: '2026-11-15',
    createdAt: '2026-10-31',
  },
  {
    id: 'inv-2026-11-003',
    storeId: '117a29e1-14b6-4bbd-bca5-f9124be3b85d',
    storeName: 'Urban Movement Footwear',
    storeSlug: 'urban',
    invoiceNumber: 'INV-EV-2026-11-03',
    billingCycle: 'MONTHLY',
    baseFee: 25000.0,
    revenueSharePercentage: 5.0,
    revenueShareAmount: 31000.0,
    hostingAllocation: 5000.0,
    totalDue: 61000.0,
    currency: 'BDT',
    status: 'INVOICED',
    dueDate: '2026-11-18',
    createdAt: '2026-10-31',
  },
];

const INITIAL_GATEWAYS: GatewayCostAllocation[] = [
  {
    gatewayName: 'bKash Merchant Gateway',
    totalVolume: 1420000.0,
    effectiveFeeRate: 1.5,
    totalCommissions: 21300.0,
    activeBrandCount: 3,
    settlementSpeed: 'Instant / T+0',
  },
  {
    gatewayName: 'SSLCommerz (Visa / Mastercard / Amex)',
    totalVolume: 1150000.0,
    effectiveFeeRate: 2.2,
    totalCommissions: 25300.0,
    activeBrandCount: 3,
    settlementSpeed: 'T+2 Escrow',
  },
  {
    gatewayName: 'Stripe International Gateway',
    totalVolume: 380000.0,
    effectiveFeeRate: 2.9,
    totalCommissions: 11020.0,
    activeBrandCount: 2,
    settlementSpeed: 'Rolling 7-day',
  },
  {
    gatewayName: 'Cash on Delivery (Courier Partner COD)',
    totalVolume: 500000.0,
    effectiveFeeRate: 1.0,
    totalCommissions: 5000.0,
    activeBrandCount: 3,
    settlementSpeed: 'Weekly Courier Payout',
  },
];

export const AccountsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'consolidated' | 'billing' | 'gateways'>('leaderboard');
  const [billingRecords, setBillingRecords] = useState<BrandBillingRecord[]>(INITIAL_BILLING);
  const [selectedPeriod, setSelectedPeriod] = useState<string>('2026-11');

  const handleToggleBillingStatus = (id: string) => {
    setBillingRecords((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status: r.status === 'PAID' ? 'INVOICED' : 'PAID',
              paidAt: r.status === 'PAID' ? undefined : new Date().toISOString().split('T')[0],
            }
          : r
      )
    );
  };

  const handleExportCSV = (type: string) => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    let filename = `portfolio-${type}-${selectedPeriod}.csv`;

    if (type === 'leaderboard') {
      csvContent += 'Rank,Store Name,Slug,Gross Sales,Net Revenue,Orders,AOV,COGS,Expenses,Net Profit,Operating Margin,Platform Fee,Growth\n';
      INITIAL_LEADERBOARD.forEach((b) => {
        csvContent += `"${b.rank}","${b.storeName}","${b.storeSlug}","${b.grossSales}","${b.netRevenue}","${b.orderCount}","${b.aov.toFixed(2)}","${b.cogs}","${b.totalExpenses}","${b.netProfit}","${b.operatingMarginPct.toFixed(2)}%","${b.platformFeePaid}","${b.growthPct}%"\n`;
      });
    } else if (type === 'billing') {
      csvContent += 'Invoice Number,Store Name,Slug,Cycle,Base Fee,Rev Share %,Rev Share Amount,Hosting Fee,Total Due,Status,Due Date,Paid At\n';
      billingRecords.forEach((b) => {
        csvContent += `"${b.invoiceNumber}","${b.storeName}","${b.storeSlug}","${b.billingCycle}","${b.baseFee}","${b.revenueSharePercentage}%","${b.revenueShareAmount}","${b.hostingAllocation}","${b.totalDue}","${b.status}","${b.dueDate}","${b.paidAt || ''}"\n`;
      });
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Portfolio Accounts & Financial Command Center
            </h1>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-700 border border-teal-200">
              CENTRAL DB AGGREGATOR
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Aggregated financial health, brand revenue leaderboard, platform fee collections, and billing management across all retail stores.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="text-xs font-semibold px-3 py-2 bg-white border border-slate-200 rounded-lg shadow-sm outline-none focus:ring-1 focus:ring-teal-500"
          >
            <option value="2026-11">Period: November 2026</option>
            <option value="2026-10">Period: October 2026</option>
            <option value="2026-09">Period: September 2026</option>
          </select>

          <button
            onClick={() => handleExportCSV(activeTab === 'billing' ? 'billing' : 'leaderboard')}
            className="min-h-[40px] px-3.5 py-2 bg-teal-600 text-white rounded-lg text-xs font-semibold shadow-sm hover:bg-teal-700 transition flex items-center space-x-1.5"
          >
            <Download className="h-4 w-4" />
            <span>Export Report (CSV)</span>
          </button>
        </div>
      </div>

      {/* Consolidated Financial Cards - 7 Column Box Card Design */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-3">
        {/* 1. Total GMV */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Portfolio GMV
            </span>
            <span className="p-1.5 bg-teal-50 text-teal-600 rounded-md">
              <TrendingUp className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="text-lg font-black text-slate-900 font-mono mt-1.5">
            ৳{Math.round(INITIAL_METRICS.totalGMV).toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-400 mt-1 truncate">
            Total sales across stores
          </p>
        </div>

        {/* 2. Net Cash Flow */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Net Cash Flow
            </span>
            <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-md">
              <DollarSign className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="text-lg font-black text-emerald-700 font-mono mt-1.5">
            ৳{Math.round(INITIAL_METRICS.totalNetCashFlow).toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-400 mt-1 truncate">
            Merchant settled revenue
          </p>
        </div>

        {/* 3. Platform Fees Earned */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Platform Fees
            </span>
            <span className="p-1.5 bg-indigo-50 text-indigo-600 rounded-md">
              <Award className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="text-lg font-black text-indigo-700 font-mono mt-1.5">
            ৳{Math.round(INITIAL_METRICS.totalPlatformFeesEarned).toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-400 mt-1 truncate">
            5% rev-share take rate
          </p>
        </div>

        {/* 4. Orders */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Total Orders
            </span>
            <span className="p-1.5 bg-amber-50 text-amber-600 rounded-md">
              <BarChart2 className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="text-lg font-black text-slate-900 font-mono mt-1.5">
            {INITIAL_METRICS.totalOrdersProcessed}
          </div>
          <p className="text-[10px] text-slate-400 mt-1 truncate">
            Transactions cleared
          </p>
        </div>

        {/* 5. Portfolio AOV */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Average Order (AOV)
            </span>
            <span className="p-1.5 bg-sky-50 text-sky-600 rounded-md">
              <CreditCard className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="text-lg font-black text-slate-900 font-mono mt-1.5">
            ৳{Math.round(INITIAL_METRICS.averageOrderValue).toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-400 mt-1 truncate">
            Per transaction basket
          </p>
        </div>

        {/* 6. Active Brands */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Active Tenants
            </span>
            <span className="p-1.5 bg-purple-50 text-purple-600 rounded-md">
              <Store className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="text-lg font-black text-slate-900 font-mono mt-1.5">
            {INITIAL_METRICS.totalActiveStores}
          </div>
          <p className="text-[10px] text-slate-400 mt-1 truncate">
            Contributing GMV
          </p>
        </div>

        {/* 7. Pending Payouts */}
        <div className="bg-white border border-slate-200 rounded-lg p-3.5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Pending Payouts
            </span>
            <span className="p-1.5 bg-rose-50 text-rose-600 rounded-md">
              <Clock className="h-3.5 w-3.5" />
            </span>
          </div>
          <div className="text-lg font-black text-rose-600 font-mono mt-1.5">
            ৳{Math.round(INITIAL_METRICS.pendingPayoutsAmount ?? 48500).toLocaleString()}
          </div>
          <p className="text-[10px] text-slate-400 mt-1 truncate">
            Disbursement queue
          </p>
        </div>
      </div>

      {/* Navigation Sub-tabs */}
      <div className="flex border-b border-slate-200 space-x-1 overflow-x-auto no-scrollbar">
        {[
          { key: 'leaderboard', label: 'Revenue Leaderboard', icon: Award },
          { key: 'consolidated', label: 'Cash Flow Rollups', icon: PieChart },
          { key: 'billing', label: 'Brand Billing & Invoices', icon: Receipt, count: billingRecords.length },
          { key: 'gateways', label: 'Gateway Fee Structures', icon: CreditCard },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`min-h-[44px] flex items-center space-x-2 px-4 py-2.5 text-xs font-bold border-b-2 whitespace-nowrap transition ${
                isActive
                  ? 'border-teal-600 text-teal-700 bg-teal-50/40'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-50'
              }`}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-700">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ================= TAB 1: PORTFOLIO REVENUE LEADERBOARD ================= */}
      {activeTab === 'leaderboard' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Brand Profitability & Revenue Rankings
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Comparative sales, net margins, order volumes, and platform fees generated per retail brand.
              </p>
            </div>
            <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
              Ranked by GMV
            </span>
          </div>

          {/* Desktop Table View (≥ 1024px) */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4 text-center">Rank</th>
                  <th className="py-3 px-4">Brand Store</th>
                  <th className="py-3 px-4 text-right">Gross GMV</th>
                  <th className="py-3 px-4 text-right">Net Revenue</th>
                  <th className="py-3 px-4 text-center">Orders</th>
                  <th className="py-3 px-4 text-right">AOV</th>
                  <th className="py-3 px-4 text-right">Net Profit</th>
                  <th className="py-3 px-4 text-center">Operating Margin</th>
                  <th className="py-3 px-4 text-right">Platform Fee (5%)</th>
                  <th className="py-3 px-4 text-center">MoM Growth</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {INITIAL_LEADERBOARD.map((b) => (
                  <tr key={b.storeId} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`inline-flex items-center justify-center h-6 w-6 rounded-full font-bold text-xs ${
                          b.rank === 1
                            ? 'bg-amber-100 text-amber-800'
                            : b.rank === 2
                            ? 'bg-slate-200 text-slate-800'
                            : 'bg-orange-100 text-orange-800'
                        }`}
                      >
                        {b.rank}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900">{b.storeName}</div>
                      <div className="text-[11px] text-slate-400 font-mono">{b.storeSlug}.dropiobd.com</div>
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-slate-900 font-mono">
                      ৳{b.grossSales.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-emerald-700 font-semibold">
                      ৳{b.netRevenue.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-center font-semibold text-slate-700">
                      {b.orderCount}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-600">
                      ৳{b.aov.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      ৳{b.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {b.operatingMarginPct.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-teal-700">
                      ৳{b.platformFeePaid.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span className="inline-flex items-center text-emerald-700 font-bold text-[11px]">
                        <ArrowUpRight className="h-3 w-3 mr-0.5" />
                        +{b.growthPct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile / Tablet Cards View (< 1024px) */}
          <div className="lg:hidden p-4 space-y-3">
            {INITIAL_LEADERBOARD.map((b) => (
              <div key={b.storeId} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <span className="h-6 w-6 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center font-bold text-xs">
                      #{b.rank}
                    </span>
                    <div>
                      <h3 className="font-bold text-slate-900 text-sm">{b.storeName}</h3>
                      <p className="text-[10px] text-slate-400 font-mono">{b.storeSlug}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    +{b.growthPct}% MoM
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Gross GMV</span>
                    <span className="font-bold text-slate-900 font-mono">৳{b.grossSales.toFixed(0)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Net Profit</span>
                    <span className="font-bold text-emerald-700 font-mono">৳{b.netProfit.toFixed(0)} ({b.operatingMarginPct.toFixed(1)}%)</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Orders & AOV</span>
                    <span className="text-slate-700">{b.orderCount} orders • ৳{b.aov.toFixed(0)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Platform Fee</span>
                    <span className="font-bold text-teal-700 font-mono">৳{b.platformFeePaid.toFixed(0)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 2: CONSOLIDATED CASH FLOW ROLLUPS ================= */}
      {activeTab === 'consolidated' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue Contribution by Brand */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900">Revenue Contribution by Brand Store</h2>
            <div className="space-y-3">
              {INITIAL_LEADERBOARD.map((b) => {
                const pct = (b.grossSales / INITIAL_METRICS.totalGMV) * 100;
                return (
                  <div key={b.storeId} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-slate-800">{b.storeName}</span>
                      <span className="font-bold text-slate-900 font-mono">
                        {pct.toFixed(1)}% (৳{b.grossSales.toLocaleString()})
                      </span>
                    </div>
                    <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-600 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Consolidated Waterfall */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-4">
            <h2 className="text-sm font-bold text-slate-900">Portfolio Cash Retention Waterfall</h2>
            <div className="space-y-2.5 text-xs">
              <div className="flex justify-between p-2.5 bg-slate-50 rounded-lg">
                <span className="text-slate-600">Total Portfolio GMV</span>
                <span className="font-bold font-mono text-slate-900">৳{INITIAL_METRICS.totalGMV.toLocaleString()}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-rose-50 text-rose-800 rounded-lg">
                <span>Total Gateway Commissions (~1.8%)</span>
                <span className="font-bold font-mono">-৳58,620.00</span>
              </div>
              <div className="flex justify-between p-2.5 bg-rose-50 text-rose-800 rounded-lg">
                <span>Courier Disbursements & Deductions</span>
                <span className="font-bold font-mono">-৳61,400.00</span>
              </div>
              <div className="flex justify-between p-2.5 bg-emerald-50 text-emerald-800 rounded-lg font-bold">
                <span>Net Tenant Cash Flow</span>
                <span className="font-mono">৳{INITIAL_METRICS.totalNetCashFlow.toLocaleString()}</span>
              </div>
              <div className="flex justify-between p-2.5 bg-teal-50 text-teal-900 rounded-lg font-bold">
                <span>Total Platform Fee Inflow (5% + Hosting)</span>
                <span className="font-mono">৳{INITIAL_METRICS.totalPlatformFeesEarned.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 3: BRAND BILLING & PLATFORM INVOICES ================= */}
      {activeTab === 'billing' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm sm:text-base font-bold text-slate-900">
                Brand Platform Usage & Revenue Share Billing
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Contractual billing breakdown: ৳25,000 monthly SaaS baseline + 5% revenue sharing + ৳5,000 cloud allocation.
              </p>
            </div>
          </div>

          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Invoice #</th>
                  <th className="py-3 px-4">Brand Store</th>
                  <th className="py-3 px-4 text-right">Base SaaS Fee</th>
                  <th className="py-3 px-4 text-right">Revenue Share (5%)</th>
                  <th className="py-3 px-4 text-right">Hosting Fee</th>
                  <th className="py-3 px-4 text-right">Total Due</th>
                  <th className="py-3 px-4 text-center">Status</th>
                  <th className="py-3 px-4">Due Date</th>
                  <th className="py-3 px-4 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {billingRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">{r.invoiceNumber}</td>
                    <td className="py-3.5 px-4 font-semibold text-slate-900">{r.storeName}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-600">৳{r.baseFee.toFixed(2)}</td>
                    <td className="py-3.5 px-4 text-right font-mono text-teal-700 font-semibold">
                      ৳{r.revenueShareAmount.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono text-slate-600">৳{r.hostingAllocation.toFixed(2)}</td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-950">
                      ৳{r.totalDue.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                          r.status === 'PAID'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 text-[11px]">{r.dueDate}</td>
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => handleToggleBillingStatus(r.id)}
                        className={`min-h-[36px] px-3 py-1 rounded text-xs font-semibold transition ${
                          r.status === 'PAID'
                            ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            : 'bg-teal-600 text-white hover:bg-teal-700'
                        }`}
                      >
                        {r.status === 'PAID' ? 'Mark Unpaid' : 'Mark as Paid'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Billing Cards */}
          <div className="lg:hidden p-4 space-y-3">
            {billingRecords.map((r) => (
              <div key={r.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-mono font-bold text-slate-900">{r.invoiceNumber}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      r.status === 'PAID' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {r.status}
                  </span>
                </div>
                <div className="font-semibold text-slate-800">{r.storeName}</div>
                <div className="flex justify-between bg-white p-2 rounded border border-slate-200">
                  <span className="text-slate-500">Total Invoice Amount:</span>
                  <span className="font-mono font-bold text-slate-900">৳{r.totalDue.toFixed(2)}</span>
                </div>
                <button
                  onClick={() => handleToggleBillingStatus(r.id)}
                  className="w-full min-h-[40px] bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold text-xs shadow-xs transition"
                >
                  {r.status === 'PAID' ? 'Mark as Unpaid' : 'Confirm Invoice Paid'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 4: GATEWAY FEE STRUCTURES ================= */}
      {activeTab === 'gateways' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {INITIAL_GATEWAYS.map((gw, idx) => (
            <div key={idx} className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CreditCard className="h-5 w-5 text-teal-600" />
                  <h3 className="font-bold text-slate-900 text-sm">{gw.gatewayName}</h3>
                </div>
                <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                  {gw.effectiveFeeRate}% Fee
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-100">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Processed Volume</span>
                  <span className="font-bold font-mono text-slate-900">৳{gw.totalVolume.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Commissions Deducted</span>
                  <span className="font-bold font-mono text-rose-600">৳{gw.totalCommissions.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Active Brands</span>
                  <span className="text-slate-700 font-semibold">{gw.activeBrandCount} Brands</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Settlement Timeline</span>
                  <span className="text-slate-700 font-semibold">{gw.settlementSpeed}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
