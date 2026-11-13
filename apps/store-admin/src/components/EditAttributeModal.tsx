import React, { useState } from 'react';
import { X, Save, Sliders } from 'lucide-react';
import { StoreAttribute } from '../types/store';

interface EditAttributeModalProps {
  attribute: StoreAttribute;
  onClose: () => void;
  onSave: (updated: StoreAttribute) => void;
}

export const EditAttributeModal: React.FC<EditAttributeModalProps> = ({ attribute, onClose, onSave }) => {
  const [name, setName] = useState(attribute.name);
  const [code, setCode] = useState(attribute.code);
  const [displayType, setDisplayType] = useState<'SELECT' | 'COLOR_SWATCH' | 'BUTTON'>(attribute.displayType);
  const [valuesText, setValuesText] = useState(attribute.values.map((v) => v.displayValue).join(', '));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !code.trim()) return;

    const vals = valuesText
      .split(',')
      .map((v) => v.trim())
      .filter((v) => v.length > 0)
      .map((v, i) => {
        const existing = attribute.values.find((ev) => ev.displayValue.toLowerCase() === v.toLowerCase());
        return {
          id: existing?.id || `val-${Date.now()}-${i}`,
          value: v.toLowerCase(),
          displayValue: v,
          colorHex: displayType === 'COLOR_SWATCH' ? (existing?.colorHex || '#047857') : undefined,
        };
      });

    const updated: StoreAttribute = {
      ...attribute,
      name: name.trim(),
      code: code.trim().toLowerCase(),
      displayType,
      values: vals,
    };
    onSave(updated);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal-content" style={{ maxWidth: '480px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sliders size={15} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>Edit Product Attribute</h3>
              <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-subtle)' }}>code: {attribute.code}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid" style={{ marginBottom: '10px' }}>
            <div className="form-group">
              <label className="form-label">Attribute Name *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="form-input"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Code Key *</label>
              <input
                type="text"
                required
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="form-input"
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '10px' }}>
            <label className="form-label">Display Swatch Type</label>
            <select
              value={displayType}
              onChange={(e) => setDisplayType(e.target.value as any)}
              className="form-select"
            >
              <option value="BUTTON">Selectable Buttons (Size / Specs)</option>
              <option value="COLOR_SWATCH">Color Circle Swatches</option>
              <option value="SELECT">Dropdown Menu</option>
            </select>
          </div>

          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label className="form-label">Values (Comma separated)</label>
            <input
              type="text"
              required
              value={valuesText}
              onChange={(e) => setValuesText(e.target.value)}
              className="form-input"
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">Cancel</button>
            <button type="submit" className="btn btn-primary btn-sm">
              <Save size={13} />
              <span>Save Attribute Changes</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
