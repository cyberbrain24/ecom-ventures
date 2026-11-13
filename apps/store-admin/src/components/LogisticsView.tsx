import React, { useState } from 'react';
import { Truck, CheckCircle2, ShieldCheck, RefreshCw, Key, Zap, Navigation, Clock, TrendingUp, Layers } from 'lucide-react';
import { CourierConfig, StoreBrand, ShipmentRecord } from '../types/store';

interface LogisticsViewProps {
  currentStore: StoreBrand;
  couriers: CourierConfig[];
  shipments: ShipmentRecord[];
  onToggleCourier: (provider: string) => void;
}

export const LogisticsView: React.FC<LogisticsViewProps> = ({
  currentStore,
  couriers,
  shipments,
  onToggleCourier,
}) => {
  const [activeTab, setActiveTab] = useState<'configs' | 'shipments' | 'simulator'>('configs');
  const [testRecipient, setTestRecipient] = useState('Nusrat Jahan');
  const [testAddress, setTestAddress] = useState('House 14, Road 7, Dhanmondi, Dhaka');
  const [testPhone, setTestPhone] = useState('+880 1711 998822');
  const [testAmount, setTestAmount] = useState('18500');
  const [consignmentLog, setConsignmentLog] = useState<string | null>(null);
  const [isBooking, setIsBooking] = useState(false);

  const handleSimulateDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    setIsBooking(true);
    setTimeout(() => {
      const id = `ST-${Math.floor(100000 + Math.random() * 900000)}`;
      setConsignmentLog(`[Steadfast Dispatch Engine] Consignment booked successfully! ID: ${id} | COD Collection: ৳${testAmount} | Webhook listener registered.`);
      setIsBooking(false);
    }, 700);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
            Courier Logistics & Shipping Automation
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
            Integrated automated dispatch pipelines for Steadfast, Pathao, and RedX in <code>{currentStore.name}</code>
          </p>
        </div>
      </div>

      {/* Logistics Overview Metrics - 7 Column Box Card Design */}
      <div className="stats-grid">
        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Total Parcels</div>
            <div className="stat-val">{shipments.length}</div>
            <div className="stat-sub" style={{ color: '#0284c7', fontWeight: 600 }}>
              <Truck size={11} /> All consignments
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#f0f9ff', color: '#0284c7' }}>
            <Truck size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">In Transit</div>
            <div className="stat-val" style={{ color: '#0284c7' }}>
              {shipments.filter((s) => s.status === 'IN_TRANSIT').length}
            </div>
            <div className="stat-sub" style={{ color: '#0284c7' }}>
              <Clock size={11} /> On trunk route
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#e0f2fe', color: '#0369a1' }}>
            <Clock size={16} />
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: shipments.filter((s) => s.status === 'OUT_FOR_DELIVERY').length > 0 ? '3px solid #f59e0b' : undefined }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Out for Delivery</div>
            <div className="stat-val" style={{ color: '#f59e0b' }}>
              {shipments.filter((s) => s.status === 'OUT_FOR_DELIVERY').length}
            </div>
            <div className="stat-sub" style={{ color: '#d97706' }}>
              <Zap size={11} /> With rider
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
            <Zap size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Delivered</div>
            <div className="stat-val" style={{ color: '#059669' }}>
              {shipments.filter((s) => s.status === 'DELIVERED').length}
            </div>
            <div className="stat-sub" style={{ color: '#10b981' }}>
              <CheckCircle2 size={11} /> Completed
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
            <CheckCircle2 size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Success Rate</div>
            <div className="stat-val" style={{ color: '#059669' }}>
              {shipments.length > 0 ? Math.round((shipments.filter((s) => s.status === 'DELIVERED').length / shipments.length) * 100) : 100}%
            </div>
            <div className="stat-sub" style={{ color: '#059669', fontWeight: 600 }}>
              <TrendingUp size={11} /> Drop efficiency
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#dcfce7', color: '#15803d' }}>
            <TrendingUp size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Couriers</div>
            <div className="stat-val">{couriers.filter((c) => c.isActive).length}/{couriers.length}</div>
            <div className="stat-sub" style={{ color: '#6366f1' }}>
              <Layers size={11} /> Connected APIs
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#eef2ff', color: '#6366f1' }}>
            <Layers size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Auto-Dispatch</div>
            <div className="stat-val" style={{ color: '#059669' }}>
              {couriers.filter((c) => c.autoDispatch).length > 0 ? 'Active' : 'Manual'}
            </div>
            <div className="stat-sub" style={{ color: '#64748b' }}>
              <ShieldCheck size={11} /> Trigger mode
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
          onClick={() => setActiveTab('configs')}
          className={`btn btn-sm ${activeTab === 'configs' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.8rem', padding: '5px 12px' }}
        >
          <Truck size={14} />
          <span>Courier Partners ({couriers.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('shipments')}
          className={`btn btn-sm ${activeTab === 'shipments' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.8rem', padding: '5px 12px' }}
        >
          <Navigation size={14} />
          <span>Active Shipments Ledger ({shipments.length})</span>
        </button>
        <button
          onClick={() => setActiveTab('simulator')}
          className={`btn btn-sm ${activeTab === 'simulator' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ fontSize: '0.8rem', padding: '5px 12px' }}
        >
          <Zap size={14} />
          <span>Live Dispatch Engine</span>
        </button>
      </div>

      {/* Courier Providers Grid */}
      {activeTab === 'configs' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '28px' }}>
          {couriers.map((courier) => (
            <div key={courier.provider} className="card" style={{ marginBottom: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-sm)', background: '#e0f2fe', color: '#0369a1', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Truck size={20} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--text-main)' }}>{courier.provider} Courier</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Automated Parcel Delivery</div>
                  </div>
                </div>
                <span className={`badge ${courier.isActive ? 'badge-active' : 'badge-outline'}`}>
                  {courier.isActive ? 'ACTIVE' : 'DISABLED'}
                </span>
              </div>

              <div style={{ background: '#f8fafc', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>API Key:</span>
                  <code style={{ fontFamily: 'var(--font-mono)' }}>{courier.apiKey}</code>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Webhook Sync:</span>
                  <span style={{ color: courier.webhookStatus === 'ACTIVE' ? '#059669' : '#dc2626', fontWeight: 600 }}>
                    {courier.webhookStatus}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Auto Dispatch:</span>
                  <span style={{ fontWeight: 600 }}>{courier.autoDispatch ? 'Enabled on Payment' : 'Manual Trigger'}</span>
                </div>
              </div>

              <button
                onClick={() => onToggleCourier(courier.provider)}
                className={`btn btn-sm ${courier.isActive ? 'btn-secondary' : 'btn-primary'}`}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {courier.isActive ? 'Disable Integration' : 'Enable & Connect API'}
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Active Shipments Ledger */}
      {activeTab === 'shipments' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Carrier</th>
                  <th>Tracking #</th>
                  <th>Recipient</th>
                  <th>Destination</th>
                  <th>Shipped Date</th>
                  <th>Delivery Status</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((shp) => (
                  <tr key={shp.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{shp.orderNumber}</td>
                    <td><span className="badge badge-shipped">{shp.carrier}</span></td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: '#0369a1' }}>{shp.trackingNumber}</td>
                    <td style={{ fontWeight: 600 }}>{shp.recipientName}</td>
                    <td>{shp.recipientCity}</td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{shp.shippedAt}</td>
                    <td>
                      <span className={`badge ${shp.status === 'DELIVERED' ? 'badge-active' : 'badge-shipped'}`}>
                        {shp.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Live Parcel Dispatch Simulator */}
      {activeTab === 'simulator' && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Live Dispatch Booking Engine</div>
              <div className="card-desc">Simulate direct API consignment creation with automated reverse-sync</div>
            </div>
          </div>

          <form onSubmit={handleSimulateDispatch}>
            <div className="form-grid">
              <div className="form-group">
                <label className="form-label">Recipient Full Name</label>
                <input
                  type="text"
                  required
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">Customer Mobile (+880)</label>
                <input
                  type="text"
                  required
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="form-group">
                <label className="form-label">COD Collection Amount (BDT)</label>
                <input
                  type="number"
                  required
                  value={testAmount}
                  onChange={(e) => setTestAmount(e.target.value)}
                  className="form-input"
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label className="form-label">Delivery Address Coordinates</label>
              <input
                type="text"
                required
                value={testAddress}
                onChange={(e) => setTestAddress(e.target.value)}
                className="form-input"
              />
            </div>

            <button
              type="submit"
              disabled={isBooking}
              className="btn btn-primary"
              style={{ backgroundColor: '#0284c7' }}
            >
              <Zap size={14} />
              <span>{isBooking ? 'Contacting Courier API...' : 'Dispatch Parcel & Generate Consignment'}</span>
            </button>
          </form>

          {consignmentLog && (
            <div style={{ marginTop: '16px', background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '12px 16px', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: '#065f46', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={18} />
              <span>{consignmentLog}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
