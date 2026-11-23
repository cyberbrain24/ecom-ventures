import React, { useState, useEffect, useCallback } from 'react';
import {
  Phone,
  MessageCircle,
  CheckCircle2,
  Clock,
  AlertTriangle,
  RotateCcw,
  Zap,
  ShoppingBag,
  ExternalLink,
  Search,
  Calendar,
} from 'lucide-react';
import {
  AbandonedCheckoutRecord,
  AbandonedCheckoutStatus,
  AbandonedSummary,
  StoreBrand,
} from '../types/store';
import {
  fetchAbandonedCheckouts,
  updateAbandonedStatus,
  convertAbandonedToOrder,
} from '../lib/abandoned-api';
import { formatMoney } from '../lib/format';

interface AbandonedRecoveryViewProps {
  currentStore: StoreBrand;
  onOrderCreated?: () => void;
}

const STATUS_FILTERS: { label: string; value: string }[] = [
  { label: 'All Drops', value: 'ALL' },
  { label: 'Pending Call', value: 'pending' },
  { label: 'Called - Busy', value: 'called_busy' },
  { label: 'Follow-up Needed', value: 'called_followup' },
  { label: 'Declined', value: 'declined' },
  { label: 'Converted', value: 'converted' },
];

export const AbandonedRecoveryView: React.FC<AbandonedRecoveryViewProps> = ({
  currentStore,
  onOrderCreated,
}) => {
  const [drops, setDrops] = useState<AbandonedCheckoutRecord[]>([]);
  const [summary, setSummary] = useState<AbandonedSummary>({
    total_count: 0,
    pending_count: 0,
    called_busy_count: 0,
    called_followup_count: 0,
    declined_count: 0,
    converted_count: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Call Notes Editing Modal / Inline
  const [selectedDrop, setSelectedDrop] = useState<AbandonedCheckoutRecord | null>(null);
  const [noteText, setNoteText] = useState<string>('');
  const [nextStatus, setNextStatus] = useState<AbandonedCheckoutStatus>('called_followup');
  const [callbackTime, setCallbackTime] = useState<string>('');
  const [savingNote, setSavingNote] = useState<boolean>(false);

  // Conversion loading state
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetchAbandonedCheckouts(activeFilter, 1, 50);
      setDrops(res.items || []);
      if (res.summary) {
        setSummary(res.summary);
      }
    } catch (err: any) {
      setErrorMsg(err.detail || err.message || 'Failed to load abandoned checkouts.');
    } finally {
      setLoading(false);
    }
  }, [activeFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleOpenNoteModal = (drop: AbandonedCheckoutRecord) => {
    setSelectedDrop(drop);
    setNoteText(drop.call_notes || '');
    setNextStatus(drop.status === 'pending' ? 'called_followup' : drop.status);
    setCallbackTime(
      drop.scheduled_callback_at
        ? new Date(drop.scheduled_callback_at).toISOString().slice(0, 16)
        : ''
    );
  };

  const handleSaveNotes = async () => {
    if (!selectedDrop) return;
    setSavingNote(true);
    try {
      await updateAbandonedStatus(selectedDrop.id, {
        status: nextStatus,
        call_notes: noteText,
        scheduled_callback_at: callbackTime ? new Date(callbackTime).toISOString() : undefined,
      });
      setSelectedDrop(null);
      await loadData();
    } catch (err: any) {
      alert(err.detail || err.message || 'Failed to update outreach status.');
    } finally {
      setSavingNote(false);
    }
  };

  const handleConvert1Click = async (drop: AbandonedCheckoutRecord) => {
    if (
      !confirm(
        `Are you sure you want to convert drop #${drop.id.slice(0, 8)} into an active COD order for ${drop.customer_name || 'Customer'} (${drop.phone})?`
      )
    ) {
      return;
    }

    setConvertingId(drop.id);
    try {
      const res = await convertAbandonedToOrder(drop.id, {
        customer_name: drop.customer_name,
        phone: drop.phone,
        customer_email: drop.customer_email,
        district: drop.district,
        thana: drop.thana,
        address: drop.address,
        payment_method: 'COD',
      });
      setSuccessToast(
        `Successfully converted! Created Order #${res.order_number} and injected into Warehouse Dispatch Queue.`
      );
      setTimeout(() => setSuccessToast(null), 6000);
      await loadData();
      if (onOrderCreated) onOrderCreated();
    } catch (err: any) {
      alert(err.detail || err.message || 'Failed to convert order.');
    } finally {
      setConvertingId(null);
    }
  };

  const filteredDrops = drops.filter((d) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      d.phone.toLowerCase().includes(q) ||
      d.customer_name.toLowerCase().includes(q) ||
      d.district.toLowerCase().includes(q) ||
      d.address.toLowerCase().includes(q)
    );
  });

  const getStatusBadge = (status: AbandonedCheckoutStatus) => {
    switch (status) {
      case 'pending':
        return <span className="badge badge-warning">Pending Call</span>;
      case 'called_busy':
        return <span className="badge badge-secondary">Called - Busy</span>;
      case 'called_followup':
        return <span className="badge badge-info">Follow-up Needed</span>;
      case 'declined':
        return <span className="badge badge-danger">Declined</span>;
      case 'converted':
        return <span className="badge badge-success">Converted ✓</span>;
      default:
        return <span className="badge">{status}</span>;
    }
  };

  const buildWhatsAppLink = (drop: AbandonedCheckoutRecord) => {
    const cleanPhone = drop.phone.replace(/\D/g, '');
    const intlPhone = cleanPhone.startsWith('88') ? cleanPhone : `88${cleanPhone}`;
    const itemsSummary = (drop.cart_items || [])
      .map((it) => `• ${it.product_title || 'Item'} (x${it.quantity})`)
      .join('\n');
    const msg = `Hello ${drop.customer_name || 'there'}! We noticed you left some items in your ${currentStore.name} cart:\n\n${itemsSummary}\nTotal: BDT ${drop.cart_total}\n\nWould you like us to confirm and dispatch your Cash On Delivery (COD) order today?`;
    return `https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`;
  };

  return (
    <div style={{ marginTop: '16px' }}>
      {/* Toast Notification */}
      {successToast && (
        <div
          style={{
            background: '#ecfdf5',
            border: '1px solid #10b981',
            color: '#065f46',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '0.85rem',
            fontWeight: 600,
          }}
        >
          <CheckCircle2 size={18} color="#10b981" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Operational Metric KPI Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <div className="card" style={{ padding: '14px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>Total Drops</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px' }}>{summary.total_count}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>Lifetime Abandoned</div>
        </div>

        <div className="card" style={{ padding: '14px', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ fontSize: '0.75rem', color: '#b45309', fontWeight: 600 }}>Pending Calls</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px', color: '#b45309' }}>
            {summary.pending_count}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>Awaiting initial outreach</div>
        </div>

        <div className="card" style={{ padding: '14px', borderLeft: '4px solid #3b82f6' }}>
          <div style={{ fontSize: '0.75rem', color: '#1d4ed8', fontWeight: 600 }}>Scheduled Callbacks</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px', color: '#1d4ed8' }}>
            {summary.called_followup_count + summary.called_busy_count}
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>Busy / Needs follow-up</div>
        </div>

        <div className="card" style={{ padding: '14px', borderLeft: '4px solid #10b981' }}>
          <div style={{ fontSize: '0.75rem', color: '#047857', fontWeight: 600 }}>Converted Sales</div>
          <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px', color: '#047857' }}>
            {summary.converted_count}
          </div>
          <div style={{ fontSize: '0.7rem', color: '#047857', marginTop: '2px' }}>
            {summary.total_count > 0
              ? `${((summary.converted_count / summary.total_count) * 100).toFixed(1)}% Recovery Rate`
              : '0% Recovery Rate'}
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap',
          marginBottom: '12px',
        }}
      >
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setActiveFilter(f.value)}
              className={`btn btn-sm ${activeFilter === f.value ? 'btn-primary' : 'btn-secondary'}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Search phone or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="form-control"
              style={{
                fontSize: '0.8rem',
                padding: '6px 10px',
                width: '200px',
                borderRadius: '6px',
              }}
            />
          </div>
          <button onClick={loadData} className="btn btn-sm btn-secondary" title="Refresh Queue">
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* Main Table View */}
      <div className="card" style={{ padding: 0 }}>
        {loading ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Loading abandoned recovery queue...
          </div>
        ) : errorMsg ? (
          <div style={{ padding: '24px', textAlign: 'center', color: '#dc2626' }}>{errorMsg}</div>
        ) : filteredDrops.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
            No abandoned checkouts match this filter.
          </div>
        ) : (
          <div className="table-container" style={{ border: 'none' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Shopper Details</th>
                  <th>Location</th>
                  <th>Cart Breakdown</th>
                  <th>Cart Total</th>
                  <th>Status</th>
                  <th>Call Notes & Callback</th>
                  <th style={{ textAlign: 'right' }}>1-Click Outreach & Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredDrops.map((drop) => {
                  const isConverted = drop.status === 'converted';
                  const isConverting = convertingId === drop.id;

                  return (
                    <tr key={drop.id}>
                      {/* Customer Info */}
                      <td>
                        <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>
                          {drop.customer_name || 'Guest Shopper'}
                        </div>
                        <div
                          style={{
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--text-primary)',
                            fontWeight: 700,
                            fontSize: '0.8rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            marginTop: '2px',
                          }}
                        >
                          <Phone size={12} color="#0d9488" />
                          <span>{drop.phone}</span>
                        </div>
                        {drop.customer_email && (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {drop.customer_email}
                          </div>
                        )}
                        <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          Dropped {new Date(drop.created_at).toLocaleDateString()} at{' '}
                          {new Date(drop.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </td>

                      {/* District & Location */}
                      <td>
                        <div style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                          {drop.district || 'District N/A'}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                          {drop.thana || 'Thana N/A'}
                        </div>
                        <div
                          style={{
                            fontSize: '0.7rem',
                            color: 'var(--text-muted)',
                            maxWidth: '160px',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={drop.address}
                        >
                          {drop.address}
                        </div>
                      </td>

                      {/* Items */}
                      <td>
                        <div style={{ fontSize: '0.75rem', maxWidth: '200px' }}>
                          {(drop.cart_items || []).map((it, idx) => (
                            <div
                              key={idx}
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                gap: '8px',
                                padding: '1px 0',
                              }}
                            >
                              <span
                                style={{
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {it.product_title || 'Product'} (x{it.quantity})
                              </span>
                              <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                                {formatMoney(currentStore.currency, it.unit_price * it.quantity)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>

                      {/* Cart Total */}
                      <td style={{ fontWeight: 800, fontFamily: 'var(--font-mono)' }}>
                        {formatMoney(currentStore.currency, drop.cart_total)}
                      </td>

                      {/* Status */}
                      <td>{getStatusBadge(drop.status)}</td>

                      {/* Notes / Callback */}
                      <td>
                        {drop.call_notes ? (
                          <div
                            style={{
                              fontSize: '0.75rem',
                              color: 'var(--text-main)',
                              maxWidth: '180px',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={drop.call_notes}
                          >
                            💬 {drop.call_notes}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            No notes logged
                          </div>
                        )}
                        {drop.scheduled_callback_at && (
                          <div
                            style={{
                              fontSize: '0.7rem',
                              color: '#b45309',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              marginTop: '2px',
                            }}
                          >
                            <Calendar size={11} />
                            <span>
                              Call: {new Date(drop.scheduled_callback_at).toLocaleString([], {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </div>
                        )}
                        <button
                          onClick={() => handleOpenNoteModal(drop)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#0d9488',
                            fontSize: '0.7rem',
                            fontWeight: 600,
                            cursor: 'pointer',
                            padding: 0,
                            marginTop: '2px',
                          }}
                        >
                          + Edit Notes / Time
                        </button>
                      </td>

                      {/* 1-Click Actions */}
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                          {/* Direct Phone Call */}
                          <a
                            href={`tel:${drop.phone}`}
                            className="btn btn-sm btn-secondary"
                            style={{ padding: '4px 8px' }}
                            title="Direct Phone Call"
                          >
                            <Phone size={13} color="#0d9488" />
                          </a>

                          {/* WhatsApp Direct */}
                          <a
                            href={buildWhatsAppLink(drop)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="btn btn-sm btn-secondary"
                            style={{ padding: '4px 8px', color: '#25D366' }}
                            title="Send WhatsApp Cart Recovery Message"
                          >
                            <MessageCircle size={13} color="#25D366" />
                          </a>

                          {/* 1-Click COD Order Genesis */}
                          {!isConverted ? (
                            <button
                              onClick={() => handleConvert1Click(drop)}
                              disabled={isConverting}
                              className="btn btn-sm btn-primary"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '4px 10px',
                                fontWeight: 700,
                                background: '#0d9488',
                              }}
                              title="1-Click Genesis: Converts cart to placed COD Order"
                            >
                              <Zap size={13} />
                              <span>{isConverting ? 'Creating...' : 'Convert to COD'}</span>
                            </button>
                          ) : (
                            <span
                              style={{
                                fontSize: '0.75rem',
                                color: '#10b981',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                              }}
                            >
                              <CheckCircle2 size={14} /> Converted
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Note & Follow-up Scheduler Modal */}
      {selectedDrop && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            className="card"
            style={{ width: '420px', maxWidth: '90%', padding: '20px', background: '#fff' }}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 12px 0' }}>
              Tele-Sales Outreach & Follow-Up
            </h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '14px' }}>
              Customer: <strong>{selectedDrop.customer_name || 'Guest'}</strong> ({selectedDrop.phone})
            </p>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                Outreach Status
              </label>
              <select
                value={nextStatus}
                onChange={(e) => setNextStatus(e.target.value as AbandonedCheckoutStatus)}
                className="form-control"
                style={{ width: '100%', fontSize: '0.8rem' }}
              >
                <option value="pending">Pending Call</option>
                <option value="called_busy">Called - Busy / No Answer</option>
                <option value="called_followup">Follow-up Needed (Requested Callback)</option>
                <option value="declined">Declined / Not Interested</option>
                <option value="converted">Converted</option>
              </select>
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                Scheduled Callback Date & Time
              </label>
              <input
                type="datetime-local"
                value={callbackTime}
                onChange={(e) => setCallbackTime(e.target.value)}
                className="form-control"
                style={{ width: '100%', fontSize: '0.8rem' }}
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>
                Call Remarks / Customer Preferences
              </label>
              <textarea
                rows={3}
                placeholder="e.g. Customer asked to call back after 5 PM. Prefers XL size."
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                className="form-control"
                style={{ width: '100%', fontSize: '0.8rem' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setSelectedDrop(null)}
                className="btn btn-sm btn-secondary"
                disabled={savingNote}
              >
                Cancel
              </button>
              <button
                onClick={handleSaveNotes}
                disabled={savingNote}
                className="btn btn-sm btn-primary"
                style={{ background: '#0d9488' }}
              >
                {savingNote ? 'Saving...' : 'Save Outreach'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
