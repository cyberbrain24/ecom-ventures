import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Download, RefreshCw } from 'lucide-react';
import { api, apiErrorMessage } from '../lib/api';
import {
  BrandBillingRecord,
  BrandRevenueLeaderboardItem,
  GatewayCostAllocation,
  PortfolioFinancialMetrics,
} from '../types/store';

type AccountsTab = 'leaderboard' | 'consolidated' | 'billing' | 'gateways';

interface ApiEnvelope<T> {
  data: T;
}

interface PortfolioOverviewDto {
  total_gmv: number;
  total_net_cash_flow: number;
  total_platform_fees_earned: number;
  total_active_stores: number;
  total_orders_processed: number;
  average_order_value: number;
  currency: string;
  revenue_by_store: Record<string, number>;
}

interface LeaderboardDto {
  rank: number;
  store_id: string;
  store_name: string;
  store_slug: string;
  gross_sales: number;
  net_revenue: number;
  order_count: number;
  aov: number;
  cogs: number;
  total_expenses: number;
  net_profit: number;
  operating_margin_pct: number;
  platform_fee_paid: number;
  growth_pct: number | null;
  status: string;
}

interface BillingDto {
  id: string;
  store_id: string;
  store_name: string;
  store_slug: string;
  invoice_number: string;
  billing_cycle: BrandBillingRecord['billingCycle'];
  base_fee: number;
  revenue_share_percentage: number;
  revenue_share_amount: number;
  hosting_allocation: number;
  total_due: number;
  currency: string;
  status: BrandBillingRecord['status'];
  due_date: string;
  paid_at?: string;
  created_at: string;
}

const currentPeriod = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

/**
 * Formats an amount with the currency code the API reported. When the API reports no currency,
 * the amount is shown with an explicit "currency not reported" note instead of a default code.
 *
 * @param value - Amount from the API
 * @param currency - Currency code from the API, if any
 * @returns Display text for the amount
 */
const formatMoney = (value: number, currency: string | undefined) => {
  const amount = value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${currency} ${amount}` : `${amount} (currency not reported)`;
};

const csvCell = (value: string | number) => `"${String(value).replace(/"/g, '""')}"`;

