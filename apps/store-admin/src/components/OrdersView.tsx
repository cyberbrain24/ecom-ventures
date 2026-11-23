import React, { useState, useEffect, useCallback } from 'react';
import {
  StoreBrand,
  StoreOrder,
  OrderStatus,
  FulfillmentQueueItem,
  FulfillmentQueueSummary,
} from '../types/store';
import {
  fetchStoreOrders,
  fetchFulfillmentQueue,
  updateFulfillmentFlags,
  updateOrderStatus,
  addOrderCallNote,
  dispatchOrderCourier,
} from '../lib/orders-api';
import { formatMoney } from '../lib/format';
import { AbandonedRecoveryView } from './AbandonedRecoveryView';
import {
  ShoppingBag,
  Zap,
  PhoneCall,
  Printer,
  CheckCircle,
  Truck,
  RotateCcw,
  Clock,
  AlertCircle,
  Search,
  Phone,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  Shield,
  Eye,
  ExternalLink,
  MapPin,
  Calendar,
  X,
  Send,
  FileText,
  User,
  Package,
} from 'lucide-react';

interface OrdersViewProps {
  currentStore: StoreBrand;
  orders?: StoreOrder[];
}

type OrderViewSubTab = 'orders' | 'fulfillment' | 'abandoned';

// All 12 Operational Status Queues + ALL
const OPERATIONAL_QUEUES: { key: 'ALL' | OrderStatus; label: string; shortLabel: string; badgeColor: string }[] = [
  { key: 'ALL', label: 'All', shortLabel: 'All', badgeColor: '#64748b' },
  { key: 'PLACED', label: 'Placed', shortLabel: 'Placed', badgeColor: '#3b82f6' },
  { key: 'REVIEW', label: 'Review', shortLabel: 'Review', badgeColor: '#8b5cf6' },
  { key: 'PENDING', label: 'Pending', shortLabel: 'Pending', badgeColor: '#f59e0b' },
  { key: 'DELAYED', label: 'Delayed', shortLabel: 'Delayed', badgeColor: '#ef4444' },
  { key: 'HOLD', label: 'Hold', shortLabel: 'Hold', badgeColor: '#ec4899' },
  { key: 'APPROVAL_PENDING', label: 'Approval Pending', shortLabel: 'Approval', badgeColor: '#6366f1' },
  { key: 'CONFIRMED', label: 'Confirmed', shortLabel: 'Confirmed', badgeColor: '#0ea5e9' },
  { key: 'PROCESSING', label: 'Processing', shortLabel: 'Processing', badgeColor: '#14b8a6' },
  { key: 'SHIPPED', label: 'Shipped', shortLabel: 'Shipped', badgeColor: '#0d9488' },
  { key: 'DELIVERED', label: 'Delivered', shortLabel: 'Delivered', badgeColor: '#10b981' },
  { key: 'PARTIALLY_DELIVERED', label: 'Partially Delivered', shortLabel: 'Partial', badgeColor: '#84cc16' },
  { key: 'RETURNED', label: 'Returned', shortLabel: 'Returned', badgeColor: '#dc2626' },
  { key: 'CANCELLED', label: 'Cancelled', shortLabel: 'Cancelled', badgeColor: '#6b7280' },
  { key: 'MANUALLY_CANCELLED', label: 'Manually Cancelled', shortLabel: 'Manual', badgeColor: '#475569' },
];

