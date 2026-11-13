import React, { useState } from 'react';
import { AlertTriangle, Plus, Minus, History, CheckCircle, RefreshCw, Package, DollarSign, Sparkles, XCircle, TrendingUp } from 'lucide-react';
import { StoreProduct, InventoryMovement, StoreBrand } from '../types/store';

interface InventoryViewProps {
  currentStore: StoreBrand;
  products: StoreProduct[];
  movements: InventoryMovement[];
  onAdjustStock: (productId: string, delta: number, reason: string) => void;
}

export const InventoryView: React.FC<InventoryViewProps> = ({
  currentStore,
  products,
  movements,
  onAdjustStock,
}) => {
  const [selectedProduct, setSelectedProduct] = useState<StoreProduct | null>(null);
  const [adjustAmount, setAdjustAmount] = useState<string>('5');
  const [adjustReason, setAdjustReason] = useState<string>('RESTOCK');
  const [isModalOpen, setIsModalOpen] = useState(false);

  const lowStockItems = products.filter((p) => p.inventoryCount > 0 && p.inventoryCount < 10);
  const healthyStockItems = products.filter((p) => p.inventoryCount >= 10);
  const outOfStockItems = products.filter((p) => (p.inventoryCount || 0) === 0);
  const totalStockUnits = products.reduce((sum, p) => sum + (p.inventoryCount || 0), 0);
  const totalStockValuation = products.reduce((sum, p) => sum + (p.inventoryCount || 0) * (p.price || 0), 0);

  const openAdjustModal = (product: StoreProduct) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleAdjust = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    const qty = parseInt(adjustAmount, 10);
    if (isNaN(qty)) return;

    onAdjustStock(selectedProduct.id, qty, adjustReason);
    setIsModalOpen(false);
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
            Real-Time Stock Inventory & Ledger
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
            Physical inventory levels and atomic stock movement auditing for <code>{currentStore.name}</code>
          </p>
        </div>
      </div>

      {/* Stock Operational Metrics - 7 Column Box Card Design */}
      <div className="stats-grid">
        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Total Stock Units</div>
            <div className="stat-val">{totalStockUnits}</div>
            <div className="stat-sub" style={{ color: '#0284c7', fontWeight: 600 }}>
              <Package size={11} /> Physical items
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#f0f9ff', color: '#0284c7' }}>
            <Package size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Tracked SKUs</div>
            <div className="stat-val">{products.length}</div>
            <div className="stat-sub" style={{ color: '#6366f1' }}>
              <Sparkles size={11} /> Active models
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#eef2ff', color: '#6366f1' }}>
            <Sparkles size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Healthy Stock</div>
            <div className="stat-val" style={{ color: '#059669' }}>{healthyStockItems.length}</div>
            <div className="stat-sub" style={{ color: '#10b981' }}>
              <CheckCircle size={11} /> &ge;10 units
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
            <CheckCircle size={16} />
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: lowStockItems.length > 0 ? '3px solid #f59e0b' : undefined }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Low Stock</div>
            <div className="stat-val" style={{ color: lowStockItems.length > 0 ? '#f59e0b' : 'var(--text-main)' }}>
              {lowStockItems.length}
            </div>
            <div className="stat-sub" style={{ color: '#d97706' }}>
              <AlertTriangle size={11} /> &lt;10 units
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
            <AlertTriangle size={16} />
          </div>
        </div>

        <div className="stat-card" style={{ borderLeft: outOfStockItems.length > 0 ? '3px solid #ef4444' : undefined }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Out of Stock</div>
            <div className="stat-val" style={{ color: outOfStockItems.length > 0 ? '#ef4444' : 'var(--text-main)' }}>
              {outOfStockItems.length}
            </div>
            <div className="stat-sub" style={{ color: '#dc2626' }}>
              <XCircle size={11} /> 0 inventory
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
            <XCircle size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Asset Valuation</div>
            <div className="stat-val">৳{Math.round(totalStockValuation).toLocaleString()}</div>
            <div className="stat-sub" style={{ color: '#059669' }}>
              <DollarSign size={11} /> Inventory value
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
            <DollarSign size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Audit History</div>
            <div className="stat-val">{movements.length}</div>
            <div className="stat-sub" style={{ color: '#64748b' }}>
              <History size={11} /> Movements
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#f8fafc', color: '#475569' }}>
            <History size={16} />
          </div>
        </div>
      </div>

      {/* Low Stock Alerts Banner */}
      {lowStockItems.length > 0 && (
        <div
          style={{
            backgroundColor: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle style={{ color: '#dc2626' }} size={18} />
            <div>
              <div style={{ fontWeight: 700, color: '#991b1b', fontSize: '0.84rem' }}>
                Stock Depletion Warning ({lowStockItems.length} item{lowStockItems.length > 1 ? 's' : ''} low on stock)
              </div>
              <div style={{ fontSize: '0.78rem', color: '#b91c1c' }}>
                The following SKUs have fallen below the 10-unit safety threshold:{' '}
                {lowStockItems.map((p) => `${p.title} (${p.inventoryCount} left)`).join(', ')}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock Overview Table */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Stock Levels Probing</div>
            <div className="card-desc">Current available inventory across product catalog</div>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Product Title</th>
                <th>SKU</th>
                <th>Category</th>
                <th>Available Stock</th>
                <th>Stock Health</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => {
                const isLow = p.inventoryCount < 10;
                return (
                  <tr key={p.id}>
                    <td style={{ fontWeight: 600 }}>{p.title}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{p.sku}</td>
                    <td><span className="badge badge-outline">{p.category}</span></td>
                    <td style={{ fontWeight: 700, fontSize: '0.95rem', color: isLow ? '#dc2626' : '#059669' }}>
                      {p.inventoryCount} units
                    </td>
                    <td>
                      <span className={`badge ${isLow ? 'badge-danger' : 'badge-active'}`}>
                        {isLow ? 'Low Stock' : 'Optimal'}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => openAdjustModal(p)}
                        className="btn btn-secondary btn-sm"
                      >
                        Adjust Stock
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Movement Audit Log */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <History size={18} />
              <span>Stock Movement Audit Trail</span>
            </div>
            <div className="card-desc">Immutable transaction log of stock decrements and restocking batches</div>
          </div>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Product / SKU</th>
                <th>Adjustment</th>
                <th>Ending Balance</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id}>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>{m.timestamp}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{m.productTitle}</div>
                    <div style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>{m.sku}</div>
                  </td>
                  <td style={{ fontWeight: 700, color: m.change > 0 ? '#059669' : '#dc2626' }}>
                    {m.change > 0 ? `+${m.change}` : m.change}
                  </td>
                  <td style={{ fontWeight: 600 }}>{m.balance} units</td>
                  <td>
                    <span className="badge badge-outline">{m.reason}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Stock Modal */}
      {isModalOpen && selectedProduct && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>Adjust Stock: {selectedProduct.title}</h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.25rem' }}>✕</button>
            </div>

            <form onSubmit={handleAdjust}>
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: 'var(--radius-sm)', marginBottom: '16px' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Current Available Balance:</div>
                <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)' }}>{selectedProduct.inventoryCount} units</div>
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Adjustment Quantity (+ or -)</label>
                <input
                  type="number"
                  required
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  className="form-input"
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Enter positive value to restock, negative to write-off.</span>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Adjustment Reason</label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="form-select"
                >
                  <option value="RESTOCK">RESTOCK (Supplier replenishment)</option>
                  <option value="DAMAGE">DAMAGE (Damaged in storage)</option>
                  <option value="MANUAL_CORRECTION">MANUAL_CORRECTION (Physical inventory count sync)</option>
                  <option value="ORDER_FULFILLMENT">ORDER_FULFILLMENT (Direct fulfillment)</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setIsModalOpen(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Commit Stock Change</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
