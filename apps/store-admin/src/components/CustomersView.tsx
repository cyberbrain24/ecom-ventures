import React, { useState } from 'react';
import {
  Users,
  Search,
  Phone,
  Mail,
  MapPin,
  ShoppingBag,
  Plus,
  Pencil,
  Trash2,
  Star,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Archive,
  Image as ImageIcon,
  ArrowUpDown,
  Filter,
  Eye,
  X,
  TrendingUp,
  Clock,
  Sparkles,
} from 'lucide-react';
import {
  StoreCustomer,
  StoreBrand,
  StoreProduct,
  StoreReview,
  ReviewStatus,
} from '../types/store';
import { AddCustomerModal } from './AddCustomerModal';
import { EditCustomerModal } from './EditCustomerModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { LogCustomerReviewModal } from './LogCustomerReviewModal';
import { EditReviewModal } from './EditReviewModal';

interface CustomersViewProps {
  currentStore: StoreBrand;
  customers: StoreCustomer[];
  products: StoreProduct[];
  reviews: StoreReview[];
  onAddCustomer?: (customer: StoreCustomer) => void;
  onUpdateCustomer?: (customer: StoreCustomer) => void;
  onDeleteCustomer?: (customerId: string) => void;
  onAddReview?: (review: StoreReview) => void;
  onUpdateReview?: (review: StoreReview) => void;
  onDeleteReview?: (reviewId: string) => void;
}

type CustomerSubTab = 'customers' | 'reviews';

