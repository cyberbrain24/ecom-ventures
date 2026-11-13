import React, { useState, useEffect } from 'react';
import { X, Pencil, CheckCircle2, ShieldAlert } from 'lucide-react';
import { StoreOrder, StoreBrand, OrderStatus } from '../types/store';

interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: StoreOrder | null;
  currentStore: StoreBrand;
  onSaveOrder: (updatedOrder: StoreOrder) => void;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({
  isOpen,
  onClose,
  order,
  currentStore,
  onSaveOrder,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [district, setDistrict] = useState('Dhaka City');
  const [thana, setThana] = useState('');
  const [specialNote, setSpecialNote] = useState('');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [status, setStatus] = useState<OrderStatus>('PENDING');
  const [paymentStatus, setPaymentStatus] = useState<StoreOrder['paymentStatus']>('UNPAID');
  const [paymentMethod, setPaymentMethod] = useState<StoreOrder['paymentMethod']>('COD');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (order) {
      setCustomerName(order.customerName);
      setCustomerPhone(order.customerPhone);
      setCustomerEmail(order.customerEmail);
      setShippingAddress(order.shippingAddress);
      setDistrict(order.district || order.city || 'Dhaka City');
      setThana(order.thana || '');
      setSpecialNote(order.specialNote || '');
      setPaidAmount(order.paidAmount || 0);
      setStatus(order.status);
      setPaymentStatus(order.paymentStatus);
      setPaymentMethod(order.paymentMethod);
      setErrorMsg(null);
    }
  }, [order]);

  if (!isOpen || !order) return null;

  const totalAmount = order.totalAmount;
  const dueAmount = Math.max(0, totalAmount - paidAmount);
  const isPhoneInvalid = customerPhone.trim().length > 0 && !/^01[3-9]\d{8}$/.test(customerPhone.replace(/\D/g, ''));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 11) {
      setErrorMsg('Please enter a valid 11-digit Bangladesh phone number.');
      return;
    }

    const updatedOrder: StoreOrder = {
      ...order,
      customerName: customerName.trim(),
      customerPhone: cleanPhone,
      customerEmail: customerEmail.trim(),
      shippingAddress: shippingAddress.trim(),
      district: district,
      thana: thana.trim(),
      specialNote: specialNote.trim() || undefined,
      paidAmount: paidAmount,
      dueAmount: dueAmount,
      status: status,
      paymentStatus: paymentStatus,
      paymentMethod: paymentMethod,
    };

    onSaveOrder(updatedOrder);
    onClose();
  };

  return (
    <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', zIndex: 1050, padding: '16px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', margin: 0, padding: '24px', borderRadius: '14px', background: '#ffffff', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}>
        
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', borderBottom: '1px solid var(--border)', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#0284c7', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Pencil size={18} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                  Edit Order #{order.orderNumber}
                </h2>
                <span className="badge badge-outline" style={{ fontFamily: 'var(--font-mono)' }}>{currentStore.name}</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Universal CRUD order modification and financial ledger adjustment
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm" style={{ padding: '6px' }}>
            <X size={16} />
          </button>
        </div>

        {errorMsg && (
          <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', fontSize: '0.8rem', marginBottom: '16px' }}>
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* Customer Contacts */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700 }}>Recipient Full Name</label>
              <input
                type="text"
                required
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="form-input"
                style={{ height: '36px', fontSize: '0.84rem' }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700 }}>Customer Mobile</label>
              <input
                type="text"
                required
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                className="form-input"
                style={{ height: '36px', fontSize: '0.84rem' }}
              />
              {isPhoneInvalid && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#b91c1c', fontSize: '0.72rem', marginTop: '3px' }}>
                  <ShieldAlert size={12} />
                  <span>Must be valid 11-digit BD mobile (013-019)</span>
                </div>
              )}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700 }}>Customer Email</label>
            <input
              type="email"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="form-input"
              style={{ height: '36px', fontSize: '0.84rem' }}
            />
          </div>

          {/* Delivery Coordinates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700 }}>District / Zone</label>
              <select
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="form-input"
                style={{ height: '36px', fontSize: '0.84rem' }}
              >
                <option value="Dhaka City">Dhaka City</option>
                <option value="Dhaka Sub-Urban">Dhaka Sub-Urban</option>
                <option value="Chattogram">Chattogram</option>
                <option value="Sylhet">Sylhet</option>
                <option value="Rajshahi">Rajshahi</option>
                <option value="Khulna">Khulna</option>
                <option value="Barishal">Barishal</option>
                <option value="Rangpur">Rangpur</option>
                <option value="Mymensingh">Mymensingh</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700 }}>Thana / Delivery Area</label>
              <input
                type="text"
                value={thana}
                onChange={(e) => setThana(e.target.value)}
                className="form-input"
                style={{ height: '36px', fontSize: '0.84rem' }}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700 }}>Street Address</label>
            <textarea
              rows={2}
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              className="form-input"
              style={{ fontSize: '0.84rem', resize: 'vertical' }}
            />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700 }}>Special Delivery Note</label>
            <input
              type="text"
              value={specialNote}
              onChange={(e) => setSpecialNote(e.target.value)}
              className="form-input"
              style={{ height: '36px', fontSize: '0.84rem' }}
            />
          </div>

          {/* Status & Financial Adjustments */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700 }}>Fulfillment State</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as OrderStatus)}
                className="form-input"
                style={{ height: '36px', fontSize: '0.84rem' }}
              >
                <option value="PENDING">PENDING</option>
                <option value="CONFIRMED">CONFIRMED</option>
                <option value="PROCESSING">PROCESSING</option>
                <option value="SHIPPED">SHIPPED</option>
                <option value="DELIVERED">DELIVERED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700 }}>Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="form-input"
                style={{ height: '36px', fontSize: '0.84rem' }}
              >
                <option value="COD">COD</option>
                <option value="BKASH">bKash</option>
                <option value="NAGAD">Nagad</option>
                <option value="STRIPE">Stripe Card</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700 }}>Payment Status</label>
              <select
                value={paymentStatus}
                onChange={(e) => setPaymentStatus(e.target.value as any)}
                className="form-input"
                style={{ height: '36px', fontSize: '0.84rem' }}
              >
                <option value="UNPAID">UNPAID</option>
                <option value="PENDING">PENDING</option>
                <option value="PARTIALLY_PAID">PARTIALLY_PAID</option>
                <option value="PAID">PAID</option>
                <option value="REFUNDED">REFUNDED</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700 }}>Total Order Amount (৳)</label>
              <input
                type="text"
                disabled
                value={`৳ ${totalAmount.toLocaleString()}`}
                className="form-input"
                style={{ height: '36px', fontSize: '0.84rem', background: '#f8fafc', fontWeight: 700 }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700 }}>Paid Amount (৳)</label>
              <input
                type="number"
                min="0"
                max={totalAmount}
                value={paidAmount}
                onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                className="form-input"
                style={{ height: '36px', fontSize: '0.84rem' }}
              />
            </div>
          </div>

          {/* Ledger Banner */}
          <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', color: '#475569' }}>Calculated Due Balance:</span>
            <span style={{ fontSize: '0.95rem', fontWeight: 800, color: dueAmount > 0 ? '#ef4444' : '#10b981' }}>
              ৳ {dueAmount.toLocaleString()}
            </span>
          </div>

          {/* Modal Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.82rem' }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ padding: '8px 20px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={15} />
              <span>Save Order Changes</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};

