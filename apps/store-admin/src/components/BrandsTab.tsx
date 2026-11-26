import React, { useState } from 'react';
import { Pencil, Plus, Trash2, Upload, X } from 'lucide-react';
import { uploadStoreMedia } from '../lib/api';
import { BrandInput, CatalogBrand } from '../lib/catalog-api';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';
import { RecordModal } from './RecordModal';
import { SortableList } from './SortableList';
import { EmptyState } from './StoreStatusNotices';

/** Props for the Brands tab. */
interface BrandsTabProps {
  brands: CatalogBrand[];
  /** True while another change is being saved. */
  busy: boolean;
  onReorder: (next: CatalogBrand[]) => void;
  /** Creates (id null) or updates a brand. Throws with a readable message when the server rejects it. */
  onSave: (id: string | null, input: BrandInput) => Promise<void>;
  /** Deletes a brand; errors are shown by the parent. */
  onDelete: (brand: CatalogBrand) => Promise<void>;
}

const EMPTY_BRAND: BrandInput = { name: '', slug: '', logoUrl: '', origin: '', description: '', websiteUrl: '', isActive: true };

/** Props for the brand form. */
interface BrandModalProps {
  /** The brand being edited, or null to create one. */
  brand: CatalogBrand | null;
  onSave: BrandsTabProps['onSave'];
  onClose: () => void;
}

/** Create and edit form for a brand. */
const BrandModal: React.FC<BrandModalProps> = ({ brand, onSave, onClose }) => {
  const [form, setForm] = useState<BrandInput>(
    brand === null
      ? EMPTY_BRAND
      : {
          name: brand.name,
          slug: brand.slug,
          logoUrl: brand.logoUrl,
          origin: brand.origin,
          description: brand.description,
          websiteUrl: brand.websiteUrl,
          isActive: brand.isActive,
        },
  );
  const set = <K extends keyof BrandInput>(key: K, value: BrandInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const [logoUploadError, setLogoUploadError] = useState<string | null>(null);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setIsUploadingLogo(true);
    setLogoUploadError(null);
    try {
      const uploaded = await uploadStoreMedia(file, 'brand');
      set('logoUrl', uploaded.url);
    } catch (err) {
      setLogoUploadError(err instanceof Error ? err.message : 'Failed to upload brand logo.');
    } finally {
      setIsUploadingLogo(false);
    }
  };

  return (
    <RecordModal
      title={brand === null ? 'Add brand' : `Edit brand: ${brand.name}`}
      submitLabel={brand === null ? 'Add brand' : 'Save brand'}
      onClose={onClose}
      onSubmit={async () => {
        if (form.name.trim() === '') throw new Error('Brand name is required.');
        await onSave(brand?.id ?? null, form);
      }}
    >
      <div className="form-grid">
        <div className="form-group">
          <label className="form-label" htmlFor="brand-name">Name *</label>
          <input id="brand-name" className="form-input" value={form.name} maxLength={120} onChange={(e) => set('name', e.target.value)} autoFocus />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="brand-slug">Slug</label>
          <input id="brand-slug" className="form-input" value={form.slug} placeholder="Built from the name if empty" onChange={(e) => set('slug', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="brand-origin">Origin</label>
          <input id="brand-origin" className="form-input" value={form.origin} maxLength={120} placeholder="For example Italy" onChange={(e) => set('origin', e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="brand-website">Website</label>
          <input id="brand-website" className="form-input" value={form.websiteUrl} placeholder="https://" onChange={(e) => set('websiteUrl', e.target.value)} />
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label" htmlFor="brand-logo">Logo (Upload or URL)</label>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              id="brand-logo"
              className="form-input"
              style={{ flex: 1 }}
              value={form.logoUrl}
              placeholder="https://... or upload a logo"
              onChange={(e) => set('logoUrl', e.target.value)}
            />
            <label
              className="btn btn-secondary"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                cursor: isUploadingLogo ? 'not-allowed' : 'pointer',
                whiteSpace: 'nowrap',
                opacity: isUploadingLogo ? 0.6 : 1,
              }}
            >
              <Upload size={14} />
              <span>{isUploadingLogo ? 'Uploading...' : 'Upload Logo'}</span>
              <input
                type="file"
                accept="image/*"
                disabled={isUploadingLogo}
                onChange={handleLogoUpload}
                style={{ display: 'none' }}
              />
            </label>
          </div>
          {logoUploadError && (
            <p style={{ color: '#e11d48', fontSize: '0.78rem', marginTop: '6px' }}>{logoUploadError}</p>
          )}
          {form.logoUrl && (
            <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <img
                src={form.logoUrl}
                alt="Brand logo preview"
                style={{
                  width: '56px',
                  height: '56px',
                  objectFit: 'contain',
                  borderRadius: '8px',
                  border: '1px solid #e2e8f0',
                  background: '#ffffff',
                  padding: '4px',
                }}
              />
              <button
                type="button"
                onClick={() => set('logoUrl', '')}
                className="btn btn-secondary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', padding: '4px 10px' }}
              >
                <X size={12} />
                <span>Remove</span>
              </button>
            </div>
          )}
        </div>
        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
          <label className="form-label" htmlFor="brand-description">Description</label>
          <textarea id="brand-description" className="form-textarea" rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} />
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
 * The Brands tab: brands in the merchant's order, with add, edit and delete. Drag a row, type a position, or use
 * the arrows to reorder. Deleting asks for confirmation first.
 */
export const BrandsTab: React.FC<BrandsTabProps> = ({ brands, busy, onReorder, onSave, onDelete }) => {
  const [editing, setEditing] = useState<CatalogBrand | 'new' | null>(null);
  const [deleting, setDeleting] = useState<CatalogBrand | null>(null);

  return (
    <div className="card" style={{ padding: '10px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', gap: '8px', flexWrap: 'wrap' }}>
        <p className="sortable-hint" style={{ margin: 0 }}>Drag a row, type a position, or use the arrows to change the order.</p>
        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => setEditing('new')}>
          <Plus size={13} /> Add brand
        </button>
      </div>

      {brands.length === 0 ? (
        <EmptyState message="This store has no brands yet. Use Add brand to create the first one." />
      ) : (
        <SortableList
          label="Brands"
          items={brands}
          getId={(b) => b.id}
          disabled={busy}
          onReorder={onReorder}
          renderItem={(brand, row) => (
            <div className="sortable-line">
              {row.controls}
              <div className="sortable-thumb">{brand.logoUrl !== '' ? <img src={brand.logoUrl} alt="" draggable={false} /> : null}</div>
              <div className="sortable-main">
                <strong>{brand.name}</strong>
                <span className="sortable-sub mono">{brand.slug}</span>
              </div>
              <span className="sortable-cell">{brand.origin !== '' ? brand.origin : 'No origin'}</span>
              <span className={`badge ${brand.isActive ? 'badge-active' : 'badge-outline'}`}>{brand.isActive ? 'Active' : 'Inactive'}</span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setEditing(brand)}>
                  <Pencil size={13} /> Edit
                </button>
                <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => setDeleting(brand)}>
                  <Trash2 size={13} /> Delete
                </button>
              </div>
            </div>
          )}
        />
      )}

      {editing !== null && (
        <BrandModal brand={editing === 'new' ? null : editing} onSave={onSave} onClose={() => setEditing(null)} />
      )}

      <ConfirmDeleteModal
        isOpen={deleting !== null}
        itemName={deleting?.name ?? ''}
        itemType="Brand"
        warningMessage="This permanently deletes the brand and removes it from the brand list. This cannot be undone."
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