export const CustomersView: React.FC<CustomersViewProps> = ({
  currentStore,
  customers,
  products,
  reviews,
  onAddCustomer,
  onUpdateCustomer,
  onDeleteCustomer,
  onAddReview,
  onUpdateReview,
  onDeleteReview,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<CustomerSubTab>('customers');

  // Customer Directory Filters & Modals
  const [searchCustomer, setSearchCustomer] = useState('');
  const [isAddCustomerModalOpen, setIsAddCustomerModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<StoreCustomer | null>(null);
  const [deletingCustomer, setDeletingCustomer] = useState<StoreCustomer | null>(null);

  // Reviews Engine Filters & Modals
  const [reviewSearch, setReviewSearch] = useState('');
  const [reviewStatusFilter, setReviewStatusFilter] = useState<'ALL' | ReviewStatus>('ALL');
  const [reviewRatingFilter, setReviewRatingFilter] = useState<number>(0);
  const [isLogReviewModalOpen, setIsLogReviewModalOpen] = useState(false);
  const [editingReview, setEditingReview] = useState<StoreReview | null>(null);
  const [deletingReview, setDeletingReview] = useState<StoreReview | null>(null);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Filtered Customers
  const filteredCustomers = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(searchCustomer.toLowerCase()) ||
      c.email.toLowerCase().includes(searchCustomer.toLowerCase()) ||
      c.phone.includes(searchCustomer)
  );

  // Filtered Reviews
  const filteredReviews = reviews.filter((r) => {
    if (reviewStatusFilter !== 'ALL' && r.status !== reviewStatusFilter) {
      return false;
    }
    if (reviewRatingFilter > 0 && r.rating !== reviewRatingFilter) {
      return false;
    }
    if (reviewSearch.trim()) {
      const q = reviewSearch.toLowerCase();
      const matchText =
        r.customerName.toLowerCase().includes(q) ||
        r.customerPhone.includes(q) ||
        r.productTitle.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.comment.toLowerCase().includes(q);
      if (!matchText) return false;
    }
    return true;
  });

  // Review Summary Metrics
  const pendingReviewsCount = reviews.filter((r) => r.status === 'PENDING').length;
  const approvedReviewsCount = reviews.filter((r) => r.status === 'APPROVED' || r.status === 'FEATURED').length;
  const photoReviewsCount = reviews.filter((r) => r.images && r.images.length > 0).length;

  const totalRatingSum = reviews
    .filter((r) => r.status === 'APPROVED' || r.status === 'FEATURED')
    .reduce((acc, curr) => acc + curr.rating, 0);

  const averageRating = approvedReviewsCount > 0 ? (totalRatingSum / approvedReviewsCount).toFixed(1) : '0.0';
  const fiveStarReviewsCount = reviews.filter((r) => r.rating === 5).length;
  const verifiedReviewsCount = reviews.filter((r) => r.isVerifiedPurchase).length;

  // Customer Summary Metrics
  const totalLtv = customers.reduce((sum, c) => sum + (c.lifetimeValue || 0), 0);
  const avgLtv = customers.length > 0 ? totalLtv / customers.length : 0;
  const totalCustomerOrders = customers.reduce((sum, c) => sum + (c.totalOrders || 0), 0);
  const repeatCustomerCount = customers.filter((c) => (c.totalOrders || 0) > 1).length;
  const avgOrdersPerCustomer = customers.length > 0 ? (totalCustomerOrders / customers.length).toFixed(1) : '0.0';

  // Quick Moderation Action Handlers
  const handleQuickStatusChange = (review: StoreReview, newStatus: ReviewStatus) => {
    if (!onUpdateReview) return;
    const isFeat = newStatus === 'FEATURED';
    onUpdateReview({
      ...review,
      status: newStatus,
      isFeatured: isFeat,
      updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    });
  };

  return (
    <div>
      {/* Top Level Sub-Tab Navigation Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid var(--border)',
          marginBottom: '18px',
          paddingBottom: '4px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setActiveSubTab('customers')}
            className="touch-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeSubTab === 'customers' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeSubTab === 'customers' ? 'var(--text-main)' : 'var(--text-muted)',
              fontWeight: activeSubTab === 'customers' ? 800 : 500,
              fontSize: '0.88rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Users size={16} style={{ color: activeSubTab === 'customers' ? 'var(--primary)' : 'inherit' }} />
            <span>Customer Profiles & LTV</span>
            <span
              style={{
                fontSize: '0.7rem',
                backgroundColor: 'rgba(255,255,255,0.08)',
                padding: '2px 6px',
                borderRadius: '10px',
                fontWeight: 700,
              }}
            >
              {customers.length}
            </span>
          </button>

          <button
            onClick={() => setActiveSubTab('reviews')}
            className="touch-btn"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              background: 'none',
              border: 'none',
              borderBottom: activeSubTab === 'reviews' ? '2px solid var(--primary)' : '2px solid transparent',
              color: activeSubTab === 'reviews' ? 'var(--text-main)' : 'var(--text-muted)',
              fontWeight: activeSubTab === 'reviews' ? 800 : 500,
              fontSize: '0.88rem',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Star size={16} style={{ color: activeSubTab === 'reviews' ? '#f59e0b' : 'inherit' }} />
            <span>Product Reviews & Reputation</span>
            {pendingReviewsCount > 0 ? (
              <span
                style={{
                  fontSize: '0.7rem',
                  backgroundColor: 'rgba(245, 158, 11, 0.2)',
                  color: '#f59e0b',
                  border: '1px solid rgba(245, 158, 11, 0.4)',
                  padding: '2px 7px',
                  borderRadius: '10px',
                  fontWeight: 800,
                }}
              >
                {pendingReviewsCount} PENDING
              </span>
            ) : (
              <span
                style={{
                  fontSize: '0.7rem',
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  fontWeight: 700,
                }}
              >
                {reviews.length}
              </span>
            )}
          </button>
        </div>

        {/* Primary Action Buttons */}
        <div>
          {activeSubTab === 'customers' && onAddCustomer && (
            <button onClick={() => setIsAddCustomerModalOpen(true)} className="btn btn-primary btn-sm">
              <Plus size={15} />
              <span>Register Customer</span>
            </button>
          )}

          {activeSubTab === 'reviews' && onAddReview && (
            <button
              onClick={() => setIsLogReviewModalOpen(true)}
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={15} />
              <span>Log Customer Review</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: CUSTOMER DIRECTORY & PROFILES                                      */}
      {/* ========================================================================= */}
      {activeSubTab === 'customers' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
                Customer Directory & Profiles
              </h1>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                Customer profiles, order histories, and Customer Lifetime Value (LTV) for <strong>{currentStore.name}</strong>
              </p>
            </div>
          </div>

          {/* Customer CRM Metrics - 7 Column Box Card Design */}
          <div className="stats-grid">
            <div className="stat-card">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="stat-label">Total Shoppers</div>
                <div className="stat-val">{customers.length}</div>
                <div className="stat-sub" style={{ color: '#059669', fontWeight: 600 }}>
                  <Users size={11} /> CRM profiles
                </div>
              </div>
              <div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                <Users size={16} />
              </div>
            </div>

            <div className="stat-card">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="stat-label">Portfolio LTV</div>
                <div className="stat-val">৳{Math.round(totalLtv).toLocaleString()}</div>
                <div className="stat-sub" style={{ color: '#0284c7' }}>
                  <TrendingUp size={11} /> Cumulative value
                </div>
              </div>
              <div className="stat-icon" style={{ background: '#f0f9ff', color: '#0284c7' }}>
                <TrendingUp size={16} />
              </div>
            </div>

            <div className="stat-card">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="stat-label">Avg Customer LTV</div>
                <div className="stat-val">৳{Math.round(avgLtv).toLocaleString()}</div>
                <div className="stat-sub" style={{ color: '#6366f1' }}>
                  <ShoppingBag size={11} /> Per account
                </div>
              </div>
              <div className="stat-icon" style={{ background: '#eef2ff', color: '#6366f1' }}>
                <ShoppingBag size={16} />
              </div>
            </div>

            <div className="stat-card">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="stat-label">Orders Placed</div>
                <div className="stat-val">{totalCustomerOrders}</div>
                <div className="stat-sub" style={{ color: '#059669' }}>
                  <CheckCircle2 size={11} /> Historical sales
                </div>
              </div>
              <div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                <CheckCircle2 size={16} />
              </div>
            </div>

            <div className="stat-card">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="stat-label">Repeat Buyers</div>
                <div className="stat-val">{repeatCustomerCount}</div>
                <div className="stat-sub" style={{ color: '#f59e0b', fontWeight: 600 }}>
                  <Sparkles size={11} /> Multi-order
                </div>
              </div>
              <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                <Sparkles size={16} />
              </div>
            </div>

            <div className="stat-card">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="stat-label">Top Location</div>
                <div className="stat-val" style={{ fontSize: '1rem' }}>Dhaka Hub</div>
                <div className="stat-sub" style={{ color: '#64748b' }}>
                  <MapPin size={11} /> Core market
                </div>
              </div>
              <div className="stat-icon" style={{ background: '#f1f5f9', color: '#64748b' }}>
                <MapPin size={16} />
              </div>
            </div>

            <div className="stat-card">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="stat-label">Frequency</div>
                <div className="stat-val">{avgOrdersPerCustomer}</div>
                <div className="stat-sub" style={{ color: '#64748b' }}>
                  <Clock size={11} /> Orders/shopper
                </div>
              </div>
              <div className="stat-icon" style={{ background: '#f8fafc', color: '#475569' }}>
                <Clock size={16} />
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: '10px 14px', marginBottom: '12px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={15} style={{ position: 'absolute', left: '10px', top: '9px', color: 'var(--text-subtle)' }} />
              <input
                type="text"
                placeholder="Search customer by name, email, or mobile..."
                value={searchCustomer}
                onChange={(e) => setSearchCustomer(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '32px', width: '100%', height: '32px', fontSize: '0.82rem' }}
              />
            </div>
          </div>

          <div className="card" style={{ padding: 0 }}>
            <div className="table-container" style={{ border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Contact Info</th>
                    <th>Location</th>
                    <th>Total Orders</th>
                    <th>Lifetime Spend (LTV)</th>
                    <th>Last Order Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomers.map((cust) => (
                    <tr key={cust.id}>
                      <td style={{ fontWeight: 700 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.84rem' }}>
                            {cust.name.substring(0, 2).toUpperCase()}
                          </div>
                          <span>{cust.name}</span>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <Mail size={13} style={{ color: 'var(--text-muted)' }} /> {cust.email}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                          <Phone size={13} /> {cust.phone}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-outline">
                          <MapPin size={11} /> {cust.city}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>{cust.totalOrders} order{cust.totalOrders > 1 ? 's' : ''}</td>
                      <td style={{ fontWeight: 800, color: 'var(--primary)', fontSize: '0.98rem' }}>
                        ৳ {cust.lifetimeValue.toLocaleString()}
                      </td>
                      <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{cust.lastOrderDate}</td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          {onUpdateCustomer && (
                            <button
                              onClick={() => setEditingCustomer(cust)}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '4px 7px' }}
                              title="Edit Customer"
                            >
                              <Pencil size={13} />
                            </button>
                          )}
                          {onDeleteCustomer && (
                            <button
                              onClick={() => setDeletingCustomer(cust)}
                              className="btn btn-danger btn-sm"
                              style={{ padding: '3px 6px' }}
                              title="Delete Customer"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: PRODUCT REVIEWS & REPUTATION ENGINE                                */}
      {/* ========================================================================= */}
      {activeSubTab === 'reviews' && (
        <div>
          {/* Header Description */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
                  Product Reviews & Moderation Engine
                </h1>
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    color: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    padding: '2px 8px',
                    borderRadius: '6px',
                    border: '1px solid rgba(16, 185, 129, 0.25)',
                  }}
                >
                  CUSTOMER REVIEWS · LIVE SYNC
                </span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
                Screen verified social proof, moderate online customer ratings, and log offline WhatsApp/DM buyer fit photos for <code>{currentStore.name}</code>.
              </p>
            </div>
          </div>

          {/* KPI Metrics Summary Strip - 7 Column Box Card Design */}
          <div className="stats-grid">
            {/* 1. Total Reviews */}
            <div className="stat-card">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="stat-label">Total Reviews</div>
                <div className="stat-val">{reviews.length}</div>
                <div className="stat-sub" style={{ color: '#059669', fontWeight: 600 }}>
                  <Star size={11} fill="#059669" /> All feedback
                </div>
              </div>
              <div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                <Star size={16} />
              </div>
            </div>

            {/* 2. Rating Average */}
            <div className="stat-card">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="stat-label">Avg Rating</div>
                <div className="stat-val">{averageRating}</div>
                <div className="stat-sub" style={{ color: '#f59e0b', fontWeight: 700 }}>
                  <Star size={11} fill="#f59e0b" color="#f59e0b" /> Out of 5.0
                </div>
              </div>
              <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                <Star size={16} />
              </div>
            </div>

            {/* 3. Approved Reviews */}
            <div className="stat-card">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="stat-label">Approved Live</div>
                <div className="stat-val" style={{ color: '#059669' }}>{approvedReviewsCount}</div>
                <div className="stat-sub" style={{ color: '#10b981' }}>
                  <CheckCircle2 size={11} /> Published
                </div>
              </div>
              <div className="stat-icon" style={{ background: '#dcfce7', color: '#15803d' }}>
                <CheckCircle2 size={16} />
              </div>
            </div>

            {/* 4. Pending Queue */}
            <div className="stat-card" style={{ borderLeft: pendingReviewsCount > 0 ? '3px solid #f59e0b' : undefined }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="stat-label">Pending Queue</div>
                <div className="stat-val" style={{ color: pendingReviewsCount > 0 ? '#f59e0b' : 'var(--text-main)' }}>
                  {pendingReviewsCount}
                </div>
                <div className="stat-sub" style={{ color: pendingReviewsCount > 0 ? '#d97706' : 'var(--text-subtle)' }}>
                  <Clock size={11} /> Needs review
                </div>
              </div>
              <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
                <Clock size={16} />
              </div>
            </div>

            {/* 5. Fit Photo Proofs */}
            <div className="stat-card">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="stat-label">Photo Proofs</div>
                <div className="stat-val" style={{ color: '#0284c7' }}>{photoReviewsCount}</div>
                <div className="stat-sub" style={{ color: '#0284c7' }}>
                  <ImageIcon size={11} /> Visual proof
                </div>
              </div>
              <div className="stat-icon" style={{ background: '#f0f9ff', color: '#0284c7' }}>
                <ImageIcon size={16} />
              </div>
            </div>

            {/* 6. 5-Star Praise */}
            <div className="stat-card">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="stat-label">5-Star Reviews</div>
                <div className="stat-val">{fiveStarReviewsCount}</div>
                <div className="stat-sub" style={{ color: '#10b981', fontWeight: 600 }}>
                  <Sparkles size={11} /> Top ratings
                </div>
              </div>
              <div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
                <Sparkles size={16} />
              </div>
            </div>

            {/* 7. Verified Buyers */}
            <div className="stat-card">
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="stat-label">Verified Buyers</div>
                <div className="stat-val">{verifiedReviewsCount}</div>
                <div className="stat-sub" style={{ color: '#6366f1' }}>
                  <ShieldCheck size={11} /> Verified orders
                </div>
              </div>
              <div className="stat-icon" style={{ background: '#eef2ff', color: '#6366f1' }}>
                <ShieldCheck size={16} />
              </div>
            </div>
          </div>

          {/* Filter Bar: Status & Star Ratings */}
          <div className="card" style={{ padding: '12px 16px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
              {/* Status Chips */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {(['ALL', 'PENDING', 'APPROVED', 'FEATURED', 'ARCHIVED'] as const).map((st) => {
                  const isActive = reviewStatusFilter === st;
                  const count =
                    st === 'ALL'
                      ? reviews.length
                      : reviews.filter((r) => r.status === st).length;

                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setReviewStatusFilter(st)}
                      className="touch-btn"
                      style={{
                        padding: '5px 12px',
                        borderRadius: '20px',
                        border: isActive ? '1px solid var(--primary)' : '1px solid var(--border)',
                        backgroundColor: isActive ? 'rgba(20, 184, 166, 0.15)' : 'transparent',
                        color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                        fontSize: '0.75rem',
                        fontWeight: isActive ? 700 : 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <span>{st}</span>
                      <span style={{ fontSize: '0.68rem', opacity: 0.8 }}>({count})</span>
                    </button>
                  );
                })}
              </div>

              {/* Star Rating Dropdown & Search */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                <select
                  value={reviewRatingFilter}
                  onChange={(e) => setReviewRatingFilter(parseInt(e.target.value) || 0)}
                  className="form-input"
                  style={{ height: '32px', fontSize: '0.78rem', paddingRight: '24px' }}
                >
                  <option value={0}>All Star Ratings</option>
                  <option value={5}>5 Stars ★★★★★</option>
                  <option value={4}>4 Stars ★★★★☆</option>
                  <option value={3}>3 Stars ★★★☆☆</option>
                  <option value={2}>2 Stars ★★☆☆☆</option>
                  <option value={1}>1 Star ★☆☆☆☆</option>
                </select>

                <div style={{ position: 'relative', width: '220px' }}>
                  <Search size={14} style={{ position: 'absolute', left: '9px', top: '9px', color: 'var(--text-subtle)' }} />
                  <input
                    type="text"
                    placeholder="Search review, customer, phone..."
                    value={reviewSearch}
                    onChange={(e) => setReviewSearch(e.target.value)}
                    className="form-input"
                    style={{ paddingLeft: '28px', width: '100%', height: '32px', fontSize: '0.78rem' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Moderation Reviews Table */}
          <div className="card" style={{ padding: 0 }}>
            <div className="table-container" style={{ border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Customer (Verified CRM)</th>
                    <th>Target Product</th>
                    <th>Rating & Feedback</th>
                    <th>Photo Proof</th>
                    <th>Rank</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReviews.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        No product reviews found matching the current filter.
                      </td>
                    </tr>
                  ) : (
                    filteredReviews.map((rev) => (
                      <tr key={rev.id}>
                        {/* Customer Column */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                            <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: '0.75rem', flexShrink: 0 }}>
                              {rev.customerName.substring(0, 2).toUpperCase()}
                            </div>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.84rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span>{rev.customerName}</span>
                                {rev.isVerifiedPurchase && (
                                  <span title="Verified Buyer (Confirmed Order)">
                                    <ShieldCheck size={13} style={{ color: '#10b981' }} />
                                  </span>
                                )}
                              </div>
                              <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px' }}>
                                <Phone size={11} />
                                <span>{rev.customerPhone}</span>
                              </div>
                              <div style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
                                {rev.createdAt}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Product Column */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '180px' }}>
                            {rev.productImage && (
                              <img
                                src={rev.productImage}
                                alt=""
                                style={{ width: '32px', height: '32px', borderRadius: '4px', objectFit: 'cover' }}
                              />
                            )}
                            <div style={{ overflow: 'hidden' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                                {rev.productTitle}
                              </span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                {rev.productSlug}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Rating & Feedback */}
                        <td>
                          <div style={{ maxWidth: '280px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', marginBottom: '2px' }}>
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star
                                  key={s}
                                  size={13}
                                  fill={rev.rating >= s ? '#f59e0b' : 'none'}
                                  color={rev.rating >= s ? '#f59e0b' : '#64748b'}
                                />
                              ))}
                              <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f59e0b', marginLeft: '4px' }}>
                                {rev.rating}.0
                              </span>
                            </div>
                            <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '2px' }}>
                              {rev.title}
                            </div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', lineHeight: '1.3', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                              {rev.comment}
                            </div>
                            {rev.staffNotes && (
                              <div style={{ fontSize: '0.7rem', color: '#38bdf8', marginTop: '3px', fontStyle: 'italic' }}>
                                Staff: {rev.staffNotes}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Photo Proof Gallery */}
                        <td>
                          {rev.images && rev.images.length > 0 ? (
                            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                              {rev.images.slice(0, 2).map((img, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => setPreviewImageUrl(img)}
                                  style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer' }}
                                  title="Click to inspect photo proof"
                                >
                                  <img
                                    src={img}
                                    alt=""
                                    style={{ width: '36px', height: '36px', borderRadius: '4px', objectFit: 'cover', border: '1px solid var(--border)' }}
                                  />
                                </button>
                              ))}
                              {rev.images.length > 2 && (
                                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 700 }}>
                                  +{rev.images.length - 2}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: '0.74rem', color: 'var(--text-subtle)' }}>No Photos</span>
                          )}
                        </td>

                        {/* Storefront Display Rank */}
                        <td>
                          <span className="badge badge-outline" style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                            #{rev.displayOrder}
                          </span>
                        </td>

                        {/* Status Badge */}
                        <td>
                          {rev.status === 'FEATURED' && (
                            <span className="badge" style={{ backgroundColor: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', border: '1px solid rgba(168, 85, 247, 0.3)', fontSize: '0.72rem', fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Star size={11} fill="#c084fc" /> FEATURED
                            </span>
                          )}
                          {rev.status === 'APPROVED' && (
                            <span className="badge badge-success" style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                              APPROVED
                            </span>
                          )}
                          {rev.status === 'PENDING' && (
                            <span className="badge badge-warning" style={{ fontSize: '0.72rem', fontWeight: 700 }}>
                              PENDING
                            </span>
                          )}
                          {rev.status === 'ARCHIVED' && (
                            <span className="badge" style={{ backgroundColor: 'rgba(100, 116, 139, 0.15)', color: '#94a3b8', border: '1px solid rgba(100, 116, 139, 0.3)', fontSize: '0.72rem' }}>
                              ARCHIVED
                            </span>
                          )}
                        </td>

                        {/* Moderation Actions */}
                        <td>
                          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                            {/* One-click Approve */}
                            {rev.status !== 'APPROVED' && (
                              <button
                                type="button"
                                onClick={() => handleQuickStatusChange(rev, 'APPROVED')}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '3px 6px', color: '#10b981' }}
                                title="Approve Review (Publish to Storefront)"
                              >
                                <CheckCircle2 size={13} />
                              </button>
                            )}

                            {/* One-click Feature / Pin */}
                            {rev.status !== 'FEATURED' && (
                              <button
                                type="button"
                                onClick={() => handleQuickStatusChange(rev, 'FEATURED')}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '3px 6px', color: '#c084fc' }}
                                title="Pin as Featured Testimonial at Top of PDP"
                              >
                                <Star size={13} />
                              </button>
                            )}

                            {/* Edit Modal Button */}
                            {onUpdateReview && (
                              <button
                                type="button"
                                onClick={() => setEditingReview(rev)}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '4px 7px' }}
                                title="Edit Review Content & Priority"
                              >
                                <Pencil size={13} />
                              </button>
                            )}

                            {/* One-click Archive */}
                            {rev.status !== 'ARCHIVED' && (
                              <button
                                type="button"
                                onClick={() => handleQuickStatusChange(rev, 'ARCHIVED')}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '3px 6px', color: '#94a3b8' }}
                                title="Archive from Public Storefront"
                              >
                                <Archive size={13} />
                              </button>
                            )}

                            {/* Delete Approval Confirmation Modal */}
                            {onDeleteReview && (
                              <button
                                type="button"
                                onClick={() => setDeletingReview(rev)}
                                className="btn btn-danger btn-sm"
                                style={{ padding: '3px 6px' }}
                                title="Delete Review"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
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

      {/* ========================================================================= */}
      {/* MODALS & CONFIRMATIONS                                                    */}
      {/* ========================================================================= */}

      {/* Add Customer Modal */}
      {isAddCustomerModalOpen && onAddCustomer && (
        <AddCustomerModal
          onClose={() => setIsAddCustomerModalOpen(false)}
          onAdd={(newCust) => {
            onAddCustomer(newCust);
            setIsAddCustomerModalOpen(false);
          }}
        />
      )}

      {/* Edit Customer Modal */}
      {editingCustomer && onUpdateCustomer && (
        <EditCustomerModal
          customer={editingCustomer}
          onClose={() => setEditingCustomer(null)}
          onSave={(updated) => {
            onUpdateCustomer(updated);
            setEditingCustomer(null);
          }}
        />
      )}

      {/* Delete Customer Confirmation Modal */}
      {deletingCustomer && onDeleteCustomer && (
        <ConfirmDeleteModal
          isOpen={!!deletingCustomer}
          title="Delete Customer Account"
          itemName={`${deletingCustomer.name} (${deletingCustomer.email})`}
          itemType="Customer Profile"
          warningMessage={`Are you sure you want to permanently delete customer profile for "${deletingCustomer.name}"? Historical CRM spend data will be detached.`}
          onConfirm={() => {
            onDeleteCustomer(deletingCustomer.id);
            setDeletingCustomer(null);
          }}
          onClose={() => setDeletingCustomer(null)}
        />
      )}

      {/* Log Customer Review Modal (Channel B) */}
      {isLogReviewModalOpen && onAddReview && (
        <LogCustomerReviewModal
          currentStore={currentStore}
          customers={customers}
          products={products}
          onClose={() => setIsLogReviewModalOpen(false)}
          onAdd={(newRev) => {
            onAddReview(newRev);
            setIsLogReviewModalOpen(false);
          }}
        />
      )}

      {/* Edit Review Modal */}
      {editingReview && onUpdateReview && (
        <EditReviewModal
          review={editingReview}
          onClose={() => setEditingReview(null)}
          onSave={(updated) => {
            onUpdateReview(updated);
            setEditingReview(null);
          }}
        />
      )}

      {/* Delete Review Approval Modal (AGENT.md Universal CRUD Requirement) */}
      {deletingReview && onDeleteReview && (
        <ConfirmDeleteModal
          isOpen={!!deletingReview}
          title="Delete Customer Review"
          itemName={`${deletingReview.rating}★ Review by ${deletingReview.customerName}`}
          itemType="Product Review & Social Proof"
          warningMessage={`Are you sure you want to permanently delete review "${deletingReview.title}" for product "${deletingReview.productTitle}"? This will permanently remove its rating from the storefront math and purge all ${deletingReview.images?.length || 0} attached fit photos from storage.`}
          onConfirm={() => {
            onDeleteReview(deletingReview.id);
            setDeletingReview(null);
          }}
          onClose={() => setDeletingReview(null)}
        />
      )}

      {/* Photo Proof Lightbox Modal */}
      {previewImageUrl && (
        <div
          className="modal-backdrop"
          style={{ zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setPreviewImageUrl(null)}
        >
          <div
            style={{ position: 'relative', maxWidth: '85vw', maxHeight: '85vh', borderRadius: '10px', overflow: 'hidden', backgroundColor: '#000' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPreviewImageUrl(null)}
              style={{
                position: 'absolute',
                top: '10px',
                right: '10px',
                background: 'rgba(0,0,0,0.6)',
                border: 'none',
                color: '#fff',
                borderRadius: '50%',
                padding: '6px',
                cursor: 'pointer',
              }}
            >
              <X size={20} />
            </button>
            <img
              src={previewImageUrl}
              alt="Customer Fit Photo Proof"
              style={{ maxWidth: '100%', maxHeight: '85vh', objectFit: 'contain', display: 'block' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