export const AccountsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<AccountsTab>('leaderboard');
  const [selectedPeriod, setSelectedPeriod] = useState(currentPeriod);
  const [metrics, setMetrics] = useState<PortfolioFinancialMetrics | null>(null);
  const [revenueByStore, setRevenueByStore] = useState<Record<string, number>>({});
  const [leaderboard, setLeaderboard] = useState<BrandRevenueLeaderboardItem[]>([]);
  const [billingRecords, setBillingRecords] = useState<BrandBillingRecord[]>([]);
  const [gateways, setGateways] = useState<GatewayCostAllocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUpdatingBilling, setIsUpdatingBilling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAccounts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const periodQuery = new URLSearchParams({ period: selectedPeriod });
      const [overviewResponse, leaderboardResponse, billingResponse, gatewaysResponse] = await Promise.all([
        api.get<ApiEnvelope<PortfolioOverviewDto>>('/platform/accounts/overview'),
        api.get<ApiEnvelope<LeaderboardDto[]>>(`/platform/accounts/leaderboard?${periodQuery.toString()}`),
        api.get<ApiEnvelope<BillingDto[]>>('/platform/accounts/billing'),
        api.get<ApiEnvelope<GatewayCostAllocation[]>>('/platform/accounts/gateways'),
      ]);

      const overview = overviewResponse.data.data;
      if (!overview || !Array.isArray(leaderboardResponse.data.data) ||
          !Array.isArray(billingResponse.data.data) || !Array.isArray(gatewaysResponse.data.data)) {
        throw new Error('The accounts API returned an invalid response.');
      }

      setMetrics({
        totalGMV: overview.total_gmv,
        totalNetCashFlow: overview.total_net_cash_flow,
        totalPlatformFeesEarned: overview.total_platform_fees_earned,
        totalActiveStores: overview.total_active_stores,
        totalOrdersProcessed: overview.total_orders_processed,
        averageOrderValue: overview.average_order_value,
        currency: overview.currency,
      });
      setRevenueByStore(overview.revenue_by_store || {});
      setLeaderboard(leaderboardResponse.data.data.map((item) => ({
        rank: item.rank,
        storeId: item.store_id,
        storeName: item.store_name,
        storeSlug: item.store_slug,
        grossSales: item.gross_sales,
        netRevenue: item.net_revenue,
        orderCount: item.order_count,
        aov: item.aov,
        cogs: item.cogs,
        totalExpenses: item.total_expenses,
        netProfit: item.net_profit,
        operatingMarginPct: item.operating_margin_pct,
        platformFeePaid: item.platform_fee_paid,
        growthPct: item.growth_pct,
        status: item.status,
      })));
      setBillingRecords(billingResponse.data.data.map((item) => ({
        id: item.id,
        storeId: item.store_id,
        storeName: item.store_name,
        storeSlug: item.store_slug,
        invoiceNumber: item.invoice_number,
        billingCycle: item.billing_cycle,
        baseFee: item.base_fee,
        revenueSharePercentage: item.revenue_share_percentage,
        revenueShareAmount: item.revenue_share_amount,
        hostingAllocation: item.hosting_allocation,
        totalDue: item.total_due,
        currency: item.currency,
        status: item.status,
        dueDate: item.due_date,
        paidAt: item.paid_at,
        createdAt: item.created_at,
      })));
      setGateways(gatewaysResponse.data.data);
    } catch (loadError) {
      setMetrics(null);
      setRevenueByStore({});
      setLeaderboard([]);
      setBillingRecords([]);
      setGateways([]);
      setError(apiErrorMessage(loadError, 'Could not load portfolio accounts.'));
    } finally {
      setIsLoading(false);
    }
  }, [selectedPeriod]);

  useEffect(() => {
    void fetchAccounts();
  }, [fetchAccounts]);

  const periods = useMemo(() => {
    const now = new Date();
    return Array.from({ length: 12 }, (_, index) => {
      const month = new Date(now.getFullYear(), now.getMonth() - index, 1);
      return `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
    });
  }, []);

  const handleToggleBillingStatus = async (record: BrandBillingRecord) => {
    const nextStatus = record.status === 'PAID' ? 'INVOICED' : 'PAID';
    setIsUpdatingBilling(record.id);
    setError(null);
    try {
      await api.patch(`/platform/accounts/billing/${encodeURIComponent(record.id)}/status`, { status: nextStatus });
      await fetchAccounts();
    } catch (updateError) {
      setError(apiErrorMessage(updateError, 'Could not update billing status.'));
    } finally {
      setIsUpdatingBilling(null);
    }
  };

  const handleExportCSV = () => {
    const rows = activeTab === 'billing'
      ? [
          ['Invoice', 'Store', 'Slug', 'Cycle', 'Base fee', 'Revenue share', 'Hosting', 'Total due', 'Status', 'Due date'],
          ...billingRecords.map((record) => [
            record.invoiceNumber, record.storeName, record.storeSlug, record.billingCycle,
            record.baseFee, record.revenueShareAmount, record.hostingAllocation,
            record.totalDue, record.status, record.dueDate,
          ]),
        ]
      : [
          ['Rank', 'Store', 'Slug', 'Gross sales', 'Net revenue', 'Orders', 'AOV', 'Net profit', 'Platform fee'],
          ...leaderboard.map((record) => [
            record.rank, record.storeName, record.storeSlug, record.grossSales,
            record.netRevenue, record.orderCount, record.aov, record.netProfit, record.platformFeePaid,
          ]),
        ];
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `portfolio-${activeTab}-${selectedPeriod}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const tabs: Array<{ id: AccountsTab; label: string }> = [
    { id: 'leaderboard', label: 'Revenue Leaderboard' },
    { id: 'consolidated', label: 'Cash Flow Rollups' },
    { id: 'billing', label: 'Billing & Invoices' },
    { id: 'gateways', label: 'Gateway Analytics' },
  ];

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-black text-slate-900">Portfolio Accounts</h1>
          <p className="mt-1 text-xs text-slate-500">Financial aggregates and invoices stored by the platform.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={selectedPeriod}
            onChange={(event) => setSelectedPeriod(event.target.value)}
            className="min-h-[40px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs"
            aria-label="Financial period"
          >
            {periods.map((period) => <option key={period} value={period}>{period}</option>)}
          </select>
          <button type="button" onClick={handleExportCSV} disabled={isLoading} className="min-h-[40px] inline-flex items-center gap-1.5 rounded-lg bg-teal-600 px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-50 transition active:scale-95">
            <Download className="h-4 w-4" /> Export CSV
          </button>
          <button type="button" onClick={() => void fetchAccounts()} disabled={isLoading} aria-label="Refresh accounts" className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg border border-slate-200 bg-white p-2 text-slate-600 disabled:opacity-50 transition active:scale-95">
            <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </header>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 whitespace-pre-line">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}
      {isLoading && <p className="text-xs text-slate-500">Loading portfolio data...</p>}

      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5 sm:gap-3">
          {[
            ['Portfolio GMV', formatMoney(metrics.totalGMV, metrics.currency)],
            ['Net cash flow', formatMoney(metrics.totalNetCashFlow, metrics.currency)],
            ['Platform fees', formatMoney(metrics.totalPlatformFeesEarned, metrics.currency)],
            ['Orders processed', metrics.totalOrdersProcessed.toLocaleString()],
            ['Average order value', formatMoney(metrics.averageOrderValue, metrics.currency)],
            ['Active stores', metrics.totalActiveStores.toLocaleString()],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-slate-200 bg-white p-3 sm:p-3.5 shadow-xs">
              <p className="text-[10px] sm:text-[11px] font-semibold uppercase text-slate-500">{label}</p>
              <p className="mt-1 text-xs sm:text-sm font-bold text-slate-900 break-words">{value}</p>
            </div>
          ))}
        </div>
      )}

      <nav className="flex gap-1 overflow-x-auto no-scrollbar border-b border-slate-200 py-0.5" aria-label="Accounts views">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-xs font-bold ${
              activeTab === tab.id ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {activeTab === 'leaderboard' && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr><th className="px-3 py-2">Rank</th><th className="px-3 py-2">Store</th><th className="px-3 py-2 text-right">Gross sales</th><th className="px-3 py-2 text-right">Net revenue</th><th className="px-3 py-2 text-right">Orders</th><th className="px-3 py-2 text-right">AOV</th><th className="px-3 py-2 text-right">Net profit</th><th className="px-3 py-2 text-right">Growth</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leaderboard.map((store) => (
                <tr key={store.storeId}>
                  <td className="px-3 py-2">{store.rank}</td><td className="px-3 py-2 font-semibold">{store.storeName}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(store.grossSales, metrics?.currency)}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(store.netRevenue, metrics?.currency)}</td>
                  <td className="px-3 py-2 text-right">{store.orderCount}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(store.aov, metrics?.currency)}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(store.netProfit, metrics?.currency)}</td>
                  <td className="px-3 py-2 text-right">{store.growthPct == null ? '—' : `${store.growthPct.toFixed(1)}%`}</td>
                </tr>
              ))}
              {!isLoading && leaderboard.length === 0 && <tr><td colSpan={8} className="px-3 py-8 text-center text-slate-500">No financial summaries are stored for this period.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'consolidated' && (
        <section className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">Revenue by store</h2>
            <div className="mt-3 space-y-3">
              {Object.entries(revenueByStore).map(([name, revenue]) => (
                <div key={name} className="flex justify-between gap-3 text-xs">
                  <span>{name}</span><span className="font-semibold">{formatMoney(revenue, metrics?.currency)}</span>
                </div>
              ))}
              {!isLoading && Object.keys(revenueByStore).length === 0 && <p className="text-xs text-slate-500">No store revenue summaries are stored.</p>}
            </div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-bold text-slate-900">Stored portfolio totals</h2>
            {metrics && <dl className="mt-3 space-y-2 text-xs">
              <div className="flex justify-between"><dt>Gross sales</dt><dd>{formatMoney(metrics.totalGMV, metrics.currency)}</dd></div>
              <div className="flex justify-between"><dt>Net sales</dt><dd>{formatMoney(metrics.totalNetCashFlow, metrics.currency)}</dd></div>
              <div className="flex justify-between"><dt>Platform fees</dt><dd>{formatMoney(metrics.totalPlatformFeesEarned, metrics.currency)}</dd></div>
              <div className="flex justify-between"><dt>Orders</dt><dd>{metrics.totalOrdersProcessed.toLocaleString()}</dd></div>
            </dl>}
            {!metrics && !isLoading && <p className="mt-3 text-xs text-slate-500">Financial totals are unavailable.</p>}
          </div>
        </section>
      )}

      {activeTab === 'billing' && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500">
              <tr><th className="px-3 py-2">Invoice</th><th className="px-3 py-2">Store</th><th className="px-3 py-2 text-right">Total due</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Due date</th><th className="px-3 py-2">Action</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {billingRecords.map((record) => (
                <tr key={record.id}>
                  <td className="px-3 py-2 font-mono">{record.invoiceNumber}</td><td className="px-3 py-2">{record.storeName}</td>
                  <td className="px-3 py-2 text-right">{formatMoney(record.totalDue, record.currency)}</td><td className="px-3 py-2">{record.status}</td>
                  <td className="px-3 py-2">{record.dueDate}</td>
                  <td className="px-3 py-2"><button type="button" disabled={isUpdatingBilling === record.id} onClick={() => void handleToggleBillingStatus(record)} className="rounded bg-teal-600 px-2.5 py-1.5 text-white disabled:opacity-50">{isUpdatingBilling === record.id ? 'Saving...' : record.status === 'PAID' ? 'Mark invoiced' : 'Mark paid'}</button></td>
                </tr>
              ))}
              {!isLoading && billingRecords.length === 0 && <tr><td colSpan={6} className="px-3 py-8 text-center text-slate-500">No billing records are stored.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'gateways' && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-center text-xs text-slate-500">
          {gateways.length === 0
            ? 'Gateway cost analytics are not stored by the platform yet.'
            : `${gateways.length} gateway allocation records were returned.`}
        </div>
      )}
    </div>
  );
};
