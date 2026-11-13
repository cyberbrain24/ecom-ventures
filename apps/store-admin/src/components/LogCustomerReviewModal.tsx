import React, { useState } from 'react';
import { X, Star, Upload, Plus, Trash2, ShieldCheck, Phone, ShoppingBag, User } from 'lucide-react';
import { StoreReview, StoreCustomer, StoreProduct, StoreBrand } from '../types/store';

interface LogCustomerReviewModalProps {
  onClose: () => void;
  onAdd: (review: StoreReview) => void;
  customers: StoreCustomer[];
  products: StoreProduct[];
  currentStore: StoreBrand;
}

export const LogCustomerReviewModal: React.FC<LogCustomerReviewModalProps> = ({
  onClose,
  onAdd,
  customers,
  products,
  currentStore,
}) => {
  // Mode: select existing CRM customer or manual phone entry
  const [customerSelectionMode, setCustomerSelectionMode] = useState<'existing' | 'manual'>('existing');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>(customers[0]?.id || '');
  const [manualPhone, setManualPhone] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');

  // Product selection
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');

  // Review details
  const [rating, setRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [title, setTitle] = useState('');
  const [comment, setComment] = useState('');
  const [isFeatured, setIsFeatured] = useState(false);
  const [isVerifiedPurchase, setIsVerifiedPurchase] = useState(true);
  const [displayOrder, setDisplayOrder] = useState(1);
  const [staffNotes, setStaffNotes] = useState('');
  const [imageUrls, setImageUrls] = useState<string[]>(['']);

  const handleAddImageUrl = () => {
    setImageUrls([...imageUrls, '']);
  };

  const handleImageUrlChange = (index: number, val: string) => {
    const updated = [...imageUrls];
    updated[index] = val;
    setImageUrls(updated);
  };

  const handleRemoveImageUrl = (index: number) => {
    setImageUrls(imageUrls.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!comment.trim()) {
      alert('Please enter review comment text.');
      return;
    }

    // Resolve Customer
    let customerId = '';
    let customerName = '';
    let customerEmail = '';
    let customerPhone = '';

    if (customerSelectionMode === 'existing') {
      const cust = customers.find((c) => c.id === selectedCustomerId);
      if (cust) {
        customerId = cust.id;
        customerName = cust.name;
        customerEmail = cust.email;
        customerPhone = cust.phone;
      }
    } else {
      if (!manualPhone.trim()) {
        alert('Please enter customer phone number.');
        return;
      }
      customerId = `cust-${Date.now()}`;
      customerName = manualName.trim() || 'Verified Customer';
      customerPhone = manualPhone.trim();
      customerEmail = manualEmail.trim() || `cust_${manualPhone.replace(/\D/g, '')}@store.dropiobd.localhost`;
    }

    // Resolve Product
    const prod = products.find((p) => p.id === selectedProductId);
    const productTitle = prod ? prod.title : 'Selected Product';
    const productSlug = prod ? prod.slug : 'selected-product';
    const productImage = prod ? (prod.imageUrl || (prod.images && prod.images[0])) : undefined;

    const filteredImages = imageUrls.map((u) => u.trim()).filter((u) => u.length > 0);

    const newReview: StoreReview = {
      id: `rev-${Date.now()}`,
      productId: selectedProductId,
      productTitle,
      productSlug,
      productImage,
      customerId,
      customerName,
      customerEmail,
      customerPhone,
      isVerifiedPurchase,
      rating,
      title: title.trim() || 'Customer Review',
      comment: comment.trim(),
      status: isFeatured ? 'FEATURED' : 'APPROVED', // Channel B: Staff-assisted publishing
      isFeatured,
      displayOrder,
      staffNotes: staffNotes.trim() ? staffNotes.trim() : `Logged by store staff for ${currentStore.name}`,
      images: filteredImages,
      createdAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };

    onAdd(newReview);
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 1050 }}>
      <div className="modal-card" style={{ maxWidth: '640px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Log Customer Review
              </h2>
              <span className="badge badge-primary" style={{ fontSize: '0.68rem' }}>
                CHANNEL B · STAFF ASSISTED
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
              Record verified buyer feedback from WhatsApp, Instagram DMs, or courier callbacks.
            </p>
          </div>
          <button onClick={onClose} className="btn-icon" aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Customer Selection Section */}
          <div style={{ padding: '12px', backgroundColor: 'var(--bg-subtle, rgba(255,255,255,0.03))', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <User size={14} style={{ color: 'var(--primary)' }} />
                <span>Customer Association</span>
              </label>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  type="button"
                  onClick={() => setCustomerSelectionMode('existing')}
                  className={`btn btn-sm ${customerSelectionMode === 'existing' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                >
                  Select from CRM
                </button>
                <button
                  type="button"
                  onClick={() => setCustomerSelectionMode('manual')}
                  className={`btn btn-sm ${customerSelectionMode === 'manual' ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: '0.72rem', padding: '2px 8px' }}
                >
                  Phone Lookup
                </button>
              </div>
            </div>

            {customerSelectionMode === 'existing' ? (
              <div>
                <select
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="form-input"
                  style={{ width: '100%', fontSize: '0.82rem' }}
                >
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.phone} ({c.totalOrders} orders · LTV: ৳{c.lifetimeValue.toLocaleString()})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <input
                    type="tel"
                    placeholder="Mobile (+88017...)"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    className="form-input"
                    style={{ width: '100%', fontSize: '0.82rem' }}
                    required
                  />
                </div>
                <div>
                  <input
                    type="text"
                    placeholder="Customer Name"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    className="form-input"
                    style={{ width: '100%', fontSize: '0.82rem' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Product Selection */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <ShoppingBag size={14} style={{ color: 'var(--primary)' }} />
              <span>Target Product</span>
            </label>
            <select
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
              className="form-input"
              style={{ width: '100%', fontSize: '0.82rem' }}
              required
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title} · (৳{p.price.toLocaleString()})
                </option>
              ))}
            </select>
          </div>

          {/* Star Rating Picker */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
              Star Rating Score
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoverRating(star)}
                  onMouseLeave={() => setHoverRating(0)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '2px',
                    transition: 'transform 0.1s',
                  }}
                >
                  <Star
                    size={24}
                    fill={(hoverRating || rating) >= star ? '#f59e0b' : 'none'}
                    color={(hoverRating || rating) >= star ? '#f59e0b' : '#64748b'}
                  />
                </button>
              ))}
              <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f59e0b', marginLeft: '6px' }}>
                {rating} of 5 Stars
              </span>
            </div>
          </div>

          {/* Review Headline & Comment */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
              Review Headline / Title
            </label>
            <input
              type="text"
              placeholder="e.g. Unbelievable fit and luxurious silk drape!"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input"
              style={{ width: '100%', fontSize: '0.82rem' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
              Customer Testimonial Feedback *
            </label>
            <textarea
              rows={3}
              placeholder="Write customer feedback, fit remarks, or unboxing comments..."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="form-input"
              style={{ width: '100%', fontSize: '0.82rem', resize: 'vertical' }}
              required
            />
          </div>

          {/* Photo Gallery Attachments */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Upload size={14} style={{ color: 'var(--primary)' }} />
                <span>Fit & Unboxing Photo URLs</span>
              </label>
              <button
                type="button"
                onClick={handleAddImageUrl}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.72rem', padding: '2px 8px' }}
              >
                <Plus size={12} /> Add Photo URL
              </button>
            </div>
            {imageUrls.map((url, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={url}
                  onChange={(e) => handleImageUrlChange(idx, e.target.value)}
                  className="form-input"
                  style={{ flex: 1, fontSize: '0.8rem' }}
                />
                {imageUrls.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveImageUrl(idx)}
                    className="btn btn-danger btn-sm"
                    style={{ padding: '4px 8px' }}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>

          {/* Toggles & Priority Rank */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', padding: '10px', backgroundColor: 'var(--bg-subtle, rgba(255,255,255,0.03))', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                Storefront Ranking
              </label>
              <input
                type="number"
                min={0}
                max={999}
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
                className="form-input"
                style={{ width: '100%', fontSize: '0.8rem' }}
                title="Lower values appear first on the storefront product page"
              />
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Lower = Top priority</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                />
                <span>Pin as Featured</span>
              </label>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>Highlight on PDP</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600 }}>
                <input
                  type="checkbox"
                  checked={isVerifiedPurchase}
                  onChange={(e) => setIsVerifiedPurchase(e.target.checked)}
                />
                <span>Verified Buyer</span>
              </label>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>Trust badge</span>
            </div>
          </div>

          {/* Internal Staff Notes */}
          <div>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '3px' }}>
              Internal Staff Note (CRM audit trail, not shown to public)
            </label>
            <input
              type="text"
              placeholder="e.g. Sourced from WhatsApp chat with customer on 28 Oct."
              value={staffNotes}
              onChange={(e) => setStaffNotes(e.target.value)}
              className="form-input"
              style={{ width: '100%', fontSize: '0.8rem' }}
            />
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <ShieldCheck size={16} />
              <span>Publish Verified Review</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
