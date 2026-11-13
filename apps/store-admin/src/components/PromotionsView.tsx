import React, { useState } from 'react';
import {
  Tag,
  Plus,
  Percent,
  Pencil,
  Trash2,
  Layers,
  Truck,
  Sparkles,
  CheckCircle2,
  XCircle,
  TrendingUp,
} from 'lucide-react';
import { StoreCoupon, StoreBrand, BundleTier } from '../types/store';
import { EditCouponModal } from './EditCouponModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { CreateBundleTierModal } from './CreateBundleTierModal';
import { EditBundleTierModal } from './EditBundleTierModal';

interface PromotionsViewProps {
  currentStore: StoreBrand;
  coupons: StoreCoupon[];
  bundleTiers?: BundleTier[];
  onAddCoupon: (coupon: StoreCoupon) => void;
  onUpdateCoupon: (coupon: StoreCoupon) => void;
  onDeleteCoupon: (couponId: string) => void;
  onToggleCoupon: (couponId: string) => void;
  onAddBundleTier?: (tier: BundleTier) => void;
  onUpdateBundleTier?: (tier: BundleTier) => void;
  onDeleteBundleTier?: (tierId: string) => void;
  onToggleBundleTier?: (tierId: string) => void;
}

type PromotionSubTab = 'coupons' | 'bundles';

