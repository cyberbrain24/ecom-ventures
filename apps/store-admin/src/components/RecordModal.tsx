import React, { useState } from 'react';
import { X } from 'lucide-react';
import { describeError } from '../lib/format';

/** Props for {@link RecordModal}. */
interface RecordModalProps {
  title: string;
  /** Label of the submit button, for example "Save brand". */
  submitLabel: string;
  /**
   * Called when the form is submitted. Throw to keep the modal open: the message is shown inside the modal.
   * Return normally once the change is saved; the modal then closes itself.
   */
  onSubmit: () => Promise<void>;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}

/** Shared frame for create and edit forms: title bar, form body, error message and Save/Cancel buttons. */
export const RecordModal: React.FC<RecordModalProps> = ({ title, submitLabel, onSubmit, onClose, children, maxWidth }) => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit();
      onClose();
    } catch (err) {
      setError(describeError(err));
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label={title} style={{ zIndex: 900 }}>
      <form className="modal-content" onSubmit={(e) => void submit(e)} noValidate style={maxWidth ? { maxWidth } : undefined}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)', display: 'flex' }}>
            <X size={16} />
          </button>
        </div>

        {children}

        {error !== null && (
          <div className="notice notice-error" role="alert" style={{ marginBottom: '12px' }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <button type="button" className="btn btn-secondary btn-sm" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
            {submitting ? 'Saving...' : submitLabel}
          </button>
        </div>
      </form>
    </div>
  );
};
