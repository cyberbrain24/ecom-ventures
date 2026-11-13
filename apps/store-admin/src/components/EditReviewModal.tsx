import React, { useState } from 'react';
import { X, Star, Upload, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { StoreReview, ReviewStatus } from '../types/store';

interface EditReviewModalProps {
  review: StoreReview;
  onClose: () => void;
  onSave: (updated: StoreReview) => void;
}

export const EditReviewModal: React.FC<EditReviewModalProps> = ({
  review,
  onClose,
  onSave,
}) => {
  const [rating, setRating] = useState<number>(review.rating);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [title, setTitle] = useState(review.title);
  const [comment, setComment] = useState(review.comment);
  const [status, setStatus] = useState<ReviewStatus>(review.status);
  const [isFeatured, setIsFeatured] = useState(review.isFeatured);
  const [displayOrder, setDisplayOrder] = useState(review.displayOrder);
  const [staffNotes, setStaffNotes] = useState(review.staffNotes || '');
  const [imageUrls, setImageUrls] = useState<string[]>(
    review.images.length > 0 ? [...review.images] : ['']
  );

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

  const handleStatusChange = (newStatus: ReviewStatus) => {
    setStatus(newStatus);
    if (newStatus === 'FEATURED') {
      setIsFeatured(true);
    } else if (newStatus === 'PENDING' || newStatus === 'ARCHIVED') {
      setIsFeatured(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!comment.trim()) {
      alert('Review comment cannot be empty.');
      return;
    }

    const filteredImages = imageUrls.map((u) => u.trim()).filter((u) => u.length > 0);

    const updatedReview: StoreReview = {
      ...review,
      rating,
      title: title.trim(),
      comment: comment.trim(),
      status,
      isFeatured: status === 'FEATURED' || isFeatured,
      displayOrder,
      staffNotes: staffNotes.trim() || undefined,
      images: filteredImages,
      updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
    };

    onSave(updatedReview);
  };

  return (
    <div className="modal-backdrop" style={{ zIndex: 1050 }}>
      <div className="modal-card" style={{ maxWidth: '620px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
              Edit Customer Review
            </h2>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
              Modify review content, moderation status, and storefront display priority.
            </p>
          </div>
          <button onClick={onClose} className="btn-icon" aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Customer & Product Metadata Pill */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', backgroundColor: 'var(--bg-subtle, rgba(255,255,255,0.03))', borderRadius: '8px', border: '1px solid var(--border)', marginBottom: '14px', fontSize: '0.8rem' }}>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Customer: </span>
            <strong style={{ color: 'var(--text-main)' }}>{review.customerName}</strong>{' '}
            <span style={{ color: 'var(--text-subtle)' }}>({review.customerPhone})</span>
          </div>
          <div>
            <span style={{ color: 'var(--text-muted)' }}>Product: </span>
            <strong style={{ color: 'var(--primary)' }}>{review.productTitle}</strong>
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {/* Rating & Status Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '6px' }}>
                Star Rating
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
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
                    }}
                  >
                    <Star
                      size={22}
                      fill={(hoverRating || rating) >= star ? '#f59e0b' : 'none'}
                      color={(hoverRating || rating) >= star ? '#f59e0b' : '#64748b'}
                    />
                  </button>
                ))}
                <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f59e0b', marginLeft: '6px' }}>
                  {rating} ★
                </span>
              </div>
            </div>

            <div>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                Moderation Status *
              </label>
              <select
                value={status}
                onChange={(e) => handleStatusChange(e.target.value as ReviewStatus)}
                className="form-input"
                style={{ width: '100%', fontSize: '0.82rem' }}
              >
                <option value="APPROVED">APPROVED (Active in Math & Storefront)</option>
                <option value="FEATURED">FEATURED (Pinned at Top of PDP)</option>
                <option value="PENDING">PENDING (Hidden awaiting screening)</option>
                <option value="ARCHIVED">ARCHIVED (Excluded from math & hidden)</option>
              </select>
            </div>
          </div>

          {/* Headline & Testimonial */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
              Review Headline
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="form-input"
              style={{ width: '100%', fontSize: '0.82rem' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
              Customer Feedback Comment *
            </label>
            <textarea
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="form-input"
              style={{ width: '100%', fontSize: '0.82rem', resize: 'vertical' }}
              required
            />
          </div>

          {/* Photo URLs */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Upload size={14} style={{ color: 'var(--primary)' }} />
                <span>Fit Photos Gallery URLs</span>
              </label>
              <button
                type="button"
                onClick={handleAddImageUrl}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.72rem', padding: '2px 8px' }}
              >
                <Plus size={12} /> Add Photo
              </button>
            </div>
            {imageUrls.map((url, idx) => (
              <div key={idx} style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                <input
                  type="url"
                  placeholder="https://..."
                  value={url}
                  onChange={(e) => handleImageUrlChange(idx, e.target.value)}
                  className="form-input"
                  style={{ flex: 1, fontSize: '0.8rem' }}
                />
                <button
                  type="button"
                  onClick={() => handleRemoveImageUrl(idx)}
                  className="btn btn-danger btn-sm"
                  style={{ padding: '4px 8px' }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          {/* Display Order & Staff Notes */}
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                Storefront Rank
              </label>
              <input
                type="number"
                min={0}
                max={999}
                value={displayOrder}
                onChange={(e) => setDisplayOrder(parseInt(e.target.value) || 0)}
                className="form-input"
                style={{ width: '100%', fontSize: '0.8rem' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>
                Staff Note (Internal CRM)
              </label>
              <input
                type="text"
                value={staffNotes}
                onChange={(e) => setStaffNotes(e.target.value)}
                className="form-input"
                style={{ width: '100%', fontSize: '0.8rem' }}
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '8px', borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={16} />
              <span>Save Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

