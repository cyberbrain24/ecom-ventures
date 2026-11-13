import React, { useState } from 'react';
import { CreditCard, CheckCircle, Shield, Settings2, Globe, FileText, CheckCircle2, DollarSign, TrendingUp, Clock, XCircle, ShieldCheck } from 'lucide-react';
import { PaymentGatewayConfig, StoreBrand, PaymentTransaction } from '../types/store';

interface PaymentsViewProps {
  currentStore: StoreBrand;
  gateways: PaymentGatewayConfig[];
  transactions: PaymentTransaction[];
  onToggleGateway: (gatewayId: string) => void;
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({
  currentStore,
  gateways,
  transactions,
  onToggleGateway,
}) => {
  const [activeTab, setActiveTab] = useState<'gateways' | 'ledger'>('gateways');

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
            Payment Gateways & Transaction Processing
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
            Configured payment gateways and tokenized checkout channels for <strong>{currentStore.name}</strong>
          </p>
        </div>
      </div>

      {/* Payments Operational Metrics - 7 Column Box Card Design */}
      <div className="stats-grid">
        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Total Channels</div>
            <div className="stat-val">{gateways.length}</div>
            <div className="stat-sub" style={{ color: '#0284c7', fontWeight: 600 }}>
              <CreditCard size={11} /> Gateway APIs
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#f0f9ff', color: '#0284c7' }}>
            <CreditCard size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Active Gateways</div>
            <div className="stat-val" style={{ color: '#059669' }}>
              {gateways.filter((g) => g.isEnabled).length}
            </div>
            <div className="stat-sub" style={{ color: '#10b981' }}>
              <CheckCircle2 size={11} /> Live processing
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
            <CheckCircle2 size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Settled Inflow</div>
            <div className="stat-val" style={{ color: '#059669' }}>
              ৳{Math.round(transactions.filter((t) => t.status === 'SUCCESS').reduce((sum, t) => sum + (t.amount || 0), 0)).toLocaleString()}
            </div>
            <div className="stat-sub" style={{ color: '#059669', fontWeight: 600 }}>
              <DollarSign size={11} /> Successful
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#dcfce7', color: '#15803d' }}>
            <DollarSign size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Successful Txns</div>
            <div className="stat-val">
              {transactions.filter((t) => t.status === 'SUCCESS').length}
            </div>
            <div className="stat-sub" style={{ color: '#0284c7' }}>
              <TrendingUp size={11} /> Completed
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#e0f2fe', color: '#0369a1' }}>
            <TrendingUp size={16} />
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: transactions.filter((t) => t.status === 'PENDING').length > 0 ? '3px solid #f59e0b' : undefined }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Pending Verification</div>
            <div className="stat-val" style={{ color: transactions.filter((t) => t.status === 'PENDING').length > 0 ? '#f59e0b' : 'var(--text-main)' }}>
              {transactions.filter((t) => t.status === 'PENDING').length}
            </div>
            <div className="stat-sub" style={{ color: '#d97706' }}>
              <Clock size={11} /> In verification
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
            <Clock size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Refunds/Reversals</div>
            <div className="stat-val" style={{ color: transactions.filter((t) => t.status === 'REFUNDED').length > 0 ? '#ef4444' : 'var(--text-main)' }}>
              {transactions.filter((t) => t.status === 'REFUNDED').length}
            </div>
            <div className="stat-sub" style={{ color: '#dc2626' }}>
              <XCircle size={11} /> Reversal logs
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
            <XCircle size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">HMAC Security</div>
            <div className="stat-val" style={{ color: '#059669', fontSize: '1rem' }}>SHA256</div>
            <div className="stat-sub" style={{ color: '#64748b' }}>
              <ShieldCheck size={11} /> Idempotent
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#f8fafc', color: '#475569' }}>
            <ShieldCheck size={16} />
          </div>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '12px', paddingBottom: '8px' }}>
        <button
          onClick={() => setActiveTab('gateways')}
          className={`btn btn-sm ${activeTab === 'gateways' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.8rem', padding: '5px 12px' }}
        >
          <CreditCard size={14} />
          <span>Gateway Channels ({gateways.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('ledger')}
          className={`btn btn-sm ${activeTab === 'ledger' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.8rem', padding: '5px 12px' }}
        >
          <FileText size={14} />
          <span>Payment Transactions Ledger ({transactions.length})</span>
        </button>
      </div>

      {activeTab === 'gateways' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' }}>
          {gateways.map((gw) => (
            <div key={gw.id} className="card">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: 'var(--radius-sm)', background: gw.isEnabled ? '#ecfdf5' : '#f1f5f9', color: gw.isEnabled ? '#059669' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <CreditCard size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.98rem' }}>{gw.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Currencies: {gw.supportedCurrencies.join(', ')}
                    </div>
                  </div>
                </div>
                <span className={`badge ${gw.isEnabled ? 'badge-active' : 'badge-outline'}`}>
                  {gw.isEnabled ? 'ENABLED' : 'DISABLED'}
                </span>
              </div>

              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: 'var(--radius-sm)', fontSize: '0.82rem', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Merchant ID:</span>
                  <code style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{gw.merchantId}</code>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Environment:</span>
                  <span style={{ fontWeight: 600, color: gw.isSandbox ? '#eab308' : '#059669' }}>
                    {gw.isSandbox ? 'Sandbox (Test Mode)' : 'Production (Live API)'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Webhook Security:</span>
                  <span style={{ color: '#059669', fontWeight: 600 }}>HMAC-SHA256 Idempotent</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={() => onToggleGateway(gw.id)}
                  className={`btn btn-sm ${gw.isEnabled ? 'btn-secondary' : 'btn-primary'}`}
                  style={{ flex: 1, justifyContent: 'center' }}
                >
                  {gw.isEnabled ? 'Disable Gateway' : 'Enable Gateway'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'ledger' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Order #</th>
                  <th>Gateway Channel</th>
                  <th>Transaction Reference</th>
                  <th>Amount (BDT)</th>
                  <th>Payment Status</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => (
                  <tr key={tx.id}>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{tx.timestamp}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{tx.orderNumber}</td>
                    <td><span className="badge badge-shipped">{tx.gateway}</span></td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#334155' }}>{tx.transactionReference}</td>
                    <td style={{ fontWeight: 800, color: 'var(--primary)' }}>৳ {tx.amount.toLocaleString()}</td>
                    <td>
                      <span className={`badge ${tx.status === 'SUCCESS' ? 'badge-active' : tx.status === 'PENDING' ? 'badge-pending' : 'badge-danger'}`}>
                        {tx.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
