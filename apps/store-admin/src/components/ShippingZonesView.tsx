import React, { useEffect, useState, useMemo } from 'react';
import {
  MapPin,
  Pencil,
  Plus,
  Trash2,
  Globe,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  Layers,
  Building,
  RotateCcw,
  Zap,
  Info,
} from 'lucide-react';
import {
  DistrictEntity,
  DistrictInput,
  ThanaEntity,
  ThanaInput,
  fetchDistricts,
  createDistrict,
  updateDistrict,
  deleteDistrict,
  fetchThanas,
  createThana,
  updateThana,
  deleteThana,
} from '../lib/shipping-api';
import { describeError } from '../lib/format';
import { StoreBrand } from '../types/store';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { RecordModal } from './RecordModal';

interface ShippingZonesViewProps {
  currentStore: StoreBrand;
  role: string;
}

const ZONE_WRITE_ROLES: readonly string[] = ['STORE_OWNER', 'STORE_ADMIN'];

export const ShippingZonesView: React.FC<ShippingZonesViewProps> = ({ currentStore, role }) => {
  const canWrite = ZONE_WRITE_ROLES.includes(role);
  const [activeTab, setActiveTab] = useState<'districts' | 'thanas'>('districts');

  // Districts State
  const [districts, setDistricts] = useState<DistrictEntity[]>([]);
  const [districtsLoading, setDistrictsLoading] = useState<boolean>(true);
  const [districtsError, setDistrictsError] = useState<string | null>(null);
  const [districtSearch, setDistrictSearch] = useState<string>('');
  const [editingDistrict, setEditingDistrict] = useState<DistrictEntity | 'new' | null>(null);
  const [deletingDistrict, setDeletingDistrict] = useState<DistrictEntity | null>(null);

  // Thanas State
  const [thanas, setThanas] = useState<ThanaEntity[]>([]);
  const [thanasLoading, setThanasLoading] = useState<boolean>(true);
  const [thanasError, setThanasError] = useState<string | null>(null);
  const [thanaSearch, setThanaSearch] = useState<string>('');
  const [selectedDistrictFilter, setSelectedDistrictFilter] = useState<number | 'ALL'>('ALL');
  const [editingThana, setEditingThana] = useState<ThanaEntity | 'new' | null>(null);
  const [deletingThana, setDeletingThana] = useState<ThanaEntity | null>(null);

  // Pagination State
  const [districtPage, setDistrictPage] = useState<number>(1);
  const districtPageSize = 15;
  const [thanaPage, setThanaPage] = useState<number>(1);
  const thanaPageSize = 25;

  // General Notification
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Load Districts
  const loadDistricts = async () => {
    setDistrictsLoading(true);
    setDistrictsError(null);
    try {
      const data = await fetchDistricts(districtSearch);
      setDistricts(data);
    } catch (err) {
      setDistrictsError(describeError(err));
    } finally {
      setDistrictsLoading(false);
    }
  };

  // Load Thanas
  const loadThanas = async () => {
    setThanasLoading(true);
    setThanasError(null);
    try {
      const filterId = selectedDistrictFilter === 'ALL' ? undefined : selectedDistrictFilter;
      const data = await fetchThanas(filterId, thanaSearch);
      setThanas(data);
    } catch (err) {
      setThanasError(describeError(err));
    } finally {
      setThanasLoading(false);
    }
  };

  useEffect(() => {
    loadDistricts();
  }, [districtSearch]);

  useEffect(() => {
    loadThanas();
  }, [thanaSearch, selectedDistrictFilter]);

  // District Form State
  const [districtFormName, setDistrictFormName] = useState('');
  const [districtFormDivision, setDistrictFormDivision] = useState('Dhaka');
  const [districtFormActive, setDistrictFormActive] = useState(true);
  const [districtSubmitting, setDistrictSubmitting] = useState(false);

  useEffect(() => {
    if (editingDistrict && editingDistrict !== 'new') {
      setDistrictFormName(editingDistrict.name);
      setDistrictFormDivision(editingDistrict.division || 'Dhaka');
      setDistrictFormActive(editingDistrict.is_active);
    } else {
      setDistrictFormName('');
      setDistrictFormDivision('Dhaka');
      setDistrictFormActive(true);
    }
  }, [editingDistrict]);

  const handleSaveDistrict = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!districtFormName.trim()) return;
    setDistrictSubmitting(true);
    try {
      const payload: DistrictInput = {
        name: districtFormName.trim(),
        division: districtFormDivision,
        is_active: districtFormActive,
      };
      if (editingDistrict === 'new') {
        await createDistrict(payload);
        showToast(`District "${payload.name}" created successfully.`);
      } else if (editingDistrict) {
        await updateDistrict(editingDistrict.id, payload);
        showToast(`District "${payload.name}" updated successfully.`);
      }
      setEditingDistrict(null);
      await loadDistricts();
      await loadThanas();
    } catch (err) {
      alert(`Could not save district: ${describeError(err)}`);
    } finally {
      setDistrictSubmitting(false);
    }
  };

  const handleConfirmDeleteDistrict = async () => {
    if (!deletingDistrict) return;
    try {
      await deleteDistrict(deletingDistrict.id);
      showToast(`District "${deletingDistrict.name}" removed.`);
      setDeletingDistrict(null);
      await loadDistricts();
      await loadThanas();
    } catch (err) {
      alert(`Could not delete district: ${describeError(err)}`);
    }
  };

  // Thana Form State
  const [thanaFormDistrictId, setThanaFormDistrictId] = useState<number>(0);
  const [thanaFormName, setThanaFormName] = useState('');
  const [thanaFormShippingCost, setThanaFormShippingCost] = useState('120.00');
  const [thanaFormActive, setThanaFormActive] = useState(true);
  const [thanaSubmitting, setThanaSubmitting] = useState(false);

  useEffect(() => {
    if (editingThana && editingThana !== 'new') {
      setThanaFormDistrictId(editingThana.district_id);
      setThanaFormName(editingThana.name);
      setThanaFormShippingCost(editingThana.shipping_cost.toFixed(2));
      setThanaFormActive(editingThana.is_active);
    } else {
      setThanaFormDistrictId(districts[0]?.id || 0);
      setThanaFormName('');
      setThanaFormShippingCost('120.00');
      setThanaFormActive(true);
    }
  }, [editingThana, districts]);

  const handleSaveThana = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!thanaFormName.trim() || thanaFormDistrictId <= 0) return;
    setThanaSubmitting(true);
    try {
      const payload: ThanaInput = {
        district_id: thanaFormDistrictId,
        name: thanaFormName.trim(),
        shipping_cost: parseFloat(thanaFormShippingCost) || 120.0,
        is_active: thanaFormActive,
      };
      if (editingThana === 'new') {
        await createThana(payload);
        showToast(`Thana "${payload.name}" created successfully.`);
      } else if (editingThana) {
        await updateThana(editingThana.id, payload);
        showToast(`Thana "${payload.name}" updated successfully.`);
      }
      setEditingThana(null);
      await loadThanas();
      await loadDistricts();
    } catch (err) {
      alert(`Could not save thana: ${describeError(err)}`);
    } finally {
      setThanaSubmitting(false);
    }
  };

  const handleConfirmDeleteThana = async () => {
    if (!deletingThana) return;
    try {
      await deleteThana(deletingThana.id);
      showToast(`Thana "${deletingThana.name}" removed.`);
      setDeletingThana(null);
      await loadThanas();
      await loadDistricts();
    } catch (err) {
      alert(`Could not delete thana: ${describeError(err)}`);
    }
  };

  // Pagination Slicing
  const paginatedDistricts = useMemo(() => {
    const start = (districtPage - 1) * districtPageSize;
    return districts.slice(start, start + districtPageSize);
  }, [districts, districtPage]);

  const totalDistrictPages = Math.ceil(districts.length / districtPageSize) || 1;

  const paginatedThanas = useMemo(() => {
    const start = (thanaPage - 1) * thanaPageSize;
    return thanas.slice(start, start + thanaPageSize);
  }, [thanas, thanaPage]);

  const totalThanaPages = Math.ceil(thanas.length / thanaPageSize) || 1;

  return (
    <div>
      {/* Header Bar */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: '#0d9488',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Globe size={18} />
            </div>
            <div>
              <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
                Locations & Delivery Zones
              </h1>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                Geographic shipping routing, district grouping & thana-level fee configuration for <b>{currentStore.name}</b>
              </p>
            </div>
          </div>
        </div>

        {/* 3-Tier Quick Reference Summary */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <div
            style={{
              background: '#f0fdf4',
              border: '1px solid #bbf7d0',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.74rem',
            }}
          >
            <span style={{ fontWeight: 800, color: '#166534' }}>Zone 1 (Dhaka City):</span> ৳70 - ৳80 (24-48h)
          </div>
          <div
            style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.74rem',
            }}
          >
            <span style={{ fontWeight: 800, color: '#1e40af' }}>Zone 2 (Dhaka Sub-Urban):</span> ৳100 - ৳110 (48-72h)
          </div>
          <div
            style={{
              background: '#faf5ff',
              border: '1px solid #e9d5ff',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '0.74rem',
            }}
          >
            <span style={{ fontWeight: 800, color: '#6b21a8' }}>Zone 3 (Nationwide):</span> ৳120 - ৳130 (3-5 Days)
          </div>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            background: '#ecfdf5',
            border: '1px solid #10b981',
            color: '#065f46',
            padding: '10px 14px',
            borderRadius: '6px',
            marginBottom: '14px',
            fontSize: '0.82rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle size={15} color="#10b981" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Tab Selector */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border)',
          marginBottom: '16px',
          paddingBottom: '1px',
        }}
      >
        <button
          onClick={() => setActiveTab('districts')}
          style={{
            padding: '8px 16px',
            borderBottom: activeTab === 'districts' ? '2px solid #0d9488' : '2px solid transparent',
            color: activeTab === 'districts' ? '#0d9488' : 'var(--text-muted)',
            fontWeight: activeTab === 'districts' ? 800 : 600,
            fontSize: '0.82rem',
            cursor: 'pointer',
            background: 'transparent',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Building size={14} />
          <span>Districts & Divisions ({districts.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('thanas')}
          style={{
            padding: '8px 16px',
            borderBottom: activeTab === 'thanas' ? '2px solid #0d9488' : '2px solid transparent',
            color: activeTab === 'thanas' ? '#0d9488' : 'var(--text-muted)',
            fontWeight: activeTab === 'thanas' ? 800 : 600,
            fontSize: '0.82rem',
            cursor: 'pointer',
            background: 'transparent',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <Layers size={14} />
          <span>Thanas & Zone Rates ({thanas.length})</span>
        </button>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: DISTRICTS (DIVISIONS)                                   */}
      {/* ============================================================== */}
      {activeTab === 'districts' && (
        <div>
          {/* Controls Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '14px',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ position: 'relative', width: '320px', maxWidth: '100%' }}>
              <Search
                size={14}
                style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
              />
              <input
                type="text"
                placeholder="Search district by name or division..."
                value={districtSearch}
                onChange={(e) => {
                  setDistrictSearch(e.target.value);
                  setDistrictPage(1);
                }}
                className="form-control"
                style={{ paddingLeft: '32px', fontSize: '0.8rem', height: '34px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={loadDistricts} className="btn btn-secondary btn-sm" title="Refresh">
                <RotateCcw size={13} />
              </button>
              {canWrite && (
                <button
                  onClick={() => setEditingDistrict('new')}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={14} />
                  <span>Add District</span>
                </button>
              )}
            </div>
          </div>

          {/* Districts Grid Table */}
          <div className="card" style={{ padding: 0 }}>
            {districtsLoading ? (
              <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading administrative districts...
              </div>
            ) : districtsError ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#dc2626' }}>{districtsError}</div>
            ) : districts.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No district entities match your search.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>ID</th>
                      <th>District Name</th>
                      <th>Division</th>
                      <th>Total Thanas</th>
                      <th>Status</th>
                      {canWrite && <th style={{ textAlign: 'right', width: '150px' }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDistricts.map((d) => (
                      <tr key={d.id}>
                        <td className="mono" style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          #{d.id}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{d.name}</div>
                        </td>
                        <td>
                          <span
                            style={{
                              background: '#f1f5f9',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              color: '#475569',
                            }}
                          >
                            {d.division}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => {
                              setSelectedDistrictFilter(d.id);
                              setActiveTab('thanas');
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#0d9488',
                              fontWeight: 700,
                              cursor: 'pointer',
                              textDecoration: 'underline',
                              fontSize: '0.8rem',
                            }}
                          >
                            {d.total_thanas} Thanas
                          </button>
                        </td>
                        <td>
                          {d.is_active ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: '#ecfdf5',
                                color: '#065f46',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                              }}
                            >
                              <CheckCircle size={10} color="#10b981" />
                              ACTIVE
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: '#fef2f2',
                                color: '#991b1b',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                              }}
                            >
                              <XCircle size={10} color="#ef4444" />
                              INACTIVE
                            </span>
                          )}
                        </td>
                        {canWrite && (
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                onClick={() => setEditingDistrict(d)}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                              >
                                <Pencil size={11} /> Edit
                              </button>
                              <button
                                onClick={() => setDeletingDistrict(d)}
                                className="btn btn-danger btn-sm"
                                style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                              >
                                <Trash2 size={11} /> Delete
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 16px',
                borderTop: '1px solid var(--border)',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
              }}
            >
              <div>
                Showing {Math.min((districtPage - 1) * districtPageSize + 1, districts.length)} -{' '}
                {Math.min(districtPage * districtPageSize, districts.length)} of {districts.length} District Entities
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  disabled={districtPage <= 1}
                  onClick={() => setDistrictPage((p) => p - 1)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                >
                  Prev
                </button>
                <span style={{ padding: '3px 8px', fontWeight: 700 }}>
                  Page {districtPage} of {totalDistrictPages}
                </span>
                <button
                  disabled={districtPage >= totalDistrictPages}
                  onClick={() => setDistrictPage((p) => p + 1)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: THANAS (ZONES & RATES)                                  */}
      {/* ============================================================== */}
      {activeTab === 'thanas' && (
        <div>
          {/* Controls Bar */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '14px',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', flex: 1, maxWidth: '640px' }}>
              {/* Filter by District */}
              <div style={{ width: '220px' }}>
                <select
                  value={selectedDistrictFilter}
                  onChange={(e) => {
                    const val = e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value, 10);
                    setSelectedDistrictFilter(val);
                    setThanaPage(1);
                  }}
                  className="form-control"
                  style={{ fontSize: '0.8rem', height: '34px' }}
                >
                  <option value="ALL">All Districts ({districts.length})</option>
                  {districts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.total_thanas} Thanas)
                    </option>
                  ))}
                </select>
              </div>

              {/* Search Thana */}
              <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
                <Search
                  size={14}
                  style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
                />
                <input
                  type="text"
                  placeholder="Search thana / police station..."
                  value={thanaSearch}
                  onChange={(e) => {
                    setThanaSearch(e.target.value);
                    setThanaPage(1);
                  }}
                  className="form-control"
                  style={{ paddingLeft: '32px', fontSize: '0.8rem', height: '34px' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={loadThanas} className="btn btn-secondary btn-sm" title="Refresh">
                <RotateCcw size={13} />
              </button>
              {canWrite && (
                <button
                  onClick={() => setEditingThana('new')}
                  className="btn btn-primary btn-sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  <Plus size={14} />
                  <span>Add Thana</span>
                </button>
              )}
            </div>
          </div>

          {/* Thanas Grid Table */}
          <div className="card" style={{ padding: 0 }}>
            {thanasLoading ? (
              <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading thanas and shipping rates...
              </div>
            ) : thanasError ? (
              <div style={{ padding: '24px', textAlign: 'center', color: '#dc2626' }}>{thanasError}</div>
            ) : thanas.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No thanas match your criteria.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '60px' }}>ID</th>
                      <th>Thana Name</th>
                      <th>Parent District</th>
                      <th>Shipping Rate</th>
                      <th>Status</th>
                      {canWrite && <th style={{ textAlign: 'right', width: '150px' }}>Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedThanas.map((t) => (
                      <tr key={t.id}>
                        <td className="mono" style={{ fontSize: '0.78rem', color: '#64748b' }}>
                          #{t.id}
                        </td>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{t.name}</div>
                        </td>
                        <td>
                          <span
                            style={{
                              background: '#f8fafc',
                              border: '1px solid #e2e8f0',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.74rem',
                              fontWeight: 600,
                              color: '#334155',
                            }}
                          >
                            {t.district_name}
                          </span>
                        </td>
                        <td>
                          <span
                            className="mono"
                            style={{
                              fontWeight: 800,
                              fontSize: '0.85rem',
                              color: t.shipping_cost <= 80 ? '#166534' : t.shipping_cost <= 110 ? '#1e40af' : '#7e22ce',
                              background: t.shipping_cost <= 80 ? '#f0fdf4' : t.shipping_cost <= 110 ? '#eff6ff' : '#faf5ff',
                              padding: '2px 8px',
                              borderRadius: '4px',
                            }}
                          >
                            ৳{t.shipping_cost.toFixed(2)}
                          </span>
                        </td>
                        <td>
                          {t.is_active ? (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: '#ecfdf5',
                                color: '#065f46',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                              }}
                            >
                              <CheckCircle size={10} color="#10b981" />
                              ACTIVE
                            </span>
                          ) : (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                background: '#fef2f2',
                                color: '#991b1b',
                                padding: '2px 8px',
                                borderRadius: '12px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                              }}
                            >
                              <XCircle size={10} color="#ef4444" />
                              INACTIVE
                            </span>
                          )}
                        </td>
                        {canWrite && (
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '6px' }}>
                              <button
                                onClick={() => setEditingThana(t)}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                              >
                                <Pencil size={11} /> Edit
                              </button>
                              <button
                                onClick={() => setDeletingThana(t)}
                                className="btn btn-danger btn-sm"
                                style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                              >
                                <Trash2 size={11} /> Delete
                              </button>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination Controls */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '10px 16px',
                borderTop: '1px solid var(--border)',
                fontSize: '0.78rem',
                color: 'var(--text-muted)',
              }}
            >
              <div>
                Showing {Math.min((thanaPage - 1) * thanaPageSize + 1, thanas.length)} -{' '}
                {Math.min(thanaPage * thanaPageSize, thanas.length)} of {thanas.length} Thana Entities
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  disabled={thanaPage <= 1}
                  onClick={() => setThanaPage((p) => p - 1)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                >
                  Prev
                </button>
                <span style={{ padding: '3px 8px', fontWeight: 700 }}>
                  Page {thanaPage} of {totalThanaPages}
                </span>
                <button
                  disabled={thanaPage >= totalThanaPages}
                  onClick={() => setThanaPage((p) => p + 1)}
                  className="btn btn-secondary btn-sm"
                  style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CREATE / EDIT DISTRICT                                  */}
      {/* ============================================================== */}
      {editingDistrict !== null && (
        <RecordModal
          title={editingDistrict === 'new' ? 'Create District' : 'Edit District'}
          submitLabel={editingDistrict === 'new' ? 'Save District' : 'Update District'}
          onClose={() => setEditingDistrict(null)}
          onSubmit={async () => {
            if (!districtFormName.trim()) throw new Error('District name is required');
            const payload: DistrictInput = {
              name: districtFormName.trim(),
              division: districtFormDivision,
              is_active: districtFormActive,
            };
            if (editingDistrict === 'new') {
              await createDistrict(payload);
              showToast(`District "${payload.name}" created successfully.`);
            } else {
              await updateDistrict(editingDistrict.id, payload);
              showToast(`District "${payload.name}" updated successfully.`);
            }
            await loadDistricts();
            await loadThanas();
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px' }}>
                District Name *
              </label>
              <input
                type="text"
                required
                placeholder="Enter district name, e.g. Dhaka City or Cox's Bazar"
                value={districtFormName}
                onChange={(e) => setDistrictFormName(e.target.value)}
                className="form-control"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px' }}>
                Administrative Division *
              </label>
              <select
                value={districtFormDivision}
                onChange={(e) => setDistrictFormDivision(e.target.value)}
                className="form-control"
              >
                {['Dhaka', 'Chattogram', 'Rajshahi', 'Khulna', 'Barishal', 'Sylhet', 'Rangpur', 'Mymensingh'].map((div) => (
                  <option key={div} value={div}>
                    {div} Division
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem' }}>
                <input
                  type="checkbox"
                  checked={districtFormActive}
                  onChange={(e) => setDistrictFormActive(e.target.checked)}
                />
                <span style={{ fontWeight: 600 }}>Active Status</span>
              </label>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px', marginLeft: '22px' }}>
                Inactive districts will be hidden from checkout dropdowns
              </div>
            </div>
          </div>
        </RecordModal>
      )}

      {/* ============================================================== */}
      {/* MODAL: CREATE / EDIT THANA                                     */}
      {/* ============================================================== */}
      {editingThana !== null && (
        <RecordModal
          title={editingThana === 'new' ? 'Create Thana (Zone)' : 'Edit Thana (Zone)'}
          submitLabel={editingThana === 'new' ? 'Save Thana' : 'Update Thana'}
          onClose={() => setEditingThana(null)}
          onSubmit={async () => {
            if (!thanaFormName.trim()) throw new Error('Thana name is required');
            if (thanaFormDistrictId <= 0) throw new Error('Parent district is required');
            const payload: ThanaInput = {
              district_id: thanaFormDistrictId,
              name: thanaFormName.trim(),
              shipping_cost: parseFloat(thanaFormShippingCost) || 120.0,
              is_active: thanaFormActive,
            };
            if (editingThana === 'new') {
              await createThana(payload);
              showToast(`Thana "${payload.name}" created successfully.`);
            } else {
              await updateThana(editingThana.id, payload);
              showToast(`Thana "${payload.name}" updated successfully.`);
            }
            await loadThanas();
            await loadDistricts();
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px' }}>
                Parent District *
              </label>
              <select
                required
                value={thanaFormDistrictId}
                onChange={(e) => setThanaFormDistrictId(parseInt(e.target.value, 10))}
                className="form-control"
              >
                <option value={0}>Select District...</option>
                {districts.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.division})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px' }}>
                Thana Name *
              </label>
              <input
                type="text"
                required
                placeholder="Enter Thana / Upazila name, e.g. Dhanmondi, Ashulia"
                value={thanaFormName}
                onChange={(e) => setThanaFormName(e.target.value)}
                className="form-control"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, marginBottom: '4px' }}>
                Base Shipping Cost (BDT) *
              </label>
              <div style={{ position: 'relative' }}>
                <span
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    fontWeight: 800,
                    color: '#64748b',
                  }}
                >
                  ৳
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={thanaFormShippingCost}
                  onChange={(e) => setThanaFormShippingCost(e.target.value)}
                  className="form-control"
                  style={{ paddingLeft: '28px' }}
                />
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                Standard Zone 1 (৳80), Zone 2 (৳110), Zone 3 (৳130)
              </div>
            </div>

            <div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.82rem' }}>
                <input
                  type="checkbox"
                  checked={thanaFormActive}
                  onChange={(e) => setThanaFormActive(e.target.checked)}
                />
                <span style={{ fontWeight: 600 }}>Active Status</span>
              </label>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px', marginLeft: '22px' }}>
                Inactive thanas are hidden from checkout address selection
              </div>
            </div>
          </div>
        </RecordModal>
      )}

      {/* Delete District Confirmation */}
      <ConfirmDeleteModal
        isOpen={deletingDistrict !== null}
        itemName={deletingDistrict ? deletingDistrict.name : ''}
        itemType="District"
        warningMessage={
          deletingDistrict
            ? `Deleting "${deletingDistrict.name}" will also cascade delete all its ${deletingDistrict.total_thanas} associated thanas. This cannot be undone.`
            : ''
        }
        onClose={() => setDeletingDistrict(null)}
        onConfirm={handleConfirmDeleteDistrict}
      />

      {/* Delete Thana Confirmation */}
      <ConfirmDeleteModal
        isOpen={deletingThana !== null}
        itemName={deletingThana ? deletingThana.name : ''}
        itemType="Thana"
        warningMessage={
          deletingThana
            ? `Deleting "${deletingThana.name}" will remove this shipping endpoint. Customers selecting this thana will no longer have a mapped rate until re-added.`
            : ''
        }
        onClose={() => setDeletingThana(null)}
        onConfirm={handleConfirmDeleteThana}
      />
    </div>
  );
};
