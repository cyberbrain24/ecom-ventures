import React, { useEffect, useState, useTransition } from 'react';
import { BundleTier, StoreBrand, StoreCoupon } from '../types/store';
import {
  CouponItem,
  DiscountType,
  createCoupon,
  deleteCoupon,
  fetchCoupons,
  toggleCouponStatus,
  updateCoupon,
} from '../lib/promotions-api';
import { CatalogCategory, CatalogProduct, fetchCategories, fetchProducts } from '../lib/catalog-api';

interface PromotionsViewProps {
  currentStore: StoreBrand;
  coupons?: StoreCoupon[];
  bundleTiers?: BundleTier[];
}

export const PromotionsView: React.FC<PromotionsViewProps> = ({ currentStore }) => {
  const [activeTab, setActiveTab] = useState<'coupons' | 'bundles'>('coupons');
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // Categories & Products for targeting picker modal
  const [categories, setCategories] = useState<CatalogCategory[]>([]);
  const [products, setProducts] = useState<CatalogProduct[]>([]);

  // Modal State
  const [modalMode, setModalMode] = useState<'create' | 'edit' | null>(null);
  const [selectedCoupon, setSelectedCoupon] = useState<CouponItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form Fields
  const [formCode, setFormCode] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formDiscountType, setFormDiscountType] = useState<DiscountType>('PERCENTAGE');
  const [formDiscountValue, setFormDiscountValue] = useState<number>(10);
  const [formMinSubtotal, setFormMinSubtotal] = useState<number>(0);
  const [formMaxDiscount, setFormMaxDiscount] = useState<string>('');
  const [formMaxUses, setFormMaxUses] = useState<number>(0);
  const [formMaxUsesPerCustomer, setFormMaxUsesPerCustomer] = useState<number>(1);
  const [formValidFrom, setFormValidFrom] = useState('');
  const [formValidTo, setFormValidTo] = useState('');
  const [formIsActive, setFormIsActive] = useState(true);

  // Targeting Arrays
  const [formApplicableCategoryIds, setFormApplicableCategoryIds] = useState<string[]>([]);
  const [formIncludedProductIds, setFormIncludedProductIds] = useState<string[]>([]);
  const [formExcludedProductIds, setFormExcludedProductIds] = useState<string[]>([]);

  const [, startTransition] = useTransition();

  const loadData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const activeParam = statusFilter === 'ALL' ? undefined : statusFilter === 'ACTIVE';
      const res = await fetchCoupons(currentStore.slug, {
        search: search.trim() || undefined,
        is_active: activeParam,
      });
      setCoupons(res.coupons || []);
      setTotal(res.total || 0);
    } catch (err: any) {
      setError(err?.message || 'Failed to load promotions');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentStore.slug, search, statusFilter]);

  // Load categories and products for modal picker
  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => {});
    fetchProducts(false).then(setProducts).catch(() => {});
  }, []);

  const openCreateModal = () => {
    const today = new Date();
    const nextMonth = new Date();
    nextMonth.setDate(today.getDate() + 30);

    setFormCode('');
    setFormDescription('');
    setFormDiscountType('PERCENTAGE');
    setFormDiscountValue(10);
    setFormMinSubtotal(0);
    setFormMaxDiscount('');
    setFormMaxUses(0);
    setFormMaxUsesPerCustomer(1);
    setFormValidFrom(today.toISOString().slice(0, 16));
    setFormValidTo(nextMonth.toISOString().slice(0, 16));
    setFormIsActive(true);
    setFormApplicableCategoryIds([]);
    setFormIncludedProductIds([]);
    setFormExcludedProductIds([]);
    setSelectedCoupon(null);
    setModalMode('create');
  };

  const openEditModal = (c: CouponItem) => {
    setSelectedCoupon(c);
    setFormCode(c.code);
    setFormDescription(c.description || '');
    setFormDiscountType(c.discount_type);
    setFormDiscountValue(c.discount_value);
    setFormMinSubtotal(c.min_subtotal);
    setFormMaxDiscount(c.max_discount_amount ? String(c.max_discount_amount) : '');
    setFormMaxUses(c.max_uses);
    setFormMaxUsesPerCustomer(c.max_uses_per_customer);
    setFormValidFrom(c.valid_from ? new Date(c.valid_from).toISOString().slice(0, 16) : '');
    setFormValidTo(c.valid_to ? new Date(c.valid_to).toISOString().slice(0, 16) : '');
    setFormIsActive(c.is_active);
    setFormApplicableCategoryIds(c.applicable_category_ids || []);
    setFormIncludedProductIds(c.included_product_ids || []);
    setFormExcludedProductIds(c.excluded_product_ids || []);
    setModalMode('edit');
  };

  const handleToggleStatus = async (c: CouponItem) => {
    try {
      await toggleCouponStatus(currentStore.slug, c.id, !c.is_active);
      setCoupons((prev) =>
        prev.map((item) => (item.id === c.id ? { ...item, is_active: !item.is_active } : item))
      );
    } catch (err: any) {
      alert(err?.message || 'Failed to toggle status');
    }
  };

  const handleDelete = async (c: CouponItem) => {
    if (!confirm(`Are you sure you want to permanently delete coupon "${c.code}"?`)) {
      return;
    }
    try {
      await deleteCoupon(currentStore.slug, c.id);
      setCoupons((prev) => prev.filter((item) => item.id !== c.id));
      setTotal((prev) => prev - 1);
    } catch (err: any) {
      alert(err?.message || 'Failed to delete coupon');
    }
  };

  const handleSaveCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim()) {
      alert('Coupon code is required');
      return;
    }

    setIsSubmitting(true);
    try {
      const maxDiscountVal = formMaxDiscount.trim() ? parseFloat(formMaxDiscount) : undefined;
      const validFromISO = new Date(formValidFrom).toISOString();
      const validToISO = new Date(formValidTo).toISOString();

      if (modalMode === 'create') {
        const created = await createCoupon(currentStore.slug, {
          code: formCode.trim().toUpperCase(),
          description: formDescription.trim(),
          discount_type: formDiscountType,
          discount_value: formDiscountValue,
          min_subtotal: formMinSubtotal,
          max_discount_amount: maxDiscountVal,
          max_uses: formMaxUses,
          max_uses_per_customer: formMaxUsesPerCustomer,
          valid_from: validFromISO,
          valid_to: validToISO,
          is_active: formIsActive,
          applicable_category_ids: formApplicableCategoryIds,
          included_product_ids: formIncludedProductIds,
          excluded_product_ids: formExcludedProductIds,
        });
        setCoupons([created, ...coupons]);
        setTotal((prev) => prev + 1);
      } else if (modalMode === 'edit' && selectedCoupon) {
        const updated = await updateCoupon(currentStore.slug, selectedCoupon.id, {
          description: formDescription.trim(),
          min_subtotal: formMinSubtotal,
          max_discount_amount: maxDiscountVal,
          max_uses: formMaxUses,
          max_uses_per_customer: formMaxUsesPerCustomer,
          valid_from: validFromISO,
          valid_to: validToISO,
          is_active: formIsActive,
          applicable_category_ids: formApplicableCategoryIds,
          included_product_ids: formIncludedProductIds,
          excluded_product_ids: formExcludedProductIds,
        });
        setCoupons((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      }
      setModalMode(null);
    } catch (err: any) {
      alert(err?.message || 'Failed to save coupon');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleArrayItem = (arr: string[], item: string): string[] => {
    return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
  };

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
            Promotions & Discount Engine
          </h1>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '4px 0 0 0' }}>
            Multi-stage promo codes, hierarchical category targeting & rate limiting for <strong>{currentStore.name}</strong>
          </p>
        </div>
        <button onClick={openCreateModal} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>+</span> Create Coupon
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '16px', paddingBottom: '8px' }}>
        <button onClick={() => setActiveTab('coupons')} className={`btn btn-sm ${activeTab === 'coupons' ? 'btn-primary' : 'btn-secondary'}`}>
          Active Coupons ({total})
        </button>
        <button onClick={() => setActiveTab('bundles')} className={`btn btn-sm ${activeTab === 'bundles' ? 'btn-primary' : 'btn-secondary'}`}>
          Bundle Tiers (Trio Architecture)
        </button>
      </div>

      {activeTab === 'coupons' && (
        <>
          {/* Filters Bar */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '240px' }}>
              <input
                type="text"
                placeholder="Search coupon code or description..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="form-control"
                style={{ width: '100%', fontSize: '0.85rem', padding: '7px 12px' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              {(['ALL', 'ACTIVE', 'INACTIVE'] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setStatusFilter(mode)}
                  className={`btn btn-sm ${statusFilter === mode ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.78rem' }}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div style={{ padding: '12px', background: '#fee2e2', color: '#991b1b', borderRadius: '6px', marginBottom: '16px', fontSize: '0.85rem' }}>
              {error}
            </div>
          )}

          {/* Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {isLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading promotion rules...
              </div>
            ) : coupons.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No promotion coupons found matching criteria.
              </div>
            ) : (
              <div className="table-container" style={{ border: 'none', margin: 0 }}>
                <table className="data-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Discount Value</th>
                      <th>Targeting Scope</th>
                      <th>Min Spend</th>
                      <th>Global Cap</th>
                      <th>Per Customer</th>
                      <th>Validity</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {coupons.map((c) => {
                      const hasCategories = c.applicable_category_ids && c.applicable_category_ids.length > 0;
                      const hasWhitelist = c.included_product_ids && c.included_product_ids.length > 0;
                      const hasBlacklist = c.excluded_product_ids && c.excluded_product_ids.length > 0;

                      return (
                        <tr key={c.id}>
                          <td>
                            <div style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--text-main)', fontSize: '0.95rem' }}>
                              {c.code}
                            </div>
                            {c.description && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {c.description}
                              </div>
                            )}
                          </td>
                          <td>
                            <span style={{ fontWeight: 600 }}>
                              {c.discount_type === 'PERCENTAGE' && `${c.discount_value}% OFF`}
                              {c.discount_type === 'FIXED_AMOUNT' && `${currentStore.currency} ${c.discount_value}`}
                              {c.discount_type === 'FREE_SHIPPING' && 'Free Shipping'}
                            </span>
                            {c.max_discount_amount && (
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                                Cap: {currentStore.currency} {c.max_discount_amount}
                              </div>
                            )}
                          </td>
                          <td>
                            {!hasCategories && !hasWhitelist && !hasBlacklist && (
                              <span className="badge" style={{ background: '#e0f2fe', color: '#0369a1', fontSize: '0.72rem' }}>
                                Entire Store
                              </span>
                            )}
                            {hasCategories && (
                              <div style={{ fontSize: '0.75rem', color: '#4338ca', fontWeight: 600 }}>
                                📁 {c.applicable_category_ids.length} Categories (+child)
                              </div>
                            )}
                            {hasWhitelist && (
                              <div style={{ fontSize: '0.72rem', color: '#15803d' }}>
                                ✓ {c.included_product_ids.length} Products Whitelisted
                              </div>
                            )}
                            {hasBlacklist && (
                              <div style={{ fontSize: '0.72rem', color: '#b91c1c' }}>
                                ✕ {c.excluded_product_ids.length} Blacklisted
                              </div>
                            )}
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>
                            {c.min_subtotal > 0 ? `${currentStore.currency} ${c.min_subtotal}` : 'None'}
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>
                            {c.times_used} / {c.max_uses > 0 ? c.max_uses : '∞'}
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>
                            {c.max_uses_per_customer > 0 ? `${c.max_uses_per_customer}x / phone` : '∞'}
                          </td>
                          <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            <div>Start: {new Date(c.valid_from).toLocaleDateString()}</div>
                            <div>End: {new Date(c.valid_to).toLocaleDateString()}</div>
                          </td>
                          <td>
                            <button
                              onClick={() => handleToggleStatus(c)}
                              className={`badge ${c.is_active ? 'badge-active' : 'badge-outline'}`}
                              style={{ cursor: 'pointer', border: 'none' }}
                              title="Click to toggle status"
                            >
                              {c.is_active ? 'ACTIVE' : 'INACTIVE'}
                            </button>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button onClick={() => openEditModal(c)} className="btn btn-sm btn-secondary" style={{ fontSize: '0.75rem', padding: '4px 8px' }}>
                                Edit
                              </button>
                              <button onClick={() => handleDelete(c)} className="btn btn-sm" style={{ fontSize: '0.75rem', padding: '4px 8px', color: '#dc2626', borderColor: '#fca5a5' }}>
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {activeTab === 'bundles' && (
        <div className="card" style={{ padding: '24px' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '8px' }}>Multi-Item Bundle Tiers (Trio Engine)</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '16px' }}>
            Built into the platform architecture: 3-item dynamic bundles offering proportional tier discounts and auto-free shipping.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', background: 'var(--card-bg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '1rem' }}>Trio Saver Tier</span>
                <span className="badge badge-active">ACTIVE</span>
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 12px 0' }}>
                Buy any 3 items from catalog to receive 10% instant off plus free shipping.
              </p>
              <div style={{ fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div><strong>Min Items:</strong> 3 items</div>
                <div><strong>Discount:</strong> 10% off entire bundle</div>
                <div><strong>Free Shipping:</strong> Yes (0 BDT delivery fee)</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit Modal */}
      {modalMode && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px',
          }}
        >
          <div
            style={{
              background: 'var(--card-bg, #ffffff)',
              borderRadius: '12px',
              maxWidth: '750px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              padding: '24px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                {modalMode === 'create' ? 'Create Promotional Coupon' : `Edit Coupon: ${formCode}`}
              </h2>
              <button
                type="button"
                onClick={() => setModalMode(null)}
                style={{ background: 'transparent', border: 'none', fontSize: '1.4rem', cursor: 'pointer', color: 'var(--text-muted)' }}
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveCoupon}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                    Coupon Code *
                  </label>
                  <input
                    type="text"
                    required
                    disabled={modalMode === 'edit'}
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                    placeholder="e.g. FLASH20"
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontWeight: 700 }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                    Discount Type *
                  </label>
                  <select
                    value={formDiscountType}
                    disabled={modalMode === 'edit'}
                    onChange={(e) => setFormDiscountType(e.target.value as DiscountType)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
                  >
                    <option value="PERCENTAGE">Percentage (%)</option>
                    <option value="FIXED_AMOUNT">Fixed Monetary Amount</option>
                    <option value="FREE_SHIPPING">Free Shipping</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                  Description / Campaign Note
                </label>
                <input
                  type="text"
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="e.g. 15% Off Winter Sweaters Launch"
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                    Discount Value *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    disabled={formDiscountType === 'FREE_SHIPPING'}
                    value={formDiscountValue}
                    onChange={(e) => setFormDiscountValue(parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                    Max Discount Cap ({currentStore.currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    disabled={formDiscountType !== 'PERCENTAGE'}
                    placeholder="Optional ceiling"
                    value={formMaxDiscount}
                    onChange={(e) => setFormMaxDiscount(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                    Min Subtotal ({currentStore.currency})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formMinSubtotal}
                    onChange={(e) => setFormMinSubtotal(parseFloat(e.target.value) || 0)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                    Global Max Redemptions (0 = Unlimited)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formMaxUses}
                    onChange={(e) => setFormMaxUses(parseInt(e.target.value, 10) || 0)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                    Per-Customer Limit (Phone Anchor)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formMaxUsesPerCustomer}
                    onChange={(e) => setFormMaxUsesPerCustomer(parseInt(e.target.value, 10) || 0)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                    Valid From *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formValidFrom}
                    onChange={(e) => setFormValidFrom(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '4px' }}>
                    Valid To *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formValidTo}
                    onChange={(e) => setFormValidTo(e.target.value)}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)' }}
                  />
                </div>
              </div>

              {/* Targeting Rules Section */}
              <div style={{ border: '1px solid var(--border)', borderRadius: '8px', padding: '16px', marginBottom: '20px', background: 'rgba(0,0,0,0.01)' }}>
                <h4 style={{ fontSize: '0.9rem', fontWeight: 700, margin: '0 0 12px 0' }}>
                  🎯 Scope & Advanced Targeting Resolution (Stages 4 & 5)
                </h4>

                {/* Categories */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px' }}>
                    Hierarchical Category Whitelist (Includes all descendant subcategories automatically)
                  </label>
                  <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px', background: '#fff' }}>
                    {categories.length === 0 ? (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No categories configured</span>
                    ) : (
                      categories.map((cat) => (
                        <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', padding: '3px 0', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={formApplicableCategoryIds.includes(cat.id)}
                            onChange={() => setFormApplicableCategoryIds(toggleArrayItem(formApplicableCategoryIds, cat.id))}
                          />
                          <span>📁 {cat.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>

                {/* Excluded Products */}
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px', color: '#b91c1c' }}>
                    Product Blacklist (Explicit Exclusion Gate)
                  </label>
                  <div style={{ maxHeight: '120px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '6px', padding: '8px', background: '#fff' }}>
                    {products.length === 0 ? (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>No products loaded</span>
                    ) : (
                      products.map((p) => (
                        <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', padding: '3px 0', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={formExcludedProductIds.includes(p.id)}
                            onChange={() => setFormExcludedProductIds(toggleArrayItem(formExcludedProductIds, p.id))}
                          />
                          <span>✕ {p.title} ({p.sku})</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                  />
                  <span>Active promotion</span>
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button type="button" onClick={() => setModalMode(null)} className="btn btn-secondary">
                    Cancel
                  </button>
                  <button type="submit" disabled={isSubmitting} className="btn btn-primary">
                    {isSubmitting ? 'Saving...' : modalMode === 'create' ? 'Create Coupon' : 'Update Coupon'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
