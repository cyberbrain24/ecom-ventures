import React, { useState, useEffect } from 'react';
import { Truck, CheckCircle2, Navigation, Clock, Layers, Settings, Key, ShieldCheck } from 'lucide-react';
import { CourierConfig, StoreBrand, ShipmentRecord } from '../types/store';
import { EmptyState } from './StoreStatusNotices';
import { fetchCourierConfigs, fetchShipments, saveCourierConfig } from '../lib/logistics-api';

interface LogisticsViewProps {
  currentStore: StoreBrand;
  couriers?: CourierConfig[];
  shipments?: ShipmentRecord[];
}

function countStatus(shipments: ShipmentRecord[], status: string): number {
  return shipments.filter((s) => s.status === status).length;
}

export const LogisticsView: React.FC<LogisticsViewProps> = ({ currentStore }) => {
  const [activeTab, setActiveTab] = useState<'configs' | 'shipments'>('configs');
  const [couriers, setCouriers] = useState<CourierConfig[]>([]);
  const [shipments, setShipments] = useState<ShipmentRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCourier, setSelectedCourier] = useState<CourierConfig | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [secretKeyInput, setSecretKeyInput] = useState('');
  const [isEnabledInput, setIsEnabledInput] = useState(false);
  const [isTestModeInput, setIsTestModeInput] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [cList, sList] = await Promise.all([fetchCourierConfigs(), fetchShipments()]);
      setCouriers(cList);
      setShipments(sList);
    } catch {
      setNotice({ type: 'error', text: 'Failed to load courier logistics settings.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentStore.slug]);

  const handleOpenConfigModal = (c: CourierConfig) => {
    setSelectedCourier(c);
    setApiKeyInput('');
    setSecretKeyInput('');
    setIsEnabledInput(c.isActive);
    setIsTestModeInput(!c.autoDispatch);
    setNotice(null);
  };

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCourier) return;

    setIsSaving(true);
    setNotice(null);
    try {
      await saveCourierConfig({
        carrier: selectedCourier.provider.toUpperCase() as 'STEADFAST' | 'PATHAO' | 'REDX',
        is_enabled: isEnabledInput,
        is_test_mode: isTestModeInput,
        api_key: apiKeyInput || 'existing_masked_key',
        secret_key: secretKeyInput || 'existing_masked_secret',
      });
      setNotice({ type: 'success', text: `${selectedCourier.provider} configuration saved successfully.` });
      setSelectedCourier(null);
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Failed to save courier configuration.' });
    } finally {
      setIsSaving(false);
    }
  };

  const deliveredCount = countStatus(shipments, 'DELIVERED');

  return (
    <div>
      <div style={{ marginBottom: '14px' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
          Courier Logistics
        </h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
          Courier integration and parcel dispatch management for <code>{currentStore.name}</code>
        </p>
      </div>

      {notice && (
        <div className={`notice notice-${notice.type === 'success' ? 'success' : 'warning'}`} style={{ marginBottom: '14px' }}>
          {notice.text}
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Total Shipments</div>
            <div className="stat-val">{shipments.length}</div>
            <div className="stat-sub" style={{ color: '#0284c7', fontWeight: 600 }}>
              <Truck size={11} /> Live courier parcels
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#f0f9ff', color: '#0284c7' }}>
            <Truck size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">In Transit</div>
            <div className="stat-val" style={{ color: '#0284c7' }}>{countStatus(shipments, 'IN_TRANSIT')}</div>
            <div className="stat-sub" style={{ color: '#0284c7' }}>
              <Clock size={11} /> On the way
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#e0f2fe', color: '#0369a1' }}>
            <Clock size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Delivered</div>
            <div className="stat-val" style={{ color: '#059669' }}>{deliveredCount}</div>
            <div className="stat-sub" style={{ color: '#10b981' }}>
              <CheckCircle2 size={11} /> Successfully handed over
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
            <CheckCircle2 size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Delivery Success Rate</div>
            <div className="stat-val">
              {shipments.length > 0 ? `${Math.round((deliveredCount / shipments.length) * 100)}%` : '100%'}
            </div>
            <div className="stat-sub" style={{ color: '#64748b' }}>
              <Layers size={11} /> {shipments.length > 0 ? 'Delivered of all parcels' : 'No parcels dispatched yet'}
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#f8fafc', color: '#475569' }}>
            <Layers size={16} />
          </div>
        </div>
      </div>

      {/* Sub-Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '12px', paddingBottom: '8px' }}>
        <button
          onClick={() => setActiveTab('configs')}
          className={`btn btn-sm ${activeTab === 'configs' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.8rem', padding: '5px 12px' }}
        >
          <Truck size={14} />
          <span>Courier Channels ({couriers.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('shipments')}
          className={`btn btn-sm ${activeTab === 'shipments' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.8rem', padding: '5px 12px' }}
        >
          <Navigation size={14} />
          <span>Parcel Shipments ({shipments.length})</span>
        </button>
      </div>

      {activeTab === 'configs' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {couriers.map((courier) => (
            <div key={courier.provider} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '42px', height: '42px', borderRadius: 'var(--radius-sm)', background: courier.isActive ? '#e0f2fe' : '#f1f5f9', color: courier.isActive ? '#0369a1' : '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Truck size={22} />
                    </div>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1.05rem', color: 'var(--text-main)' }}>{courier.provider}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Status: {courier.webhookStatus === 'ACTIVE' ? 'Webhook Live' : 'Standard API'}
                      </div>
                    </div>
                  </div>
                  <span className={`badge ${courier.isActive ? 'badge-active' : 'badge-outline'}`}>
                    {courier.isActive ? 'CONNECTED' : 'DISABLED'}
                  </span>
                </div>

                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '16px', lineHeight: 1.5 }}>
                  Automatic dispatch is {courier.autoDispatch ? 'enabled for verified orders' : 'set to manual confirmation mode'}.
                </div>
              </div>

              <button
                onClick={() => handleOpenConfigModal(courier)}
                className="btn btn-sm btn-secondary"
                style={{ width: '100%', justifyContent: 'center', gap: '6px' }}
              >
                <Settings size={14} />
                <span>Configure {courier.provider} API</span>
              </button>
            </div>
          ))}
        </div>
      )}

      {activeTab === 'shipments' && (
        <div className="card" style={{ padding: 0 }}>
          {shipments.length === 0 ? (
            <EmptyState message="No dispatched parcels recorded yet. Dispatch orders directly from the Orders Queue." />
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order #</th>
                    <th>Carrier</th>
                    <th>Tracking #</th>
                    <th>Recipient</th>
                    <th>City / District</th>
                    <th>Shipped Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shipments.map((shp) => (
                    <tr key={shp.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{shp.orderNumber}</td>
                      <td><span className="badge badge-shipped">{shp.carrier}</span></td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#0369a1' }}>
                        {shp.trackingNumber || 'Pending'}
                      </td>
                      <td style={{ fontWeight: 600 }}>{shp.recipientName}</td>
                      <td>{shp.recipientCity}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{shp.shippedAt || '—'}</td>
                      <td>
                        <span className={`badge ${shp.status === 'DELIVERED' ? 'badge-active' : 'badge-shipped'}`}>{shp.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit Courier Modal */}
      {selectedCourier && (
        <div className="modal-backdrop" onClick={() => setSelectedCourier(null)}>
          <div className="modal-container" style={{ maxWidth: '480px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Key size={18} style={{ color: 'var(--primary)' }} />
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>
                  Configure {selectedCourier.provider}
                </h2>
              </div>
              <button className="btn-close" onClick={() => setSelectedCourier(null)}>×</button>
            </div>

            <form onSubmit={handleSaveConfig} style={{ padding: '20px' }}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">API Key</label>
                <input
                  type="password"
                  placeholder="Leave empty to keep existing key"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Secret Key / Token</label>
                <input
                  type="password"
                  placeholder="Leave empty to keep existing secret"
                  value={secretKeyInput}
                  onChange={(e) => setSecretKeyInput(e.target.value)}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '16px 0 20px 0' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={isEnabledInput}
                    onChange={(e) => setIsEnabledInput(e.target.checked)}
                  />
                  <span style={{ fontWeight: 600 }}>Enable this courier for fulfillment</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                  <input
                    type="checkbox"
                    checked={isTestModeInput}
                    onChange={(e) => setIsTestModeInput(e.target.checked)}
                  />
                  <span>Sandbox / Sandbox Test Mode</span>
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setSelectedCourier(null)}>
                  Cancel
                </button>
                <button type="submit" disabled={isSaving} className="btn btn-primary">
                  {isSaving ? 'Saving...' : 'Save Configuration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
