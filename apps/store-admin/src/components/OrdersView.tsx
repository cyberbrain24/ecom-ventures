import React, { useState } from 'react';
import {
  ShoppingBag,
  Truck,
  CheckCircle2,
  Clock,
  XCircle,
  Search,
  ExternalLink,
  MessageCircle,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  Copy,
  Check,
  AlertTriangle,
  MapPin,
  FileText,
  Eye,
  LayoutGrid,
  Table as TableIcon,
  ShieldAlert,
  Send,
  X,
  Package,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { StoreOrder, OrderStatus, StoreBrand, StoreProduct, OrderRiskFlag } from '../types/store';
import { CreateOrderModal } from './CreateOrderModal';
import { EditOrderModal } from './EditOrderModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface OrdersViewProps {
  currentStore: StoreBrand;
  orders: StoreOrder[];
  products?: StoreProduct[];
  onUpdateOrderStatus: (
    orderId: string,
    newStatus: OrderStatus,
    courier?: 'Steadfast' | 'Pathao' | 'RedX',
    tracking?: string,
    consignmentId?: string
  ) => void;
  onCreateOrder?: (order: StoreOrder) => void;
  onUpdateOrder?: (order: StoreOrder) => void;
  onDeleteOrder?: (orderId: string) => void;
  onAddCallNote?: (orderId: string, note: string) => void;
}

