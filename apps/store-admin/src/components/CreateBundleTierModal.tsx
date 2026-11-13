import React, { useState } from 'react';
import { X, Sparkles, Truck, Tag, Layers } from 'lucide-react';
import { BundleTier } from '../types/store';

interface CreateBundleTierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tier: BundleTier) => void;
}

export const CreateBundleTierModal: React.FC<CreateBundleTierModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState('');
  const [requiredItemsCount, setRequiredItemsCount] = useState<number>(3);
  const [discountPercentage, setDiscountPercentage] = useState<number>(10);
  const [badgeText, setBadgeText] = useState('MOST POPULAR');
  const [subtitle, setSubtitle] = useState('Mix & Match Any 3 Products From Our Collection');
  const [perksText, setPerksText] = useState('SAVE 10%\nFREE DELIVERY ALL OVER BANGLADESH\nFan Favorite Bundle');
  const [hasFreeDelivery, setHasFreeDelivery] = useState(true);
  const [displayOrder, setDisplayOrder] = useState<number>(1);
  const [isActive, setIsActive] = useState(true);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const parsedPerks = perksText
      .split('\n')
      .map((p) => p.trim())
      .filter((p) => p.length > 0);

    const newTier: BundleTier = {
      id: `bt-${Date.now()}`,
      name: name.trim(),
      requiredItemsCount: Number(requiredItemsCount) || 2,
      discountPercentage: Number(discountPercentage) || 0,
      badgeText: badgeText.trim() || undefined,
      subtitle: subtitle.trim() || undefined,
      perks: parsedPerks,
      hasFreeDelivery,
      displayOrder: Number(displayOrder) || 1,
      isActive,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    onSave(newTier);
    onClose();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '580px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(255, 90, 31, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}>
              <Layers size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                Create Multi-Item Bundle Tier
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>
                Configure a slot-filling "Buy More & Save" promotional tier
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-secondary btn-sm"
            style={{ border: 'none', background: 'transparent', padding: '4px', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Combo Tier Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Trio, 4 Pack, Duo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Required Garments (Slots) *</label>
              <input
                type="number"
                required
                min={2}
                max={20}
                value={requiredItemsCount}
                onChange={(e) => setRequiredItemsCount(parseInt(e.target.value, 10) || 2)}
                className="form-input"
              />
            </div>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Discount Percentage (%) *</label>
              <input
                type="number"
                required
                min={0}
                max={100}
                step="0.5"
                value={discountPercentage}
                onChange={(e) => setDiscountPercentage(parseFloat(e.target.value) || 0)}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Promotional Header Badge</label>
              <input
                type="text"
                placeholder="e.g. MOST POPULAR, BEST VALUE"
                value={badgeText}
                onChange={(e) => setBadgeText(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Subtitle Description</label>
            <input
              type="text"
              placeholder="e.g. Mix & Match Any 3 Products From Our Collection"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Perks & Value Highlights (One per line)</label>
            <textarea
              rows={3}
              placeholder="SAVE 10%&#10;FREE DELIVERY ALL OVER BANGLADESH&#10;Fan Favorite Bundle"
              value={perksText}
              onChange={(e) => setPerksText(e.target.value)}
              className="form-textarea"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '0.82rem' }}
            />
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label className="form-label">Display Order Sequence</label>
              <input
                type="number"
                min={1}
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value, 10) || 1)}
                className="form-input"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', justifyContent: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={hasFreeDelivery}
                  onChange={(e) => setHasFreeDelivery(e.target.checked)}
                  style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                />
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Truck size={14} style={{ color: 'var(--primary)' }} />
                  Free Nationwide Delivery Perk
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ accentColor: 'var(--primary)', width: '16px', height: '16px' }}
                />
                <span>Active on Live Storefront</span>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              <Sparkles size={14} />
              <span>Save Bundle Tier</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

