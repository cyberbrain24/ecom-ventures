import React, { useEffect, useState } from 'react';
import { StoreBrand } from '../types/store';
import { EmptyState } from './StoreStatusNotices';
import {
  InventoryItem,
  InventoryMovementItem,
  adjustInventoryStock,
  fetchInventoryItems,
  fetchInventoryMovements,
} from '../lib/inventory-api';
import { RecordModal } from './RecordModal';

interface InventoryViewProps {
  currentStore: StoreBrand;
  products?: any[];
  movements?: any[];
}

export const InventoryView: React.FC<InventoryViewProps> = ({ currentStore }) => {
  const [activeTab, setActiveTab] = useState<'stock' | 'history'>('stock');
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [movements, setMovements] = useState<InventoryMovementItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Adjustment Modal
  const [adjustItem, setAdjustItem] = useState<InventoryItem | null>(null);
  const [adjustQuantity, setAdjustQuantity] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>('MANUAL_CORRECTION');
  const [adjustNotes, setAdjustNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      if (activeTab === 'stock') {
        const res = await fetchInventoryItems();
        setItems(res.items || []);
      } else {
        const res = await fetchInventoryMovements();
        setMovements(res.movements || []);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load inventory data');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const handleAdjustSubmit = async () => {
    if (!adjustItem) return;
    if (adjustQuantity === 0) {
      throw new Error('Quantity change must be non-zero.');
    }
    await adjustInventoryStock(adjustItem.variant_id, adjustQuantity, adjustReason, adjustNotes);
    setAdjustItem(null);
    setAdjustQuantity(0);
    setAdjustNotes('');
    loadData();
  };

  return (
    <div>
      <div style={{ marginBottom: '14px' }}>
        <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
          Inventory & Stocks
        </h1>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
          Live stock levels and double-entry movement ledger for <code>{currentStore.name}</code>
        </p>
      </div>

      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '12px', paddingBottom: '8px' }}>
        <button
          onClick={() => setActiveTab('stock')}
          className={`btn btn-sm ${activeTab === 'stock' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Stock balances ({items.length})
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`btn btn-sm ${activeTab === 'history' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Movement history ({movements.length})
        </button>
      </div>

      {error && (
        <div className="notice notice-error" style={{ marginBottom: '12px' }}>
          {error}
        </div>
      )}

      {activeTab === 'stock' && (
        <div className="card" style={{ padding: 0 }}>
          {isLoading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading stock balances...</div>
          ) : items.length === 0 ? (
            <EmptyState message="No inventory items found. Add products with variants to begin tracking stock." />
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product & Variant</th>
                    <th>SKU</th>
                    <th>On Hand</th>
                    <th>Reserved</th>
                    <th>Available</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr key={it.variant_id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{it.product_title}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{it.variant_title}</div>
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{it.sku}</td>
                      <td style={{ fontWeight: 700 }}>{it.quantity_on_hand}</td>
                      <td style={{ color: 'var(--text-muted)' }}>{it.quantity_reserved}</td>
                      <td style={{ fontWeight: 700, color: it.quantity_available <= it.low_stock_threshold ? '#dc2626' : '#15803d' }}>
                        {it.quantity_available}
                      </td>
                      <td>
                        <span className={`badge ${it.is_low_stock ? 'badge-error' : 'badge-active'}`}>
                          {it.is_low_stock ? 'LOW STOCK' : 'IN STOCK'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          onClick={() => {
                            setAdjustItem(it);
                            setAdjustQuantity(0);
                            setAdjustNotes('');
                          }}
                          className="btn btn-sm btn-secondary"
                        >
                          Adjust Stock
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

      {activeTab === 'history' && (
        <div className="card" style={{ padding: 0 }}>
          {isLoading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading movement audit trail...</div>
          ) : movements.length === 0 ? (
            <EmptyState message="No stock movements recorded yet." />
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Variant ID</th>
                    <th>Change</th>
                    <th>Before → After</th>
                    <th>Reason</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(m.created_at).toLocaleString()}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{m.variant_id.slice(0, 8)}...</td>
                      <td style={{ fontWeight: 700, color: m.quantity_change > 0 ? '#15803d' : '#dc2626' }}>
                        {m.quantity_change > 0 ? `+${m.quantity_change}` : m.quantity_change}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}>
                        {m.quantity_before} → {m.quantity_after}
                      </td>
                      <td>
                        <span className="badge badge-outline">{m.reason}</span>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{m.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Adjust Stock Modal */}
      {adjustItem && (
        <RecordModal
          title={`Adjust Stock: ${adjustItem.product_title} (${adjustItem.sku})`}
          submitLabel="Save Adjustment"
          onClose={() => setAdjustItem(null)}
          onSubmit={handleAdjustSubmit}
        >
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Current On Hand</label>
              <input className="form-input" disabled value={adjustItem.quantity_on_hand} />
            </div>

            <div className="form-group">
              <label className="form-label">Quantity Change (+ / -) *</label>
              <input
                type="number"
                className="form-input"
                required
                value={adjustQuantity}
                onChange={(e) => setAdjustQuantity(parseInt(e.target.value, 10) || 0)}
                placeholder="e.g. +10 or -2"
                autoFocus
              />
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Reason</label>
              <select
                className="form-select"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
              >
                <option value="MANUAL_CORRECTION">Manual Stock Correction</option>
                <option value="PURCHASE_RECEIPT">Purchase Receipt (Inventory In)</option>
                <option value="DAMAGED">Damaged / Defective Stock</option>
                <option value="SHRINKAGE">Shrinkage / Lost Inventory</option>
                <option value="RETURN_RESTOCK">Customer Return Restock</option>
              </select>
            </div>

            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Notes / Remarks</label>
              <input
                className="form-input"
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
                placeholder="Audit explanation for this adjustment"
              />
            </div>
          </div>
        </RecordModal>
      )}
    </div>
  );
};