export const OrdersView: React.FC<OrdersViewProps> = ({
  currentStore,
  orders,
  products = [],
  onUpdateOrderStatus,
  onCreateOrder,
  onUpdateOrder,
  onDeleteOrder,
  onAddCallNote,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPayStatus, setSelectedPayStatus] = useState<string>('ALL');
  const [selectedMethod, setSelectedMethod] = useState<string>('ALL');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<StoreOrder | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<StoreOrder | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<StoreOrder | null>(null);

  // Inline note input state by order ID
  const [inlineNotes, setInlineNotes] = useState<Record<string, string>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Dispatch processing tracking
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

  const filteredOrders = orders.filter((o) => {
    const matchesStatus =
      selectedStatus === 'ALL' ||
      (selectedStatus === 'PENDING' && (o.status === 'PENDING' || o.status === 'CONFIRMED')) ||
      o.status === selectedStatus;

    const matchesPayStatus =
      selectedPayStatus === 'ALL' ||
      (selectedPayStatus === 'PAID' && o.paymentStatus === 'PAID') ||
      (selectedPayStatus === 'UNPAID' && (o.paymentStatus === 'UNPAID' || o.paymentStatus === 'PENDING'));

    const matchesMethod = selectedMethod === 'ALL' || o.paymentMethod === selectedMethod;

    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      o.orderNumber.toLowerCase().includes(query) ||
      o.customerName.toLowerCase().includes(query) ||
      o.customerPhone.includes(query) ||
      (o.trackingNumber && o.trackingNumber.toLowerCase().includes(query)) ||
      (o.consignmentId && o.consignmentId.toLowerCase().includes(query));

    return matchesStatus && matchesPayStatus && matchesMethod && matchesSearch;
  });

  const handleSyncSteadfast = () => {
    setIsSyncing(true);
    setSyncMessage(null);
    setTimeout(() => {
      setIsSyncing(false);
      setSyncMessage('Steadfast courier status synchronized across all active consignments.');
      setTimeout(() => setSyncMessage(null), 3500);
    }, 1000);
  };

  const handleDispatchSteadfast = (order: StoreOrder) => {
    setDispatchingId(order.id);
    setTimeout(() => {
      const generatedConsignment = `${Math.floor(2400000 + Math.random() * 900000)}`;
      const generatedTracking = `STF-TRK-${Math.floor(100000 + Math.random() * 900000)}`;
      onUpdateOrderStatus(order.id, 'SHIPPED', 'Steadfast', generatedTracking, generatedConsignment);
      setDispatchingId(null);
    }, 700);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleSaveInlineNote = (orderId: string) => {
    const noteText = inlineNotes[orderId]?.trim();
    if (!noteText) return;

    if (onAddCallNote) {
      onAddCallNote(orderId, noteText);
    }
    setInlineNotes((prev) => ({ ...prev, [orderId]: '' }));
  };

  return (
    <div>
      {/* Top Header Control Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
            Orders & Fulfillment Control Center
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
            Decoupled ledger, automated risk scoring, and headless Steadfast courier dispatch for <code>{currentStore.name}</code>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            type="button"
            onClick={handleSyncSteadfast}
            disabled={isSyncing}
            className="btn btn-secondary btn-sm"
            style={{ fontSize: '0.8rem', padding: '6px 12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            title="Batch query Steadfast status API"
          >
            <RefreshCw size={14} className={isSyncing ? 'spin-animation' : ''} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Steadfast'}</span>
          </button>

          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="btn btn-primary btn-sm"
            style={{ fontSize: '0.8rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#0f172a' }}
          >
            <Plus size={15} />
            <span>Create Order</span>
          </button>
        </div>
      </div>

      {/* Orders Operational Metrics - 7 Column Box Card Design */}
      <div className="stats-grid">
        {/* 1. Total Orders */}
        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Total Orders</div>
            <div className="stat-val">{orders.length}</div>
            <div className="stat-sub" style={{ color: '#0284c7', fontWeight: 600 }}>
              <ShoppingBag size={11} /> All orders
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#f0f9ff', color: '#0284c7' }}>
            <ShoppingBag size={16} />
          </div>
        </div>

        {/* 2. Pending Orders */}
        <div className="stat-card" style={{ borderLeft: orders.filter((o) => o.status === 'PENDING').length > 0 ? '3px solid #f59e0b' : undefined }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Pending Verify</div>
            <div className="stat-val" style={{ color: orders.filter((o) => o.status === 'PENDING').length > 0 ? '#f59e0b' : 'var(--text-main)' }}>
              {orders.filter((o) => o.status === 'PENDING').length}
            </div>
            <div className="stat-sub" style={{ color: '#d97706' }}>
              <Clock size={11} /> Awaiting call
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
            <Clock size={16} />
          </div>
        </div>

        {/* 3. Processing / Packing */}
        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Confirmed/Packing</div>
            <div className="stat-val" style={{ color: '#6366f1' }}>
              {orders.filter((o) => o.status === 'CONFIRMED' || o.status === 'PROCESSING').length}
            </div>
            <div className="stat-sub" style={{ color: '#6366f1' }}>
              <Package size={11} /> Ready to ship
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#eef2ff', color: '#6366f1' }}>
            <Package size={16} />
          </div>
        </div>

        {/* 4. In Transit / Shipped */}
        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">In Transit</div>
            <div className="stat-val" style={{ color: '#0284c7' }}>
              {orders.filter((o) => o.status === 'SHIPPED').length}
            </div>
            <div className="stat-sub" style={{ color: '#0284c7' }}>
              <Truck size={11} /> On the road
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#e0f2fe', color: '#0369a1' }}>
            <Truck size={16} />
          </div>
        </div>

        {/* 5. Delivered */}
        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Delivered</div>
            <div className="stat-val" style={{ color: '#059669' }}>
              {orders.filter((o) => o.status === 'DELIVERED').length}
            </div>
            <div className="stat-sub" style={{ color: '#059669', fontWeight: 600 }}>
              <CheckCircle2 size={11} /> Fulfilled
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
            <CheckCircle2 size={16} />
          </div>
        </div>

        {/* 6. Cancelled */}
        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Cancelled/RTO</div>
            <div className="stat-val" style={{ color: orders.filter((o) => o.status === 'CANCELLED').length > 0 ? '#ef4444' : 'var(--text-main)' }}>
              {orders.filter((o) => o.status === 'CANCELLED').length}
            </div>
            <div className="stat-sub" style={{ color: '#dc2626' }}>
              <XCircle size={11} /> Returns & voids
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
            <XCircle size={16} />
          </div>
        </div>

        {/* 7. Outstanding Due */}
        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">COD Receivable</div>
            <div className="stat-val">
              ৳{Math.round(orders.filter((o) => o.status !== 'CANCELLED').reduce((sum, o) => sum + (o.dueAmount !== undefined ? o.dueAmount : Math.max(0, o.totalAmount - (o.paidAmount || 0))), 0)).toLocaleString()}
            </div>
            <div className="stat-sub" style={{ color: '#64748b' }}>
              <DollarSign size={11} /> Courier collect
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#f1f5f9', color: '#475569' }}>
            <DollarSign size={16} />
          </div>
        </div>
      </div>

      {syncMessage && (
        <div style={{ padding: '8px 14px', borderRadius: '8px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: '0.8rem', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CheckCircle2 size={15} />
          <span>{syncMessage}</span>
        </div>
      )}

      {/* Filter and Search Toolbar */}
      <div className="card" style={{ padding: '12px 14px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          
          <div style={{ position: 'relative', minWidth: '260px', flex: 1 }}>
            <Search size={15} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-subtle)' }} />
            <input
              type="text"
              placeholder="Search Order # / Customer / Phone / Consignment ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '32px', width: '100%', height: '34px', fontSize: '0.82rem' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={selectedPayStatus}
              onChange={(e) => setSelectedPayStatus(e.target.value)}
              className="form-input"
              style={{ height: '34px', fontSize: '0.8rem', padding: '0 8px', width: '130px' }}
            >
              <option value="ALL">Payment: All</option>
              <option value="PAID">Paid Only</option>
              <option value="UNPAID">Unpaid / Due</option>
            </select>

            <select
              value={selectedMethod}
              onChange={(e) => setSelectedMethod(e.target.value)}
              className="form-input"
              style={{ height: '34px', fontSize: '0.8rem', padding: '0 8px', width: '120px' }}
            >
              <option value="ALL">Method: All</option>
              <option value="COD">COD</option>
              <option value="BKASH">bKash</option>
              <option value="NAGAD">Nagad</option>
              <option value="STRIPE">Stripe</option>
            </select>

            {/* View Mode Toggle */}
            <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: '6px', padding: '2px', border: '1px solid #e2e8f0' }}>
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`btn btn-sm ${viewMode === 'cards' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 8px', fontSize: '0.75rem', border: 'none', background: viewMode === 'cards' ? '#0f172a' : 'transparent', color: viewMode === 'cards' ? '#fff' : '#475569' }}
                title="Poshplex Card Grid View"
              >
                <LayoutGrid size={13} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}`}
                style={{ padding: '4px 8px', fontSize: '0.75rem', border: 'none', background: viewMode === 'table' ? '#0f172a' : 'transparent', color: viewMode === 'table' ? '#fff' : '#475569' }}
                title="Dense Data Table View"
              >
                <TableIcon size={13} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Status Tabs Navigation */}
      <div style={{ display: 'flex', gap: '6px', borderBottom: '1px solid var(--border)', marginBottom: '16px', overflowX: 'auto', paddingBottom: '6px' }}>
        {[
          { key: 'ALL', label: 'All Orders', count: orders.length },
          { key: 'PENDING', label: 'Placed / Review', count: orders.filter((o) => o.status === 'PENDING' || o.status === 'CONFIRMED').length },
          { key: 'PROCESSING', label: 'Processing', count: orders.filter((o) => o.status === 'PROCESSING').length },
          { key: 'SHIPPED', label: 'In Transit / Shipped', count: orders.filter((o) => o.status === 'SHIPPED').length },
          { key: 'DELIVERED', label: 'Delivered', count: orders.filter((o) => o.status === 'DELIVERED').length },
          { key: 'CANCELLED', label: 'Cancelled / RTO', count: orders.filter((o) => o.status === 'CANCELLED').length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSelectedStatus(tab.key)}
            className={`btn btn-sm ${selectedStatus === tab.key ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.78rem', padding: '5px 12px', whiteSpace: 'nowrap', borderRadius: '20px' }}
          >
            <span>{tab.label}</span>
            <span style={{ marginLeft: '4px', opacity: 0.85, fontWeight: 700 }}>({tab.count})</span>
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-subtle)' }}>
          <ShoppingBag size={36} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
          <h3 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', margin: '0 0 4px 0' }}>No orders found</h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
            No orders match the current status and filter parameters.
          </p>
        </div>
      ) : viewMode === 'cards' ? (
        /* Poshplex Responsive CSS Grid Card View */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: '18px' }}>
          {filteredOrders.map((order) => {
            const hasMultipleImages = order.items && order.items.length > 1;
            const primaryItem = order.items?.[0];
            const secondaryItem = order.items?.[1];
            const cleanPhone = order.customerPhone.replace(/\D/g, '');
            const due = order.dueAmount !== undefined ? order.dueAmount : Math.max(0, order.totalAmount - (order.paidAmount || 0));

            return (
              <div
                key={order.id}
                className="card"
                style={{
                  margin: 0,
                  padding: 0,
                  overflow: 'hidden',
                  borderRadius: '12px',
                  border: '1px solid #e2e8f0',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                {/* Product Image Banner */}
                <div
                  style={{
                    height: '110px',
                    background: '#f1f5f9',
                    display: 'grid',
                    gridTemplateColumns: hasMultipleImages ? '1fr 1fr' : '1fr',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  {primaryItem?.productImage ? (
                    <img
                      src={primaryItem.productImage}
                      alt={primaryItem.productTitle}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8' }}>
                      <ShoppingBag size={28} />
                    </div>
                  )}

                  {hasMultipleImages && (
                    secondaryItem?.productImage ? (
                      <img
                        src={secondaryItem.productImage}
                        alt={secondaryItem.productTitle}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderLeft: '1px solid #ffffff' }}
                      />
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', borderLeft: '1px solid #ffffff' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 700 }}>+{order.items.length - 1} item</span>
                      </div>
                    )
                  )}

                  <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '4px' }}>
                    <span className={`badge ${order.status === 'DELIVERED' ? 'badge-active' : order.status === 'SHIPPED' ? 'badge-shipped' : order.status === 'CANCELLED' ? 'badge-outline' : 'badge-pending'}`} style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>
                      {order.status}
                    </span>
                  </div>
                </div>

                {/* Card Body */}
                <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                  
                  {/* Meta Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: '#64748b', fontWeight: 600 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary)', fontWeight: 800 }}>
                      {order.orderNumber}
                    </span>
                    <span>{order.createdAt}</span>
                  </div>

                  {/* Customer Info with WhatsApp Pill */}
                  <div>
                    <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                      {order.customerName}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', color: '#475569', marginTop: '2px' }}>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{order.customerPhone}</span>
                      {cleanPhone && (
                        <a
                          href={`https://wa.me/880${cleanPhone.startsWith('0') ? cleanPhone.slice(1) : cleanPhone}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                            color: '#10b981',
                            fontSize: '0.74rem',
                            fontWeight: 700,
                            textDecoration: 'none',
                            padding: '1px 6px',
                            borderRadius: '4px',
                            background: '#ecfdf5',
                          }}
                          title="Instant WhatsApp Verification"
                        >
                          <MessageCircle size={11} />
                          <span>WhatsApp</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Location Chip */}
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.74rem', color: '#0369a1', background: '#e0f2fe', padding: '3px 8px', borderRadius: '4px', width: 'fit-content' }}>
                    <MapPin size={11} />
                    <span>Loc: {order.district || order.city || 'Dhaka City'}{order.thana ? ` (${order.thana})` : ''}</span>
                  </div>

                  {/* Special Note Badge */}
                  {order.specialNote && (
                    <div style={{ background: '#f3e8ff', color: '#7e22ce', padding: '4px 8px', borderRadius: '6px', fontSize: '0.74rem', fontWeight: 600 }}>
                      🟪 Note: {order.specialNote}
                    </div>
                  )}

                  {/* Risk Score Warning Badges */}
                  {order.riskFlags && order.riskFlags.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {order.riskFlags.map((rf: OrderRiskFlag, idx: number) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '5px',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            background: rf.severity === 'DANGER' ? '#fee2e2' : '#fef3c7',
                            color: rf.severity === 'DANGER' ? '#991b1b' : '#92400e',
                            border: `1px solid ${rf.severity === 'DANGER' ? '#fecaca' : '#fde68a'}`,
                          }}
                          title={rf.description}
                        >
                          <ShieldAlert size={12} />
                          <span>{rf.label}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Financial Ledger Breakdown */}
                  <div style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '6px', border: '1px solid #f1f5f9', fontSize: '0.8rem', marginTop: '2px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ color: '#64748b' }}>{order.items?.length || 1} item(s)</span>
                      <span style={{ fontWeight: 800, color: 'var(--text-main)' }}>৳ {order.totalAmount.toLocaleString()}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem' }}>
                      <span style={{ color: '#10b981', fontWeight: 600 }}>Paid: ৳{(order.paidAmount || 0).toLocaleString()}</span>
                      <span style={{ fontWeight: 800, color: due > 0 ? '#ef4444' : '#10b981' }}>
                        Due: ৳{due.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Dynamic Courier Action Area */}
                  <div style={{ marginTop: '4px' }}>
                    {order.trackingNumber ? (
                      <button
                        type="button"
                        onClick={() => handleCopy(order.consignmentId || order.trackingNumber || '')}
                        style={{
                          width: '100%',
                          background: '#ecfdf5',
                          border: '1px solid #a7f3d0',
                          color: '#065f46',
                          padding: '7px 10px',
                          borderRadius: '6px',
                          fontWeight: 700,
                          fontSize: '0.78rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          cursor: 'pointer',
                        }}
                        title="Click to copy consignment / tracking code"
                      >
                        {copiedId ? <Check size={13} color="#059669" /> : <Truck size={13} />}
                        <span>
                          {copiedId ? 'Copied to Clipboard!' : `[ ✅ Shipped: ${order.consignmentId || order.trackingNumber} ]`}
                        </span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={dispatchingId === order.id || order.status === 'CANCELLED' || order.status === 'DELIVERED'}
                        onClick={() => handleDispatchSteadfast(order)}
                        style={{
                          width: '100%',
                          background: '#0f172a',
                          color: '#ffffff',
                          border: 'none',
                          padding: '8px',
                          borderRadius: '6px',
                          fontWeight: 700,
                          fontSize: '0.8rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '6px',
                          opacity: order.status === 'CANCELLED' || order.status === 'DELIVERED' ? 0.5 : 1,
                        }}
                      >
                        <Truck size={14} className={dispatchingId === order.id ? 'spin-animation' : ''} />
                        <span>{dispatchingId === order.id ? 'Processing Dispatch...' : '[ 🚚 Ship with Courier ]'}</span>
                      </button>
                    )}
                  </div>

                  {/* Inline Call Notes Quick Input */}
                  <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                    <input
                      type="text"
                      placeholder="+ Add staff call note (Enter)..."
                      value={inlineNotes[order.id] || ''}
                      onChange={(e) => setInlineNotes({ ...inlineNotes, [order.id]: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSaveInlineNote(order.id);
                        }
                      }}
                      style={{
                        flex: 1,
                        border: '1px dashed #cbd5e1',
                        padding: '5px 8px',
                        borderRadius: '4px',
                        fontSize: '0.74rem',
                        outline: 'none',
                      }}
                    />
                    {inlineNotes[order.id]?.trim() && (
                      <button
                        type="button"
                        onClick={() => handleSaveInlineNote(order.id)}
                        className="btn btn-primary btn-sm"
                        style={{ padding: '4px 8px', fontSize: '0.72rem' }}
                      >
                        <Send size={11} />
                      </button>
                    )}
                  </div>

                  {/* Recent Call Note Preview */}
                  {order.callNotes && order.callNotes.length > 0 && (
                    <div style={{ fontSize: '0.72rem', color: '#64748b', fontStyle: 'italic', background: '#f8fafc', padding: '4px 6px', borderRadius: '4px' }}>
                      💬 &quot;{order.callNotes[order.callNotes.length - 1].note}&quot; — <span style={{ fontWeight: 600 }}>{order.callNotes[order.callNotes.length - 1].staffName}</span>
                    </div>
                  )}

                  {/* Card Footer Controls (View, Edit, Delete) */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '1px solid #f1f5f9',
                      paddingTop: '8px',
                      marginTop: '6px',
                    }}
                  >
                    <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
                      {order.paymentMethod} • {order.paymentStatus}
                    </span>

                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedOrder(order)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '3px 7px' }}
                        title="View Full Details Drawer"
                      >
                        <Eye size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingOrder(order)}
                        className="btn btn-secondary btn-sm"
                        style={{ padding: '3px 7px' }}
                        title="Edit Order"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingOrder(order)}
                        className="btn btn-danger btn-sm"
                        style={{ padding: '3px 7px' }}
                        title="Delete / Cancel Order"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Dense Desktop Table View */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Date</th>
                  <th>Customer & Mobile</th>
                  <th>Items Ordered</th>
                  <th>Financial Ledger</th>
                  <th>Status</th>
                  <th>Courier Consignment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const cleanPhone = order.customerPhone.replace(/\D/g, '');
                  const due = order.dueAmount !== undefined ? order.dueAmount : Math.max(0, order.totalAmount - (order.paidAmount || 0));

                  return (
                    <tr key={order.id}>
                      <td>
                        <button
                          onClick={() => setSelectedOrder(order)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--primary)',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: 800,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <span>{order.orderNumber}</span>
                          <ExternalLink size={12} />
                        </button>
                      </td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{order.createdAt}</td>
                      <td>
                        <div style={{ fontWeight: 700 }}>{order.customerName}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem' }}>
                          <span style={{ color: 'var(--text-muted)' }}>{order.customerPhone}</span>
                          {cleanPhone && (
                            <a
                              href={`https://wa.me/880${cleanPhone.startsWith('0') ? cleanPhone.slice(1) : cleanPhone}`}
                              target="_blank"
                              rel="noreferrer"
                              style={{ color: '#10b981', fontWeight: 700, textDecoration: 'none', fontSize: '0.72rem' }}
                            >
                              [WA]
                            </a>
                          )}
                        </div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b' }}>
                          {order.district || order.city}{order.thana ? ` (${order.thana})` : ''}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '0.82rem' }}>
                          {order.items?.map((it) => (
                            <div key={it.id}>{it.quantity}x {it.productTitle}</div>
                          ))}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>৳ {order.totalAmount.toLocaleString()}</div>
                        <div style={{ fontSize: '0.74rem', color: due > 0 ? '#ef4444' : '#10b981', fontWeight: 700 }}>
                          Due: ৳{due.toLocaleString()}
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${order.status === 'DELIVERED' ? 'badge-active' : order.status === 'SHIPPED' ? 'badge-shipped' : 'badge-pending'}`}>
                          {order.status}
                        </span>
                      </td>
                      <td>
                        {order.trackingNumber ? (
                          <div>
                            <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#0369a1' }}>
                              {order.consignmentId || order.trackingNumber}
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b' }}>Steadfast Parcel</div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleDispatchSteadfast(order)}
                            className="btn btn-secondary btn-sm"
                            style={{ fontSize: '0.74rem', padding: '3px 8px' }}
                          >
                            Dispatch
                          </button>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            type="button"
                            onClick={() => setSelectedOrder(order)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '3px 6px' }}
                            title="View Details"
                          >
                            <Eye size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingOrder(order)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '3px 6px' }}
                            title="Edit Order"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingOrder(order)}
                            className="btn btn-danger btn-sm"
                            style={{ padding: '3px 6px' }}
                            title="Delete Order"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Slide-Over Order Detail Drawer */}
      {selectedOrder && (
        <div className="modal-overlay" style={{ display: 'flex', justifyContent: 'flex-end', position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.5)', zIndex: 1040 }}>
          <div style={{ width: '100%', maxWidth: '480px', height: '100%', background: '#ffffff', padding: '24px', overflowY: 'auto', boxShadow: '-10px 0 25px -5px rgba(0,0,0,0.1)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '14px', marginBottom: '18px' }}>
              <div>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0 }}>Order #{selectedOrder.orderNumber}</h2>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Created {selectedOrder.createdAt}</span>
              </div>
              <button type="button" onClick={() => setSelectedOrder(null)} className="btn btn-secondary btn-sm" style={{ padding: '6px' }}>
                <X size={16} />
              </button>
            </div>

            {/* Customer Details */}
            <div className="card" style={{ padding: '14px', marginBottom: '14px' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>Customer & Shipping Address</div>
              <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{selectedOrder.customerName}</div>
              <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '2px' }}>{selectedOrder.customerPhone}</div>
              <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{selectedOrder.customerEmail}</div>
              <div style={{ marginTop: '8px', fontSize: '0.8rem', color: '#334155', lineHeight: 1.4 }}>
                {selectedOrder.shippingAddress}, {selectedOrder.thana ? `${selectedOrder.thana}, ` : ''}{selectedOrder.district || selectedOrder.city}
              </div>
              {selectedOrder.specialNote && (
                <div style={{ marginTop: '8px', padding: '6px 10px', background: '#f3e8ff', color: '#7e22ce', borderRadius: '6px', fontSize: '0.76rem', fontWeight: 600 }}>
                  🟪 Note: {selectedOrder.specialNote}
                </div>
              )}
            </div>

            {/* Line Items */}
            <div className="card" style={{ padding: '14px', marginBottom: '14px' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '10px' }}>Items Ordered</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {selectedOrder.items?.map((it) => (
                  <div key={it.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.82rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {it.productImage && (
                        <img src={it.productImage} alt={it.productTitle} style={{ width: '38px', height: '38px', borderRadius: '6px', objectFit: 'cover' }} />
                      )}
                      <div>
                        <div style={{ fontWeight: 600 }}>{it.productTitle}</div>
                        <div style={{ fontSize: '0.74rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>SKU: {it.sku}</div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700 }}>৳ {it.totalPrice.toLocaleString()}</div>
                      <div style={{ fontSize: '0.74rem', color: '#64748b' }}>Qty: {it.quantity}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Ledger */}
            <div className="card" style={{ padding: '14px', marginBottom: '14px', background: '#f8fafc' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>Payment Ledger</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                <span>Subtotal:</span>
                <span>৳ {selectedOrder.subtotal?.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', marginBottom: '4px' }}>
                <span>Shipping Fee:</span>
                <span>৳ {selectedOrder.shippingFee?.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 800, borderTop: '1px solid #e2e8f0', paddingTop: '6px' }}>
                <span>Total Amount:</span>
                <span>৳ {selectedOrder.totalAmount?.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: '#10b981', marginTop: '4px' }}>
                <span>Paid Balance:</span>
                <span>৳ {(selectedOrder.paidAmount || 0).toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: '#ef4444', fontWeight: 800, marginTop: '2px' }}>
                <span>Due Balance:</span>
                <span>৳ {(selectedOrder.dueAmount !== undefined ? selectedOrder.dueAmount : Math.max(0, selectedOrder.totalAmount - (selectedOrder.paidAmount || 0))).toLocaleString()}</span>
              </div>
            </div>

            {/* Call Notes History */}
            <div className="card" style={{ padding: '14px', marginBottom: '14px' }}>
              <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#334155', marginBottom: '8px' }}>Staff Call Notes ({selectedOrder.callNotes?.length || 0})</div>
              {selectedOrder.callNotes && selectedOrder.callNotes.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {selectedOrder.callNotes.map((cn) => (
                    <div key={cn.id} style={{ background: '#f8fafc', padding: '8px 10px', borderRadius: '6px', borderLeft: '3px solid #0284c7', fontSize: '0.78rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b', fontSize: '0.72rem', marginBottom: '2px' }}>
                        <span style={{ fontWeight: 700 }}>{cn.staffName}</span>
                        <span>{cn.createdAt}</span>
                      </div>
                      <div style={{ color: '#1e293b' }}>{cn.note}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '0.76rem', color: '#94a3b8', fontStyle: 'italic' }}>No call notes logged yet.</div>
              )}
            </div>

            {/* Drawer Actions */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => {
                  setEditingOrder(selectedOrder);
                  setSelectedOrder(null);
                }}
                className="btn btn-secondary"
                style={{ flex: 1, padding: '8px', fontSize: '0.82rem' }}
              >
                Edit Order
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeletingOrder(selectedOrder);
                  setSelectedOrder(null);
                }}
                className="btn btn-danger"
                style={{ padding: '8px 14px', fontSize: '0.82rem' }}
              >
                Delete
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Universal CRUD Modals */}
      <CreateOrderModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        currentStore={currentStore}
        products={products}
        onCreateOrder={(newOrd) => {
          if (onCreateOrder) onCreateOrder(newOrd);
        }}
      />

      <EditOrderModal
        isOpen={!!editingOrder}
        onClose={() => setEditingOrder(null)}
        order={editingOrder}
        currentStore={currentStore}
        onSaveOrder={(updatedOrd) => {
          if (onUpdateOrder) onUpdateOrder(updatedOrd);
        }}
      />

      <ConfirmDeleteModal
        isOpen={!!deletingOrder}
        onClose={() => setDeletingOrder(null)}
        title={`Delete Order #${deletingOrder?.orderNumber}`}
        itemName={`Order #${deletingOrder?.orderNumber} (${deletingOrder?.customerName})`}
        itemType="Customer Order"
        warningMessage={`Are you sure you want to permanently delete order #${deletingOrder?.orderNumber} for customer ${deletingOrder?.customerName}? This will purge all financial ledger transactions, call notes, and courier records for this order.`}
        confirmButtonText="Confirm Delete"
        onConfirm={() => {
          if (deletingOrder && onDeleteOrder) {
            onDeleteOrder(deletingOrder.id);
          }
          setDeletingOrder(null);
        }}
      />

    </div>
  );
};
