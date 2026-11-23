import React, { useState, useEffect } from 'react';
import { DollarSign, TrendingUp, Plus, Trash2, ArrowUpRight, CheckCircle2, AlertTriangle, Layers } from 'lucide-react';
import {
  AccountTransactionRecord,
  PaymentReconciliationItem,
  StoreBrand,
  StoreExpenseRecord,
  StorePayoutRecord,
} from '../types/store';
import { EmptyState } from './StoreStatusNotices';
import {
  AccountsOverviewData,
  ProfitLossData,
  createExpense,
  deleteExpense,
  fetchAccountTransactions,
  fetchAccountsOverview,
  fetchExpenses,
  fetchPayouts,
  fetchProfitLoss,
  fetchReconciliation,
} from '../lib/accounts-api';

interface AccountsViewProps {
  currentStore: StoreBrand;
  transactions?: AccountTransactionRecord[];
  expenses?: StoreExpenseRecord[];
  payouts?: StorePayoutRecord[];
  reconciliations?: PaymentReconciliationItem[];
}

function formatMoney(amount: number, currency: string): string {
  return `${currency} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const AccountsView: React.FC<AccountsViewProps> = ({ currentStore }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'settlements' | 'expenses' | 'payouts' | 'reconciliation'>('overview');
  const [overview, setOverview] = useState<AccountsOverviewData | null>(null);
  const [pnl, setPnl] = useState<ProfitLossData | null>(null);
  const [transactions, setTransactions] = useState<AccountTransactionRecord[]>([]);
  const [expenses, setExpenses] = useState<StoreExpenseRecord[]>([]);
  const [payouts, setPayouts] = useState<StorePayoutRecord[]>([]);
  const [reconciliations, setReconciliations] = useState<PaymentReconciliationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseTitle, setExpenseTitle] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] = useState<'Packaging' | 'Meta Ads' | 'Courier Handling' | 'Studio / Photo' | 'Operations' | 'Inventory Logistics' | 'Other'>('Packaging');
  const [expenseDate, setExpenseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [expenseNotes, setExpenseNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [ov, pl, txs, exps, pyts, recons] = await Promise.all([
        fetchAccountsOverview(),
        fetchProfitLoss(),
        fetchAccountTransactions(),
        fetchExpenses(),
        fetchPayouts(),
        fetchReconciliation(),
      ]);
      setOverview(ov);
      setPnl(pl);
      setTransactions(txs);
      setExpenses(exps);
      setPayouts(pyts);
      setReconciliations(recons);
    } catch {
      setNotice({ type: 'error', text: 'Failed to load ledger records.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentStore.slug]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseTitle.trim() || !expenseAmount || Number(expenseAmount) <= 0) return;

    setIsSubmitting(true);
    setNotice(null);
    try {
      await createExpense({
        category: expenseCategory,
        title: expenseTitle.trim(),
        amount: Number(expenseAmount),
        currency: currentStore.currency,
        expense_date: expenseDate,
        notes: expenseNotes.trim() || undefined,
      });
      setNotice({ type: 'success', text: 'Expense logged successfully.' });
      setIsExpenseModalOpen(false);
      setExpenseTitle('');
      setExpenseAmount('');
      setExpenseNotes('');
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Failed to record expense.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm('Are you sure you want to remove this expense record?')) return;
    try {
      await deleteExpense(id);
      setNotice({ type: 'success', text: 'Expense record deleted.' });
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Failed to delete expense.' });
    }
  };

  const openDiscrepancies = reconciliations.filter((r) => !r.reconciled).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
            Accounts & Reconciliation
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
            Live settlement transactions, operational expenses, payout reconciliation & P&L for <code>{currentStore.name}</code>
          </p>
        </div>

        <button className="btn btn-primary btn-sm" onClick={() => setIsExpenseModalOpen(true)} style={{ gap: '6px' }}>
          <Plus size={14} />
          <span>Record Expense</span>
        </button>
      </div>

      {notice && (
        <div className={`notice notice-${notice.type === 'success' ? 'success' : 'warning'}`} style={{ marginBottom: '14px' }}>
          {notice.text}
        </div>
      )}

      {/* Top Financial Stat Grid */}
      <div className="stats-grid">
        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Net Sales Revenue</div>
            <div className="stat-val">{formatMoney(pnl?.net_revenue ?? overview?.net_revenue ?? 0, currentStore.currency)}</div>
            <div className="stat-sub" style={{ color: '#059669', fontWeight: 600 }}>
              <TrendingUp size={11} /> Realized revenue
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
            <DollarSign size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Operational Expenses</div>
            <div className="stat-val">{formatMoney(pnl?.total_expenses ?? overview?.total_expenses ?? 0, currentStore.currency)}</div>
            <div className="stat-sub" style={{ color: '#dc2626' }}>
              Logged store overheads
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#fef2f2', color: '#dc2626' }}>
            <TrendingUp size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Net Profit</div>
            <div className="stat-val" style={{ color: (pnl?.net_profit ?? 0) >= 0 ? '#059669' : '#dc2626' }}>
              {formatMoney(pnl?.net_profit ?? overview?.net_profit ?? 0, currentStore.currency)}
            </div>
            <div className="stat-sub" style={{ color: 'var(--text-muted)' }}>
              Margin: {pnl?.net_margin_pct ?? 0}%
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#f8fafc', color: '#475569' }}>
            <DollarSign size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Audit Discrepancies</div>
            <div className="stat-val" style={{ color: openDiscrepancies > 0 ? '#d97706' : '#059669' }}>
              {openDiscrepancies}
            </div>
            <div className="stat-sub" style={{ color: openDiscrepancies > 0 ? '#d97706' : '#059669' }}>
              {openDiscrepancies > 0 ? 'Mismatches detected' : 'All orders reconciled'}
            </div>
          </div>
          <div className="stat-icon" style={{ background: openDiscrepancies > 0 ? '#fffbeb' : '#ecfdf5', color: openDiscrepancies > 0 ? '#d97706' : '#059669' }}>
            {openDiscrepancies > 0 ? <AlertTriangle size={16} /> : <CheckCircle2 size={16} />}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', borderBottom: '1px solid var(--border)', marginBottom: '12px', paddingBottom: '8px' }}>
        <button onClick={() => setActiveTab('overview')} className={`btn btn-sm ${activeTab === 'overview' ? 'btn-primary' : 'btn-secondary'}`}>
          P&L Statement
        </button>
        <button onClick={() => setActiveTab('settlements')} className={`btn btn-sm ${activeTab === 'settlements' ? 'btn-primary' : 'btn-secondary'}`}>
          Settlements ({transactions.length})
        </button>
        <button onClick={() => setActiveTab('expenses')} className={`btn btn-sm ${activeTab === 'expenses' ? 'btn-primary' : 'btn-secondary'}`}>
          Expenses ({expenses.length})
        </button>
        <button onClick={() => setActiveTab('payouts')} className={`btn btn-sm ${activeTab === 'payouts' ? 'btn-primary' : 'btn-secondary'}`}>
          Payouts ({payouts.length})
        </button>
        <button onClick={() => setActiveTab('reconciliation')} className={`btn btn-sm ${activeTab === 'reconciliation' ? 'btn-primary' : 'btn-secondary'}`}>
          Audit Reconciliation ({openDiscrepancies} open)
        </button>
      </div>

      {activeTab === 'overview' && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">Profit & Loss Breakdown ({pnl?.period || 'Current Period'})</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span>Gross Sales</span>
              <span style={{ fontWeight: 700 }}>{formatMoney(pnl?.gross_sales || 0, currentStore.currency)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span>Discounts & Returns</span>
              <span style={{ color: '#dc2626' }}>- {formatMoney(pnl?.discounts_and_returns || 0, currentStore.currency)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span>Gateway Commission & Processing</span>
              <span style={{ color: '#dc2626' }}>- {formatMoney(pnl?.gateway_fees || 0, currentStore.currency)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span>Courier Delivery Costs</span>
              <span style={{ color: '#dc2626' }}>- {formatMoney(pnl?.shipping_costs || 0, currentStore.currency)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontWeight: 800, fontSize: '1rem', borderBottom: '2px solid var(--border)' }}>
              <span>Net Sales Revenue</span>
              <span style={{ color: '#059669' }}>{formatMoney(pnl?.net_revenue || 0, currentStore.currency)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span>Cost of Goods Sold (COGS)</span>
              <span style={{ color: '#dc2626' }}>- {formatMoney(pnl?.cost_of_goods_sold || 0, currentStore.currency)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span>Operating Expenses (Overhead, Ads, Packaging)</span>
              <span style={{ color: '#dc2626' }}>- {formatMoney(pnl?.total_expenses || 0, currentStore.currency)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', fontWeight: 800, fontSize: '1.1rem' }}>
              <span>Net Clean Profit</span>
              <span style={{ color: (pnl?.net_profit || 0) >= 0 ? '#059669' : '#dc2626' }}>
                {formatMoney(pnl?.net_profit || 0, currentStore.currency)}
              </span>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'settlements' && (
        <div className="card" style={{ padding: 0 }}>
          {transactions.length === 0 ? (
            <EmptyState message="No settlement records loaded yet. Gateway transactions will appear here." />
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Order #</th>
                    <th>Gateway</th>
                    <th>Customer</th>
                    <th>Gross</th>
                    <th>Fee</th>
                    <th>Net Payout</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{tx.timestamp}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{tx.orderNumber}</td>
                      <td><span className="badge badge-shipped">{tx.gateway}</span></td>
                      <td>{tx.customerName}</td>
                      <td>{formatMoney(tx.grossAmount, tx.currency)}</td>
                      <td style={{ color: '#dc2626' }}>{formatMoney(tx.gatewayFee, tx.currency)}</td>
                      <td style={{ fontWeight: 700, color: '#059669' }}>{formatMoney(tx.netPayout, tx.currency)}</td>
                      <td><span className={`badge ${tx.status === 'PAID' ? 'badge-active' : 'badge-outline'}`}>{tx.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'expenses' && (
        <div className="card" style={{ padding: 0 }}>
          {expenses.length === 0 ? (
            <EmptyState message="No operational expenses logged yet. Use 'Record Expense' to track packaging, ads, or studio costs." />
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Category</th>
                    <th>Description</th>
                    <th>Amount</th>
                    <th>Logged By</th>
                    <th style={{ width: '80px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((exp) => (
                    <tr key={exp.id}>
                      <td style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)' }}>{exp.expenseDate}</td>
                      <td><span className="badge badge-outline">{exp.category}</span></td>
                      <td style={{ fontWeight: 600 }}>{exp.title}</td>
                      <td style={{ fontWeight: 700, color: '#dc2626' }}>{formatMoney(exp.amount, exp.currency)}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{exp.loggedBy}</td>
                      <td>
                        <button
                          onClick={() => handleDeleteExpense(exp.id)}
                          className="btn btn-sm btn-secondary"
                          style={{ color: '#dc2626', padding: '4px 8px' }}
                          title="Delete expense"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'payouts' && (
        <div className="card" style={{ padding: 0 }}>
          {payouts.length === 0 ? (
            <EmptyState message="No payout batches recorded yet." />
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Payout Ref</th>
                    <th>Amount</th>
                    <th>Initiated Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((pyt) => (
                    <tr key={pyt.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{pyt.payoutReference}</td>
                      <td style={{ fontWeight: 700, color: '#059669' }}>{formatMoney(pyt.amount, pyt.currency)}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{pyt.processedAt || '—'}</td>
                      <td><span className="badge badge-active">{pyt.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'reconciliation' && (
        <div className="card" style={{ padding: 0 }}>
          {reconciliations.length === 0 ? (
            <EmptyState message="No orders needing audit reconciliation found." />
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Customer</th>
                    <th>Gateway</th>
                    <th>Store Status</th>
                    <th>Expected</th>
                    <th>Received</th>
                    <th>Discrepancy</th>
                    <th>Audit Status</th>
                  </tr>
                </thead>
                <tbody>
                  {reconciliations.map((rec, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{rec.orderNumber}</td>
                      <td>{rec.customerName}</td>
                      <td><span className="badge badge-shipped">{rec.gateway}</span></td>
                      <td><span className="badge badge-outline">{rec.storeOrderStatus}</span></td>
                      <td>{formatMoney(rec.expectedAmount, currentStore.currency)}</td>
                      <td>{formatMoney(rec.receivedAmount, currentStore.currency)}</td>
                      <td style={{ fontWeight: 700, color: rec.discrepancyAmount > 0 ? '#dc2626' : '#059669' }}>
                        {formatMoney(rec.discrepancyAmount, currentStore.currency)}
                      </td>
                      <td>
                        <span className={`badge ${rec.reconciled ? 'badge-active' : 'badge-warning'}`}>
                          {rec.reconciled ? 'RECONCILED' : 'DISCREPANCY'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Record Expense Modal */}
      {isExpenseModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsExpenseModalOpen(false)}>
          <div className="modal-container" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Record Expense</h2>
              <button className="btn-close" onClick={() => setIsExpenseModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleCreateExpense} style={{ padding: '20px' }}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Category</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value as any)}
                  className="form-input"
                >
                  <option value="Packaging">Packaging & Boxing</option>
                  <option value="Meta Ads">Meta / Instagram Ads</option>
                  <option value="Courier Handling">Courier Handling & Return Fees</option>
                  <option value="Studio / Photo">Studio / Photography</option>
                  <option value="Operations">Operations & Utilities</option>
                  <option value="Inventory Logistics">Inventory Logistics</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Expense Title / Description</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. 500 Luxury Jewelry Gift Boxes"
                  value={expenseTitle}
                  onChange={(e) => setExpenseTitle(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-grid" style={{ marginBottom: '14px' }}>
                <div className="form-group">
                  <label className="form-label">Amount ({currentStore.currency})</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="0.00"
                    value={expenseAmount}
                    onChange={(e) => setExpenseAmount(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Date</label>
                  <input
                    type="date"
                    required
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Notes (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Invoice or supplier memo..."
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsExpenseModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="btn btn-primary">
                  {isSubmitting ? 'Saving...' : 'Save Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
