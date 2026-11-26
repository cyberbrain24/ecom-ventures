import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clock,
  Eye,
  MapPin,
  Package,
  Phone,
  Printer,
  RefreshCw,
  Search,
  Send,
  Truck,
  Zap,
} from 'lucide-react';
import { FulfillmentQueueItem, StoreBrand, StoreOrder } from '../types/store';
import {
  dispatchOrderCourier,
  fetchFulfillmentQueue,
  syncCouriers,
  updateFulfillmentFlags,
} from '../lib/orders-api';
import { formatMoney } from '../lib/format';

interface FulfillmentQueueViewProps {
  currentStore: StoreBrand;
  onInspectOrder?: (order: StoreOrder) => void;
}

const ISSUE_OPTIONS = [
  { value: 'NONE', label: 'None' },
  { value: 'STOCK_OUT', label: 'Stock Out' },
  { value: 'PRINT_ISSUES', label: 'Print Issues' },
  { value: 'COURIER_ISSUES', label: 'Courier Issues' },
  { value: 'OTHERS', label: 'Others' },
];

function getOrderLocationZone(order: StoreOrder): string {
  const district = (order.district || order.city || '').trim().toLowerCase();
  const thana = (order.thana || '').trim().toLowerCase();
  if (!district && !thana) return 'Zone Unassigned';
  if (district.includes('dhaka')) {
    if (
      thana.includes('savar') ||
      thana.includes('keraniganj') ||
      thana.includes('dhamrai') ||
      thana.includes('nawabganj') ||
      thana.includes('dohar') ||
      thana.includes('gazipur') ||
      thana.includes('narayanganj')
    ) {
      return `Dhaka Suburbs (${order.thana || order.district})`;
    }
    return `Inside Dhaka (${order.thana || order.district || 'Zone 1'})`;
  }
  return `Outside Dhaka (${order.district || order.city || 'Zone 2'})`;
}

