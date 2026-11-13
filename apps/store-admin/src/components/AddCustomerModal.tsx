import React, { useState } from 'react';
import { X, UserPlus, Save } from 'lucide-react';
import { StoreCustomer } from '../types/store';

interface AddCustomerModalProps {
  onClose: () => void;
  onAdd: (newCustomer: StoreCustomer) => void;
}

export const AddCustomerModal: React.FC<AddCustomerModalProps> = ({ onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Dhaka');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !phone.trim()) return;

    const newCustomer: StoreCustomer = {
      id: `cust-${Date.now()}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      phone: phone.trim(),
      city: city.trim() || 'Dhaka',
      totalOrders: 0,
      lifetimeValue: 0,
      lastOrderDate: new Date().toISOString().split('T')[0],
    };
    onAdd(newCustomer);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal-content" style={{ maxWidth: '440px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <UserPlus size={15} />
            </div>
            <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>Register New Customer</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group" style={{ marginBottom: '10px' }}>
            <label className="form-label">Customer Full Name *</label>
            <input
              type="text"
              required
              placeholder="e.g. Asif Rahman"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-group" style={{ marginBottom: '10px' }}>
            <label className="form-label">Email Address *</label>
            <input
              type="email"
              required
              placeholder="asif@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="form-input"
            />
          </div>

          <div className="form-grid" style={{ marginBottom: '14px' }}>
            <div className="form-group">
              <label className="form-label">Mobile Phone Number *</label>
              <input
                type="tel"
                required
                placeholder="+8801700000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">City / Region</label>
              <input
                type="text"
                placeholder="Dhaka, Chittagong..."
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm">
              <Save size={13} />
              <span>Create Customer</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