export const PromotionsView: React.FC<PromotionsViewProps> = ({
  currentStore,
  coupons,
  bundleTiers = [],
  onAddCoupon,
  onUpdateCoupon,
  onDeleteCoupon,
  onToggleCoupon,
  onAddBundleTier,
  onUpdateBundleTier,
  onDeleteBundleTier,
  onToggleBundleTier,
}) => {
  const [activeTab, setActiveTab] = useState<PromotionSubTab>('coupons');

  // Coupon Modals
  const [isCouponModalOpen, setIsCouponModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<StoreCoupon | null>(null);
  const [deletingCoupon, setDeletingCoupon] = useState<StoreCoupon | null>(null);

  // Bundle Tier Modals
  const [isBundleModalOpen, setIsBundleModalOpen] = useState(false);
  const [editingBundleTier, setEditingBundleTier] = useState<BundleTier | null>(null);
  const [deletingBundleTier, setDeletingBundleTier] = useState<BundleTier | null>(null);

  // Coupon Creation Form State
  const [code, setCode] = useState('');
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [discountValue, setDiscountValue] = useState('10');
  const [minOrder, setMinOrder] = useState('5000');
  const [usageLimit, setUsageLimit] = useState('100');

  const handleCreateCoupon = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !discountValue) return;

    const newCoupon: StoreCoupon = {
      id: `cp-${Date.now()}`,
      code: code.trim().toUpperCase(),
      discountType,
      discountValue: parseFloat(discountValue),
      minOrderAmount: parseFloat(minOrder) || 0,
      usageCount: 0,
      usageLimit: parseInt(usageLimit, 10) || 100,
      isActive: true,
      expiresAt: '2026-12-31',
    };

    onAddCoupon(newCoupon);
    setIsCouponModalOpen(false);
    setCode('');
  };

  const activeTiersCount = bundleTiers.filter((t) => t.isActive).length;
  const maxDiscountTier = bundleTiers.reduce((max, t) => (t.discountPercentage > max ? t.discountPercentage : max), 0);
  const freeDeliveryTiersCount = bundleTiers.filter((t) => t.hasFreeDelivery).length;

  return (
    <div>
      {/* Top Header & Context Description */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
            Discount Engine & Promotions
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
            Drive conversion and boost Average Order Value (AOV) for <strong>{currentStore.name}</strong>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {activeTab === 'coupons' ? (
            <button onClick={() => setIsCouponModalOpen(true)} className="btn btn-primary btn-sm">
              <Plus size={15} />
              <span>Create Coupon Code</span>
            </button>
          ) : (
            <button onClick={() => setIsBundleModalOpen(true)} className="btn btn-primary btn-sm">
              <Plus size={15} />
              <span>Create Combo Offer Tier</span>
            </button>
          )}
        </div>
      </div>

      {/* Promotions Overview Metrics - 7 Column Box Card Design */}
      <div className="stats-grid">
        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Total Coupons</div>
            <div className="stat-val">{coupons.length}</div>
            <div className="stat-sub" style={{ color: '#0284c7', fontWeight: 600 }}>
              <Tag size={11} /> Discount codes
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#f0f9ff', color: '#0284c7' }}>
            <Tag size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Active Coupons</div>
            <div className="stat-val" style={{ color: '#059669' }}>
              {coupons.filter((c) => c.isActive).length}
            </div>
            <div className="stat-sub" style={{ color: '#10b981' }}>
              <CheckCircle2 size={11} /> Claimable
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
            <CheckCircle2 size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Bundle Tiers</div>
            <div className="stat-val">{bundleTiers.length}</div>
            <div className="stat-sub" style={{ color: '#6366f1' }}>
              <Layers size={11} /> Combos
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#eef2ff', color: '#6366f1' }}>
            <Layers size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Active Combos</div>
            <div className="stat-val" style={{ color: '#059669' }}>{activeTiersCount}</div>
            <div className="stat-sub" style={{ color: '#10b981' }}>
              <Sparkles size={11} /> Live cart deals
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#dcfce7', color: '#15803d' }}>
            <Sparkles size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Free Delivery</div>
            <div className="stat-val" style={{ color: '#0284c7' }}>{freeDeliveryTiersCount}</div>
            <div className="stat-sub" style={{ color: '#0284c7' }}>
              <Truck size={11} /> Perks enabled
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#e0f2fe', color: '#0369a1' }}>
            <Truck size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Max Discount</div>
            <div className="stat-val" style={{ color: '#f59e0b' }}>{maxDiscountTier}%</div>
            <div className="stat-sub" style={{ color: '#d97706' }}>
              <Percent size={11} /> Highest combo
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
            <Percent size={16} />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Redemptions</div>
            <div className="stat-val">
              {coupons.reduce((sum, c) => sum + (c.usageCount || 0), 0)}
            </div>
            <div className="stat-sub" style={{ color: '#64748b' }}>
              <TrendingUp size={11} /> Total claimed
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#f8fafc', color: '#475569' }}>
            <TrendingUp size={16} />
          </div>
        </div>
      </div>

      {/* Segmented Sub-Tab Switcher */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-color, #e2e8f0)',
          marginBottom: '20px',
          paddingBottom: '2px',
        }}
      >
        <button
          onClick={() => setActiveTab('coupons')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'coupons' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
            color: activeTab === 'coupons' ? 'var(--primary)' : 'var(--text-muted)',
            transition: 'all 0.2s ease',
          }}
        >
          <Tag size={16} />
          <span>Coupon Codes & Vouchers ({coupons.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('bundles')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 16px',
            fontSize: '0.85rem',
            fontWeight: 700,
            cursor: 'pointer',
            border: 'none',
            background: 'none',
            borderBottom: activeTab === 'bundles' ? '2.5px solid var(--primary)' : '2.5px solid transparent',
            color: activeTab === 'bundles' ? 'var(--primary)' : 'var(--text-muted)',
            transition: 'all 0.2s ease',
          }}
        >
          <Layers size={16} />
          <span>Multi-Item Bundle Tiers ("Buy More & Save") ({bundleTiers.length})</span>
        </button>
      </div>

      {/* TAB 1: COUPON CODES & VOUCHERS */}
      {activeTab === 'coupons' && (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Coupon Code</th>
                  <th>Discount Amount</th>
                  <th>Min Cart Requirement</th>
                  <th>Redemption Progress</th>
                  <th>Expiration</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {coupons.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      No active discount coupons found for {currentStore.name}.
                    </td>
                  </tr>
                ) : (
                  coupons.map((cp) => (
                    <tr key={cp.id}>
                      <td>
                        <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.95rem', color: '#1e293b' }}>
                          {cp.code}
                        </div>
                      </td>
                      <td>
                        <span style={{ fontWeight: 700, color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {cp.discountType === 'PERCENTAGE' ? <Percent size={14} /> : '৳ '}
                          {cp.discountValue} {cp.discountType === 'PERCENTAGE' ? 'OFF' : 'BDT OFF'}
                        </span>
                      </td>
                      <td>৳ {cp.minOrderAmount.toLocaleString()}</td>
                      <td>
                        <div style={{ width: '120px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', marginBottom: '3px' }}>
                            <span>{cp.usageCount} used</span>
                            <span style={{ color: 'var(--text-muted)' }}>max {cp.usageLimit}</span>
                          </div>
                          <div style={{ width: '100%', height: '6px', background: '#e2e8f0', borderRadius: '9999px', overflow: 'hidden' }}>
                            <div
                              style={{
                                width: `${Math.min(100, (cp.usageCount / cp.usageLimit) * 100)}%`,
                                height: '100%',
                                background: 'var(--primary)',
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{cp.expiresAt}</td>
                      <td>
                        <span className={`badge ${cp.isActive ? 'badge-active' : 'badge-outline'}`}>
                          {cp.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            onClick={() => onToggleCoupon(cp.id)}
                            className={`btn btn-sm ${cp.isActive ? 'btn-secondary' : 'btn-primary'}`}
                            style={{ padding: '4px 8px', fontSize: '0.76rem' }}
                          >
                            {cp.isActive ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            onClick={() => setEditingCoupon(cp)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '4px 7px' }}
                            title="Edit Coupon"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            onClick={() => setDeletingCoupon(cp)}
                            className="btn btn-danger btn-sm"
                            style={{ padding: '3px 6px' }}
                            title="Delete Coupon"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: MULTI-ITEM BUNDLE TIERS */}
      {activeTab === 'bundles' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Summary Metric Pills */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(255, 90, 31, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
                <Layers size={22} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Active Combo Tiers</p>
                <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>{activeTiersCount} / {bundleTiers.length}</h3>
              </div>
            </div>

            <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#10b981' }}>
                <Sparkles size={22} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Maximum Savings</p>
                <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>{maxDiscountTier}% OFF</h3>
              </div>
            </div>

            <div className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#3b82f6' }}>
                <Truck size={22} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Free Delivery Perks</p>
                <h3 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 800 }}>{freeDeliveryTiersCount} Tiers Unlocked</h3>
              </div>
            </div>
          </div>

          {/* Bundle Tiers Table */}
          <div className="card" style={{ padding: 0 }}>
            <div className="table-container" style={{ border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Combo Tier</th>
                    <th>Required Slots</th>
                    <th>Discount Rate</th>
                    <th>Delivery Perk</th>
                    <th>Marketing Badge</th>
                    <th>Perks Breakdown</th>
                    <th>Order</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {bundleTiers.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        No bundle tiers configured yet. Click "Create Combo Offer Tier" to create your first bundle offer.
                      </td>
                    </tr>
                  ) : (
                    bundleTiers.map((tier) => (
                      <tr key={tier.id}>
                        <td>
                          <div>
                            <div style={{ fontWeight: 800, fontSize: '0.95rem', color: '#1e293b' }}>
                              {tier.name}
                            </div>
                            {tier.subtitle && (
                              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {tier.subtitle}
                              </div>
                            )}
                          </div>
                        </td>
                        <td>
                          <span style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                            {tier.requiredItemsCount} Items
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 800, color: 'var(--primary)', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                            <Percent size={13} />
                            {tier.discountPercentage}% OFF
                          </span>
                        </td>
                        <td>
                          {tier.hasFreeDelivery ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                background: '#dcfce7',
                                color: '#15803d',
                                fontSize: '0.74rem',
                                fontWeight: 700,
                              }}
                            >
                              <Truck size={12} />
                              FREE Delivery
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                              Standard Courier
                            </span>
                          )}
                        </td>
                        <td>
                          {tier.badgeText ? (
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: '#fef3c7',
                                color: '#b45309',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                letterSpacing: '0.04em',
                              }}
                            >
                              {tier.badgeText}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>—</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {tier.perks.slice(0, 2).map((p, idx) => (
                              <span key={idx} style={{ fontSize: '0.74rem', color: '#475569', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                • {p}
                              </span>
                            ))}
                            {tier.perks.length > 2 && (
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                +{tier.perks.length - 2} more
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}>
                          #{tier.displayOrder}
                        </td>
                        <td>
                          <span className={`badge ${tier.isActive ? 'badge-active' : 'badge-outline'}`}>
                            {tier.isActive ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px' }}>
                            <button
                              onClick={() => onToggleBundleTier && onToggleBundleTier(tier.id)}
                              className={`btn btn-sm ${tier.isActive ? 'btn-secondary' : 'btn-primary'}`}
                              style={{ padding: '4px 8px', fontSize: '0.76rem' }}
                            >
                              {tier.isActive ? 'Disable' : 'Enable'}
                            </button>
                            <button
                              onClick={() => setEditingBundleTier(tier)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 7px' }}
                              title="Edit Bundle Tier"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => setDeletingBundleTier(tier)}
                              className="btn btn-danger btn-sm"
                              style={{ padding: '3px 6px' }}
                              title="Delete Bundle Tier"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Create Coupon Modal */}
      {isCouponModalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '16px' }}>Create Promotional Coupon</h2>
            <form onSubmit={handleCreateCoupon}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Coupon Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SUMMER20"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="form-input"
                  style={{ textTransform: 'uppercase' }}
                />
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Discount Type</label>
                  <select
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                    className="form-select"
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED">Fixed Amount (BDT)</option>
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Discount Value *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={discountValue}
                    onChange={(e) => setDiscountValue(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="form-grid">
                <div className="form-group">
                  <label className="form-label">Minimum Cart Amount (BDT)</label>
                  <input
                    type="number"
                    value={minOrder}
                    onChange={(e) => setMinOrder(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Total Max Usage Limit</label>
                  <input
                    type="number"
                    value={usageLimit}
                    onChange={(e) => setUsageLimit(e.target.value)}
                    className="form-input"
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '16px' }}>
                <button type="button" onClick={() => setIsCouponModalOpen(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create Coupon
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Coupon Modal */}
      {editingCoupon && (
        <EditCouponModal
          coupon={editingCoupon}
          onClose={() => setEditingCoupon(null)}
          onSave={(updated) => {
            onUpdateCoupon(updated);
            setEditingCoupon(null);
          }}
        />
      )}

      {/* Delete Coupon Confirmation Modal */}
      {deletingCoupon && (
        <ConfirmDeleteModal
          isOpen={!!deletingCoupon}
          title="Delete Promotional Coupon"
          itemName={`${deletingCoupon.code} (${deletingCoupon.discountValue}${deletingCoupon.discountType === 'PERCENTAGE' ? '%' : ' BDT'})`}
          itemType="Promotional Coupon"
          warningMessage={`Are you sure you want to permanently delete coupon "${deletingCoupon.code}"? Customers will no longer be able to apply this discount voucher at checkout.`}
          onConfirm={() => {
            onDeleteCoupon(deletingCoupon.id);
            setDeletingCoupon(null);
          }}
          onClose={() => setDeletingCoupon(null)}
        />
      )}

      {/* Create Bundle Tier Modal */}
      {isBundleModalOpen && (
        <CreateBundleTierModal
          isOpen={isBundleModalOpen}
          onClose={() => setIsBundleModalOpen(false)}
          onSave={(newTier) => {
            if (onAddBundleTier) {
              onAddBundleTier(newTier);
            }
          }}
        />
      )}

      {/* Edit Bundle Tier Modal */}
      {editingBundleTier && (
        <EditBundleTierModal
          tier={editingBundleTier}
          onClose={() => setEditingBundleTier(null)}
          onSave={(updated) => {
            if (onUpdateBundleTier) {
              onUpdateBundleTier(updated);
            }
            setEditingBundleTier(null);
          }}
        />
      )}

      {/* Delete Bundle Tier Confirmation Modal */}
      {deletingBundleTier && (
        <ConfirmDeleteModal
          isOpen={!!deletingBundleTier}
          title="Delete Bundle Tier"
          itemName={`${deletingBundleTier.name} (${deletingBundleTier.requiredItemsCount} Items - ${deletingBundleTier.discountPercentage}% OFF)`}
          itemType="Bundle Offer Tier"
          warningMessage={`Are you sure you want to permanently delete bundle tier "${deletingBundleTier.name}"? Storefront shoppers will no longer be offered this slot bundle configuration.`}
          onConfirm={() => {
            if (onDeleteBundleTier) {
              onDeleteBundleTier(deletingBundleTier.id);
            }
            setDeletingBundleTier(null);
          }}
          onClose={() => setDeletingBundleTier(null)}
        />
      )}
    </div>
  );
};