export const OrdersView: React.FC<OrdersViewProps> = ({ currentStore }) => {
  const [subTab, setSubTab] = useState<OrderViewSubTab>('orders');

  // Total Orders Ledger State
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [ordersLoading, setOrdersLoading] = useState<boolean>(true);
  const [ordersError, setOrdersError] = useState<string | null>(null);
  const [orderFilter, setOrderFilter] = useState<'ALL' | OrderStatus>('ALL');
  const [orderSearch, setOrderSearch] = useState<string>('');

  // Fulfillment Queue State
  const [queueItems, setQueueItems] = useState<FulfillmentQueueItem[]>([]);
  const [queueSummary, setQueueSummary] = useState<FulfillmentQueueSummary>({
    total_queue_count: 0,
    urgent_count: 0,
    ready_to_ship_count: 0,
    print_pending_count: 0,
    delayed_alert_count: 0,
  });
  const [queueLoading, setQueueLoading] = useState<boolean>(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [urgentOnly, setUrgentOnly] = useState<boolean>(false);

  // Modal / Drawer state for View & Edit Order
  const [selectedOrder, setSelectedOrder] = useState<StoreOrder | null>(null);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  // Inline Note Drafts per order
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const [submittingNoteId, setSubmittingNoteId] = useState<string | null>(null);

  // Dispatching state
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

  // Action feedback toast
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setActionSuccess(msg);
    setTimeout(() => setActionSuccess(null), 4000);
  };

  // Load Orders with filter and search
  const loadOrders = useCallback(async () => {
    setOrdersLoading(true);
    setOrdersError(null);
    try {
      const res = await fetchStoreOrders(orderFilter, orderSearch, 1, 100);
      setOrders(res.orders || []);
      setStatusCounts(res.statusCounts || {});
    } catch (err: any) {
      setOrdersError(err.detail || err.message || 'Failed to load store orders.');
    } finally {
      setOrdersLoading(false);
    }
  }, [orderFilter, orderSearch]);

  // Load Fulfillment Queue
  const loadQueue = useCallback(async () => {
    setQueueLoading(true);
    setQueueError(null);
    try {
      const res = await fetchFulfillmentQueue(urgentOnly, 1, 50);
      setQueueItems(res.items || []);
      if (res.summary) {
        setQueueSummary(res.summary);
      }
    } catch (err: any) {
      setQueueError(err.detail || err.message || 'Failed to load fulfillment queue.');
    } finally {
      setQueueLoading(false);
    }
  }, [urgentOnly]);

  useEffect(() => {
    if (subTab === 'orders') {
      loadOrders();
    } else if (subTab === 'fulfillment') {
      loadQueue();
    }
  }, [subTab, loadOrders, loadQueue]);

  // Handle Quick State Transition
  const handleTransitionStatus = async (orderId: string, newStatus: OrderStatus) => {
    try {
      setUpdatingStatusId(orderId);
      await updateOrderStatus(orderId, newStatus, `Transitioned via Orders Hub to ${newStatus}`);
      showToast(`Order status updated to ${newStatus}`);
      await loadOrders();
      if (selectedOrder && selectedOrder.id === orderId) {
        setSelectedOrder((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch (err: any) {
      alert(err.detail || err.message || 'Failed to update order status');
    } finally {
      setUpdatingStatusId(null);
    }
  };

  // Handle Inline Call Note submission
  const handleAddCallNote = async (orderId: string) => {
    const text = noteInputs[orderId]?.trim();
    if (!text) return;
    try {
      setSubmittingNoteId(orderId);
      await addOrderCallNote(orderId, text);
      showToast('Call note logged successfully');
      setNoteInputs((prev) => ({ ...prev, [orderId]: '' }));
      await loadOrders();
    } catch (err: any) {
      alert(err.detail || err.message || 'Failed to record call note');
    } finally {
      setSubmittingNoteId(null);
    }
  };

  // Handle Courier Dispatch (Steadfast API)
  const handleShipSteadfast = async (order: StoreOrder) => {
    if (!confirm(`Book and ship parcel for Order #${order.orderNumber} via Steadfast Courier API?`)) {
      return;
    }
    try {
      setDispatchingId(order.id);
      const res = await dispatchOrderCourier(order.id, 'STEADFAST');
      showToast(`Consignment booked: ${res?.tracking_number || res?.consignment_id || 'OK'}`);
      await loadOrders();
    } catch (err: any) {
      alert(err.detail || err.message || 'Steadfast booking failed. Please verify API settings.');
    } finally {
      setDispatchingId(null);
    }
  };

  // Print Invoice Generator
  const handlePrintInvoice = (order: StoreOrder) => {
    const printWindow = window.open('', '_blank', 'width=800,height=900');
    if (!printWindow) {
      alert('Pop-up blocked. Please allow popups to print invoices.');
      return;
    }
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Invoice - ${order.orderNumber}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #1e293b; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; }
          .title { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
          .meta { font-size: 13px; color: #64748b; line-height: 1.5; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-bottom: 24px; font-size: 13px; }
          .box { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px 16px; border-radius: 6px; }
          .box-title { font-weight: 700; margin-bottom: 6px; text-transform: uppercase; font-size: 11px; color: #64748b; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
          th { background: #0f172a; color: white; padding: 10px 12px; text-align: left; }
          td { padding: 10px 12px; border-bottom: 1px solid #e2e8f0; }
          .totals { margin-left: auto; width: 280px; font-size: 13px; line-height: 1.8; }
          .totals-row { display: flex; justify-content: space-between; }
          .totals-due { font-weight: 800; font-size: 16px; border-top: 2px solid #0f172a; padding-top: 6px; margin-top: 6px; }
          .footer { text-align: center; margin-top: 40px; font-size: 12px; color: #94a3b8; }
          @media print { button { display: none; } body { padding: 0; } }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="title">${currentStore.name}</div>
            <div class="meta">Streetwear Fulfillment & Dispatch Clearinghouse</div>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: 800; font-size: 18px;">INVOICE</div>
            <div class="meta"><b>PO:</b> ${order.orderNumber}</div>
            <div class="meta"><b>Date:</b> ${new Date(order.createdAt).toLocaleString()}</div>
          </div>
        </div>

        <div class="grid">
          <div class="box">
            <div class="box-title">Bill & Ship To</div>
            <div style="font-weight: 700; font-size: 14px;">${order.customerName}</div>
            <div>Phone: ${order.customerPhone}</div>
            <div>${order.shippingAddress}</div>
            <div>${order.thana ? order.thana + ', ' : ''}${order.district || order.city}</div>
          </div>
          <div class="box">
            <div class="box-title">Order Logistics & Payment</div>
            <div>Payment Method: <b>${order.paymentMethod}</b></div>
            <div>Payment Status: <b>${order.paymentStatus}</b></div>
            <div>Operational Status: <b>${order.status}</b></div>
            ${order.specialNote ? `<div style="margin-top:6px; color:#b91c1c;"><b>Note:</b> "${order.specialNote}"</div>` : ''}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th>Item & Specification</th>
              <th>SKU</th>
              <th style="text-align: center;">Qty</th>
              <th style="text-align: right;">Unit Price</th>
              <th style="text-align: right;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${(order.items || []).map((it) => `
              <tr>
                <td><b>${it.productTitle}</b></td>
                <td style="font-family: monospace;">${it.sku}</td>
                <td style="text-align: center;">${it.quantity}</td>
                <td style="text-align: right;">৳${it.unitPrice.toLocaleString()}</td>
                <td style="text-align: right; font-weight: 700;">৳${it.totalPrice.toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-row"><span>Subtotal:</span> <span>৳${order.subtotal.toLocaleString()}</span></div>
          <div class="totals-row"><span>Delivery Fee:</span> <span>৳${order.shippingFee.toLocaleString()}</span></div>
          ${order.discountAmount > 0 ? `<div class="totals-row" style="color: #10b981;"><span>Discount:</span> <span>-৳${order.discountAmount.toLocaleString()}</span></div>` : ''}
          <div class="totals-row"><span>Paid Amount:</span> <span>৳${order.paidAmount.toLocaleString()}</span></div>
          <div class="totals-row totals-due"><span>Balance Due (COD):</span> <span>৳${order.dueAmount.toLocaleString()}</span></div>
        </div>

        <div class="footer">
          <p>Thank you for choosing ${currentStore.name}. Keep this receipt for warranty and hassle-free returns.</p>
        </div>
        <script>window.onload = function() { window.print(); };</script>
      </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Format phone to Bangladesh international dialing format for WhatsApp
  const getWhatsAppLink = (phone: string, orderNumber: string) => {
    let clean = (phone || '').replace(/\D/g, '');
    if (clean.startsWith('01') && clean.length === 11) {
      clean = '88' + clean;
    }
    const message = encodeURIComponent(`Hello! We are contacting you from ${currentStore.name} regarding your Order #${orderNumber}.`);
    return `https://wa.me/${clean}?text=${message}`;
  };

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* Top Header & Workstation Switcher */}
      <div
        style={{
          marginBottom: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h1
            style={{
              fontSize: '1.4rem',
              fontWeight: 800,
              color: 'var(--text-main)',
              letterSpacing: '-0.02em',
              margin: 0,
            }}
          >
            Orders Queue & Clearinghouse
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
            12-State Transactional State Machine & Logistics Dispatch for <b>{currentStore.name}</b>
          </p>
        </div>

        {/* View Mode Buttons */}
        <div
          style={{
            display: 'flex',
            background: 'var(--surface-muted, #f1f5f9)',
            padding: '3px',
            borderRadius: '8px',
            gap: '4px',
          }}
        >
          <button
            onClick={() => setSubTab('orders')}
            className={`btn btn-sm ${subTab === 'orders' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
          >
            <ShoppingBag size={14} />
            <span>Orders Queue</span>
          </button>

          <button
            onClick={() => setSubTab('fulfillment')}
            className={`btn btn-sm ${subTab === 'fulfillment' ? 'btn-primary' : 'btn-secondary'}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontWeight: 700,
              background: subTab === 'fulfillment' ? '#0d9488' : undefined,
            }}
          >
            <Zap size={14} color={subTab === 'fulfillment' ? '#fde047' : '#0d9488'} />
            <span>⚡ Warehouse Queue</span>
          </button>

          <button
            onClick={() => setSubTab('abandoned')}
            className={`btn btn-sm ${subTab === 'abandoned' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
          >
            <PhoneCall size={14} color={subTab === 'abandoned' ? '#fff' : '#0d9488'} />
            <span>Tele-Sales Recovery</span>
          </button>
        </div>
      </div>

      {/* Success Notification Banner */}
      {actionSuccess && (
        <div
          style={{
            background: '#ecfdf5',
            border: '1px solid #10b981',
            color: '#065f46',
            padding: '10px 14px',
            borderRadius: '6px',
            marginBottom: '14px',
            fontSize: '0.85rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle size={16} color="#10b981" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* SUBTAB 1: ORDERS QUEUE (12-STATE WIREFRAME IMPLEMENTATION) */}
      {subTab === 'orders' && (
        <div>
          {/* Section A: Full-Width Status Bar with Live Badge Counters (Cover in one page width, no scroll) */}
          <div className="orders-status-bar">
            {OPERATIONAL_QUEUES.map((q) => {
              const count = statusCounts[q.key] ?? 0;
              const isActive = orderFilter === q.key;
              return (
                <button
                  key={q.key}
                  type="button"
                  onClick={() => setOrderFilter(q.key)}
                  title={`${q.label} (${count})`}
                  className={`orders-status-pill ${isActive ? 'active' : ''}`}
                  style={{
                    border: isActive ? `1.5px solid ${q.badgeColor}` : '1px solid var(--border, #e2e8f0)',
                    background: isActive ? q.badgeColor : 'var(--bg-surface, #ffffff)',
                    color: isActive ? '#ffffff' : 'var(--text-main, #1e293b)',
                    boxShadow: isActive ? '0 2px 4px rgba(0,0,0,0.12)' : 'none',
                    fontWeight: isActive ? 700 : 500,
                  }}
                >
                  <span className="orders-status-label-full">{q.label}</span>
                  <span className="orders-status-label-short">{q.shortLabel}</span>
                  <span
                    className="orders-status-count"
                    style={{
                      background: isActive ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.06)',
                      color: isActive ? '#ffffff' : 'var(--text-muted, #64748b)',
                    }}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search & Refresh Controls */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '16px',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '420px' }}>
              <div style={{ position: 'relative', width: '100%' }}>
                <Search
                  size={14}
                  style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
                />
                <input
                  type="text"
                  placeholder="Search order #, customer, phone, Steadfast ID..."
                  value={orderSearch}
                  onChange={(e) => setOrderSearch(e.target.value)}
                  className="form-control"
                  style={{
                    paddingLeft: '32px',
                    fontSize: '0.82rem',
                    borderRadius: '8px',
                    width: '100%',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={loadOrders} className="btn btn-sm btn-secondary" title="Refresh Orders">
                <RotateCcw size={13} />
                <span style={{ marginLeft: '4px' }}>Sync Queue</span>
              </button>
            </div>
          </div>

          {/* Section B: Structural Order Cards Matching Wireframe */}
          {ordersLoading ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading operational orders queue...
            </div>
          ) : ordersError ? (
            <div className="card" style={{ padding: '24px', textAlign: 'center', color: '#dc2626' }}>
              {ordersError}
            </div>
          ) : orders.length === 0 ? (
            <div className="card" style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No orders found in <b>{orderFilter}</b> queue.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {orders.map((order) => {
                const totalItemsCount = (order.items || []).reduce((acc, it) => acc + (it.quantity || 1), 0);
                const hasMultiImages = (order.items || []).length > 1;
                const courierRatio = order.courier_delivery_ratio || 88;
                const riskLevel = order.courier_risk_level || (courierRatio >= 80 ? 'LOW' : courierRatio >= 60 ? 'MEDIUM' : 'HIGH');
                const isUrgent = order.is_urgent || order.totalAmount > 2500;
                const isDhaka = (order.city || order.district || '').toLowerCase().includes('dhaka');

                return (
                  <div
                    key={order.id}
                    className="card"
                    style={{
                      padding: '16px',
                      borderRadius: '10px',
                      border: isUrgent ? '1.5px solid #f59e0b' : '1px solid var(--border-color, #e2e8f0)',
                      background: 'var(--surface-card, #ffffff)',
                      boxShadow: isUrgent ? '0 0 12px rgba(245, 158, 11, 0.12)' : '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                  >
                    {/* Top Row: PO Number, Urgent Flag, Date */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        borderBottom: '1px solid var(--border-color, #f1f5f9)',
                        paddingBottom: '10px',
                        marginBottom: '12px',
                        flexWrap: 'wrap',
                        gap: '8px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 800, fontSize: '0.95rem' }}>
                          PO: {order.orderNumber}
                        </span>

                        {isUrgent && (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                              background: '#fef3c7',
                              color: '#b45309',
                              border: '1px solid #fcd34d',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: 800,
                              fontSize: '0.72rem',
                            }}
                          >
                            <Zap size={11} fill="#b45309" />
                            <span>URGENT</span>
                          </span>
                        )}

                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {new Date(order.createdAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      {/* State Machine Transition Selector */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>Status:</span>
                        <select
                          value={order.status}
                          disabled={updatingStatusId === order.id}
                          onChange={(e) => handleTransitionStatus(order.id, e.target.value as OrderStatus)}
                          style={{
                            fontSize: '0.75rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color, #cbd5e1)',
                            background: 'var(--surface-muted, #f8fafc)',
                            color: 'var(--text-main)',
                            cursor: 'pointer',
                          }}
                        >
                          {OPERATIONAL_QUEUES.filter((q) => q.key !== 'ALL').map((q) => (
                            <option key={q.key} value={q.key}>
                              {q.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Middle Section: Wireframe Columns */}
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
                      {/* Left: 1:1 Product Thumbnail or 2-Grid */}
                      <div
                        style={{
                          width: '84px',
                          height: '84px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          background: '#f1f5f9',
                          flexShrink: 0,
                          border: '1px solid #e2e8f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {hasMultiImages ? (
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', width: '100%', height: '100%', gap: '1px' }}>
                            {order.items.slice(0, 2).map((it, idx) => (
                              <div
                                key={idx}
                                style={{
                                  background: it.productImage ? `url(${it.productImage}) center/cover no-repeat` : '#e2e8f0',
                                  width: '100%',
                                  height: '100%',
                                }}
                              />
                            ))}
                          </div>
                        ) : order.items[0]?.productImage ? (
                          <img
                            src={order.items[0].productImage}
                            alt={order.items[0].productTitle}
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          <Package size={28} color="#94a3b8" />
                        )}
                      </div>

                      {/* Center Column: Customer, Phone & Call Trigger */}
                      <div style={{ flex: 1, minWidth: '220px' }}>
                        <div style={{ fontWeight: 800, fontSize: '0.92rem', color: 'var(--text-main)' }}>
                          {order.customerName}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                          <span style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                            {order.customerPhone || 'No Phone'}
                          </span>
                          {order.customerPhone && (
                            <a
                              href={`tel:${order.customerPhone}`}
                              title="Call customer via phone trigger"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '22px',
                                height: '22px',
                                borderRadius: '50%',
                                background: '#dcfce7',
                                color: '#15803d',
                                textDecoration: 'none',
                              }}
                            >
                              <Phone size={11} />
                            </a>
                          )}
                        </div>

                        {/* Operational Status Tags */}
                        <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              background: '#eff6ff',
                              color: '#1d4ed8',
                              padding: '2px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            [{order.status}]
                          </span>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 800,
                              background: order.paymentStatus === 'PAID' ? '#dcfce7' : '#fee2e2',
                              color: order.paymentStatus === 'PAID' ? '#15803d' : '#b91c1c',
                              padding: '2px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            [{order.paymentStatus}]
                          </span>
                          <span
                            style={{
                              fontSize: '0.68rem',
                              fontWeight: 700,
                              background: '#f1f5f9',
                              color: '#475569',
                              padding: '2px 6px',
                              borderRadius: '4px',
                            }}
                          >
                            [{order.paymentMethod || 'Web Order'}]
                          </span>
                        </div>
                      </div>

                      {/* Right Column: Financial Ledger Balance & Items Volume */}
                      <div
                        style={{
                          textAlign: 'right',
                          minWidth: '180px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'center',
                        }}
                      >
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {totalItemsCount} item{totalItemsCount > 1 ? 's' : ''} &bull; Total: <b>৳{order.totalAmount.toLocaleString()}</b>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px' }}>
                          Paid: ৳{order.paidAmount.toLocaleString()}
                        </div>
                        <div
                          style={{
                            fontSize: '0.98rem',
                            fontWeight: 800,
                            color: order.dueAmount > 0 ? '#b91c1c' : '#15803d',
                            fontFamily: 'var(--font-mono)',
                            marginTop: '2px',
                          }}
                        >
                          Due (COD): ৳{order.dueAmount.toLocaleString()}
                        </div>
                      </div>
                    </div>

                    {/* Section C: Courier Risk Profile Badge */}
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '6px 12px',
                        background: riskLevel === 'LOW' ? '#f0fdf4' : riskLevel === 'MEDIUM' ? '#fffbeb' : '#fef2f2',
                        border: `1px solid ${riskLevel === 'LOW' ? '#bbf7d0' : riskLevel === 'MEDIUM' ? '#fde68a' : '#fecaca'}`,
                        borderRadius: '6px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '6px',
                        fontSize: '0.75rem',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        {riskLevel === 'LOW' ? (
                          <ShieldCheck size={14} color="#15803d" />
                        ) : riskLevel === 'MEDIUM' ? (
                          <Shield size={14} color="#b45309" />
                        ) : (
                          <ShieldAlert size={14} color="#b91c1c" />
                        )}
                        <span style={{ fontWeight: 700, color: riskLevel === 'LOW' ? '#15803d' : riskLevel === 'MEDIUM' ? '#b45309' : '#b91c1c' }}>
                          COURIER RISK: {courierRatio}% SUCCESS
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>
                          ({Math.round((courierRatio / 100) * 25)} Delivered / {25 - Math.round((courierRatio / 100) * 25)} Returned)
                        </span>
                      </div>

                      <span
                        style={{
                          fontWeight: 800,
                          padding: '1px 6px',
                          borderRadius: '3px',
                          background: riskLevel === 'LOW' ? '#dcfce7' : riskLevel === 'MEDIUM' ? '#fef3c7' : '#fee2e2',
                          color: riskLevel === 'LOW' ? '#15803d' : riskLevel === 'MEDIUM' ? '#b45309' : '#b91c1c',
                        }}
                      >
                        [{riskLevel} RISK]
                      </span>
                    </div>

                    {/* Optional Customer Special Note */}
                    {order.specialNote && (
                      <div
                        style={{
                          marginTop: '8px',
                          padding: '6px 10px',
                          background: '#fffbeb',
                          border: '1px dashed #f59e0b',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          color: '#92400e',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px',
                        }}
                      >
                        <MessageSquare size={13} color="#d97706" />
                        <span>
                          <b>Customer Note:</b> &ldquo;{order.specialNote}&rdquo;
                        </span>
                      </div>
                    )}

                    {/* Location Zone Indicator */}
                    <div
                      style={{
                        marginTop: '8px',
                        fontSize: '0.75rem',
                        color: 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <MapPin size={13} color="#64748b" />
                      <span>
                        Location: <b>{isDhaka ? 'Inside Dhaka (Home Delivery)' : 'Outside Dhaka (Express Hub)'}</b> &bull;{' '}
                        {order.shippingAddress}, {order.thana ? order.thana + ', ' : ''}{order.district || order.city}
                      </span>
                    </div>

                    {/* 1-Click Courier Booking Dispatch Dock */}
                    <div
                      style={{
                        marginTop: '12px',
                        display: 'flex',
                        gap: '8px',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        paddingTop: '8px',
                        borderTop: '1px solid var(--border-color, #f1f5f9)',
                      }}
                    >
                      <button
                        onClick={() => handleShipSteadfast(order)}
                        disabled={dispatchingId === order.id}
                        className="btn btn-sm btn-primary"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: '#0d9488',
                          fontWeight: 700,
                          fontSize: '0.75rem',
                          padding: '5px 12px',
                        }}
                      >
                        <Truck size={13} />
                        <span>
                          {dispatchingId === order.id
                            ? 'Booking API...'
                            : order.consignmentId
                            ? `Steadfast (${order.consignmentId})`
                            : '🚗 Ship Parcel (Steadfast API)'}
                        </span>
                      </button>

                      {order.trackingNumber && (
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontFamily: 'var(--font-mono)',
                            color: '#0d9488',
                            fontWeight: 700,
                            background: '#ccfbf1',
                            padding: '3px 8px',
                            borderRadius: '4px',
                          }}
                        >
                          Tracking: {order.trackingNumber}
                        </span>
                      )}
                    </div>

                    {/* Inline Staff Call Notes Input */}
                    <div style={{ marginTop: '10px' }}>
                      {order.callNotes && order.callNotes.length > 0 && (
                        <div style={{ marginBottom: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          {order.callNotes.slice(-2).map((cn, idx) => (
                            <div
                              key={idx}
                              style={{
                                fontSize: '0.72rem',
                                color: '#475569',
                                background: '#f8fafc',
                                padding: '3px 8px',
                                borderRadius: '4px',
                                borderLeft: '3px solid #cbd5e1',
                              }}
                            >
                              <b>{cn.staffName}:</b> {cn.note}{' '}
                              <span style={{ color: '#94a3b8', fontSize: '0.68rem' }}>
                                ({new Date(cn.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '6px' }}>
                        <input
                          type="text"
                          placeholder="+ Add call note / delivery instruction..."
                          value={noteInputs[order.id] || ''}
                          onChange={(e) => setNoteInputs({ ...noteInputs, [order.id]: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleAddCallNote(order.id);
                          }}
                          style={{
                            flex: 1,
                            fontSize: '0.76rem',
                            padding: '5px 10px',
                            borderRadius: '6px',
                            border: '1px solid var(--border-color, #cbd5e1)',
                            background: 'var(--surface-muted, #f8fafc)',
                          }}
                        />
                        <button
                          onClick={() => handleAddCallNote(order.id)}
                          disabled={submittingNoteId === order.id}
                          className="btn btn-sm btn-secondary"
                          style={{ fontSize: '0.72rem', padding: '4px 10px', fontWeight: 600 }}
                        >
                          <Send size={11} style={{ marginRight: '4px' }} />
                          <span>Save</span>
                        </button>
                      </div>
                    </div>

                    {/* Bottom Action Dock: View / Edit Order, Print Invoice, WhatsApp Chat */}
                    <div
                      style={{
                        marginTop: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '8px',
                        paddingTop: '8px',
                        borderTop: '1px solid var(--border-color, #f1f5f9)',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => setSelectedOrder(order)}
                          className="btn btn-sm btn-secondary"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem' }}
                        >
                          <Eye size={12} />
                          <span>👁 View / Edit Order</span>
                        </button>

                        <button
                          onClick={() => handlePrintInvoice(order)}
                          className="btn btn-sm btn-secondary"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '0.74rem' }}
                        >
                          <Printer size={12} />
                          <span>🖨 Print Invoice</span>
                        </button>
                      </div>

                      {order.customerPhone && (
                        <a
                          href={getWhatsAppLink(order.customerPhone, order.orderNumber)}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-sm"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            fontSize: '0.74rem',
                            background: '#25D366',
                            color: '#ffffff',
                            fontWeight: 700,
                            textDecoration: 'none',
                          }}
                        >
                          <MessageSquare size={12} fill="#ffffff" />
                          <span>WhatsApp Chat</span>
                        </a>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SUBTAB 2: WAREHOUSE FULFILLMENT QUEUE */}
      {subTab === 'fulfillment' && (
        <div>
          {/* OrderPulse KPI Metrics */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            <div className="card" style={{ padding: '14px', borderLeft: '4px solid #0d9488' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Active Dispatch Queue</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px' }}>{queueSummary.total_queue_count}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>Awaiting Picking & Dispatch</div>
            </div>

            <div className="card" style={{ padding: '14px', borderLeft: '4px solid #ef4444' }}>
              <div style={{ fontSize: '0.75rem', color: '#b91c1c', fontWeight: 600 }}>⚡ Urgent Orders (&gt;2,500 TK)</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px', color: '#b91c1c' }}>
                {queueSummary.urgent_count}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#b91c1c', marginTop: '2px' }}>Tier 1 Preemption Priority</div>
            </div>

            <div className="card" style={{ padding: '14px', borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '0.75rem', color: '#047857', fontWeight: 600 }}>Packed & Ready</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px', color: '#047857' }}>
                {queueSummary.ready_to_ship_count}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>At Courier Dock</div>
            </div>

            <div className="card" style={{ padding: '14px', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 600 }}>Pending Thermal Print</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px', color: '#b45309' }}>
                {queueSummary.print_pending_count}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>Need Packing Slips</div>
            </div>

            <div className="card" style={{ padding: '14px', borderLeft: '4px solid #dc2626' }}>
              <div style={{ fontSize: '0.75rem', color: '#991b1b', fontWeight: 600 }}>OrderPulse Alerts (&gt;24h)</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px', color: '#991b1b' }}>
                {queueSummary.delayed_alert_count}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#991b1b', marginTop: '2px' }}>Hub Bottleneck Warnings</div>
            </div>
          </div>

          {/* Controls Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
              flexWrap: 'wrap',
              gap: '8px',
            }}
          >
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => setUrgentOnly(!urgentOnly)}
                className={`btn btn-sm ${urgentOnly ? 'btn-danger' : 'btn-secondary'}`}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
              >
                <Zap size={13} />
                <span>{urgentOnly ? 'Showing Urgent Only' : 'Filter Urgent Orders'}</span>
              </button>
            </div>

            <button onClick={loadQueue} className="btn btn-sm btn-secondary" title="Refresh Queue">
              <RotateCcw size={13} />
            </button>
          </div>

          {/* Queue Table */}
          <div className="card" style={{ padding: 0 }}>
            {queueLoading ? (
              <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading Warehouse Fulfillment Queue...
              </div>
            ) : queueError ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#dc2626' }}>{queueError}</div>
            ) : queueItems.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No orders pending fulfillment.
              </div>
            ) : (
              <div className="table-container" style={{ border: 'none' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Customer & Address</th>
                      <th>Total & Due</th>
                      <th>Aging & Bottleneck</th>
                      <th>Thermal Slip</th>
                      <th>Dock Handover</th>
                      <th style={{ textAlign: 'right' }}>Dispatch</th>
                    </tr>
                  </thead>
                  <tbody>
                    {queueItems.map(({ order, aging_hours, aging_tier, is_delayed_hub_alert }) => (
                      <tr key={order.id}>
                        <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                          <div>{order.orderNumber}</div>
                          {order.is_urgent && (
                            <span style={{ fontSize: '0.65rem', color: '#dc2626', fontWeight: 800 }}>⚡ URGENT</span>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{order.customerName}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{order.city}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>
                            {formatMoney(currentStore.currency, order.totalAmount)}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: '#b91c1c' }}>
                            COD Due: {formatMoney(currentStore.currency, order.dueAmount)}
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Clock size={12} color={is_delayed_hub_alert ? '#ef4444' : '#10b981'} />
                            <span style={{ fontWeight: 700, fontSize: '0.8rem' }}>{aging_hours.toFixed(1)}h</span>
                          </div>
                          {is_delayed_hub_alert && (
                            <span
                              style={{
                                fontSize: '0.65rem',
                                fontWeight: 800,
                                color: '#dc2626',
                                background: '#fee2e2',
                                padding: '1px 4px',
                                borderRadius: '3px',
                              }}
                            >
                              ⚠ {aging_tier}
                            </span>
                          )}
                        </td>
                        <td>
                          <button
                            onClick={async () => {
                              await updateFulfillmentFlags(order.id, { is_print_ready: !order.is_print_ready });
                              loadQueue();
                            }}
                            className={`btn btn-sm ${order.is_print_ready ? 'btn-success' : 'btn-secondary'}`}
                            style={{ fontSize: '0.7rem', padding: '3px 8px' }}
                          >
                            <Printer size={12} style={{ marginRight: '3px' }} />
                            <span>{order.is_print_ready ? 'Printed ✓' : 'Print Slip'}</span>
                          </button>
                        </td>
                        <td>
                          <button
                            onClick={async () => {
                              await updateFulfillmentFlags(order.id, { is_ready: !order.is_ready });
                              loadQueue();
                            }}
                            className={`btn btn-sm ${order.is_ready ? 'btn-success' : 'btn-secondary'}`}
                            style={{ fontSize: '0.7rem', padding: '3px 8px' }}
                          >
                            <CheckCircle size={12} style={{ marginRight: '3px' }} />
                            <span>{order.is_ready ? 'Ready ✓' : 'Packing...'}</span>
                          </button>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            onClick={async () => {
                              await updateOrderStatus(order.id, 'SHIPPED', 'Dispatched to Steadfast Courier dock collection');
                              showToast(`Order #${order.orderNumber} dispatched!`);
                              loadQueue();
                            }}
                            className="btn btn-sm btn-primary"
                            style={{ background: '#0d9488', fontWeight: 700, fontSize: '0.72rem' }}
                          >
                            <Truck size={12} style={{ marginRight: '4px' }} />
                            <span>Dispatch</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUBTAB 3: ABANDONED CHECKOUT RECOVERY */}
      {subTab === 'abandoned' && (
        <AbandonedRecoveryView
          currentStore={currentStore}
          onOrderCreated={() => {
            loadQueue();
            loadOrders();
          }}
        />
      )}

      {/* DRAWER / MODAL: VIEW & EDIT ORDER */}
      {selectedOrder && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            zIndex: 1000,
            display: 'flex',
            justifyContent: 'flex-end',
          }}
          onClick={() => setSelectedOrder(null)}
        >
          <div
            style={{
              width: '100%',
              maxWidth: '560px',
              height: '100%',
              background: 'var(--surface-card, #ffffff)',
              boxShadow: '-4px 0 24px rgba(0,0,0,0.2)',
              overflowY: 'auto',
              padding: '24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '14px' }}>
              <div>
                <h2 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>
                  Order Details &bull; {selectedOrder.orderNumber}
                </h2>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                  Created on {new Date(selectedOrder.createdAt).toLocaleString()}
                </div>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Customer Details Box */}
            <div className="card" style={{ padding: '14px', background: '#f8fafc' }}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', marginBottom: '8px' }}>
                Customer & Shipping
              </div>
              <div style={{ fontWeight: 700, fontSize: '0.95rem' }}>{selectedOrder.customerName}</div>
              <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '2px' }}>
                Phone: <b>{selectedOrder.customerPhone}</b>
              </div>
              {selectedOrder.customerEmail && (
                <div style={{ fontSize: '0.82rem', color: '#475569' }}>
                  Email: {selectedOrder.customerEmail}
                </div>
              )}
              <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '6px' }}>
                Address: {selectedOrder.shippingAddress}, {selectedOrder.thana ? selectedOrder.thana + ', ' : ''}{selectedOrder.district || selectedOrder.city}
              </div>
            </div>

            {/* Line Items */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: 700, marginBottom: '8px' }}>
                Order Items ({selectedOrder.items?.length || 0})
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(selectedOrder.items || []).map((it, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      gap: '12px',
                      alignItems: 'center',
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid #e2e8f0',
                      background: '#ffffff',
                    }}
                  >
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '6px',
                        background: it.productImage ? `url(${it.productImage}) center/cover no-repeat` : '#f1f5f9',
                        flexShrink: 0,
                      }}
                    />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{it.productTitle}</div>
                      <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>SKU: {it.sku}</div>
                      <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                        Qty: <b>{it.quantity}</b> &times; ৳{it.unitPrice.toLocaleString()}
                      </div>
                    </div>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', fontFamily: 'monospace' }}>
                      ৳{it.totalPrice.toLocaleString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Ledger Breakdown */}
            <div className="card" style={{ padding: '14px', background: '#f8fafc' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                <span>Subtotal:</span>
                <span>৳{selectedOrder.subtotal.toLocaleString()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                <span>Shipping Fee:</span>
                <span>৳{selectedOrder.shippingFee.toLocaleString()}</span>
              </div>
              {selectedOrder.discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px', color: '#10b981' }}>
                  <span>Discount:</span>
                  <span>-৳{selectedOrder.discountAmount.toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '6px' }}>
                <span>Paid Amount:</span>
                <span>৳{selectedOrder.paidAmount.toLocaleString()}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '1rem',
                  fontWeight: 800,
                  borderTop: '1px solid #cbd5e1',
                  paddingTop: '8px',
                  marginTop: '8px',
                  color: selectedOrder.dueAmount > 0 ? '#b91c1c' : '#15803d',
                }}
              >
                <span>Balance Due (COD):</span>
                <span>৳{selectedOrder.dueAmount.toLocaleString()}</span>
              </div>
            </div>

            {/* Bottom Actions in Drawer */}
            <div style={{ display: 'flex', gap: '10px', marginTop: 'auto' }}>
              <button
                onClick={() => handlePrintInvoice(selectedOrder)}
                className="btn btn-secondary"
                style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Printer size={14} />
                <span>Print Invoice</span>
              </button>
              <button
                onClick={() => handleShipSteadfast(selectedOrder)}
                className="btn btn-primary"
                style={{ flex: 1, background: '#0d9488', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
              >
                <Truck size={14} />
                <span>Ship Steadfast</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
