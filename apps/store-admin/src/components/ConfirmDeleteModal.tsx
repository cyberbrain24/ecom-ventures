import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title?: string;
  itemName: string;
  itemType?: string;
  warningMessage?: string;
  confirmButtonText?: string;
  onConfirm: () => void;
  onClose: () => void;
}

export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  isOpen,
  title = 'Approval Required: Confirm Deletion',
  itemName,
  itemType = 'Record',
  warningMessage = 'Are you sure you want to permanently delete this item? This action is irreversible and will remove all corresponding store data.',
  confirmButtonText = 'Confirm & Delete',
  onConfirm,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal-content" style={{ maxWidth: '440px', padding: 0, overflow: 'hidden', background: '#ffffff', border: '1px solid var(--border)' }}>
        {/* Header Bar */}
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: '#fef2f2',
            borderBottom: '1px solid #fee2e2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#991b1b' }}>
            <div
              style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: '#fee2e2',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#dc2626',
              }}
            >
              <AlertTriangle size={15} />
            </div>
            <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {title}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-subtle)',
              cursor: 'pointer',
              padding: '2px',
              display: 'flex',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '16px', background: '#ffffff' }}>
          <p style={{ fontSize: '0.78rem', color: '#475569', lineHeight: 1.45, marginBottom: '12px' }}>
            {warningMessage}
          </p>

          <div
            style={{
              padding: '8px 12px',
              backgroundColor: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
              fontSize: '0.76rem',
            }}
          >
            <span style={{ color: 'var(--text-subtle)', fontWeight: 600, textTransform: 'uppercase', fontSize: '0.68rem' }}>
              Target {itemType}:
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontWeight: 700,
                color: 'var(--text-main)',
                backgroundColor: '#fff',
                padding: '2px 8px',
                borderRadius: '4px',
                border: '1px solid var(--border)',
                maxWidth: '220px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {itemName}
            </span>
          </div>

          <div
            style={{
              padding: '6px 10px',
              backgroundColor: '#fff1f2',
              border: '1px solid #ffe4e6',
              borderRadius: 'var(--radius-sm)',
              fontSize: '0.7rem',
              color: '#e11d48',
              fontWeight: 500,
            }}
          >
            ⚠️ High-impact action requires manual confirmation.
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '10px 16px',
            backgroundColor: 'var(--surface)',
            borderTop: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '8px',
          }}
        >
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} className="btn btn-danger btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Trash2 size={13} />
            <span>{confirmButtonText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
