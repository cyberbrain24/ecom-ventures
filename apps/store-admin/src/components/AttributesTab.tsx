import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Sliders, Palette, Tag, Type, Image as ImageIcon, Info, HelpCircle } from 'lucide-react';
import { CatalogAttribute, AttributeInput } from '../lib/catalog-api';
import { EmptyState } from './StoreStatusNotices';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface AttributesTabProps {
  attributes: CatalogAttribute[];
  busy: boolean;
  onSave: (id: string | null, input: AttributeInput) => Promise<void>;
  onDelete: (attribute: CatalogAttribute) => Promise<void>;
}

interface SwatchChoice {
  value: string;
  displayValue: string;
  colorHex: string;
  imageUrl: string;
}

export const AttributesTab: React.FC<AttributesTabProps> = ({ attributes, busy, onSave, onDelete }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CatalogAttribute | null>(null);

  // Form Fields
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [dataType, setDataType] = useState<'text' | 'number' | 'boolean' | 'select'>('select');
  const [displayType, setDisplayType] = useState<'text' | 'color' | 'image'>('text');
  const [listingOrder, setListingOrder] = useState<number>(0);
  const [simpleChoices, setSimpleChoices] = useState('');
  const [swatches, setSwatches] = useState<SwatchChoice[]>([]);
  const [error, setError] = useState<string | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setName('');
    setCode('');
    setDataType('select');
    setDisplayType('text');
    setListingOrder(0);
    setSimpleChoices('S, M, L, XL, XXL');
    setSwatches([
      { value: 'Black', displayValue: 'Jet Black', colorHex: '#0f172a', imageUrl: '' },
      { value: 'Charcoal', displayValue: 'Washed Charcoal', colorHex: '#334155', imageUrl: '' },
    ]);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (attr: CatalogAttribute) => {
    setEditingId(attr.id);
    setName(attr.name);
    setCode(attr.code);
    setDataType((attr.dataType as any) || 'select');
    setDisplayType((attr.displayType as any) || 'text');
    setListingOrder(attr.sortOrder || 0);
    setSimpleChoices(attr.values.map((v) => v.displayValue || v.value).join(', '));
    if (attr.values && attr.values.length > 0) {
      setSwatches(
        attr.values.map((v) => ({
          value: v.value,
          displayValue: v.displayValue || v.value,
          colorHex: v.colorHex || '#0f172a',
          imageUrl: v.imageUrl || '',
        }))
      );
    } else {
      setSwatches([]);
    }
    setError(null);
    setModalOpen(true);
  };

  const addSwatchRow = () => {
    setSwatches((prev) => [
      ...prev,
      {
        value: `Option ${prev.length + 1}`,
        displayValue: `Option ${prev.length + 1}`,
        colorHex: '#3b82f6',
        imageUrl: '',
      },
    ]);
  };

  const removeSwatchRow = (idx: number) => {
    setSwatches((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateSwatchRow = (idx: number, patch: Partial<SwatchChoice>) => {
    setSwatches((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Attribute Label is required.');
      return;
    }
    const cleanCode = code.trim() || name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');

    let valuesPayload: { value: string; displayValue?: string; colorHex?: string; imageUrl?: string }[] = [];

    if (dataType === 'select') {
      if (displayType === 'color' || displayType === 'image') {
        if (swatches.length === 0) {
          setError('At least one swatch choice is required for Color or Image display styles.');
          return;
        }
        valuesPayload = swatches.map((s) => ({
          value: s.value.trim(),
          displayValue: s.displayValue.trim() || s.value.trim(),
          colorHex: displayType === 'color' ? s.colorHex : undefined,
          imageUrl: displayType === 'image' ? s.imageUrl.trim() : undefined,
        }));
      } else {
        // Text pill / simple choices
        const rawTokens = simpleChoices.split(',').map((s) => s.trim()).filter(Boolean);
        valuesPayload = rawTokens.map((val) => ({
          value: val,
          displayValue: val,
        }));
      }
    } else if (dataType === 'text' && simpleChoices.trim()) {
      // Descriptive predefined text presets
      const rawTokens = simpleChoices.split(',').map((s) => s.trim()).filter(Boolean);
      valuesPayload = rawTokens.map((val) => ({
        value: val,
        displayValue: val,
      }));
    }

    try {
      await onSave(editingId, {
        name: name.trim(),
        code: cleanCode,
        dataType,
        displayType,
        sortOrder: listingOrder,
        values: valuesPayload,
      });
      setModalOpen(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to save attribute configuration.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Banner */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)',
          color: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px',
          border: '1px solid rgba(255,255,255,0.1)',
        }}
      >
        <div>
          <h2 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Sliders size={18} style={{ color: '#818cf8' }} />
            <span>Global Specification Attributes & Variant Dimensions</span>
          </h2>
          <p style={{ fontSize: '0.76rem', color: '#cbd5e1', margin: '4px 0 0 0', lineHeight: 1.4 }}>
            Configure technical specifications and storefront interactive variant selector styles (Text Pills, Circular HEX Swatches, and Image Thumbnails).
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          disabled={busy}
          className="btn btn-primary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={14} /> Define Attribute
        </button>
      </div>

      {/* Main Attributes Overview Table */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        {attributes.length === 0 ? (
          <EmptyState message="No specification attributes defined yet. Click 'Define Attribute' above to configure options like Size, Color, or GSM." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 16px', width: '150px' }}>LABEL</th>
                  <th style={{ padding: '10px 16px', width: '140px' }}>CODE</th>
                  <th style={{ padding: '10px 16px', width: '180px' }}>TYPE & DISPLAY</th>
                  <th style={{ padding: '10px 16px' }}>CHOICES / SWATCHES PREVIEW</th>
                  <th style={{ padding: '10px 16px', width: '100px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {attributes.map((attr) => {
                  const isSelect = attr.dataType === 'select' || !attr.dataType;
                  const isColor = isSelect && attr.displayType === 'color';
                  const isImage = isSelect && attr.displayType === 'image';

                  return (
                    <tr key={attr.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 800, color: 'var(--text-main)' }}>{attr.name}</div>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <span className="mono" style={{ fontSize: '0.76rem', color: 'var(--text-muted)', background: '#f1f5f9', padding: '2px 6px', borderRadius: '4px' }}>
                          {attr.code}
                        </span>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span
                            className="badge"
                            style={{
                              background: '#f8fafc',
                              color: 'var(--text-main)',
                              borderColor: 'var(--border)',
                              fontSize: '0.68rem',
                              fontWeight: 800,
                            }}
                          >
                            {(attr.dataType || 'select').toUpperCase()}
                          </span>

                          {isSelect && (
                            <span
                              className="badge"
                              style={{
                                background: isColor ? '#fef3c7' : isImage ? '#f3e8ff' : '#f0fdf4',
                                color: isColor ? '#92400e' : isImage ? '#6b21a8' : '#166534',
                                borderColor: isColor ? '#fde68a' : isImage ? '#e9d5ff' : '#bbf7d0',
                                fontSize: '0.68rem',
                                fontWeight: 800,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                            >
                              {isColor && <Palette size={10} />}
                              {isImage && <ImageIcon size={10} />}
                              {(attr.displayType || 'text').toUpperCase()}
                            </span>
                          )}
                        </div>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        {attr.values.length === 0 ? (
                          <span style={{ color: 'var(--text-subtle)', fontStyle: 'italic', fontSize: '0.76rem' }}>
                            {attr.dataType === 'number' ? 'Dynamic numeric value input on product' : 'Free-form text specification'}
                          </span>
                        ) : (
                          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                            {attr.values.map((v) => (
                              <div
                                key={v.id}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '5px',
                                  padding: '2px 8px',
                                  borderRadius: 'var(--radius-sm)',
                                  background: '#ffffff',
                                  border: '1px solid var(--border)',
                                  fontSize: '0.74rem',
                                  fontWeight: 600,
                                }}
                              >
                                {v.colorHex && (
                                  <span
                                    style={{
                                      width: '12px',
                                      height: '12px',
                                      borderRadius: '50%',
                                      backgroundColor: v.colorHex,
                                      border: '1px solid rgba(0,0,0,0.2)',
                                      display: 'inline-block',
                                    }}
                                  />
                                )}
                                {v.imageUrl && (
                                  <img
                                    src={v.imageUrl}
                                    alt=""
                                    style={{ width: '14px', height: '14px', borderRadius: '3px', objectFit: 'cover' }}
                                  />
                                )}
                                <span>{v.displayValue || v.value}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => openEdit(attr)}
                            title="Edit Attribute"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                            onClick={() => setDeleteTarget(attr)}
                            title="Delete Attribute"
                          >
                            <Trash2 size={13} />
                          </button>
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

      {/* Define / Edit Attribute Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)} style={{ zIndex: 1000 }}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '680px',
              width: '95%',
              backgroundColor: '#ffffff',
              borderRadius: 'var(--radius-lg)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid var(--border)',
              padding: 0,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              maxHeight: '90vh',
            }}
          >
            {/* Header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 24px',
                borderBottom: '1px solid var(--border)',
                background: '#ffffff',
              }}
            >
              <div>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>
                  {editingId ? 'Edit Attribute Specification' : 'Define Attribute Specification'}
                </h2>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  Define technical specification properties and interactive storefront variant selector styles
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                style={{
                  background: '#f8fafc',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-sm)',
                  padding: '4px 8px',
                  cursor: 'pointer',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                }}
              >
                ✕
              </button>
            </div>

            {/* Scrollable Form */}
            <form onSubmit={handleSave} style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {error && (
                <div className="notice notice-error" role="alert" style={{ margin: 0 }}>
                  {error}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    <span style={{ color: '#ef4444' }}>* </span>Attribute Label
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Fabric Color, Size, GSM Weight"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Unique Code Identifier (SKU slug)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. color, size, fabric_gsm"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="form-input mono"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    Attribute Data Type *
                  </label>
                  <select
                    value={dataType}
                    onChange={(e) => setDataType(e.target.value as any)}
                    className="form-select"
                  >
                    <option value="select">Dropdown / Matrix Choices (Variants)</option>
                    <option value="text">Free-form Single-line Text</option>
                    <option value="number">Numeric Metric (e.g. GSM / Thread Count)</option>
                    <option value="boolean">Binary Flag (Yes / No)</option>
                  </select>
                </div>

                {dataType === 'select' ? (
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>
                      Display Style on Storefront
                    </label>
                    <select
                      value={displayType}
                      onChange={(e) => setDisplayType(e.target.value as any)}
                      className="form-select"
                    >
                      <option value="text">Standard Text Pill Button (e.g. S, M, L)</option>
                      <option value="color">Circular Color Swatch with HEX Code</option>
                      <option value="image">Thumbnail Image Swatch (Pattern Crop)</option>
                    </select>
                  </div>
                ) : (
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 700 }}>
                      Listing Order
                    </label>
                    <input
                      type="number"
                      value={listingOrder}
                      onChange={(e) => setListingOrder(parseInt(e.target.value, 10) || 0)}
                      className="form-input"
                    />
                  </div>
                )}
              </div>

              {/* Dynamic Choices / Swatches Section */}
              {dataType === 'select' && (displayType === 'color' || displayType === 'image') ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Palette size={14} style={{ color: 'var(--primary)' }} />
                      Dynamic Swatch Choices ({swatches.length})
                    </span>
                    <button
                      type="button"
                      onClick={addSwatchRow}
                      className="btn btn-secondary btn-xs"
                      style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Plus size={12} /> Add Swatch Choice
                    </button>
                  </div>

                  <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
                      <thead>
                        <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                          <th style={{ padding: '8px 12px' }}>OPTION VALUE</th>
                          <th style={{ padding: '8px 12px' }}>DISPLAY LABEL</th>
                          <th style={{ padding: '8px 12px', width: displayType === 'color' ? '140px' : '220px' }}>
                            {displayType === 'color' ? 'COLOR (HEX)' : 'IMAGE ASSET URL'}
                          </th>
                          <th style={{ padding: '8px 12px', width: '50px' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {swatches.map((s, idx) => (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--border)', background: '#ffffff' }}>
                            <td style={{ padding: '6px 12px' }}>
                              <input
                                type="text"
                                required
                                placeholder="e.g. Black"
                                value={s.value}
                                onChange={(e) => updateSwatchRow(idx, { value: e.target.value })}
                                className="form-input"
                                style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                              />
                            </td>
                            <td style={{ padding: '6px 12px' }}>
                              <input
                                type="text"
                                placeholder="e.g. Jet Black"
                                value={s.displayValue}
                                onChange={(e) => updateSwatchRow(idx, { displayValue: e.target.value })}
                                className="form-input"
                                style={{ fontSize: '0.78rem', padding: '4px 8px' }}
                              />
                            </td>
                            <td style={{ padding: '6px 12px' }}>
                              {displayType === 'color' ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <input
                                    type="color"
                                    value={s.colorHex || '#000000'}
                                    onChange={(e) => updateSwatchRow(idx, { colorHex: e.target.value })}
                                    style={{
                                      width: '28px',
                                      height: '28px',
                                      border: '1px solid var(--border)',
                                      borderRadius: '4px',
                                      cursor: 'pointer',
                                      padding: 0,
                                    }}
                                  />
                                  <input
                                    type="text"
                                    value={s.colorHex || '#000000'}
                                    onChange={(e) => updateSwatchRow(idx, { colorHex: e.target.value })}
                                    className="form-input mono"
                                    style={{ fontSize: '0.75rem', padding: '4px 6px', width: '80px' }}
                                  />
                                </div>
                              ) : (
                                <input
                                  type="text"
                                  placeholder="e.g. /media/acid-wash-dark.webp"
                                  value={s.imageUrl}
                                  onChange={(e) => updateSwatchRow(idx, { imageUrl: e.target.value })}
                                  className="form-input mono"
                                  style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                                />
                              )}
                            </td>
                            <td style={{ padding: '6px 12px', textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => removeSwatchRow(idx)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: '#dc2626',
                                  cursor: 'pointer',
                                  padding: '4px',
                                }}
                                title="Delete Choice"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 700 }}>
                    {dataType === 'select' ? 'Selectable Option Choices (Comma separated)' : 'Predefined Preset Values (Optional)'}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. S, M, L, XL, XXL or 100% Cotton, 80/20 Fleece"
                    value={simpleChoices}
                    onChange={(e) => setSimpleChoices(e.target.value)}
                    className="form-input"
                  />
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Separate choices with commas. These will generate variant options or selectable specification presets.
                  </span>
                </div>
              )}

              {/* Action Strip */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                  borderTop: '1px solid var(--border)',
                  paddingTop: '14px',
                  marginTop: '8px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn btn-secondary btn-sm"
                  disabled={busy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  disabled={busy}
                >
                  {busy ? 'Saving...' : 'Save Attribute'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      {deleteTarget && (
        <ConfirmDeleteModal
          isOpen={true}
          itemName={deleteTarget.name}
          itemType="Attribute"
          warningMessage={`Deleting this attribute will unbind related variant options from your store catalog.`}
          onClose={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await onDelete(deleteTarget);
            setDeleteTarget(null);
          }}
        />
      )}
    </div>
  );
};
