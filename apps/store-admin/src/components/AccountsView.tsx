import React, { useState } from 'react';
import {
  DollarSign,
  TrendingUp,
  Receipt,
  Download,
  Plus,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Building,
  CreditCard,
  PieChart,
  Trash2,
  X,
  FileSpreadsheet,
  Calendar,
  Layers,
  ShoppingBag,
  Truck,
} from 'lucide-react';
import {
  AccountTransactionRecord,
  StoreExpenseRecord,
  StorePayoutRecord,
  PaymentReconciliationItem,
  StoreBrand,
} from '../types/store';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface AccountsViewProps {
  currentStore: StoreBrand;
  transactions: AccountTransactionRecord[];
  expenses: StoreExpenseRecord[];
  payouts: StorePayoutRecord[];
  reconciliations: PaymentReconciliationItem[];
  onAddExpense: (expense: StoreExpenseRecord) => void;
  onDeleteExpense: (id: string) => void;
}

type AccountsSubTab = 'overview' | 'transactions' | 'expenses' | 'reconciliation' | 'pnl';

export const AccountsView: React.FC<AccountsViewProps> = ({
  currentStore,
  transactions,
  expenses,
  payouts,
  reconciliations,
  onAddExpense,
  onDeleteExpense,
}) => {
  const [activeTab, setActiveTab] = useState<AccountsSubTab>('overview');
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [deletingExpense, setDeletingExpense] = useState<StoreExpenseRecord | null>(null);
  const [reconcileFilter, setReconcileFilter] = useState<'ALL' | 'RECONCILED' | 'DISCREPANCY'>('ALL');
  const [selectedPnlMonth, setSelectedPnlMonth] = useState('2026-11');

  // Form state for Log Expense Modal
  const [expenseForm, setExpenseForm] = useState({
    title: '',
    category: 'Packaging' as StoreExpenseRecord['category'],
    amount: '',
    expenseDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  // Financial Calculations
  const grossRevenue = transactions
    .filter((t) => t.status === 'PAID')
    .reduce((acc, t) => acc + t.grossAmount, 0);

  const totalGatewayFees = transactions
    .filter((t) => t.status === 'PAID')
    .reduce((acc, t) => acc + t.gatewayFee, 0);

  const totalShippingDeductions = transactions
    .filter((t) => t.status === 'PAID')
    .reduce((acc, t) => acc + t.shippingDeduction, 0);

  const netRevenue = transactions
    .filter((t) => t.status === 'PAID')
    .reduce((acc, t) => acc + t.netPayout, 0);

  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);

  const totalPayoutsReceived = payouts
    .filter((p) => p.status === 'COMPLETED')
    .reduce((acc, p) => acc + p.amount, 0);

  // Baseline COGS estimate (40% of gross sales)
  const estimatedCOGS = grossRevenue * 0.40;
  const grossProfit = grossRevenue - estimatedCOGS;
  const netProfit = netRevenue - estimatedCOGS - totalExpenses;
  const operatingMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;
  const grossMargin = grossRevenue > 0 ? (grossProfit / grossRevenue) * 100 : 0;

  // Monthly-scoped P&L calculations based on selectedPnlMonth
  const pnlTransactions = transactions.filter(
    (t) => !selectedPnlMonth || t.timestamp.startsWith(selectedPnlMonth)
  );
  const pnlPaidTransactions = pnlTransactions.filter((t) => t.status === 'PAID');
  const pnlGrossRevenue = pnlPaidTransactions.reduce((acc, t) => acc + t.grossAmount, 0);
  const pnlTotalGatewayFees = pnlPaidTransactions.reduce((acc, t) => acc + t.gatewayFee, 0);
  const pnlTotalShippingDeductions = pnlPaidTransactions.reduce((acc, t) => acc + t.shippingDeduction, 0);
  const pnlNetRevenue = pnlPaidTransactions.reduce((acc, t) => acc + t.netPayout, 0);
  const pnlExpenses = expenses.filter(
    (e) => !selectedPnlMonth || e.expenseDate.startsWith(selectedPnlMonth)
  );
  const pnlTotalExpenses = pnlExpenses.reduce((acc, e) => acc + e.amount, 0);
  const pnlEstimatedCOGS = pnlGrossRevenue * 0.40;
  const pnlGrossProfit = pnlGrossRevenue - pnlEstimatedCOGS;
  const pnlNetProfit = pnlNetRevenue - pnlEstimatedCOGS - pnlTotalExpenses;
  const pnlGrossMargin = pnlGrossRevenue > 0 ? (pnlGrossProfit / pnlGrossRevenue) * 100 : 0;
  const pnlOperatingMargin = pnlGrossRevenue > 0 ? (pnlNetProfit / pnlGrossRevenue) * 100 : 0;

  // Unsettled / Discrepancies count
  const pendingSettlementCount = transactions.filter((t) => t.settlementStatus === 'UNSETTLED').length;
  const discrepanciesCount = reconciliations.filter((r) => !r.reconciled).length;

  const handleSubmitExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(expenseForm.amount);
    if (!expenseForm.title.trim() || isNaN(amountNum) || amountNum <= 0) return;

    const newExpense: StoreExpenseRecord = {
      id: `exp_${Date.now()}`,
      title: expenseForm.title.trim(),
      category: expenseForm.category,
      amount: amountNum,
      currency: currentStore.currency,
      expenseDate: expenseForm.expenseDate,
      notes: expenseForm.notes.trim() || undefined,
      loggedBy: 'Current Operator',
    };

    onAddExpense(newExpense);
    setExpenseModalOpen(false);
    setExpenseForm({
      title: '',
      category: 'Packaging',
      amount: '',
      expenseDate: new Date().toISOString().split('T')[0],
      notes: '',
    });
  };

  const handleExportCSV = (type: 'transactions' | 'expenses' | 'pnl') => {
    let csvContent = 'data:text/csv;charset=utf-8,';
    let filename = `${currentStore.slug}_${type}_${new Date().toISOString().split('T')[0]}.csv`;

    if (type === 'transactions') {
      csvContent += 'Order Number,Date,Customer,Gateway,Gross Amount,Gateway Fee,Shipping Deduction,Net Payout,Settlement Status\n';
      transactions.forEach((t) => {
        csvContent += `"${t.orderNumber}","${t.timestamp}","${t.customerName}","${t.gateway}",${t.grossAmount},${t.gatewayFee},${t.shippingDeduction},${t.netPayout},"${t.settlementStatus}"\n`;
      });
    } else if (type === 'expenses') {
      csvContent += 'Date,Category,Title,Logged By,Currency,Amount,Notes\n';
      expenses.forEach((e) => {
        csvContent += `"${e.expenseDate}","${e.category}","${e.title}","${e.loggedBy}","${e.currency}",${e.amount},"${e.notes || ''}"\n`;
      });
    } else {
      csvContent += 'Metric,Amount (BDT),Percentage / Formula\n';
      csvContent += `Gross Sales Revenue,${grossRevenue.toFixed(2)},100.0%\n`;
      csvContent += `Less: Gateway Commissions,-${totalGatewayFees.toFixed(2)},-${((totalGatewayFees / (grossRevenue || 1)) * 100).toFixed(1)}%\n`;
      csvContent += `Less: Shipping Deductions,-${totalShippingDeductions.toFixed(2)},-${((totalShippingDeductions / (grossRevenue || 1)) * 100).toFixed(1)}%\n`;
      csvContent += `Net Realized Sales,${netRevenue.toFixed(2)},Net Inflow\n`;
      csvContent += `Estimated COGS (40%),-${estimatedCOGS.toFixed(2)},-40.0%\n`;
      csvContent += `Gross Operating Profit,${grossProfit.toFixed(2)},${grossMargin.toFixed(1)}% Gross Margin\n`;
      csvContent += `Total Operating Expenses (OPEX),-${totalExpenses.toFixed(2)},Logged Operational Costs\n`;
      csvContent += `Net EBIT Profit,${netProfit.toFixed(2)},${operatingMargin.toFixed(1)}% Operating Margin\n`;
    }

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredReconciliations = reconciliations.filter((r) => {
    if (reconcileFilter === 'RECONCILED') return r.reconciled;
    if (reconcileFilter === 'DISCREPANCY') return !r.reconciled;
    return true;
  });

  return (
    <div>
      {/* Top Header & Global Actions */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', margin: 0, letterSpacing: '-0.02em' }}>
              Accounts & P&L Financial Ledger
            </h1>
            <span
              style={{
                fontSize: '0.68rem',
                fontWeight: 700,
                padding: '2px 8px',
                borderRadius: '6px',
                backgroundColor: '#f0fdf4',
                color: '#15803d',
                border: '1px solid #bbf7d0',
                letterSpacing: '0.04em',
              }}
            >
              STORE LEDGER ACTIVE
            </span>
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Financial reconciliation, order settlement tracking, expense logging, and real-time P&L visibility for{' '}
            <strong style={{ color: 'var(--text-main)' }}>{currentStore.name}</strong>.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={() => handleExportCSV(activeTab === 'expenses' ? 'expenses' : activeTab === 'pnl' ? 'pnl' : 'transactions')}
            className="btn btn-secondary btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 14px',
              fontSize: '0.8rem',
              fontWeight: 600,
            }}
          >
            <Download size={15} />
            <span>Export Ledger (CSV)</span>
          </button>

          <button
            onClick={() => setExpenseModalOpen(true)}
            className="btn btn-primary btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '7px 16px',
              backgroundColor: '#0f766e',
              fontSize: '0.8rem',
              fontWeight: 700,
            }}
          >
            <Plus size={16} />
            <span>Log Operational Expense</span>
          </button>
        </div>
      </div>

      {/* Quick Status Bar: Unsettled & Discrepancy Alerts */}
      {(pendingSettlementCount > 0 || discrepanciesCount > 0) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            padding: '10px 14px',
            backgroundColor: '#fffbeb',
            border: '1px solid #fef3c7',
            borderRadius: 'var(--radius-md)',
            marginBottom: '18px',
            fontSize: '0.8rem',
            color: '#92400e',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} style={{ color: '#d97706', flexShrink: 0 }} />
            <span>
              <strong style={{ color: '#78350f' }}>Financial Attention:</strong> {pendingSettlementCount} order(s) pending courier/gateway settlement,{' '}
              {discrepanciesCount} payment discrepancy flagged for audit.
            </span>
          </div>
          <button
            onClick={() => setActiveTab('reconciliation')}
            style={{
              background: 'none',
              border: 'none',
              color: '#0284c7',
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: '0.78rem',
              textDecoration: 'underline',
            }}
          >
            View Reconciliation Pipeline →
          </button>
        </div>
      )}

      {/* Navigation Sub-Tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          marginBottom: '20px',
          overflowX: 'auto',
          gap: '4px',
        }}
      >
        {[
          { key: 'overview', label: 'Cash Flow Overview', icon: DollarSign },
          { key: 'transactions', label: 'Order Transactions', icon: CreditCard, count: transactions.length },
          { key: 'expenses', label: 'Expense Tracker', icon: Receipt, count: expenses.length },
          { key: 'reconciliation', label: 'Payment Reconciliation', icon: Clock, count: discrepanciesCount },
          { key: 'pnl', label: 'P&L Statement (Monthly)', icon: PieChart },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as AccountsSubTab)}
              className="touch-btn"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 16px',
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2px solid #0f766e' : '2px solid transparent',
                color: isActive ? '#0f766e' : 'var(--text-muted)',
                fontWeight: isActive ? 700 : 500,
                fontSize: '0.84rem',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    padding: '2px 7px',
                    borderRadius: '10px',
                    backgroundColor: isActive ? '#ccfbf1' : '#f1f5f9',
                    color: isActive ? '#0f766e' : '#64748b',
                    fontWeight: 700,
                  }}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ================= TAB 1: OVERVIEW & CASH FLOW ================= */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          {/* Key Financial Metrics - 7 Column Box Card Design */}
          <div className="stats-grid">
            {/* 1. Gross Revenue */}
            <div className="stat-card">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="stat-label">Gross Revenue</div>
                <div className="stat-val">৳{Math.round(grossRevenue).toLocaleString()}</div>
                <div className="stat-sub" style={{ color: '#0284c7' }}>
                  <TrendingUp size={11} /> 100% Inflow
                </div>
              </div>
              <div className="stat-icon" style={{ background: '#f0f9ff', color: '#0284c7' }}>
                <TrendingUp size={16} />
              </div>
            </div>

            {/* 2. Gateway Fees */}
            <div className="stat-card">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="stat-label">Gateway Fees</div>
                <div className="stat-val" style={{ color: '#d97706' }}>৳{Math.round(totalGatewayFees).toLocaleString()}</div>
                <div className="stat-sub" style={{ color: '#b45309' }}>
                  <CreditCard size={11} /> bKash/Nagad/SSL
                </div>
              </div>
              <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                <CreditCard size={16} />
              </div>
            </div>

            {/* 3. Courier Deductions */}
            <div className="stat-card">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="stat-label">Courier Fees</div>
                <div className="stat-val" style={{ color: '#ea580c' }}>৳{Math.round(totalShippingDeductions).toLocaleString()}</div>
                <div className="stat-sub" style={{ color: '#c2410c' }}>
                  <Truck size={11} /> Logistics charges
                </div>
              </div>
              <div className="stat-icon" style={{ background: '#ffedd5', color: '#ea580c' }}>
                <Truck size={16} />
              </div>
            </div>

            {/* 4. Net Sales Revenue */}
            <div className="stat-card">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="stat-label">Net Sales</div>
                <div className="stat-val" style={{ color: '#059669' }}>৳{Math.round(netRevenue).toLocaleString()}</div>
                <div className="stat-sub" style={{ color: '#059669', fontWeight: 600 }}>
                  <DollarSign size={11} /> Settled capital
                </div>
              </div>
              <div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                <DollarSign size={16} />
              </div>
            </div>

            {/* 5. COGS */}
            <div className="stat-card">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="stat-label">Est. COGS</div>
                <div className="stat-val" style={{ color: '#64748b' }}>৳{Math.round(estimatedCOGS).toLocaleString()}</div>
                <div className="stat-sub" style={{ color: '#94a3b8' }}>
                  <Layers size={11} /> 40% production
                </div>
              </div>
              <div className="stat-icon" style={{ background: '#f1f5f9', color: '#64748b' }}>
                <Layers size={16} />
              </div>
            </div>

            {/* 6. Operational OPEX */}
            <div className="stat-card">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="stat-label">Total OPEX</div>
                <div className="stat-val" style={{ color: '#ef4444' }}>৳{Math.round(totalExpenses).toLocaleString()}</div>
                <div className="stat-sub" style={{ color: '#dc2626' }}>
                  <Receipt size={11} /> Marketing & Ops
                </div>
              </div>
              <div className="stat-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
                <Receipt size={16} />
              </div>
            </div>

            {/* 7. Net Profit (EBIT) */}
            <div className="stat-card" style={{ borderLeft: netProfit >= 0 ? '3px solid #10b981' : '3px solid #ef4444' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="stat-label">Net EBIT</div>
                <div className="stat-val" style={{ color: netProfit >= 0 ? '#10b981' : '#ef4444' }}>
                  ৳{Math.round(netProfit).toLocaleString()}
                </div>
                <div className="stat-sub" style={{ color: netProfit >= 0 ? '#059669' : '#dc2626', fontWeight: 700 }}>
                  {operatingMargin.toFixed(1)}% margin
                </div>
              </div>
              <div className="stat-icon" style={{ background: netProfit >= 0 ? '#dcfce7' : '#fee2e2', color: netProfit >= 0 ? '#15803d' : '#b91c1c' }}>
                <CheckCircle2 size={16} />
              </div>
            </div>
          </div>

          {/* Revenue Deductions & Margin Breakdown Card */}
          <div
            className="card"
            style={{
              padding: '20px',
              backgroundColor: '#ffffff',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  Cash Flow Waterfall & Value Retention
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                  Visual breakdown of revenue deductions, COGS allocations, and net profit retention.
                </p>
              </div>
              <span
                style={{
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  color: '#059669',
                  backgroundColor: '#ecfdf5',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #a7f3d0',
                }}
              >
                {operatingMargin.toFixed(1)}% Net Operating Margin
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-main)', fontWeight: 600 }}>Gross Revenue Inflow</span>
                  <span style={{ color: 'var(--text-main)', fontWeight: 700, fontFamily: 'monospace' }}>
                    100.0% ({currentStore.currency} {grossRevenue.toFixed(2)})
                  </span>
                </div>
                <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: '100%', height: '100%', backgroundColor: '#0284c7' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                  <span style={{ color: '#475569', fontWeight: 500 }}>Gateway & Courier Commission Deductions</span>
                  <span style={{ color: '#dc2626', fontWeight: 700, fontFamily: 'monospace' }}>
                    -{((totalGatewayFees + totalShippingDeductions) / (grossRevenue || 1) * 100).toFixed(1)}% ({currentStore.currency} {(totalGatewayFees + totalShippingDeductions).toFixed(2)})
                  </span>
                </div>
                <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, ((totalGatewayFees + totalShippingDeductions) / (grossRevenue || 1)) * 100)}%`,
                      height: '100%',
                      backgroundColor: '#ef4444',
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                  <span style={{ color: '#475569', fontWeight: 500 }}>Cost of Goods Sold (COGS approx 40%)</span>
                  <span style={{ color: '#d97706', fontWeight: 700, fontFamily: 'monospace' }}>
                    -40.0% ({currentStore.currency} {estimatedCOGS.toFixed(2)})
                  </span>
                </div>
                <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ width: '40%', height: '100%', backgroundColor: '#f59e0b' }} />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                  <span style={{ color: '#475569', fontWeight: 500 }}>Operational Expenses</span>
                  <span style={{ color: '#e11d48', fontWeight: 700, fontFamily: 'monospace' }}>
                    -{(totalExpenses / (grossRevenue || 1) * 100).toFixed(1)}% ({currentStore.currency} {totalExpenses.toFixed(2)})
                  </span>
                </div>
                <div style={{ height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.min(100, (totalExpenses / (grossRevenue || 1)) * 100)}%`,
                      height: '100%',
                      backgroundColor: '#f43f5e',
                    }}
                  />
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                  <span style={{ color: '#059669', fontWeight: 700 }}>Retained Net Profit</span>
                  <span style={{ color: '#059669', fontWeight: 800, fontFamily: 'monospace' }}>
                    {operatingMargin.toFixed(1)}% ({currentStore.currency} {netProfit.toFixed(2)})
                  </span>
                </div>
                <div style={{ height: '10px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${Math.max(0, Math.min(100, operatingMargin))}%`,
                      height: '100%',
                      backgroundColor: '#10b981',
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Bank Settlements & Payouts Card */}
          <div
            className="card"
            style={{
              padding: '20px',
              backgroundColor: '#ffffff',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                  Merchant Bank Settlements & Payouts
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
                  Settlements transferred from payment gateways to brand owner bank accounts.
                </p>
              </div>
              <span
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 700,
                  color: '#059669',
                  fontFamily: 'monospace',
                  backgroundColor: '#ecfdf5',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #a7f3d0',
                }}
              >
                Total Disbursed: {currentStore.currency} {totalPayoutsReceived.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {payouts.map((po) => (
                <div
                  key={po.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    flexWrap: 'wrap',
                    gap: '10px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        padding: '8px',
                        borderRadius: '8px',
                        backgroundColor: po.status === 'COMPLETED' ? '#ecfdf5' : '#fffbeb',
                        color: po.status === 'COMPLETED' ? '#059669' : '#d97706',
                        border: `1px solid ${po.status === 'COMPLETED' ? '#a7f3d0' : '#fef3c7'}`,
                      }}
                    >
                      <Building size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)' }}>
                        {po.payoutReference} — {po.gateway}
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        {po.destinationBank} ({po.accountNumberMask}) • Cycle: {po.period}
                      </div>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'monospace' }}>
                      {po.currency} {po.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </div>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        fontWeight: 700,
                        color: po.status === 'COMPLETED' ? '#059669' : '#d97706',
                        textTransform: 'uppercase',
                      }}
                    >
                      {po.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ================= TAB 2: ORDER TRANSACTIONS ================= */}
      {activeTab === 'transactions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Desktop Table View */}
          <div className="desktop-table-view table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ padding: '12px' }}>Order & Date</th>
                  <th style={{ padding: '12px' }}>Customer</th>
                  <th style={{ padding: '12px' }}>Gateway</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Gross Amount</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Gateway Fee</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Courier Deduct</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Net Payout</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Settlement</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px' }}>
                      <div style={{ fontWeight: 700, color: 'var(--text-main)', fontFamily: 'monospace' }}>{tx.orderNumber}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{tx.timestamp}</div>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-main)', fontWeight: 500 }}>{tx.customerName}</td>
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: '#f0f9ff',
                          color: '#0284c7',
                          border: '1px solid #bae6fd',
                          fontWeight: 600,
                        }}
                      >
                        {tx.gateway}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'monospace' }}>
                      ৳{tx.grossAmount.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#dc2626', fontFamily: 'monospace' }}>
                      -৳{tx.gatewayFee.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', color: '#ea580c', fontFamily: 'monospace' }}>
                      -৳{tx.shippingDeduction.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: '#059669', fontFamily: 'monospace' }}>
                      ৳{tx.netPayout.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: '0.68rem',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontWeight: 700,
                          backgroundColor:
                            tx.settlementStatus === 'SETTLED'
                              ? '#ecfdf5'
                              : tx.settlementStatus === 'DISCREPANCY'
                              ? '#fef2f2'
                              : '#fffbeb',
                          color:
                            tx.settlementStatus === 'SETTLED'
                              ? '#059669'
                              : tx.settlementStatus === 'DISCREPANCY'
                              ? '#dc2626'
                              : '#d97706',
                          border: `1px solid ${
                            tx.settlementStatus === 'SETTLED'
                              ? '#a7f3d0'
                              : tx.settlementStatus === 'DISCREPANCY'
                              ? '#fecaca'
                              : '#fef3c7'
                          }`,
                        }}
                      >
                        {tx.settlementStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View (< 1024px) */}
          <div className="mobile-cards-view">
            {transactions.map((tx) => (
              <div
                key={tx.id}
                className="mobile-data-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'monospace' }}>
                      {tx.orderNumber}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '6px' }}>{tx.timestamp}</span>
                  </div>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontWeight: 700,
                      backgroundColor:
                        tx.settlementStatus === 'SETTLED' ? '#ecfdf5' : '#fffbeb',
                      color: tx.settlementStatus === 'SETTLED' ? '#059669' : '#d97706',
                      border: `1px solid ${tx.settlementStatus === 'SETTLED' ? '#a7f3d0' : '#fef3c7'}`,
                    }}
                  >
                    {tx.settlementStatus}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  <span>Customer: <strong style={{ color: 'var(--text-main)' }}>{tx.customerName}</strong></span>
                  <span>Gateway: <strong style={{ color: '#0284c7' }}>{tx.gateway}</strong></span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.68rem' }}>Gross</span>
                    <strong style={{ color: 'var(--text-main)', fontFamily: 'monospace' }}>৳{tx.grossAmount.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.68rem' }}>Fee + Shipping</span>
                    <strong style={{ color: '#dc2626', fontFamily: 'monospace' }}>
                      -৳{(tx.gatewayFee + tx.shippingDeduction).toFixed(2)}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '0.68rem' }}>Net Payout</span>
                    <strong style={{ color: '#059669', fontFamily: 'monospace' }}>৳{tx.netPayout.toFixed(2)}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 3: EXPENSE TRACKER ================= */}
      {activeTab === 'expenses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                Logged Operational Costs
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Packaging materials, Meta ad marketing spends, courier handling, studio photography.
              </p>
            </div>
            <button
              onClick={() => setExpenseModalOpen(true)}
              className="btn btn-primary btn-sm"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                backgroundColor: '#0f766e',
                fontSize: '0.8rem',
                fontWeight: 700,
              }}
            >
              <Plus size={16} />
              <span>Log Expense</span>
            </button>
          </div>

          {/* Desktop Table View */}
          <div className="desktop-table-view table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ padding: '12px' }}>Date</th>
                  <th style={{ padding: '12px' }}>Category</th>
                  <th style={{ padding: '12px' }}>Description / Title</th>
                  <th style={{ padding: '12px' }}>Logged By</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Amount</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => (
                  <tr key={exp.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{exp.expenseDate}</td>
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: '#f0fdfa',
                          color: '#0f766e',
                          border: '1px solid #ccfbf1',
                          fontWeight: 600,
                        }}
                      >
                        {exp.category}
                      </span>
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-main)', fontWeight: 600 }}>
                      <div>{exp.title}</div>
                      {exp.notes && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 400 }}>{exp.notes}</div>}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>{exp.loggedBy}</td>
                    <td style={{ padding: '12px', textAlign: 'right', fontWeight: 800, color: '#dc2626', fontFamily: 'monospace' }}>
                      {exp.currency} {exp.amount.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <button
                        onClick={() => setDeletingExpense(exp)}
                        className="touch-btn"
                        style={{
                          padding: '6px',
                          backgroundColor: 'transparent',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          borderRadius: '6px',
                          transition: 'color 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
                        title="Delete Expense"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View (< 1024px) */}
          <div className="mobile-cards-view">
            {expenses.map((exp) => (
              <div
                key={exp.id}
                className="mobile-data-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: '#f0fdfa',
                        color: '#0f766e',
                        border: '1px solid #ccfbf1',
                        fontWeight: 600,
                      }}
                    >
                      {exp.category}
                    </span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginLeft: '8px' }}>{exp.expenseDate}</span>
                  </div>
                  <button
                    onClick={() => setDeletingExpense(exp)}
                    className="touch-btn"
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#ef4444',
                      padding: '4px',
                    }}
                    title="Delete Expense"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)' }}>{exp.title}</div>
                {exp.notes && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{exp.notes}</div>}

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>By {exp.loggedBy}</span>
                  <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#dc2626', fontFamily: 'monospace' }}>
                    {exp.currency} {exp.amount.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 4: PAYMENT RECONCILIATION ================= */}
      {activeTab === 'reconciliation' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                Gateway Settlement Reconciliation
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Automated cross-referencing between gateway webhooks and customer orders to flag pending or mismatched settlements.
              </p>
            </div>

            {/* Filter pills */}
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['ALL', 'RECONCILED', 'DISCREPANCY'] as const).map((mode) => {
                const isSelected = reconcileFilter === mode;
                return (
                  <button
                    key={mode}
                    onClick={() => setReconcileFilter(mode)}
                    className="touch-btn"
                    style={{
                      padding: '5px 12px',
                      borderRadius: '6px',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      border: isSelected ? '1px solid #0f766e' : '1px solid var(--border)',
                      backgroundColor: isSelected ? '#0f766e' : '#ffffff',
                      color: isSelected ? '#ffffff' : 'var(--text-muted)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {mode}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="desktop-table-view table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ padding: '12px' }}>Order Number</th>
                  <th style={{ padding: '12px' }}>Customer</th>
                  <th style={{ padding: '12px' }}>Gateway</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Expected</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Received</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Discrepancy</th>
                  <th style={{ padding: '12px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '12px' }}>Audit Note / Reason</th>
                </tr>
              </thead>
              <tbody>
                {filteredReconciliations.map((item, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px', fontWeight: 700, color: 'var(--text-main)', fontFamily: 'monospace' }}>
                      {item.orderNumber}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-main)' }}>{item.customerName}</td>
                    <td style={{ padding: '12px' }}>
                      <span
                        style={{
                          fontSize: '0.72rem',
                          padding: '3px 8px',
                          borderRadius: '6px',
                          backgroundColor: '#f0f9ff',
                          color: '#0284c7',
                          border: '1px solid #bae6fd',
                          fontWeight: 600,
                        }}
                      >
                        {item.gateway}
                      </span>
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-main)' }}>
                      ৳{item.expectedAmount.toFixed(2)}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'right', fontFamily: 'monospace', color: '#059669', fontWeight: 700 }}>
                      ৳{item.receivedAmount.toFixed(2)}
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        textAlign: 'right',
                        fontFamily: 'monospace',
                        color: item.discrepancyAmount === 0 ? 'var(--text-muted)' : '#dc2626',
                        fontWeight: item.discrepancyAmount === 0 ? 500 : 800,
                      }}
                    >
                      {item.discrepancyAmount === 0 ? '৳0.00' : `-৳${item.discrepancyAmount.toFixed(2)}`}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.7rem',
                          padding: '3px 8px',
                          borderRadius: '12px',
                          fontWeight: 700,
                          backgroundColor: item.reconciled ? '#ecfdf5' : '#fef2f2',
                          color: item.reconciled ? '#059669' : '#dc2626',
                          border: `1px solid ${item.reconciled ? '#a7f3d0' : '#fecaca'}`,
                        }}
                      >
                        {item.reconciled ? <CheckCircle2 size={12} /> : <AlertTriangle size={12} />}
                        <span>{item.reconciled ? 'RECONCILED' : 'DISCREPANCY'}</span>
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontSize: '0.74rem', color: item.reconciled ? 'var(--text-muted)' : '#dc2626', fontWeight: item.reconciled ? 400 : 600 }}>
                      {item.reconciled ? 'Order amount matches gateway receipt' : item.issueReason}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile view */}
          <div className="mobile-cards-view">
            {filteredReconciliations.map((item, idx) => (
              <div
                key={idx}
                className="mobile-data-card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)', fontFamily: 'monospace' }}>
                    {item.orderNumber}
                  </span>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      padding: '2px 8px',
                      borderRadius: '10px',
                      fontWeight: 700,
                      backgroundColor: item.reconciled ? '#ecfdf5' : '#fef2f2',
                      color: item.reconciled ? '#059669' : '#dc2626',
                      border: `1px solid ${item.reconciled ? '#a7f3d0' : '#fecaca'}`,
                    }}
                  >
                    {item.reconciled ? 'RECONCILED' : 'DISCREPANCY'}
                  </span>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {item.customerName} • {item.gateway}
                </div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.78rem',
                    backgroundColor: '#f8fafc',
                    border: '1px solid var(--border)',
                    padding: '8px 10px',
                    borderRadius: '6px',
                  }}
                >
                  <span>Expected: ৳{item.expectedAmount.toFixed(0)}</span>
                  <span style={{ color: '#059669', fontWeight: 700 }}>Received: ৳{item.receivedAmount.toFixed(0)}</span>
                  {item.discrepancyAmount !== 0 && <span style={{ color: '#dc2626', fontWeight: 700 }}>Diff: -৳{item.discrepancyAmount.toFixed(0)}</span>}
                </div>
                {!item.reconciled && (
                  <div style={{ fontSize: '0.7rem', color: '#dc2626', fontWeight: 600 }}>{item.issueReason}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ================= TAB 5: P&L SUMMARY (PROFIT & LOSS) ================= */}
      {activeTab === 'pnl' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', margin: 0 }}>
                Monthly Profit & Loss (P&L) Statement
              </h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                Automated financial formula:{' '}
                <code style={{ color: '#0f766e', backgroundColor: '#f0fdfa', padding: '2px 6px', borderRadius: '4px', border: '1px solid #ccfbf1' }}>
                  Net Revenue − COGS (40%) − Operating Expenses = Net Profit
                </code>
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <select
                value={selectedPnlMonth}
                onChange={(e) => setSelectedPnlMonth(e.target.value)}
                style={{
                  padding: '7px 12px',
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--text-main)',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  outline: 'none',
                }}
              >
                <option value="2026-11">Period: November 2026</option>
                <option value="2026-10">Period: October 2026</option>
                <option value="2026-09">Period: September 2026</option>
              </select>

              <button
                onClick={() => handleExportCSV('pnl')}
                className="btn btn-primary btn-sm"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '7px 14px',
                  backgroundColor: '#0f766e',
                  fontSize: '0.8rem',
                  fontWeight: 700,
                }}
              >
                <FileSpreadsheet size={15} />
                <span>Download P&L</span>
              </button>
            </div>
          </div>

          {/* Itemized P&L Table */}
          <div
            className="card"
            style={{
              padding: 0,
              backgroundColor: '#ffffff',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              overflow: 'hidden',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.84rem' }}>
              <tbody>
                {/* 1. Revenue Block */}
                <tr style={{ backgroundColor: '#f0f9ff', borderBottom: '1px solid #bae6fd' }}>
                  <td colSpan={2} style={{ padding: '12px 18px', fontWeight: 800, color: '#0369a1', fontSize: '0.88rem' }}>
                    1. REVENUE FROM SALES
                  </td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 800, color: '#0284c7', fontFamily: 'monospace' }}>
                    {currentStore.currency} {pnlGrossRevenue.toFixed(2)}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 18px', color: 'var(--text-main)', paddingLeft: '32px', fontWeight: 600 }}>Gross Product Sales</td>
                  <td style={{ padding: '10px 18px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>Completed catalog orders</td>
                  <td style={{ padding: '10px 18px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-main)', fontWeight: 600 }}>
                    {pnlGrossRevenue.toFixed(2)}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 18px', color: '#475569', paddingLeft: '32px' }}>Less: Gateway Commissions</td>
                  <td style={{ padding: '10px 18px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>bKash / SSLCommerz / Stripe fee deductions</td>
                  <td style={{ padding: '10px 18px', textAlign: 'right', fontFamily: 'monospace', color: '#dc2626' }}>
                    -{pnlTotalGatewayFees.toFixed(2)}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 18px', color: '#475569', paddingLeft: '32px' }}>Less: Shipping & Logistics Deductions</td>
                  <td style={{ padding: '10px 18px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>Nationwide courier disbursements</td>
                  <td style={{ padding: '10px 18px', textAlign: 'right', fontFamily: 'monospace', color: '#dc2626' }}>
                    -{pnlTotalShippingDeductions.toFixed(2)}
                  </td>
                </tr>
                <tr style={{ backgroundColor: '#f0fdf4', borderBottom: '1px solid #bbf7d0' }}>
                  <td style={{ padding: '11px 18px', fontWeight: 700, color: '#15803d' }}>NET SALES REVENUE</td>
                  <td style={{ padding: '11px 18px', color: '#15803d', fontSize: '0.75rem', fontWeight: 600 }}>Net realized cash inflow</td>
                  <td style={{ padding: '11px 18px', textAlign: 'right', fontWeight: 800, color: '#15803d', fontFamily: 'monospace' }}>
                    {currentStore.currency} {pnlNetRevenue.toFixed(2)}
                  </td>
                </tr>

                {/* 2. COGS Block */}
                <tr style={{ backgroundColor: '#fffbeb', borderBottom: '1px solid #fef3c7' }}>
                  <td colSpan={2} style={{ padding: '12px 18px', fontWeight: 800, color: '#b45309', fontSize: '0.88rem' }}>
                    2. COST OF GOODS SOLD (COGS)
                  </td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 800, color: '#b45309', fontFamily: 'monospace' }}>
                    -{currentStore.currency} {pnlEstimatedCOGS.toFixed(2)}
                  </td>
                </tr>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 18px', color: 'var(--text-main)', paddingLeft: '32px' }}>Raw Material & Manufacturing Procurement</td>
                  <td style={{ padding: '10px 18px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>Fabric, silk weaving, craftsmanship costs (40% baseline)</td>
                  <td style={{ padding: '10px 18px', textAlign: 'right', fontFamily: 'monospace', color: '#b45309', fontWeight: 600 }}>
                    -{pnlEstimatedCOGS.toFixed(2)}
                  </td>
                </tr>
                <tr style={{ backgroundColor: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
                  <td style={{ padding: '11px 18px', fontWeight: 700, color: '#b45309' }}>GROSS PROFIT</td>
                  <td style={{ padding: '11px 18px', color: '#b45309', fontSize: '0.75rem', fontWeight: 700 }}>
                    {pnlGrossMargin.toFixed(1)}% Gross Margin
                  </td>
                  <td style={{ padding: '11px 18px', textAlign: 'right', fontWeight: 800, color: '#b45309', fontFamily: 'monospace' }}>
                    {currentStore.currency} {pnlGrossProfit.toFixed(2)}
                  </td>
                </tr>

                {/* 3. Operating Expenses Block */}
                <tr style={{ backgroundColor: '#fef2f2', borderBottom: '1px solid #fee2e2' }}>
                  <td colSpan={2} style={{ padding: '12px 18px', fontWeight: 800, color: '#be123c', fontSize: '0.88rem' }}>
                    3. OPERATING EXPENSES (OPEX)
                  </td>
                  <td style={{ padding: '12px 18px', textAlign: 'right', fontWeight: 800, color: '#be123c', fontFamily: 'monospace' }}>
                    -{currentStore.currency} {pnlTotalExpenses.toFixed(2)}
                  </td>
                </tr>
                {pnlExpenses.map((exp) => (
                  <tr key={exp.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 18px', color: 'var(--text-main)', paddingLeft: '32px' }}>
                      <span style={{ fontWeight: 600 }}>{exp.category}:</span> {exp.title}
                    </td>
                    <td style={{ padding: '10px 18px', color: 'var(--text-muted)', fontSize: '0.75rem' }}>Logged on {exp.expenseDate}</td>
                    <td style={{ padding: '10px 18px', textAlign: 'right', fontFamily: 'monospace', color: '#dc2626' }}>
                      -{exp.amount.toFixed(2)}
                    </td>
                  </tr>
                ))}

                {/* 4. Bottom Line Net Profit */}
                <tr
                  style={{
                    backgroundColor: pnlNetProfit >= 0 ? '#ecfdf5' : '#fef2f2',
                    borderTop: `2px solid ${pnlNetProfit >= 0 ? '#10b981' : '#ef4444'}`,
                  }}
                >
                  <td style={{ padding: '16px 18px', fontWeight: 900, fontSize: '0.98rem', color: pnlNetProfit >= 0 ? '#065f46' : '#991b1b' }}>
                    NET PROFIT (BOTTOM LINE)
                  </td>
                  <td style={{ padding: '16px 18px', color: pnlNetProfit >= 0 ? '#047857' : '#b91c1c', fontWeight: 700, fontSize: '0.84rem' }}>
                    Operating Margin: {pnlOperatingMargin.toFixed(2)}%
                  </td>
                  <td
                    style={{
                      padding: '16px 18px',
                      textAlign: 'right',
                      fontWeight: 900,
                      fontSize: '1.25rem',
                      color: pnlNetProfit >= 0 ? '#047857' : '#b91c1c',
                      fontFamily: 'monospace',
                    }}
                  >
                    {currentStore.currency} {pnlNetProfit.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= MODAL: LOG OPERATIONAL EXPENSE ================= */}
      {expenseModalOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#ffffff',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              width: '100%',
              maxWidth: '520px',
              padding: '24px',
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#f0fdfa', color: '#0f766e', border: '1px solid #ccfbf1' }}>
                  <Receipt size={18} />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                    Log Operational Expense
                  </h3>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                    Recorded to {currentStore.name} financial ledger
                  </p>
                </div>
              </div>

              <button
                onClick={() => setExpenseModalOpen(false)}
                className="touch-btn"
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSubmitExpense} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Expense Category *
                </label>
                <select
                  value={expenseForm.category}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value as any })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    backgroundColor: '#ffffff',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                >
                  <option value="Packaging">Packaging (Boxes, tags, bags, ribbons)</option>
                  <option value="Meta Ads">Meta Ads (Facebook & Instagram campaigns)</option>
                  <option value="Courier Handling">Courier Handling & Insurance Fees</option>
                  <option value="Studio / Photo">Studio / Model Lookbook Photography</option>
                  <option value="Operations">Operations & Utilities</option>
                  <option value="Inventory Logistics">Inventory Logistics & Warehouse</option>
                  <option value="Other">Other Miscellaneous</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Expense Title / Purpose *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Luxury Matte Gold Gift Boxes Batch 500"
                  value={expenseForm.title}
                  onChange={(e) => setExpenseForm({ ...expenseForm, title: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    backgroundColor: '#ffffff',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-main)',
                    fontSize: '0.85rem',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Amount ({currentStore.currency}) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      backgroundColor: '#ffffff',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-main)',
                      fontSize: '0.85rem',
                      fontFamily: 'monospace',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                    Expense Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={expenseForm.expenseDate}
                    onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      backgroundColor: '#ffffff',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-sm)',
                      color: 'var(--text-main)',
                      fontSize: '0.85rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Auditor Notes / Invoice Reference
                </label>
                <textarea
                  rows={2}
                  placeholder="Optional reference number or invoice note..."
                  value={expenseForm.notes}
                  onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })}
                  style={{
                    width: '100%',
                    padding: '9px 12px',
                    backgroundColor: '#ffffff',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-sm)',
                    color: 'var(--text-main)',
                    fontSize: '0.82rem',
                    outline: 'none',
                    resize: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px' }}>
                <button
                  type="button"
                  onClick={() => setExpenseModalOpen(false)}
                  className="btn btn-secondary btn-sm"
                  style={{
                    padding: '8px 16px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  style={{
                    padding: '8px 20px',
                    backgroundColor: '#0f766e',
                    fontSize: '0.85rem',
                    fontWeight: 700,
                  }}
                >
                  Save & Log Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Expense Confirmation Modal */}
      {deletingExpense && (
        <ConfirmDeleteModal
          isOpen={!!deletingExpense}
          title="Delete Expense Record"
          itemName={`${deletingExpense.title} (${deletingExpense.currency} ${deletingExpense.amount.toFixed(2)})`}
          itemType="Expense Record"
          warningMessage={`Are you sure you want to permanently delete expense record "${deletingExpense.title}"? This entry will be removed from your accounts ledger and profit & loss calculations.`}
          onConfirm={() => {
            onDeleteExpense(deletingExpense.id);
            setDeletingExpense(null);
          }}
          onClose={() => setDeletingExpense(null)}
        />
      )}
    </div>
  );
};
