import React, { useState } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { CareInstructionInput, CatalogCareInstruction } from '../lib/catalog-api';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { RecordModal } from './RecordModal';
import { SortableList } from './SortableList';
import { EmptyState } from './StoreStatusNotices';

/** Props for the Care instructions tab. */
interface CareInstructionsTabProps {
  items: CatalogCareInstruction[];
  /** True while another change is being saved. */
  busy: boolean;
  onReorder: (next: CatalogCareInstruction[]) => void;
  /** Creates (id null) or updates a care instruction. Throws with a readable message when the server rejects it. */
  onSave: (id: string | null, input: CareInstructionInput) => Promise<void>;
  /** Deletes a care instruction; errors are shown by the parent. */
  onDelete: (item: CatalogCareInstruction) => Promise<void>;
}

/** Form state: steps are edited one per line and symbols as a comma-separated list. */
interface CareForm {
  title: string;
  materialCategory: string;
  stepsText: string;
  symbolsText: string;
  description: string;
  isActive: boolean;
}

/** Splits free text into trimmed, non-empty entries on the given separator. */
function splitEntries(text: string, separator: RegExp): string[] {
  return text
    .split(separator)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}

/** Props for the care instruction form. */
interface CareModalProps {
  /** The care instruction being edited, or null to create one. */
  item: CatalogCareInstruction | null;
  onSave: CareInstructionsTabProps['onSave'];
  onClose: () => void;
}

/** Create and edit form for a care instruction. */
const CareModal: React.FC<CareModalProps> = ({ item, onSave, onClose }) => {
  const [form, setForm] = useState<CareForm>({
    title: item?.title ?? '',
    materialCategory: item?.materialCategory ?? '',
    stepsText: item?.instructions.join('\n') ?? '',
    symbolsText: item?.careSymbols.join(', ') ?? '',
    description: item?.description ?? '',
    isActive: item?.isActive ?? true,
  });
  const set = <K extends keyof CareForm>(key: K, value: CareForm[K]) => setForm((f) => ({ ...f, [key]: value }));

  return (
    <RecordModal
      title={item === null ? 'Add care instruction' : `Edit care instruction: ${item.title}`}
      submitLabel={item === null ? 'Add care instruction' : 'Save care instruction'}
      onClose={onClose}
      onSubmit={async () => {
        const instructions = splitEntries(form.stepsText, /\r?\n/);
        if (form.title.trim() === '') throw new Error('Title is required.');
        if (instructions.length === 0) throw new Error('Add at least one care step.');
        await onSave(item?.id ?? null, {
          title: form.title,
          materialCategory: form.materialCategory,
          instructions,
          careSymbols: splitEntries(form.symbolsText, /,/),
          description: form.description,
          isActive: form.isActive,
        });
      }}
    >
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label" htmlFor="care-title">Title *</label>
          <input id="care-title" className="form-input" value={form.title} maxLength={160} onChange={(e) => set('title', e.target.value)} autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="care-material">Material</label>
          <input id="care-material" className="form-input" value={form.materialCategory} maxLength={120} placeholder="For example Silk" onChange={(e) => set('materialCategory', e.target.value)} />
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label" htmlFor="care-steps">Care steps * (one per line)</label>
          <textarea id="care-steps" className="form-textarea" rows={5} value={form.stepsText} onChange={(e) => set('stepsText', e.target.value)} />
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label" htmlFor="care-symbols">Care symbols (comma separated)</label>
          <input id="care-symbols" className="form-input" value={form.symbolsText} placeholder="wash-30, no-bleach, iron-low" onChange={(e) => set('symbolsText', e.target.value)} />
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label" htmlFor="care-description">Description</label>
          <textarea id="care-description" className="form-textarea" rows={2} value={form.description} onChange={(e) => set('description', e.target.value)} />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', gridColumn: '1 / -1' }}>
          <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
          Active
        </label>
      </div>
    </RecordModal>
  );
};

/**
 * The Care instructions tab: care instructions in the merchant's order, with add, edit and delete. Drag a row,
 * type a position, or use the arrows to reorder. Deleting asks for confirmation first.
 */
export const CareInstructionsTab: React.FC<CareInstructionsTabProps> = ({ items, busy, onReorder, onSave, onDelete }) => {
  const [editing, setEditing] = useState<CatalogCareInstruction | 'new' | null>(null);
  const [deleting, setDeleting] = useState<CatalogCareInstruction | null>(null);

  return (
    <div className="card" style={{ padding: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '8px', flexWrap: 'wrap' }}>
        <p className="sortable-hint" style={{ margin: 0 }}>Drag a row, type a position, or use the arrows to change the order.</p>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => setEditing('new')}>
          <Plus size={13} /> Add care instruction
        </button>
      </div>

      {items.length === 0 ? (
        <EmptyState message="This store has no care instructions yet. Use Add care instruction to create the first one." />
      ) : (
        <SortableList
          label="Care instructions"
          items={items}
          getId={(c) => c.id}
          disabled={busy}
          onReorder={onReorder}
          renderItem={(item, row) => (
            <div className="sortable-line">
              {row.controls}
              <div className="sortable-main">
                <strong>{item.title}</strong>
                <span className="sortable-sub">
                  {item.instructions.length} {item.instructions.length === 1 ? 'step' : 'steps'}: {item.instructions[0]}
                </span>
              </div>
              <span className="sortable-cell">{item.materialCategory !== '' ? item.materialCategory : 'No material'}</span>
              <span className="sortable-cell mono">{item.careSymbols.join(', ')}</span>
              <span className={`badge ${item.isActive ? 'badge-active' : 'badge-outline'}`}>{item.isActive ? 'Active' : 'Inactive'}</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setEditing(item)}>
                  <Pencil size={13} /> Edit
                </button>
                <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => setDeleting(item)}>
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
          )}
        />
      )}

      {editing !== null && (
        <CareModal item={editing === 'new' ? null : editing} onSave={onSave} onClose={() => setEditing(null)} />
      )}

      <ConfirmDeleteModal
        isOpen={deleting !== null}
        itemName={deleting?.title ?? ''}
        itemType="Care instruction"
        warningMessage="This permanently deletes the care instruction and removes it from the list. This cannot be undone."
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          const target = deleting;
          setDeleting(null);
          if (target !== null) void onDelete(target);
        }}
      />
    </div>
  );
};
