import React, { useState } from 'react';
import { X, UserPlus, Save } from 'lucide-react';

export interface StoreStaffMember {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
}

interface AddStaffModalProps {
  onClose: () => void;
  onAdd: (newStaff: StoreStaffMember) => void;
}

export const AddStaffModal: React.FC<AddStaffModalProps> = ({ onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('STORE_ADMIN');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    const newStaff: StoreStaffMember = {
      id: `st-${Date.now()}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      role,
      status: 'ACTIVE',
    };
    onAdd(newStaff);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal-content" style={{ maxWidth: '440px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserPlus size={15} />
            </div>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>Add Store Staff Operator</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '10px' }}>
            <label className="form-label">Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Tanvir Hassan"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group" style={{ marginBottom: '10px' }}>
            <label className="form-label">Official Email Address *</label>
            <input
              type="email"
              required
              placeholder="tanvir@brand.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label">Assigned Store Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="form-select"
            >
              <option value="STORE_ADMIN">STORE_ADMIN (Catalog, orders, inventory)</option>
              <option value="STORE_STAFF">STORE_STAFF (Order fulfillment only)</option>
              <option value="STORE_OWNER">STORE_OWNER (Full store authority)</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm">
              <Save size={13} />
              <span>Provision Staff</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
