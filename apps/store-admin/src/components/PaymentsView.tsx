import React, { useState, useEffect } from 'react';
import { CreditCard, FileText, Settings, Key, ShieldCheck, Star, Eye, EyeOff } from 'lucide-react';
import { PaymentGatewayConfig, StoreBrand, PaymentTransaction } from '../types/store';
import { EmptyState } from './StoreStatusNotices';
import {
  fetchPaymentConfigs,
  fetchPaymentTransactions,
  savePaymentConfig,
  setDefaultPaymentGateway,
  togglePaymentGateway,
} from '../lib/payments-api';

interface PaymentsViewProps {
  currentStore: StoreBrand;
  gateways?: PaymentGatewayConfig[];
  transactions?: PaymentTransaction[];
}

export const PaymentsView: React.FC<PaymentsViewProps> = ({ currentStore }) => {
  const [activeTab, setActiveTab] = useState<'gateways' | 'ledger'>('gateways');
  const [gateways, setGateways] = useState<PaymentGatewayConfig[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedGateway, setSelectedGateway] = useState<PaymentGatewayConfig | null>(null);
  const [accountIdInput, setAccountIdInput] = useState('');
  const [clientIdInput, setClientIdInput] = useState('');
  const [clientSecretInput, setClientSecretInput] = useState('');
  const [isEnabledInput, setIsEnabledInput] = useState(false);
  const [isDefaultInput, setIsDefaultInput] = useState(false);
  const [isSandboxInput, setIsSandboxInput] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [gList, tList] = await Promise.all([fetchPaymentConfigs(), fetchPaymentTransactions()]);
      setGateways(gList);
      setTransactions(tList);
    } catch {
      setNotice({ type: 'error', text: 'Failed to load payment gateways and transactions.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentStore.slug]);

  const handleOpenConfigModal = (gw: PaymentGatewayConfig) => {
    setSelectedGateway(gw);
    setAccountIdInput('');
    setClientIdInput('');
    setClientSecretInput('');
    setIsEnabledInput(gw.isEnabled);
    setIsDefaultInput(gw.isDefault);
    setIsSandboxInput(gw.isSandbox);
    setNotice(null);
  };

  const handleToggleGateway = async (gw: PaymentGatewayConfig) => {
    const nextState = !gw.isEnabled;
    setActionLoading(gw.id);
    setNotice(null);
    try {
      await togglePaymentGateway(gw.id, nextState);
      setNotice({
        type: 'success',
        text: `${gw.name} is now ${nextState ? 'active on the checkout page' : 'deactivated and hidden on the checkout page'}.`,
      });
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Failed to toggle gateway status.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSetDefault = async (gw: PaymentGatewayConfig) => {
    setActionLoading(gw.id);
    setNotice(null);
    try {
      await setDefaultPaymentGateway(gw.id);
      setNotice({
        type: 'success',
        text: `${gw.name} is now the default payment gateway (auto-selected on checkout).`,
      });
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Failed to set default gateway.' });
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGateway) return;

    setIsSaving(true);
    setNotice(null);
    try {
      await savePaymentConfig({
        gateway: selectedGateway.id.toUpperCase() as 'BKASH' | 'NAGAD' | 'SSLCOMMERZ' | 'STRIPE' | 'COD',
        is_enabled: isEnabledInput,
        is_default: isDefaultInput,
        is_test_mode: isSandboxInput,
        account_id: accountIdInput,
        client_id: clientIdInput,
        client_secret: clientSecretInput,
      });
      setNotice({ type: 'success', text: `${selectedGateway.name} configuration saved successfully.` });
      setSelectedGateway(null);
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Failed to update payment gateway.' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '14px' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
          Payment Gateways & Ledger
        </h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
          Payment channels, MFS credentials and settlement transactions for <strong>{currentStore.name}</strong>
        </p>
      </div>

      {notice && (
        <div className={`notice notice-${notice.type === 'success' ? 'success' : 'warning'}`} style={{ marginBottom: '14px' }}>
          {notice.text}
        </div>
      )}

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
          <span>Settlement Transactions ({transactions.length})</span>
        </button>
      </div>

      {activeTab === 'gateways' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(310px, 1fr))', gap: '16px' }}>
          {gateways.map((gw) => (
            <div
              key={gw.id}
              className="card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                border: gw.isDefault ? '2px solid #10b981' : undefined,
                position: 'relative',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div
                      style={{
                        width: '42px',
                        height: '42px',
                        borderRadius: 'var(--radius-sm)',
                        background: gw.isEnabled ? (gw.isDefault ? '#ecfdf5' : '#f0fdf4') : '#f8fafc',
                        color: gw.isEnabled ? (gw.isDefault ? '#059669' : '#16a34a') : '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid',
                        borderColor: gw.isEnabled ? '#bbf7d0' : '#e2e8f0',
                      }}
                    >
                      <CreditCard size={20} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '0.98rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{gw.name}</span>
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        Currencies: {gw.supportedCurrencies.join(', ')}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                    {gw.isDefault && (
                      <span
                        className="badge"
                        style={{
                          background: '#ecfdf5',
                          color: '#059669',
                          borderColor: '#a7f3d0',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '0.68rem',
                          padding: '2px 7px',
                          fontWeight: 800,
                        }}
                      >
                        <Star size={11} fill="#059669" /> DEFAULT
                      </span>
                    )}
                    <span
                      className={`badge ${gw.isEnabled ? 'badge-active' : 'badge-outline'}`}
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        background: gw.isEnabled ? '#f0fdf4' : '#f1f5f9',
                        color: gw.isEnabled ? '#15803d' : '#64748b',
                        borderColor: gw.isEnabled ? '#86efac' : '#cbd5e1',
                      }}
                    >
                      {gw.isEnabled ? 'ACTIVE' : 'DEACTIVATED'}
                    </span>
                  </div>
                </div>

                <div style={{ background: 'var(--bg-app)', padding: '10px 12px', borderRadius: 'var(--radius-sm)', marginBottom: '14px' }}>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                    Mode: <strong style={{ color: 'var(--text-main)' }}>{gw.isSandbox ? 'Sandbox (Test Mode)' : 'Production (Live)'}</strong>
                  </div>
                  {gw.isEnabled ? (
                    <div style={{ fontSize: '0.75rem', color: gw.isDefault ? '#059669' : '#15803d', fontWeight: 600 }}>
                      {gw.isDefault ? '✓ Pre-selected by default on checkout page' : '✓ Active and visible on checkout page'}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.75rem', color: '#dc2626', fontWeight: 600 }}>
                      ✕ Deactivated & hidden on checkout page
                    </div>
                  )}
                </div>
              </div>

              {/* Action Buttons Row */}
              <div style={{ display: 'flex', gap: '6px', marginTop: '4px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={actionLoading === gw.id}
                  onClick={() => handleToggleGateway(gw)}
                  className={`btn btn-sm ${gw.isEnabled ? 'btn-secondary' : 'btn-primary'}`}
                  style={{
                    flex: 1,
                    minWidth: '85px',
                    justifyContent: 'center',
                    gap: '4px',
                    fontSize: '0.75rem',
                    padding: '6px 8px',
                  }}
                  title={gw.isEnabled ? 'Deactivate this gateway to hide it on checkout' : 'Activate this gateway to show on checkout'}
                >
                  {gw.isEnabled ? <EyeOff size={13} /> : <Eye size={13} />}
                  <span>{actionLoading === gw.id ? 'Updating...' : gw.isEnabled ? 'Deactivate' : 'Activate'}</span>
                </button>

                {!gw.isDefault && gw.isEnabled && (
                  <button
                    type="button"
                    disabled={actionLoading === gw.id}
                    onClick={() => handleSetDefault(gw)}
                    className="btn btn-sm btn-secondary"
                    style={{
                      flex: 1,
                      minWidth: '85px',
                      justifyContent: 'center',
                      gap: '4px',
                      fontSize: '0.75rem',
                      padding: '6px 8px',
                    }}
                    title="Make this the default payment method on the checkout page"
                  >
                    <Star size={13} />
                    <span>Set Default</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleOpenConfigModal(gw)}
                  className="btn btn-sm btn-secondary"
                  style={{
                    justifyContent: 'center',
                    gap: '4px',
                    fontSize: '0.75rem',
                    padding: '6px 10px',
                  }}
                  title="Configure API credentials and settings"
                >
                  <Settings size={13} />
                  <span>Configure</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'ledger' && (
        <div className="card" style={{ padding: 0 }}>
          {transactions.length === 0 ? (
            <EmptyState message="No payment transactions recorded yet. Transactions will populate as customer orders are settled." />
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Order #</th>
                    <th>Gateway</th>
                    <th>Gross Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx) => (
                    <tr key={tx.id}>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{tx.timestamp}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{tx.orderNumber}</td>
                      <td><span className="badge badge-shipped">{tx.gateway}</span></td>
                      <td style={{ fontWeight: 700 }}>{currentStore.currency} {tx.amount.toFixed(2)}</td>
                      <td>
                        <span className={`badge ${tx.status === 'SUCCESS' ? 'badge-active' : 'badge-outline'}`}>{tx.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit Gateway Modal */}
      {selectedGateway && (
        <div className="modal-backdrop" onClick={() => setSelectedGateway(null)}>
          <div className="modal-container" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={18} style={{ color: 'var(--primary)' }} />
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                  Configure {selectedGateway.name}
                </h2>
              </div>
              <button className="btn-close" onClick={() => setSelectedGateway(null)}>×</button>
            </div>

            <form onSubmit={handleSaveConfig} style={{ padding: '20px' }}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Merchant / Account ID</label>
                <input
                  type="text"
                  placeholder="e.g. merchant_0192"
                  value={accountIdInput}
                  onChange={(e) => setAccountIdInput(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Client ID / App Key</label>
                <input
                  type="text"
                  placeholder="e.g. app_key_live"
                  value={clientIdInput}
                  onChange={(e) => setClientIdInput(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Client Secret / API Secret</label>
                <input
                  type="password"
                  placeholder="Leave empty to keep existing secret"
                  value={clientSecretInput}
                  onChange={(e) => setClientSecretInput(e.target.value)}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', margin: '16px 0 20px 0', background: 'var(--bg-app)', padding: '12px 14px', borderRadius: 'var(--radius-sm)' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={isEnabledInput}
                    onChange={(e) => {
                      const val = e.target.checked;
                      setIsEnabledInput(val);
                      if (!val) setIsDefaultInput(false);
                    }}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Active on Checkout</span>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      When deactivated, this gateway is completely hidden on the checkout page.
                    </p>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '0.85rem', opacity: isEnabledInput ? 1 : 0.6 }}>
                  <input
                    type="checkbox"
                    checked={isDefaultInput}
                    disabled={!isEnabledInput}
                    onChange={(e) => setIsDefaultInput(e.target.checked)}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>Auto-active by Default on Checkout</span>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      When customers open checkout, this payment method is automatically selected.
                    </p>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={isSandboxInput}
                    onChange={(e) => setIsSandboxInput(e.target.checked)}
                    style={{ marginTop: '3px' }}
                  />
                  <div>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>Sandbox Test Mode</span>
                    <p style={{ margin: '2px 0 0 0', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                      Simulate transactions using test API keys without live monetary settlements.
                    </p>
                  </div>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedGateway(null)}>
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className="btn btn-primary">
                  {isSaving ? 'Saving...' : 'Save Gateway'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
