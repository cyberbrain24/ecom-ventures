import React, { useState } from 'react';
import { X, Save, Tag } from 'lucide-react';
import { StoreCoupon } from '../types/store';

interface EditCouponModalProps {
  coupon: StoreCoupon;
  onClose: () => void;
  onSave: (updated: StoreCoupon) => void;
}

export const EditCouponModal: React.FC<EditCouponModalProps> = ({ coupon, onClose, onSave }) => {
  const [code, setCode] = useState(coupon.code);
  const [discountType, setDiscountType] = useState<'PERCENTAGE' | 'FIXED'>(coupon.discountType);
  const [discountValue, setDiscountValue] = useState(coupon.discountValue.toString());
  const [minOrder, setMinOrder] = useState(coupon.minOrderAmount.toString());
  const [usageLimit, setUsageLimit] = useState(coupon.usageLimit.toString());
  const [expiresAt, setExpiresAt] = useState(coupon.expiresAt);
  const [isActive, setIsActive] = useState(coupon.isActive);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !discountValue) return;

    const updated: StoreCoupon = {
      ...coupon,
      code: code.trim().toUpperCase(),
      discountType,
      discountValue: parseFloat(discountValue) || 0,
      minOrderAmount: parseFloat(minOrder) || 0,
      usageLimit: parseInt(usageLimit, 10) || 100,
      expiresAt,
      isActive,
    };
    onSave(updated);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal-content" style={{ maxWidth: '480px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Tag size={15} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>Edit Coupon Discount</h3>
              <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-subtle)' }}>Code: {coupon.code}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid" style={{ marginBottom: '10px' }}>
            <div className="form-group">
              <label className="form-label">Coupon Code *</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="form-input"
                style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Discount Type</label>
              <select
                value={discountType}
                onChange={(e) => setDiscountType(e.target.value as any)}
                className="form-select"
              >
                <option value="PERCENTAGE">Percentage (%)</option>
                <option value="FIXED">Fixed Amount (৳ BDT)</option>
              </select>
            </div>
          </div>

          <div className="form-grid" style={{ marginBottom: '10px' }}>
            <div className="form-group">
              <label className="form-label">Discount Value *</label>
              <input
                type="number"
                required
                min="0"
                step="0.1"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Min Cart Spend (৳)</label>
              <input
                type="number"
                min="0"
                value={minOrder}
                onChange={(e) => setMinOrder(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div className="form-grid" style={{ marginBottom: '14px' }}>
            <div className="form-group">
              <label className="form-label">Max Usage Redemptions</label>
              <input
                type="number"
                min="1"
                value={usageLimit}
                onChange={(e) => setUsageLimit(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Expiration Date</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              type="checkbox"
              id="coupon-is-active"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
            />
            <label htmlFor="coupon-is-active" className="form-label" style={{ margin: 0, cursor: 'pointer' }}>
              Active and redeemable at checkout
            </label>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm">
              <Save size={13} />
              <span>Save Coupon Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
