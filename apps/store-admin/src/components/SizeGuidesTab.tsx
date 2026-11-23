import React, { useState } from 'react';
import { Ruler, Plus, Pencil, Trash2, Layers, Table, Info } from 'lucide-react';
import { CatalogSizeGuideTemplate, SizeGuideTable, SizeGuideTemplateInput } from '../lib/catalog-api';
import { EmptyState } from './StoreStatusNotices';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface SizeGuidesTabProps {
  items: CatalogSizeGuideTemplate[];
  busy: boolean;
  onSave: (id: string | null, input: SizeGuideTemplateInput) => Promise<void>;
  onDelete: (item: CatalogSizeGuideTemplate) => Promise<void>;
}

interface TableDraft {
  name: string;
  columnsStr: string;
  rowsStr: string;
}

export const SizeGuidesTab: React.FC<SizeGuidesTabProps> = ({ items, busy, onSave, onDelete }) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [templateDesc, setTemplateDesc] = useState('');
  const [tables, setTables] = useState<TableDraft[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CatalogSizeGuideTemplate | null>(null);

  const openCreate = () => {
    setEditingId(null);
    setTemplateName('');
    setTemplateDesc('');
    setTables([
      {
        name: 'Inches (Imperial)',
        columnsStr: 'Size, Chest, Body Length, Shoulder, Sleeve',
        rowsStr: 'S, 40, 28, 19, 8.5\nM, 42, 29, 20, 9.0\nL, 44, 30, 21, 9.5\nXL, 46, 31, 22, 10.0\nXXL, 48, 32, 23, 10.5',
      },
    ]);
    setError(null);
    setModalOpen(true);
  };

  const openEdit = (item: CatalogSizeGuideTemplate) => {
    setEditingId(item.id);
    setTemplateName(item.name);
    setTemplateDesc(item.description);
    if (item.tables && item.tables.length > 0) {
      setTables(
        item.tables.map((t) => ({
          name: t.name,
          columnsStr: t.headers.join(', '),
          rowsStr: t.rows.map((r) => r.join(', ')).join('\n'),
        }))
      );
    } else {
      setTables([
        {
          name: 'Measurements Table',
          columnsStr: 'Size, Chest, Length',
          rowsStr: 'S, 40, 28\nM, 42, 29\nL, 44, 30',
        },
      ]);
    }
    setError(null);
    setModalOpen(true);
  };

  const addTable = () => {
    setTables((prev) => [
      ...prev,
      {
        name: `Table #${prev.length + 1} (e.g. Centimeters)`,
        columnsStr: 'Size, Chest, Body Length, Shoulder, Sleeve',
        rowsStr: 'S, 101.6, 71.1, 48.2, 21.5\nM, 106.7, 73.6, 50.8, 22.8\nL, 111.7, 76.2, 53.3, 24.1',
      },
    ]);
  };

  const removeTable = (idx: number) => {
    setTables((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateTable = (idx: number, patch: Partial<TableDraft>) => {
    setTables((prev) => prev.map((t, i) => (i === idx ? { ...t, ...patch } : t)));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateName.trim()) {
      setError('Template name is required.');
      return;
    }

    if (tables.length === 0) {
      setError('At least one measurement table is required.');
      return;
    }

    const parsedTables: SizeGuideTable[] = [];
    for (let i = 0; i < tables.length; i++) {
      const draft = tables[i];
      const tableName = draft.name.trim() || `Table #${i + 1}`;
      const headers = draft.columnsStr
        .split(',')
        .map((h) => h.trim())
        .filter(Boolean);

      if (headers.length === 0) {
        setError(`Table #${i + 1} ("${tableName}") has no columns defined.`);
        return;
      }

      const rows: string[][] = [];
      const lines = draft.rowsStr.split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        const cells = line.split(',').map((c) => c.trim());
        if (cells.length !== headers.length) {
          setError(
            `Table #${i + 1} ("${tableName}") has row cell mismatch: "${line}" has ${cells.length} values, but there are ${headers.length} columns.`
          );
          return;
        }
        rows.push(cells);
      }

      parsedTables.push({
        name: tableName,
        headers,
        rows,
      });
    }

    try {
      await onSave(editingId, {
        name: templateName.trim(),
        description: templateDesc.trim(),
        tables: parsedTables,
      });
      setModalOpen(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to save size template.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {/* Banner */}
      <div
        className="card"
        style={{
          padding: '14px 18px',
          background: 'linear-gradient(135deg, #0f172a 0%, #042f2e 100%)',
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
            <Ruler size={18} style={{ color: '#2dd4bf' }} />
            <span>Size Guide Templates Architecture</span>
          </h2>
          <p style={{ fontSize: '0.76rem', color: '#cbd5e1', margin: '4px 0 0 0', lineHeight: 1.4 }}>
            Reusable dimensional matrices with CSV fast-entry and multi-table support (Inches & CM, Sets & Co-ords).
            Changes propagate to all linked storefront drops instantly.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreate}
          disabled={busy}
          className="btn btn-primary btn-sm"
          style={{ display: 'flex', alignItems: 'center', gap: '6px', backgroundColor: '#0d9488', borderColor: '#14b8a6' }}
        >
          <Plus size={14} /> Create Size Guide
        </button>
      </div>

      {/* Main Overview Table */}
      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        {items.length === 0 ? (
          <EmptyState message="No size guide templates defined yet. Click 'Create Size Guide' above to add your first fit matrix." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ margin: 0, width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-muted)' }}>
                  <th style={{ padding: '10px 16px', width: '60px' }}>#</th>
                  <th style={{ padding: '10px 16px' }}>TEMPLATE NAME</th>
                  <th style={{ padding: '10px 16px', width: '140px' }}>TABLES COUNT</th>
                  <th style={{ padding: '10px 16px', width: '140px' }}>LINKED DROPS</th>
                  <th style={{ padding: '10px 16px', width: '100px', textAlign: 'right' }}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, idx) => {
                  const tableCount = item.tables?.length || 0;
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '12px 16px', color: 'var(--text-subtle)' }} className="mono">
                        {idx + 1}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{item.name}</div>
                        {item.description && (
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                            {item.description}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          className="badge"
                          style={{
                            background: '#f0fdf4',
                            color: '#166534',
                            borderColor: '#bbf7d0',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: 700,
                          }}
                        >
                          <Table size={12} /> {tableCount} {tableCount === 1 ? 'Table' : 'Tables'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span
                          className="badge"
                          style={{
                            background: '#f8fafc',
                            color: 'var(--text-main)',
                            borderColor: 'var(--border)',
                            fontWeight: 700,
                          }}
                        >
                          {item.linkedItems || 0} Drops Linked
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-secondary"
                            onClick={() => openEdit(item)}
                            title="Edit Size Guide Template"
                          >
                            <Pencil size={13} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ color: '#dc2626', borderColor: '#fca5a5' }}
                            onClick={() => setDeleteTarget(item)}
                            title="Delete Template"
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

      {/* Multi-Table Builder Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)} style={{ zIndex: 1000 }}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '820px',
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
                  {editingId ? 'Edit Size Guide Template' : 'Create Size Guide Template'}
                </h2>
                <p style={{ fontSize: '0.76rem', color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
                  Define dimensional matrices with fast CSV multiline entry and multi-table support
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

            {/* Scrollable Form Body */}
            <form onSubmit={handleSave} style={{ overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {error && (
                <div className="notice notice-error" role="alert" style={{ margin: 0 }}>
                  {error}
                </div>
              )}

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>
                  <span style={{ color: '#ef4444' }}>* </span>Template Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acid-Wash Oversized Heavyweight Tees Fit Guide"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 700 }}>
                  Description / Merchandising Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Standard 240 GSM drop-shoulder boxy cut. True to size with relaxed drape."
                  value={templateDesc}
                  onChange={(e) => setTemplateDesc(e.target.value)}
                  className="form-input"
                />
              </div>

              {/* Multi-Table Array Builder */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Layers size={14} style={{ color: 'var(--primary)' }} />
                    Measurement Tables ({tables.length})
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {tables.map((t, idx) => (
                    <div
                      key={idx}
                      style={{
                        border: '1px solid var(--border)',
                        borderRadius: 'var(--radius-md)',
                        padding: '14px 16px',
                        backgroundColor: '#f8fafc',
                        position: 'relative',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 800, color: 'var(--text-main)', textTransform: 'uppercase' }}>
                          Table #{idx + 1}
                        </span>
                        {tables.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeTable(idx)}
                            className="btn btn-xs"
                            style={{ color: '#dc2626', borderColor: '#fca5a5', background: '#fff' }}
                            title="Delete this table"
                          >
                            <Trash2 size={12} /> Remove Table
                          </button>
                        )}
                      </div>

                      <div className="form-group" style={{ marginBottom: '10px' }}>
                        <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                          Table Name * (e.g. Measurements in Inches or Jacket Sizing)
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Inches (Imperial)"
                          value={t.name}
                          onChange={(e) => updateTable(idx, { name: e.target.value })}
                          className="form-input"
                          style={{ backgroundColor: '#fff', fontSize: '0.82rem' }}
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: '10px' }}>
                        <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                          Columns * (Comma-separated header names)
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="Size, Chest, Body Length, Shoulder, Sleeve"
                          value={t.columnsStr}
                          onChange={(e) => updateTable(idx, { columnsStr: e.target.value })}
                          className="form-input mono"
                          style={{ backgroundColor: '#fff', fontSize: '0.8rem' }}
                        />
                      </div>

                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label" style={{ fontSize: '0.75rem', fontWeight: 700 }}>
                          Measurement Rows * (CSV format, one size row per line)
                        </label>
                        <textarea
                          rows={5}
                          required
                          placeholder="S, 40, 28, 19, 8.5&#10;M, 42, 29, 20, 9.0&#10;L, 44, 30, 21, 9.5&#10;XL, 46, 31, 22, 10.0"
                          value={t.rowsStr}
                          onChange={(e) => updateTable(idx, { rowsStr: e.target.value })}
                          className="form-input mono"
                          style={{ backgroundColor: '#fff', fontSize: '0.8rem', resize: 'vertical' }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addTable}
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: '12px', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Plus size={13} /> Add Another Size Guide Table (e.g. Centimeters / Coordinates)
                </button>
              </div>

              <div className="notice notice-info" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', margin: 0 }}>
                <Info size={15} style={{ flexShrink: 0 }} />
                <span>
                  Paste comma-separated rows directly from Google Sheets or Excel. The system validates cell parity automatically.
                </span>
              </div>

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
                  style={{ backgroundColor: '#0d9488', borderColor: '#14b8a6' }}
                >
                  {busy ? 'Saving...' : 'Save Template'}
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
          itemType="Size Guide Template"
          warningMessage={`Deleting this template will unbind it from any linked drops (${deleteTarget.linkedItems || 0} active).`}
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
