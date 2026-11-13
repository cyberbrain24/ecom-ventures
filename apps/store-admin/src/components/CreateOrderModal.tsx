import React, { useState } from 'react';
import { X, ShoppingBag, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { StoreOrder, StoreBrand, StoreProduct, OrderItem } from '../types/store';

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentStore: StoreBrand;
  products: StoreProduct[];
  onCreateOrder: (newOrder: StoreOrder) => void;
}

export const CreateOrderModal: React.FC<CreateOrderModalProps> = ({
  isOpen,
  onClose,
  currentStore,
  products,
  onCreateOrder,
}) => {
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [district, setDistrict] = useState('Dhaka City');
  const [thana, setThana] = useState('Banani');
  const [specialNote, setSpecialNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'COD' | 'BKASH' | 'NAGAD' | 'STRIPE'>('COD');
  const [paidAmount, setPaidAmount] = useState<number>(0);
  const [selectedProductId, setSelectedProductId] = useState<string>(products[0]?.id || '');
  const [quantity, setQuantity] = useState<number>(1);
  const [shippingFee, setShippingFee] = useState<number>(80);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const selectedProduct = products.find((p) => p.id === selectedProductId) || products[0];
  const unitPrice = selectedProduct ? selectedProduct.price : 0;
  const subtotal = unitPrice * quantity;
  const totalAmount = subtotal + shippingFee;
  const dueAmount = Math.max(0, totalAmount - paidAmount);

  // Quick live risk checks
  const isPhoneInvalid = customerPhone.trim().length > 0 && !/^01[3-9]\d{8}$/.test(customerPhone.replace(/\D/g, ''));
  const isHighValueCOD = paymentMethod === 'COD' && totalAmount > 5000;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanPhone = customerPhone.replace(/\D/g, '');
    if (!cleanPhone || cleanPhone.length < 11) {
      setErrorMsg('Please enter a valid 11-digit Bangladesh phone number (013-019).');
      return;
    }

    if (!selectedProduct) {
      setErrorMsg('Please select at least one item to order.');
      return;
    }

    const items: OrderItem[] = [
      {
        id: `it-${Date.now()}`,
        productTitle: selectedProduct.title,
        sku: selectedProduct.sku,
        quantity: quantity,
        unitPrice: unitPrice,
        totalPrice: subtotal,
        productImage: selectedProduct.imageUrl,
      },
    ];

    const orderNumber = `ORD-${new Date().toISOString().slice(2, 10).replace(/-/g, '')}-${Math.floor(1000 + Math.random() * 9000)}`;

    const riskFlags = [];
    if (!/^01[3-9]\d{8}$/.test(cleanPhone)) {
      riskFlags.push({
        code: 'invalid_phone',
        severity: 'WARNING' as const,
        label: 'Invalid Phone Format',
        description: 'Telephone does not conform to standard 11-digit BD mobile format.',
      });
    }
    if (isHighValueCOD) {
      riskFlags.push({
        code: 'high_value_cod',
        severity: 'WARNING' as const,
        label: 'High-Value COD',
        description: `Unpaid cash on delivery total (৳${totalAmount.toLocaleString()}) exceeds safety threshold.`,
      });
    }

    const newOrder: StoreOrder = {
      id: `ord-${Date.now()}`,
      orderNumber: orderNumber,
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim() || `${cleanPhone}@phone-order.local`,
      customerPhone: cleanPhone,
      crmProfilePhone: cleanPhone,
      shippingAddress: shippingAddress.trim(),
      city: district.includes('Dhaka') ? 'Dhaka' : district,
      district: district,
      thana: thana,
      items: items,
      subtotal: subtotal,
      shippingFee: shippingFee,
      discountAmount: 0,
      totalAmount: totalAmount,
      paidAmount: paidAmount,
      dueAmount: dueAmount,
      status: 'CONFIRMED',
      paymentMethod: paymentMethod,
      paymentStatus: paidAmount >= totalAmount ? 'PAID' : paidAmount > 0 ? 'PARTIALLY_PAID' : 'UNPAID',
      specialNote: specialNote.trim() || undefined,
      riskFlags: riskFlags,
      callNotes: [
        {
          id: `cn-${Date.now()}`,
          staffName: 'Store Operator',
          note: `Staff-assisted order created via CRM. Scheduled for ${district} dispatch.`,
          createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
        },
      ],
      createdAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
    };

    onCreateOrder(newOrder);
    onClose();
  };

  return (
    <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', zIndex: 1050, padding: '16px' }}>
      <div className="card" style={{ width: '100%', maxWidth: '640px', maxHeight: '90vh', overflowY: 'auto', margin: 0, padding: '24px', borderRadius: '14px', background: '#ffffff', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' }}>
        
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', borderBottom: '1px solid var(--border)', paddingBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '8px', background: '#0f172a', color: '#ffffff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ShoppingBag size={20} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-main)', margin: 0 }}>
                Create Customer Order
              </h2>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Staff-assisted phone or WhatsApp direct order for <strong>{currentStore.name}</strong>
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
          
          {/* Customer Coordinates */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700 }}>Recipient Full Name *</label>
              <input
                type="text"
                required
                placeholder="e.g. Tanvir Ahmed"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="form-input"
                style={{ height: '36px', fontSize: '0.84rem' }}
              />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700 }}>Phone (11 Digits) *</label>
              <input
                type="text"
                required
                placeholder="01712345678"
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
            <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700 }}>Email Address (Optional)</label>
            <input
              type="email"
              placeholder="customer@example.com"
              value={customerEmail}
              onChange={(e) => setCustomerEmail(e.target.value)}
              className="form-input"
              style={{ height: '36px', fontSize: '0.84rem' }}
            />
          </div>

          {/* Delivery Location Hierarchy */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700 }}>Logistics District / Zone *</label>
              <select
                value={district}
                onChange={(e) => {
                  const val = e.target.value;
                  setDistrict(val);
                  if (val === 'Dhaka City') setShippingFee(80);
                  else if (val === 'Dhaka Sub-Urban') setShippingFee(110);
                  else setShippingFee(130);
                }}
                className="form-input"
                style={{ height: '36px', fontSize: '0.84rem' }}
              >
                <option value="Dhaka City">Dhaka City (৳80.00)</option>
                <option value="Dhaka Sub-Urban">Dhaka Sub-Urban (৳110.00)</option>
                <option value="Chattogram">Chattogram (৳130.00)</option>
                <option value="Sylhet">Sylhet (৳130.00)</option>
                <option value="Rajshahi">Rajshahi (৳130.00)</option>
                <option value="Khulna">Khulna (৳130.00)</option>
                <option value="Barishal">Barishal (৳130.00)</option>
                <option value="Rangpur">Rangpur (৳130.00)</option>
                <option value="Mymensingh">Mymensingh (৳130.00)</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700 }}>Thana / Upazila *</label>
              <input
                type="text"
                required
                placeholder="e.g. Banani, Mirpur, Dhanmondi"
                value={thana}
                onChange={(e) => setThana(e.target.value)}
                className="form-input"
                style={{ height: '36px', fontSize: '0.84rem' }}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700 }}>Detailed Street Address *</label>
            <textarea
              required
              rows={2}
              placeholder="House, Road, Apartment, Area details..."
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              className="form-input"
              style={{ fontSize: '0.84rem', resize: 'vertical' }}
            />
          </div>

          {/* Product Selector */}
          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>Product & Inventory Selection</div>
            <div style={{ display: 'grid', gridTemplateColumns: '3fr 1fr', gap: '10px' }}>
              <div>
                <select
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                  className="form-input"
                  style={{ height: '36px', fontSize: '0.84rem' }}
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} — ৳{p.price.toLocaleString()} ({p.inventoryCount} in stock)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
                  className="form-input"
                  style={{ height: '36px', fontSize: '0.84rem' }}
                />
              </div>
            </div>
          </div>

          {/* Financial Breakdown & Special Notes */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700 }}>Payment Method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                className="form-input"
                style={{ height: '36px', fontSize: '0.84rem' }}
              >
                <option value="COD">Cash on Delivery (COD)</option>
                <option value="BKASH">bKash Merchant Pay</option>
                <option value="NAGAD">Nagad Direct</option>
                <option value="STRIPE">Online Card (Stripe)</option>
              </select>
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700 }}>Advance / Paid Amount (৳)</label>
              <input
                type="number"
                min="0"
                value={paidAmount}
                onChange={(e) => setPaidAmount(parseFloat(e.target.value) || 0)}
                className="form-input"
                style={{ height: '36px', fontSize: '0.84rem' }}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label" style={{ fontSize: '0.78rem', fontWeight: 700 }}>Customer Delivery Remark / Special Note</label>
            <input
              type="text"
              placeholder="e.g. Call before 5pm. Deliver to reception desk."
              value={specialNote}
              onChange={(e) => setSpecialNote(e.target.value)}
              className="form-input"
              style={{ height: '36px', fontSize: '0.84rem' }}
            />
          </div>

          {/* Order Summary Box */}
          <div style={{ background: '#f1f5f9', padding: '12px 16px', borderRadius: '8px', fontSize: '0.82rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: '#64748b' }}>Item Subtotal:</span>
              <span style={{ fontWeight: 600 }}>৳ {subtotal.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
              <span style={{ color: '#64748b' }}>Delivery Fee ({district}):</span>
              <span style={{ fontWeight: 600 }}>৳ {shippingFee.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: '6px', marginTop: '6px' }}>
              <span style={{ fontWeight: 800 }}>Total Payable:</span>
              <span style={{ fontWeight: 800, color: 'var(--primary)' }}>৳ {totalAmount.toLocaleString()}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
              <span style={{ color: '#ef4444', fontWeight: 700 }}>Due Balance (COD):</span>
              <span style={{ color: '#ef4444', fontWeight: 800 }}>৳ {dueAmount.toLocaleString()}</span>
            </div>
          </div>

          {isHighValueCOD && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', fontSize: '0.76rem', color: '#92400e' }}>
              <ShieldAlert size={14} />
              <span>High-Value COD warning badge will be attached to this order (&gt;৳5,000 threshold).</span>
            </div>
          )}

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px', borderTop: '1px solid var(--border)', paddingTop: '14px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ padding: '8px 16px', fontSize: '0.82rem' }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ padding: '8px 20px', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#0f172a' }}>
              <CheckCircle2 size={15} />
              <span>Confirm & Place Order</span>
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
