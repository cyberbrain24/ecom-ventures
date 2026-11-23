import React, { useCallback, useEffect, useState } from 'react';
import {
  StoreBrand,
  StoreProduct,
  StoreReview,
} from '../types/store';
import {
  CustomerDetail,
  CustomerSummary,
  MembershipTier,
  fetchCustomers,
  fetchCustomerDetail,
  createCustomer,
  updateCustomerCRM,
  toggleCustomerBlacklist,
  impersonateCustomer,
  deleteCustomer,
  CreateCustomerPayload,
} from '../lib/customers-api';
import {
  Search,
  UserCheck,
  ShieldAlert,
  Crown,
  MapPin,
  ExternalLink,
  Edit3,
  Trash2,
  Plus,
  X,
  Phone,
  Mail,
  Calendar,
  AlertTriangle,
  RotateCcw,
  ShoppingBag,
  TrendingUp,
  Percent,
  CheckCircle2,
  Clock,
} from 'lucide-react';

interface CustomersViewProps {
  currentStore: StoreBrand;
  customers: any[];
  products: StoreProduct[];
  reviews: StoreReview[];
}

function formatMoney(amount: number, currency: string): string {
  return `${currency} ${(amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export const CustomersView: React.FC<CustomersViewProps> = ({ currentStore, reviews }) => {
  const [activeTab, setActiveTab] = useState<'customers' | 'reviews'>('customers');
  const [customersList, setCustomersList] = useState<CustomerSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter and search state
  const [search, setSearch] = useState('');
  const [tierFilter, setTierFilter] = useState<string>('ALL');
  const [blacklistFilter, setBlacklistFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState(1);

  // Selected customer for Profile Intelligence Drawer
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  // Profile Drawer Form Edits
  const [editTier, setEditTier] = useState<MembershipTier>('STANDARD');
  const [editDob, setEditDob] = useState<string>('');
  const [editNotes, setEditNotes] = useState<string>('');
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Create Modal
  const [isCreating, setIsCreating] = useState(false);
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newTier, setNewTier] = useState<MembershipTier>('STANDARD');
  const [newNotes, setNewNotes] = useState('');
  const [createError, setCreateError] = useState<string | null>(null);
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);

  // Blacklist confirmation
  const [isBlacklistPromptOpen, setIsBlacklistPromptOpen] = useState(false);
  const [blacklistReason, setBlacklistReason] = useState('');

  // Impersonation state
  const [isImpersonating, setIsImpersonating] = useState(false);

  // Delete Guardrail state
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteGuardrailAlert, setDeleteGuardrailAlert] = useState<string | null>(null);

  const loadCustomers = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const filters: any = {
        page: currentPage,
        limit: 50,
      };
      if (search.trim()) filters.search = search.trim();
      if (tierFilter !== 'ALL') filters.membership_tier = tierFilter;
      if (blacklistFilter === 'BLACKLISTED') filters.is_blacklisted = true;
      if (blacklistFilter === 'ACTIVE') filters.is_blacklisted = false;

      const res = await fetchCustomers(filters);
      setCustomersList(res.customers || []);
      setTotalCount(res.total || 0);
    } catch (err: any) {
      setErrorMsg(err.message || 'Could not load customer directory.');
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, search, tierFilter, blacklistFilter]);

  useEffect(() => {
    loadCustomers();
  }, [loadCustomers]);

  const openCustomerDetail = async (id: string) => {
    setSelectedCustomerId(id);
    setIsDetailLoading(true);
    setDetailError(null);
    setActionNotice(null);
    setDeleteGuardrailAlert(null);
    try {
      const detail = await fetchCustomerDetail(id);
      setCustomerDetail(detail);
      setEditTier(detail.membership_tier);
      setEditDob(detail.date_of_birth ? detail.date_of_birth.substring(0, 10) : '');
      setEditNotes(detail.crm_notes || '');
    } catch (err: any) {
      setDetailError(err.message || 'Failed to load customer profile details.');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const handleSaveCRMProfile = async () => {
    if (!selectedCustomerId) return;
    setIsSavingNotes(true);
    setActionNotice(null);
    try {
      const updated = await updateCustomerCRM(selectedCustomerId, {
        membership_tier: editTier,
        date_of_birth: editDob ? editDob : undefined,
        crm_notes: editNotes,
      });
      setCustomerDetail(updated);
      setActionNotice('CRM profile and staff notes saved successfully.');
      loadCustomers();
    } catch (err: any) {
      setActionNotice(`Error: ${err.message || 'Failed to save CRM profile'}`);
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleToggleBlacklist = async () => {
    if (!customerDetail) return;
    const targetState = !customerDetail.is_blacklisted;
    try {
      await toggleCustomerBlacklist(customerDetail.id, {
        is_blacklisted: targetState,
        reason: targetState ? blacklistReason || 'Flagged for serial RTO / doorstep cancellation' : '',
      });
      setIsBlacklistPromptOpen(false);
      setBlacklistReason('');
      setActionNotice(targetState ? 'Customer account has been soft-deactivated and blacklisted.' : 'Customer reinstated to active status.');
      openCustomerDetail(customerDetail.id);
      loadCustomers();
    } catch (err: any) {
      setActionNotice(`Error: ${err.message || 'Failed to update blacklist status'}`);
    }
  };

  const handleImpersonate = async (id: string) => {
    setIsImpersonating(true);
    setActionNotice(null);
    try {
      const imp = await impersonateCustomer(id);
      setActionNotice('1-Click Storefront Impersonation token issued!');
      const primaryDomain = currentStore.primaryDomain || `${currentStore.slug}.localhost:5200`;
      const url = `http://${primaryDomain}?impersonate_token=${imp.customer_token}`;
      window.open(url, '_blank');
    } catch (err: any) {
      setActionNotice(`Impersonation failed: ${err.message || 'Could not issue storefront token'}`);
    } finally {
      setIsImpersonating(false);
    }
  };

  const handleDeleteWithGuardrail = async () => {
    if (!customerDetail) return;
    setIsDeleting(true);
    setDeleteGuardrailAlert(null);
    try {
      await deleteCustomer(customerDetail.id);
      setSelectedCustomerId(null);
      setCustomerDetail(null);
      loadCustomers();
    } catch (err: any) {
      setDeleteGuardrailAlert(err.message || 'Deletion failed. Customer with order history cannot be deleted.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirstName.trim() || (!newPhone.trim() && !newEmail.trim())) {
      setCreateError('First name and either mobile phone number or email are required.');
      return;
    }
    setIsSubmittingCreate(true);
    setCreateError(null);
    try {
      const payload: CreateCustomerPayload = {
        first_name: newFirstName.trim(),
        last_name: newLastName.trim(),
        phone: newPhone.trim() ? newPhone.trim() : undefined,
        email: newEmail.trim() ? newEmail.trim() : undefined,
        membership_tier: newTier,
        crm_notes: newNotes.trim(),
      };
      const created = await createCustomer(payload);
      setIsCreating(false);
      setNewFirstName('');
      setNewLastName('');
      setNewPhone('');
      setNewEmail('');
      setNewNotes('');
      loadCustomers();
      openCustomerDetail(created.id);
    } catch (err: any) {
      setCreateError(err.message || 'Failed to register customer profile.');
    } finally {
      setIsSubmittingCreate(false);
    }
  };

  const renderTierBadge = (tier: MembershipTier) => {
    switch (tier) {
      case 'VIP_BLACK':
        return (
          <span className="badge" style={{ backgroundColor: '#0f172a', color: '#f59e0b', border: '1px solid #d97706', fontWeight: 700 }}>
            ★ VIP Black
          </span>
        );
      case 'GOLD':
        return (
          <span className="badge" style={{ backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fcd34d', fontWeight: 600 }}>
            Gold Tier
          </span>
        );
      case 'SILVER':
        return (
          <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', fontWeight: 600 }}>
            Silver Tier
          </span>
        );
      case 'STANDARD':
      default:
        return (
          <span className="badge" style={{ backgroundColor: '#f0fdf4', color: '#166534', border: '1px solid #bbf7d0', fontWeight: 500 }}>
            Standard
          </span>
        );
    }
  };

  const renderReliabilityBadge = (score: number, total: number) => {
    if (total === 0) {
      return <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>No orders yet</span>;
    }
    if (score >= 80) {
      return (
        <span className="badge" style={{ backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0' }}>
          ✓ {score.toFixed(0)}% Safe COD
        </span>
      );
    }
    if (score >= 50) {
      return (
        <span className="badge" style={{ backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a' }}>
          ⚠ {score.toFixed(0)}% Medium
        </span>
      );
    }
    return (
      <span className="badge" style={{ backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', fontWeight: 700 }}>
        ✕ {score.toFixed(0)}% High RTO Risk
      </span>
    );
  };

  return (
    <div>
      {/* Page Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
            CRM Customer Profiles & Intelligence
          </h1>
          <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
            Phone-first unified directory, dynamic LTV ledger, fraud/RTO risk scoring, and staff operational tools for <code>{currentStore.name}</code>.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setIsCreating(true)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} /> Add Customer Profile
          </button>
        </div>
      </div>

      {/* Main Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '14px', paddingBottom: '8px' }}>
        <button
          onClick={() => setActiveTab('customers')}
          className={`btn btn-sm ${activeTab === 'customers' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Customer Profiles ({totalCount})
        </button>
        <button
          onClick={() => setActiveTab('reviews')}
          className={`btn btn-sm ${activeTab === 'reviews' ? 'btn-primary' : 'btn-secondary'}`}
        >
          Reviews ({reviews.length})
        </button>
      </div>

      {activeTab === 'customers' && (
        <>
          {/* Filter & Live Search Toolbar */}
          <div className="card" style={{ marginBottom: '16px', padding: '12px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', gap: '8px', flex: 1, minWidth: '260px' }}>
                <div style={{ position: 'relative', width: '100%', maxWidth: '380px' }}>
                  <Search
                    size={16}
                    style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                  />
                  <input
                    type="text"
                    placeholder="Search by Mobile Phone, Name, or Email..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="input"
                    style={{ paddingLeft: '32px', width: '100%' }}
                  />
                </div>
              </div>

              {/* Tier Filter */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600 }}>Tier:</span>
                <select
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value)}
                  className="input"
                  style={{ width: '140px', padding: '6px 8px' }}
                >
                  <option value="ALL">All Tiers</option>
                  <option value="VIP_BLACK">★ VIP Black</option>
                  <option value="GOLD">Gold</option>
                  <option value="SILVER">Silver</option>
                  <option value="STANDARD">Standard</option>
                </select>

                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 600, marginLeft: '8px' }}>Status:</span>
                <select
                  value={blacklistFilter}
                  onChange={(e) => setBlacklistFilter(e.target.value)}
                  className="input"
                  style={{ width: '130px', padding: '6px 8px' }}
                >
                  <option value="ALL">All Accounts</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="BLACKLISTED">Blacklisted</option>
                </select>

                <button onClick={loadCustomers} className="btn btn-secondary btn-sm" title="Refresh List">
                  <RotateCcw size={14} />
                </button>
              </div>
            </div>
          </div>

          {/* Customer Table */}
          <div className="card" style={{ padding: 0 }}>
            {isLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading customer profiles from tenant ledger...
              </div>
            ) : errorMsg ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--danger)' }}>
                <AlertTriangle size={24} style={{ margin: '0 auto 8px auto' }} />
                <p>{errorMsg}</p>
                <button onClick={loadCustomers} className="btn btn-sm btn-secondary" style={{ marginTop: '8px' }}>
                  Retry
                </button>
              </div>
            ) : customersList.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No customer profiles match the current search or filters.
              </div>
            ) : (
              <div className="table-container" style={{ border: 'none' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Customer Identity</th>
                      <th>Primary Phone (Anchor)</th>
                      <th>Membership Tier</th>
                      <th>Location</th>
                      <th>Total Orders</th>
                      <th>Lifetime Spend (LTV)</th>
                      <th>COD Delivery Reliability</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customersList.map((c) => (
                      <tr key={c.id} style={{ opacity: c.is_blacklisted ? 0.6 : 1 }}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                            {c.first_name} {c.last_name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {c.email || 'No email attached'}
                          </div>
                        </td>
                        <td>
                          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--primary)' }}>
                            {c.phone || '—'}
                          </span>
                        </td>
                        <td>{renderTierBadge(c.membership_tier)}</td>
                        <td>
                          <div style={{ fontSize: '0.8rem' }}>
                            {c.district || c.city || '—'}
                          </div>
                          {c.thana && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                              {c.thana}
                            </div>
                          )}
                        </td>
                        <td style={{ fontWeight: 600 }}>{c.metrics.total_orders}</td>
                        <td style={{ fontWeight: 700, color: 'var(--text-main)' }}>
                          {formatMoney(c.metrics.lifetime_value, currentStore.currency)}
                        </td>
                        <td>
                          {renderReliabilityBadge(c.metrics.reliability_score, c.metrics.total_orders)}
                        </td>
                        <td>
                          {c.is_blacklisted ? (
                            <span className="badge" style={{ backgroundColor: '#fee2e2', color: '#991b1b', fontWeight: 600 }}>
                              Blacklisted
                            </span>
                          ) : (
                            <span className="badge" style={{ backgroundColor: '#f0fdf4', color: '#166534' }}>
                              Active
                            </span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              onClick={() => openCustomerDetail(c.id)}
                              className="btn btn-sm btn-secondary"
                              title="Inspect Customer CRM Profile & Intelligence"
                            >
                              View CRM Profile
                            </button>
                            <button
                              onClick={() => handleImpersonate(c.id)}
                              className="btn btn-sm btn-secondary"
                              title="1-Click Impersonation: Open Storefront as this Customer"
                            >
                              <ExternalLink size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Reviews Tab */}
      {activeTab === 'reviews' && (
        <div className="card" style={{ padding: 0 }}>
          {reviews.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No product reviews have been loaded from the server.
            </div>
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Customer</th>
                    <th>Rating</th>
                    <th>Review</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.productId}</td>
                      <td>{r.customerName}</td>
                      <td style={{ color: '#d97706', fontWeight: 700 }}>★ {r.rating} / 5</td>
                      <td>{r.comment}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Slide-Over Profile Intelligence Drawer */}
      {selectedCustomerId && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(3px)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '650px',
              backgroundColor: 'var(--bg-main, #ffffff)',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-8px 0 25px rgba(0,0,0,0.15)',
              overflowY: 'auto',
            }}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: 'var(--bg-muted, #f8fafc)',
                position: 'sticky',
                top: 0,
                zIndex: 10,
              }}
            >
              <div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)' }}>
                  {customerDetail ? `${customerDetail.first_name} ${customerDetail.last_name}` : 'Customer Profile'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  ID: {selectedCustomerId}
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomerId(null)}
                className="btn btn-secondary btn-sm"
                style={{ padding: '6px' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Action Notice */}
            {actionNotice && (
              <div
                style={{
                  margin: '12px 20px 0 20px',
                  padding: '10px 14px',
                  borderRadius: '6px',
                  backgroundColor: actionNotice.startsWith('Error') ? '#fef2f2' : '#f0fdf4',
                  color: actionNotice.startsWith('Error') ? '#b91c1c' : '#166534',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                }}
              >
                {actionNotice}
              </div>
            )}

            {/* Deletion Guardrail Alert Banner */}
            {deleteGuardrailAlert && (
              <div
                style={{
                  margin: '12px 20px 0 20px',
                  padding: '12px 14px',
                  borderRadius: '6px',
                  backgroundColor: '#fff1f2',
                  border: '1px solid #fecdd3',
                  color: '#9f1239',
                  fontSize: '0.8rem',
                }}
              >
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', fontWeight: 700, marginBottom: '4px' }}>
                  <ShieldAlert size={16} /> Audit Protected Integrity (Pillar 5 Safeguard)
                </div>
                {deleteGuardrailAlert}
              </div>
            )}

            {isDetailLoading ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Aggregating real-time ledger intelligence...
              </div>
            ) : detailError ? (
              <div style={{ padding: '24px', color: 'var(--danger)', textAlign: 'center' }}>
                <p>{detailError}</p>
                <button onClick={() => openCustomerDetail(selectedCustomerId)} className="btn btn-sm btn-secondary">
                  Retry
                </button>
              </div>
            ) : customerDetail ? (
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* 1. Real-Time Financial Intelligence Cards */}
                <div>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    📊 Real-Time Financial & Logistics Intelligence (Pillar 2)
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                    <div className="card" style={{ padding: '12px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Lifetime Value (LTV)</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--primary)', marginTop: '4px' }}>
                        {formatMoney(customerDetail.metrics.lifetime_value, currentStore.currency)}
                      </div>
                    </div>

                    <div className="card" style={{ padding: '12px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>Average Order (AOV)</div>
                      <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', marginTop: '4px' }}>
                        {formatMoney(customerDetail.metrics.average_order_value, currentStore.currency)}
                      </div>
                    </div>

                    <div className="card" style={{ padding: '12px', textAlign: 'center', backgroundColor: '#f8fafc' }}>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>COD Reliability Score</div>
                      <div style={{ marginTop: '6px' }}>
                        {renderReliabilityBadge(customerDetail.metrics.reliability_score, customerDetail.metrics.total_orders)}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', marginTop: '10px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>Total Orders: <strong>{customerDetail.metrics.total_orders}</strong></span>
                    <span>Delivered: <strong style={{ color: '#16a34a' }}>{customerDetail.metrics.delivered_orders}</strong></span>
                    <span>Cancelled: <strong style={{ color: '#dc2626' }}>{customerDetail.metrics.cancelled_orders}</strong></span>
                    <span>RTO/Refund: <strong style={{ color: '#ea580c' }}>{customerDetail.metrics.rto_orders}</strong></span>
                  </div>
                </div>

                {/* 2. Contact Channels & Primary Identity */}
                <div>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    📱 Phone-First Unified Identity (Pillar 1)
                  </h3>
                  <div className="card" style={{ padding: '14px', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Phone size={14} /> Primary Phone Number:
                      </span>
                      <strong style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>
                        {customerDetail.phone || '—'}
                      </strong>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Mail size={14} /> Email Address:
                      </span>
                      <span>{customerDetail.email || '—'}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} /> Date of Birth:
                      </span>
                      <span>{customerDetail.date_of_birth ? customerDetail.date_of_birth.substring(0, 10) : 'Not specified'}</span>
                    </div>
                  </div>
                </div>

                {/* 3. CRM Behavioral Notes & Membership Tier Editor */}
                <div>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    👑 Membership Tier Progression & Staff Notes (Pillar 4)
                  </h3>
                  <div className="card" style={{ padding: '14px' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                          Assigned Membership Tier:
                        </label>
                        <select
                          value={editTier}
                          onChange={(e) => setEditTier(e.target.value as MembershipTier)}
                          className="input"
                          style={{ width: '100%', padding: '6px 8px' }}
                        >
                          <option value="STANDARD">Standard Tier</option>
                          <option value="SILVER">Silver Tier (5% Off)</option>
                          <option value="GOLD">Gold Tier (10% Off + Free Delivery)</option>
                          <option value="VIP_BLACK">★ VIP Black (Exclusive VIP Club)</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                          Date of Birth:
                        </label>
                        <input
                          type="date"
                          value={editDob}
                          onChange={(e) => setEditDob(e.target.value)}
                          className="input"
                          style={{ width: '100%', padding: '5px 8px' }}
                        />
                      </div>
                    </div>

                    <div style={{ marginBottom: '12px' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                        Staff CRM Behavioral Remarks & Customer Preferences:
                      </label>
                      <textarea
                        rows={3}
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="e.g. Regular tele-sales customer; calls before delivery; prefers red packaging..."
                        className="input"
                        style={{ width: '100%', resize: 'vertical' }}
                      />
                    </div>

                    <button
                      onClick={handleSaveCRMProfile}
                      disabled={isSavingNotes}
                      className="btn btn-primary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <Edit3 size={14} /> {isSavingNotes ? 'Saving Notes...' : 'Save CRM Changes'}
                    </button>
                  </div>
                </div>

                {/* 4. Hierarchical Geographic Address Architecture */}
                <div>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    📍 Geographic Address Book (Pillar 3)
                  </h3>
                  {customerDetail.addresses.length === 0 ? (
                    <div className="card" style={{ padding: '14px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      No saved addresses found. Addresses will be captured on checkout or tele-sales dispatch.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {customerDetail.addresses.map((addr) => (
                        <div key={addr.id} className="card" style={{ padding: '12px', fontSize: '0.82rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                            <strong>{addr.label || 'Delivery Address'} ({addr.recipient_name})</strong>
                            <div>
                              {addr.is_default_shipping && (
                                <span className="badge" style={{ backgroundColor: '#ecfdf5', color: '#047857', marginRight: '4px' }}>
                                  Default Shipping
                                </span>
                              )}
                              {addr.is_default_billing && (
                                <span className="badge" style={{ backgroundColor: '#eff6ff', color: '#1d4ed8' }}>
                                  Default Billing
                                </span>
                              )}
                            </div>
                          </div>
                          <div style={{ color: 'var(--text-muted)' }}>
                            {addr.street_address}
                            {addr.apartment_suite && `, ${addr.apartment_suite}`}
                          </div>
                          <div style={{ marginTop: '4px', fontWeight: 600 }}>
                            {addr.thana && `${addr.thana}, `}{addr.district || addr.city}, {addr.country}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            Phone: {addr.phone}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 5. Recent Orders Ledger */}
                <div>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '10px' }}>
                    🛒 Recent Order Activity
                  </h3>
                  {customerDetail.recent_orders.length === 0 ? (
                    <div className="card" style={{ padding: '14px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                      No order history recorded for this customer.
                    </div>
                  ) : (
                    <div className="card" style={{ padding: 0 }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Order #</th>
                            <th>Status</th>
                            <th>Payment</th>
                            <th>Amount</th>
                            <th>Date</th>
                          </tr>
                        </thead>
                        <tbody>
                          {customerDetail.recent_orders.map((o) => (
                            <tr key={o.id}>
                              <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{o.order_number}</td>
                              <td><span className="badge">{o.status}</span></td>
                              <td>{o.payment_status}</td>
                              <td style={{ fontWeight: 700 }}>{formatMoney(o.total_amount, currentStore.currency)}</td>
                              <td style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                                {new Date(o.created_at).toLocaleDateString()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* 6. Operational Guardrails & Staff Tools */}
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <h3 style={{ fontSize: '0.85rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)' }}>
                    ⚙️ Staff Tools & Guardrails (Pillar 5)
                  </h3>

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {/* Impersonation Button */}
                    <button
                      onClick={() => handleImpersonate(customerDetail.id)}
                      disabled={isImpersonating}
                      className="btn btn-secondary btn-sm"
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <ExternalLink size={14} />
                      {isImpersonating ? 'Issuing Token...' : '1-Click Customer Impersonation'}
                    </button>

                    {/* Blacklist / Soft-Deactivate Button */}
                    <button
                      onClick={() => setIsBlacklistPromptOpen(true)}
                      className={`btn btn-sm ${customerDetail.is_blacklisted ? 'btn-secondary' : 'btn-danger'}`}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                    >
                      <ShieldAlert size={14} />
                      {customerDetail.is_blacklisted ? 'Reinstate Active Status' : 'Blacklist / Soft-Deactivate'}
                    </button>

                    {/* Safe Delete Guardrail Button */}
                    <button
                      onClick={handleDeleteWithGuardrail}
                      disabled={isDeleting}
                      className="btn btn-sm btn-secondary"
                      style={{ color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto' }}
                      title="Deletes profile if no orders exist. Blocks hard delete if financial ledger records exist."
                    >
                      <Trash2 size={14} />
                      {isDeleting ? 'Checking Ledger...' : 'Delete Profile'}
                    </button>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Blacklist Prompt Modal */}
      {isBlacklistPromptOpen && customerDetail && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div className="card" style={{ maxWidth: '450px', width: '100%', padding: '20px' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 8px 0', color: customerDetail.is_blacklisted ? 'var(--text-main)' : 'var(--danger)' }}>
              {customerDetail.is_blacklisted ? 'Reinstate Customer Profile' : 'Blacklist Customer Account'}
            </h3>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              {customerDetail.is_blacklisted
                ? 'Are you sure you want to restore this customer account to active status?'
                : 'Blacklisting will soft-deactivate this customer, flag high RTO risk on incoming orders, and prevent promotional redemption.'}
            </p>

            {!customerDetail.is_blacklisted && (
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Reason for Blacklisting:
                </label>
                <input
                  type="text"
                  placeholder="e.g. Serial fake orders, refused 3 COD deliveries at doorstep"
                  value={blacklistReason}
                  onChange={(e) => setBlacklistReason(e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                />
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button onClick={() => setIsBlacklistPromptOpen(false)} className="btn btn-secondary btn-sm">
                Cancel
              </button>
              <button
                onClick={handleToggleBlacklist}
                className={`btn btn-sm ${customerDetail.is_blacklisted ? 'btn-primary' : 'btn-danger'}`}
              >
                {customerDetail.is_blacklisted ? 'Confirm Reinstate' : 'Confirm Blacklist'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Customer Modal */}
      {isCreating && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.7)',
            zIndex: 1100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div className="card" style={{ maxWidth: '500px', width: '100%', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>Register New Customer Profile</h3>
              <button onClick={() => setIsCreating(false)} className="btn btn-secondary btn-sm" style={{ padding: '4px' }}>
                <X size={16} />
              </button>
            </div>

            {createError && (
              <div style={{ padding: '8px 12px', backgroundColor: '#fef2f2', color: '#b91c1c', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '12px' }}>
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateCustomerSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>First Name *</label>
                  <input
                    type="text"
                    required
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    className="input"
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Last Name</label>
                  <input
                    type="text"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    className="input"
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>
                  Mobile Phone (Primary Anchor Key) *
                </label>
                <input
                  type="text"
                  placeholder="+8801XXXXXXXXX"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="input"
                  style={{ width: '100%', fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Email Address</label>
                <input
                  type="email"
                  placeholder="customer@domain.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="input"
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Initial Membership Tier</label>
                <select
                  value={newTier}
                  onChange={(e) => setNewTier(e.target.value as MembershipTier)}
                  className="input"
                  style={{ width: '100%' }}
                >
                  <option value="STANDARD">Standard Tier</option>
                  <option value="SILVER">Silver Tier</option>
                  <option value="GOLD">Gold Tier</option>
                  <option value="VIP_BLACK">★ VIP Black</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Staff CRM Remarks</label>
                <textarea
                  rows={2}
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Initial notes on acquisition or customer preferences..."
                  className="input"
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px' }}>
                <button type="button" onClick={() => setIsCreating(false)} className="btn btn-secondary btn-sm">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmittingCreate} className="btn btn-primary btn-sm">
                  {isSubmittingCreate ? 'Creating...' : 'Create Customer Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
