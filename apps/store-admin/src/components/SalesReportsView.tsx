import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  Edit3,
  RefreshCw,
  ShoppingBag,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import { StoreBrand } from '../types/store';
import { formatMoney } from '../lib/format';
import {
  fetchSalesReport,
  SalesReportPreset,
  SalesReportResponse,
  StatusBreakdown,
  updateUsdExchangeRate,
} from '../lib/reports-api';

interface SalesReportsViewProps {
  currentStore: StoreBrand;
}

const PRESET_OPTIONS: { value: SalesReportPreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'last_7_days', label: 'Last 7 Days' },
  { value: 'last_30_days', label: 'Last 30 Days' },
  { value: 'this_month', label: 'This Month' },
  { value: 'custom', label: 'Custom Range' },
];

const CORE_STATUS_ORDER = [
  'placed',
  'review',
  'pending',
  'hold',
  'approval_pending',
  'confirmed',
  'processing',
  'shipped',
  'delayed',
  'delivered',
  'partially_delivered',
  'returned',
  'cancelled',
  'manually_cancelled',
  'refunded',
];

export const SalesReportsView: React.FC<SalesReportsViewProps> = ({ currentStore }) => {
  const [preset, setPreset] = useState<SalesReportPreset>('today');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [report, setReport] = useState<SalesReportResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Interactive client-side status filter
  const [activeStatuses, setActiveStatuses] = useState<Set<string>>(new Set());

  // Inline USD exchange rate editor
  const [editingUsdRate, setEditingUsdRate] = useState<boolean>(false);
  const [usdRateInput, setUsdRateInput] = useState<string>('132.00');
  const [savingUsdRate, setSavingUsdRate] = useState<boolean>(false);
  const [usdRateError, setUsdRateError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    if (preset === 'custom' && (!dateFrom || !dateTo)) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetchSalesReport({
        preset,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      });
      setReport(res);
      setUsdRateInput(res.snapshot.usd_rate.toFixed(2));
      const initialActive = new Set<string>();
      Object.values(res.status_report || {}).forEach((st) => {
        if (st.default_active) {
          initialActive.add(st.key);
        }
      });
      setActiveStatuses(initialActive);
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Failed to load sales report.');
    } finally {
      setLoading(false);
    }
  }, [preset, dateFrom, dateTo]);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  const orderedStatuses = useMemo<StatusBreakdown[]>(() => {
    if (!report?.status_report) return [];
    const entries = Object.values(report.status_report);
    return entries.sort((a, b) => {
      const idxA = CORE_STATUS_ORDER.indexOf(a.key);
      const idxB = CORE_STATUS_ORDER.indexOf(b.key);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [report]);

  // Real-time client-side recalculation on status checkbox toggle or USD rate update
  const liveSnapshot = useMemo(() => {
    if (!report) {
      return {
        orders_qty: 0,
        product_qty: 0,
        total_amount: 0,
        aov: 0,
        product_costing: 0,
        meta_ads_usd: 0,
        usd_rate: 132,
        meta_ads_costing: 0,
        fixed_expense: 0,
        total_profit: 0,
      };
    }

    let orders = 0;
    let products = 0;
    let amount = 0;
    let costing = 0;

    activeStatuses.forEach((key) => {
      const item = report.status_report[key];
      if (item) {
        orders += item.orders;
        products += item.products;
        amount += item.value;
        costing += item.costing;
      }
    });

    const aov = orders > 0 ? amount / orders : 0;
    const usdRate = report.snapshot.usd_rate || 132;
    const metaAdsUsd = report.snapshot.meta_ads_usd || 0;
    const metaAdsCosting = Math.round(metaAdsUsd * usdRate * 100) / 100;
    const fixedExpense = report.snapshot.fixed_expense || 0;
    const totalProfit = amount - costing - metaAdsCosting - fixedExpense;

    return {
      orders_qty: orders,
      product_qty: products,
      total_amount: amount,
      aov,
      product_costing: costing,
      meta_ads_usd: metaAdsUsd,
      usd_rate: usdRate,
      meta_ads_costing: metaAdsCosting,
      fixed_expense: fixedExpense,
      total_profit: totalProfit,
    };
  }, [report, activeStatuses]);

  const toggleStatus = (key: string) => {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleSaveUsdRate = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(usdRateInput);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 10000) {
      setUsdRateError('Enter a valid rate > 0');
      return;
    }
    setSavingUsdRate(true);
    setUsdRateError(null);
    try {
      const res = await updateUsdExchangeRate(parsed);
      setReport((prev) =>
        prev
          ? {
              ...prev,
              snapshot: {
                ...prev.snapshot,
                usd_rate: res.usd_rate,
              },
            }
          : prev,
      );
      setEditingUsdRate(false);
    } catch (err: any) {
      setUsdRateError(err?.detail || err?.message || 'Failed to update USD rate');
    } finally {
      setSavingUsdRate(false);
    }
  };

  const currency = report?.currency || currentStore.currency || 'BDT';
  const presetLabel = PRESET_OPTIONS.find((p) => p.value === preset)?.label || 'Report';
  const isProfitPositive = liveSnapshot.total_profit >= 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '12px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '18px 22px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
            Sales Reports
          </h1>
          <p style={{ fontSize: '13px', color: '#64748B', margin: '4px 0 0 0' }}>
            Independent modular analytics for {currentStore.name}
            {report ? ` • ${report.date_from === report.date_to ? report.date_from : `${report.date_from} to ${report.date_to}`} (${report.timezone})` : ''}
          </p>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={14} color="#64748B" />
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value as SalesReportPreset)}
              style={{
                border: '1px solid #CBD5E1',
                borderRadius: '8px',
                padding: '7px 12px',
                fontSize: '13px',
                fontWeight: 500,
                color: '#0F172A',
                backgroundColor: '#FFFFFF',
              }}
            >
              {PRESET_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {preset === 'custom' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                style={{
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  fontSize: '13px',
                }}
              />
              <span style={{ fontSize: '12px', color: '#64748B' }}>to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                style={{
                  border: '1px solid #CBD5E1',
                  borderRadius: '8px',
                  padding: '6px 10px',
                  fontSize: '13px',
                }}
              />
            </div>
          )}

          <button
            onClick={() => void loadReport()}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 12px',
              borderRadius: '8px',
              border: '1px solid #CBD5E1',
              backgroundColor: '#F8FAFC',
              color: '#0F172A',
              fontSize: '13px',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#991B1B',
            borderRadius: '10px',
            padding: '12px 16px',
            fontSize: '13px',
          }}
        >
          {error}
        </div>
      )}

      {/* Timeframe Title + Active Orders Pill */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
          {preset === 'today' ? "Today's Report" : `${presetLabel} Report`}
        </h2>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            backgroundColor: '#ECFDF5',
            color: '#047857',
            border: '1px solid #A7F3D0',
            borderRadius: '9999px',
            padding: '2px 10px',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          <ShoppingBag size={12} />
          {liveSnapshot.orders_qty} {liveSnapshot.orders_qty === 1 ? 'Order' : 'Orders'}
        </span>
      </div>

      {/* 2-Column Executive Summary Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
          gap: '16px',
        }}
      >
        {/* Card 1: Order Summary */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Order Summary
              </h3>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                Volume, order values &amp; item velocity
              </p>
            </div>
            <span
              style={{
                backgroundColor: '#F1F5F9',
                color: '#334155',
                borderRadius: '9999px',
                padding: '3px 10px',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              {liveSnapshot.orders_qty} {liveSnapshot.orders_qty === 1 ? 'Order' : 'Orders'}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <MetricTile label="Total Orders" value={String(liveSnapshot.orders_qty)} />
            <MetricTile label="Total Products" value={String(liveSnapshot.product_qty)} />
            <MetricTile
              label="Total Orders Amount"
              value={formatMoney(currency, liveSnapshot.total_amount)}
            />
            <MetricTile
              label="Average Order Value"
              value={formatMoney(currency, liveSnapshot.aov)}
            />
          </div>
        </div>

        {/* Card 2: Profit / Loss Statement */}
        <div
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid #E2E8F0',
            borderRadius: '12px',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
            <div>
              <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Profit / Loss Statement
              </h3>
              <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0 0' }}>
                Orders − COGS − Meta Ad Spend{liveSnapshot.fixed_expense > 0 ? ' − Expenses' : ''}
              </p>
            </div>

            {!editingUsdRate ? (
              <button
                type="button"
                onClick={() => {
                  setUsdRateInput((report?.snapshot.usd_rate || 132).toFixed(2));
                  setUsdRateError(null);
                  setEditingUsdRate(true);
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #CBD5E1',
                  borderRadius: '9999px',
                  padding: '3px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#334155',
                  cursor: 'pointer',
                }}
              >
                <span>USD Rate: {liveSnapshot.usd_rate.toFixed(2)}</span>
                <Edit3 size={11} />
              </button>
            ) : (
              <form
                onSubmit={(e) => void handleSaveUsdRate(e)}
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={usdRateInput}
                  onChange={(e) => setUsdRateInput(e.target.value)}
                  style={{
                    width: '82px',
                    border: '1px solid #059669',
                    borderRadius: '6px',
                    padding: '3px 7px',
                    fontSize: '12px',
                    fontWeight: 600,
                  }}
                />
                <button
                  type="submit"
                  disabled={savingUsdRate}
                  title="Save USD Rate"
                  style={{
                    border: 'none',
                    backgroundColor: '#059669',
                    color: '#FFFFFF',
                    borderRadius: '6px',
                    padding: '4px 6px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                  }}
                >
                  <Check size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingUsdRate(false)}
                  title="Cancel"
                  style={{
                    border: '1px solid #CBD5E1',
                    backgroundColor: '#FFFFFF',
                    color: '#64748B',
                    borderRadius: '6px',
                    padding: '4px 6px',
                    cursor: 'pointer',
                    display: 'inline-flex',
                  }}
                >
                  <X size={12} />
                </button>
              </form>
            )}
          </div>

          {usdRateError && (
            <div style={{ fontSize: '12px', color: '#DC2626' }}>{usdRateError}</div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <MetricTile
              label="Total Order Amounts"
              value={formatMoney(currency, liveSnapshot.total_amount)}
            />
            <MetricTile
              label="Total Product Costing"
              value={formatMoney(currency, liveSnapshot.product_costing)}
            />
            <MetricTile
              label="Meta Ads Costing"
              value={formatMoney(currency, liveSnapshot.meta_ads_costing)}
              subtext={`($${liveSnapshot.meta_ads_usd.toFixed(2)} USD)`}
            />
            <MetricTile
              label="Total Profit"
              value={`${isProfitPositive ? '+' : '-'}${formatMoney(currency, Math.abs(liveSnapshot.total_profit))}`}
              highlight={isProfitPositive ? 'positive' : 'negative'}
              icon={isProfitPositive ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            />
          </div>
        </div>
      </div>

      {/* Order Status Breakdown */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
            Order Status Breakdown
          </h2>
          <span style={{ fontSize: '12px', color: '#64748B' }}>
            Toggle checkboxes to recalculate totals in real time
          </span>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
            gap: '12px',
          }}
        >
          {orderedStatuses.map((st) => {
            const isChecked = activeStatuses.has(st.key);
            const livePct =
              isChecked && liveSnapshot.orders_qty > 0
                ? ((st.orders / liveSnapshot.orders_qty) * 100).toFixed(1)
                : '0.0';

            return (
              <label
                key={st.key}
                style={{
                  backgroundColor: isChecked ? '#FFFFFF' : '#F8FAFC',
                  border: isChecked ? '1px solid #CBD5E1' : '1px dashed #CBD5E1',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  opacity: isChecked ? 1 : 0.72,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #F1F5F9',
                    paddingBottom: '8px',
                  }}
                >
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#0F172A', letterSpacing: '0.02em' }}>
                    {st.name}
                  </span>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => toggleStatus(st.key)}
                    style={{ width: '15px', height: '15px', accentColor: '#059669', cursor: 'pointer' }}
                  />
                </div>

                <BreakdownRow label="Orders:" value={String(st.orders)} />
                <BreakdownRow label="Products:" value={String(st.products)} />
                <BreakdownRow label="Percentage Rate:" value={`${livePct}%`} />
                <BreakdownRow label="Value:" value={formatMoney(currency, st.value)} bold />
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const MetricTile: React.FC<{
  label: string;
  value: string;
  subtext?: string;
  highlight?: 'positive' | 'negative';
  icon?: React.ReactNode;
}> = ({ label, value, subtext, highlight, icon }) => {
  const bg =
    highlight === 'positive'
      ? '#ECFDF5'
      : highlight === 'negative'
      ? '#FEF2F2'
      : '#F8FAFC';
  const border =
    highlight === 'positive'
      ? '#A7F3D0'
      : highlight === 'negative'
      ? '#FECACA'
      : '#E2E8F0';
  const color =
    highlight === 'positive'
      ? '#047857'
      : highlight === 'negative'
      ? '#B91C1C'
      : '#0F172A';

  return (
    <div
      style={{
        backgroundColor: bg,
        border: `1px solid ${border}`,
        borderRadius: '10px',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}
    >
      <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748B' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: '18px',
            fontWeight: 700,
            color,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
          }}
        >
          {icon}
          {value}
        </span>
        {subtext && <span style={{ fontSize: '12px', color: '#64748B' }}>{subtext}</span>}
      </div>
    </div>
  );
};

const BreakdownRow: React.FC<{ label: string; value: string; bold?: boolean }> = ({
  label,
  value,
  bold,
}) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
    <span style={{ color: '#64748B' }}>{label}</span>
    <span style={{ color: '#0F172A', fontWeight: bold ? 700 : 600 }}>{value}</span>
  </div>
);