function formatDhakaTime(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Dhaka',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export const FulfillmentQueueView: React.FC<FulfillmentQueueViewProps> = ({
  currentStore,
  onInspectOrder,
}) => {
  const [queueItems, setQueueItems] = useState<FulfillmentQueueItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Filters
  const [inReviewOnly, setInReviewOnly] = useState<boolean>(false);
  const [urgentOnly, setUrgentOnly] = useState<boolean>(false);
  const [searchInput, setSearchInput] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Selection & Operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [syncingCouriers, setSyncingCouriers] = useState<boolean>(false);
  const [bulkDispatching, setBulkDispatching] = useState<boolean>(false);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchFulfillmentQueue(
        urgentOnly,
        1,
        100,
        inReviewOnly ? 'REVIEW' : '',
        searchTerm,
      );
      setQueueItems(res.items || []);
    } catch (err: any) {
      setError(err?.detail || err?.message || 'Failed to load fulfillment queue.');
    } finally {
      setLoading(false);
    }
  }, [urgentOnly, inReviewOnly, searchTerm]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  // Priority Sort: Urgent First, then oldest first
  const sortedQueue = useMemo(() => {
    return [...queueItems].sort((a, b) => {
      if (Boolean(b.order.is_urgent) !== Boolean(a.order.is_urgent)) {
        return b.order.is_urgent ? 1 : -1;
      }
      return new Date(a.order.createdAt).getTime() - new Date(b.order.createdAt).getTime();
    });
  }, [queueItems]);

  // Real-time Summary Counters
  const counters = useMemo(() => {
    let urgent = 0;
    let ready = 0;
    let notReady = 0;
    let delayedReview = 0;

    sortedQueue.forEach(({ order, is_delayed_hub_alert }) => {
      if (order.is_urgent) urgent++;
      if (order.is_ready) ready++;
      else notReady++;
      const hasDelayNote = (order.callNotes || []).some((n) =>
        n.note.toLowerCase().includes('delay'),
      );
      if (order.status === 'REVIEW' && (is_delayed_hub_alert || hasDelayNote)) {
        delayedReview++;
      }
    });

    return {
      total: sortedQueue.length,
      urgent,
      ready,
      notReady,
      delayedReview,
    };
  }, [sortedQueue]);

  const handleToggleFlag = async (
    order: StoreOrder,
    patch: { is_ready?: boolean; is_print_ready?: boolean; issue_status?: string },
  ) => {
    setUpdatingOrderId(order.id);
    // Optimistic update
    setQueueItems((prev) =>
      prev.map((item) =>
        item.order.id === order.id ? { ...item, order: { ...item.order, ...patch } } : item,
      ),
    );
    try {
      await updateFulfillmentFlags(order.id, patch);
    } catch (err: any) {
      showToast(err?.detail || err?.message || 'Failed to update fulfillment status');
      await loadQueue();
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleDispatchSingle = async (order: StoreOrder) => {
    setUpdatingOrderId(order.id);
    try {
      await dispatchOrderCourier(order.id, 'STEADFAST');
      showToast(`Dispatched ${order.orderNumber} to Steadfast`);
      await loadQueue();
    } catch (err: any) {
      showToast(err?.detail || err?.message || `Dispatch failed for ${order.orderNumber}`);
    } finally {
      setUpdatingOrderId(null);
    }
  };

  const handleBulkDispatch = async () => {
    if (selectedIds.size === 0) return;
    setBulkDispatching(true);
    let ok = 0;
    let fail = 0;
    for (const orderId of Array.from(selectedIds)) {
      try {
        await dispatchOrderCourier(orderId, 'STEADFAST');
        ok++;
      } catch {
        fail++;
      }
    }
    setBulkDispatching(false);
    setSelectedIds(new Set());
    showToast(`Bulk dispatch complete: ${ok} sent${fail > 0 ? `, ${fail} failed` : ''}`);
    await loadQueue();
  };

  const handleSyncCouriers = async () => {
    setSyncingCouriers(true);
    try {
      const res = await syncCouriers();
      showToast(`Synced ${res.synced_count} parcels (${res.updated_count} updated)`);
      await loadQueue();
    } catch (err: any) {
      showToast(err?.detail || err?.message || 'Courier sync failed');
    } finally {
      setSyncingCouriers(false);
    }
  };

  const handlePrintPackList = (ordersToPrint: StoreOrder[]) => {
    if (ordersToPrint.length === 0) return;
    const win = window.open('', '_blank', 'width=860,height=900');
    if (!win) {
      showToast('Please allow pop-ups to print the packing list.');
      return;
    }

    const slipsHtml = ordersToPrint
      .map(
        (order) => `
      <div class="slip">
        <div class="slip-header">
          <div>
            <h2>${currentStore.name.toUpperCase()} DISPATCH PACK LIST</h2>
            <p class="meta">Order #${order.orderNumber} • ${formatDhakaTime(order.createdAt)}</p>
          </div>
          <div class="zone">${getOrderLocationZone(order)}</div>
        </div>
        <div class="recipient">
          <div><strong>Recipient:</strong> ${order.customerName} (${order.customerPhone})</div>
          <div><strong>Address:</strong> ${order.shippingAddress || 'N/A'}${order.thana ? `, ${order.thana}` : ''}${order.district ? `, ${order.district}` : ''}</div>
          ${order.specialNote ? `<div class="note"><strong>Customer Note:</strong> ${order.specialNote}</div>` : ''}
        </div>
        <table>
          <thead>
            <tr>
              <th style="width:36px;">Pack</th>
              <th>SKU</th>
              <th>Item &amp; Variation</th>
              <th style="text-align:right;">Qty</th>
            </tr>
          </thead>
          <tbody>
            ${(order.items || [])
              .map(
                (it) => `
              <tr>
                <td style="text-align:center;">&#9744;</td>
                <td class="mono">${it.sku || '-'}</td>
                <td>${it.productTitle}${it.variantTitle ? ` (${it.variantTitle})` : ''}</td>
                <td style="text-align:right;font-weight:700;">x${it.quantity}</td>
              </tr>`,
              )
              .join('')}
          </tbody>
        </table>
      </div>`,
      )
      .join('');

    win.document.write(`<!doctype html>
<html>
<head>
  <title>${currentStore.name} - Dispatch Pack List</title>
  <style>
    body { font-family: Arial, sans-serif; color: #000; margin: 20px; }
    .slip { border: 1.5px solid #000; padding: 14px; margin-bottom: 18px; page-break-inside: avoid; }
    .slip-header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #000; padding-bottom: 8px; margin-bottom: 10px; }
    h2 { margin: 0; font-size: 15px; letter-spacing: 0.04em; }
    .meta { margin: 3px 0 0 0; font-size: 12px; }
    .zone { border: 1px solid #000; padding: 3px 8px; font-size: 11px; font-weight: 700; }
    .recipient { font-size: 12px; line-height: 1.5; margin-bottom: 10px; }
    .note { margin-top: 4px; padding: 4px 6px; border: 1px dashed #000; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #000; padding: 6px 8px; text-align: left; }
    th { background: #f3f4f6; }
    .mono { font-family: monospace; }
    @media print { body { margin: 8px; } }
  </style>
</head>
<body>
  ${slipsHtml}
  <script>window.onload = function() { window.print(); };</script>
</body>
</html>`);
    win.document.close();
  };

  const toggleSelectOrder = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedOrders = useMemo(
    () => sortedQueue.filter((i) => selectedIds.has(i.order.id)).map((i) => i.order),
    [sortedQueue, selectedIds],
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* Header + Summary Bar */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Package size={20} color="#0F766E" />
            <div>
              <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0F172A' }}>
                Order Fulfillment <span style={{ color: '#64748B', fontWeight: 500 }}>({counters.total})</span>
              </h2>
              <p style={{ margin: '2px 0 0 0', fontSize: '12px', color: '#64748B' }}>
                Pack &amp; prepare orders before courier handover
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <CounterPill icon={<Zap size={13} />} label="URGENT" count={counters.urgent} tone="danger" />
            <CounterPill icon={<Package size={13} />} label="READY" count={counters.ready} tone="success" />
            <CounterPill icon={<Clock size={13} />} label="NOT READY" count={counters.notReady} tone="neutral" />
            <CounterPill icon={<AlertTriangle size={13} />} label="DELAYED REVIEW" count={counters.delayedReview} tone="warning" />
          </div>
        </div>

        {/* Filter Bar */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px', flex: 1 }}>
            <button
              type="button"
              onClick={() => setInReviewOnly((v) => !v)}
              className={`btn btn-sm ${inReviewOnly ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontWeight: 600 }}
            >
              {inReviewOnly ? 'Showing: In Review' : 'In Review'}
            </button>

            <button
              type="button"
              onClick={() => setUrgentOnly((v) => !v)}
              className={`btn btn-sm ${urgentOnly ? 'btn-danger' : 'btn-secondary'}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}
            >
              <Zap size={13} />
              <span>Urgent Only</span>
            </button>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSearchTerm(searchInput);
              }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: '1 1 240px', maxWidth: '380px' }}
            >
              <div style={{ position: 'relative', flex: 1 }}>
                <Search
                  size={14}
                  color="#64748B"
                  style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
                />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    if (e.target.value === '') setSearchTerm('');
                  }}
                  placeholder="Search PO / phone / name..."
                  style={{
                    width: '100%',
                    padding: '7px 10px 7px 30px',
                    border: '1px solid #CBD5E1',
                    borderRadius: '8px',
                    fontSize: '13px',
                  }}
                />
              </div>
              <button type="submit" className="btn btn-sm btn-secondary">
                Search
              </button>
            </form>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {selectedIds.size > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => handlePrintPackList(selectedOrders)}
                  className="btn btn-sm btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}
                >
                  <Printer size={13} />
                  <span>Print Pack List ({selectedIds.size})</span>
                </button>
                <button
                  type="button"
                  onClick={() => void handleBulkDispatch()}
                  disabled={bulkDispatching}
                  className="btn btn-sm btn-primary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600 }}
                >
                  <Send size={13} />
                  <span>{bulkDispatching ? 'Dispatching...' : `Dispatch Selected (${selectedIds.size})`}</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => void handleSyncCouriers()}
              disabled={syncingCouriers}
              className="btn btn-sm btn-secondary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
            >
              <RefreshCw size={13} className={syncingCouriers ? 'animate-spin' : ''} />
              <span>{syncingCouriers ? 'Syncing...' : 'Sync Couriers'}</span>
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div
          style={{
            backgroundColor: '#ECFDF5',
            border: '1px solid #A7F3D0',
            color: '#065F46',
            borderRadius: '8px',
            padding: '10px 14px',
            fontSize: '13px',
            fontWeight: 600,
          }}
        >
          {toast}
        </div>
      )}

      {error && (
        <div
          style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid #FECACA',
            color: '#991B1B',
            borderRadius: '8px',
            padding: '12px 16px',
            fontSize: '13px',
          }}
        >
          {error}
        </div>
      )}

      {/* 3-Column Order Cards */}
      {loading ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
          Loading Warehouse Fulfillment Queue...
        </div>
      ) : sortedQueue.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center', color: '#64748B' }}>
          No orders in this fulfillment view.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sortedQueue.map(({ order, is_delayed_hub_alert, aging_hours }) => {
            const isSelected = selectedIds.has(order.id);
            const latestStaffNote = order.callNotes?.[0];
            const zoneLabel = getOrderLocationZone(order);
            const isBusy = updatingOrderId === order.id;

            return (
              <div
                key={order.id}
                style={{
                  backgroundColor: '#FFFFFF',
                  border: order.is_urgent ? '1.5px solid #FCA5A5' : '1px solid #E2E8F0',
                  borderRadius: '12px',
                  overflow: 'hidden',
                }}
              >
                {/* Card Header */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                    padding: '10px 16px',
                    backgroundColor: order.is_urgent ? '#FEF2F2' : '#F8FAFC',
                    borderBottom: '1px solid #E2E8F0',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectOrder(order.id)}
                      style={{ width: '15px', height: '15px', accentColor: '#0F766E', cursor: 'pointer' }}
                    />
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '14px', color: '#0F172A' }}>
                      #{order.orderNumber}
                    </span>
                    {is_delayed_hub_alert && (
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          color: '#B45309',
                          backgroundColor: '#FEF3C7',
                          padding: '2px 8px',
                          borderRadius: '9999px',
                        }}
                      >
                        {Math.round(aging_hours)}h in queue
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {order.is_urgent && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          backgroundColor: '#FEE2E2',
                          color: '#B91C1C',
                          padding: '2px 9px',
                          borderRadius: '9999px',
                          fontSize: '11px',
                          fontWeight: 700,
                        }}
                      >
                        <Zap size={11} />
                        URGENT PARCEL
                      </span>
                    )}
                    <span
                      style={{
                        backgroundColor: '#E2E8F0',
                        color: '#1E293B',
                        padding: '2px 10px',
                        borderRadius: '9999px',
                        fontSize: '11px',
                        fontWeight: 700,
                      }}
                    >
                      {order.status}
                    </span>
                  </div>
                </div>

                {/* 3-Column Body */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(240px, 1.15fr) minmax(260px, 1.35fr) minmax(200px, 0.85fr)',
                    gap: '16px',
                    padding: '16px',
                  }}
                >
                  {/* COL 1: Product Visuals & Variations */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'flex-start' }}>
                    {(order.items || []).length === 0 ? (
                      <div style={{ fontSize: '12px', color: '#64748B' }}>No line items</div>
                    ) : (
                      order.items.map((item) => (
                        <div
                          key={item.id}
                          style={{
                            width: '126px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px',
                          }}
                        >
                          <div
                            style={{
                              width: '120px',
                              height: '120px',
                              border: '1px solid #E2E8F0',
                              borderRadius: '8px',
                              backgroundColor: '#F8FAFC',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                            }}
                          >
                            {item.productImage ? (
                              <img
                                src={item.productImage}
                                alt={item.productTitle}
                                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                              />
                            ) : (
                              <Package size={28} color="#94A3B8" />
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                            <span
                              style={{
                                backgroundColor: '#0F172A',
                                color: '#FFFFFF',
                                borderRadius: '6px',
                                padding: '1px 7px',
                                fontSize: '11px',
                                fontWeight: 700,
                              }}
                            >
                              Qty: x{item.quantity}
                            </span>
                          </div>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#0F172A', lineHeight: 1.3 }}>
                            {item.productTitle}
                          </div>
                          {(item.variantTitle || item.sku) && (
                            <div style={{ fontSize: '11px', color: '#475569' }}>
                              {item.variantTitle || item.sku}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* COL 2: Recipient & Logistics */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '7px',
                      borderLeft: '1px solid #F1F5F9',
                      borderRight: '1px solid #F1F5F9',
                      padding: '0 14px',
                      fontSize: '13px',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ color: '#475569' }}>
                        <strong>Parcel ID:</strong>{' '}
                        <span style={{ fontFamily: 'var(--font-mono)' }}>
                          {order.consignmentId || order.trackingNumber || 'Not Dispatched'}
                        </span>
                      </span>
                      {onInspectOrder && (
                        <button
                          type="button"
                          onClick={() => onInspectOrder(order)}
                          title="Inspect Order Details"
                          style={{
                            border: '1px solid #CBD5E1',
                            backgroundColor: '#FFFFFF',
                            borderRadius: '6px',
                            padding: '3px 7px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '11px',
                            color: '#334155',
                          }}
                        >
                          <Eye size={12} />
                          <span>View</span>
                        </button>
                      )}
                    </div>

                    <div style={{ fontWeight: 700, color: '#0F172A' }}>{order.customerName}</div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#334155' }}>
                      <Phone size={13} color="#0F766E" />
                      <a href={`tel:${order.customerPhone}`} style={{ color: '#0F172A', textDecoration: 'none', fontWeight: 600 }}>
                        {order.customerPhone || 'N/A'}
                      </a>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#475569' }}>
                      <MapPin size={13} color="#64748B" />
                      <span>{zoneLabel}</span>
                    </div>

                    {order.shippingAddress && (
                      <div style={{ fontSize: '12px', color: '#64748B' }}>{order.shippingAddress}</div>
                    )}

                    {order.specialNote && (
                      <div
                        style={{
                          backgroundColor: '#FFFBEB',
                          border: '1px solid #FDE68A',
                          borderRadius: '6px',
                          padding: '6px 9px',
                          fontSize: '12px',
                          color: '#92400E',
                        }}
                      >
                        <strong>Customer Note:</strong> {order.specialNote}
                      </div>
                    )}

                    {latestStaffNote && (
                      <div
                        style={{
                          backgroundColor: '#F1F5F9',
                          borderRadius: '6px',
                          padding: '6px 9px',
                          fontSize: '12px',
                          color: '#334155',
                        }}
                      >
                        <strong>Staff Note:</strong> {latestStaffNote.note}
                      </div>
                    )}

                    <div style={{ marginTop: 'auto', paddingTop: '6px', fontSize: '12px', color: '#475569', fontWeight: 600 }}>
                      {formatDhakaTime(order.createdAt)} •{' '}
                      <span style={{ color: '#0F172A', fontWeight: 700 }}>
                        {formatMoney(currentStore.currency || 'BDT', order.totalAmount)}
                      </span>
                    </div>
                  </div>

                  {/* COL 3: Quick Operational Actions */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748B', marginBottom: '4px' }}>
                        Issue Status
                      </label>
                      <select
                        value={order.issue_status || 'NONE'}
                        disabled={isBusy}
                        onChange={(e) =>
                          void handleToggleFlag(order, { issue_status: e.target.value })
                        }
                        style={{
                          width: '100%',
                          border:
                            order.issue_status && order.issue_status !== 'NONE'
                              ? '1px solid #DC2626'
                              : '1px solid #CBD5E1',
                          backgroundColor:
                            order.issue_status && order.issue_status !== 'NONE'
                              ? '#FEF2F2'
                              : '#FFFFFF',
                          color:
                            order.issue_status && order.issue_status !== 'NONE'
                              ? '#991B1B'
                              : '#0F172A',
                          borderRadius: '8px',
                          padding: '7px 10px',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      >
                        {ISSUE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        void handleToggleFlag(order, { is_print_ready: !order.is_print_ready })
                      }
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: order.is_print_ready ? '#059669' : '#0F172A',
                        color: '#FFFFFF',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: isBusy ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {order.is_print_ready ? <Check size={14} /> : <Printer size={14} />}
                      <span>{order.is_print_ready ? 'Printed' : 'Print Ready'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void handleToggleFlag(order, { is_ready: !order.is_ready })}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        padding: '8px 12px',
                        borderRadius: '8px',
                        border: order.is_ready ? 'none' : '1px solid #CBD5E1',
                        backgroundColor: order.is_ready ? '#047857' : '#F8FAFC',
                        color: order.is_ready ? '#FFFFFF' : '#0F172A',
                        fontSize: '12px',
                        fontWeight: 700,
                        cursor: isBusy ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {order.is_ready ? <Check size={14} /> : <Package size={14} />}
                      <span>{order.is_ready ? 'Ready' : 'Parcel Ready'}</span>
                    </button>

                    <div style={{ display: 'flex', gap: '6px', marginTop: 'auto' }}>
                      <button
                        type="button"
                        onClick={() => handlePrintPackList([order])}
                        className="btn btn-sm btn-secondary"
                        style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                        title="Print Packing Slip"
                      >
                        <Printer size={12} />
                        <span>Slip</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy || Boolean(order.consignmentId)}
                        onClick={() => void handleDispatchSingle(order)}
                        className="btn btn-sm btn-primary"
                        style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                      >
                        <Truck size={12} />
                        <span>{order.consignmentId ? 'Sent' : 'Dispatch'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const CounterPill: React.FC<{
  icon: React.ReactNode;
  label: string;
  count: number;
  tone: 'danger' | 'success' | 'warning' | 'neutral';
}> = ({ icon, label, count, tone }) => {
  const styles: Record<string, { bg: string; border: string; color: string }> = {
    danger: { bg: '#FEF2F2', border: '#FECACA', color: '#B91C1C' },
    success: { bg: '#ECFDF5', border: '#A7F3D0', color: '#047857' },
    warning: { bg: '#FFFBEB', border: '#FDE68A', color: '#B45309' },
    neutral: { bg: '#F1F5F9', border: '#CBD5E1', color: '#334155' },
  };
  const s = styles[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        backgroundColor: s.bg,
        border: `1px solid ${s.border}`,
        color: s.color,
        borderRadius: '8px',
        padding: '5px 10px',
        fontSize: '12px',
        fontWeight: 700,
      }}
    >
      {icon}
      <span>
        {label}: {count}
      </span>
    </span>
  );
};
