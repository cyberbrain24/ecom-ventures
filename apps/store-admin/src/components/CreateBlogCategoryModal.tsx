import React, { useState } from 'react';
import { X, Save, FolderPlus, Globe } from 'lucide-react';
import { StoreBlogCategory } from '../types/store';

interface CreateBlogCategoryModalProps {
  onClose: () => void;
  onSave: (cat: StoreBlogCategory) => void;
}

export const CreateBlogCategoryModal: React.FC<CreateBlogCategoryModalProps> = ({ onClose, onSave }) => {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [displayOrder, setDisplayOrder] = useState('1');
  const [isActive, setIsActive] = useState(true);

  const handleNameChange = (val: string) => {
    setName(val);
    if (!slug || slug === name.toLowerCase().replace(/[^a-z0-9]+/g, '-')) {
      const generated = val.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      setSlug(generated);
      setMetaTitle(`${val} | Blog Category`);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newCategory: StoreBlogCategory = {
      id: `bcat-${Date.now()}`,
      name: name.trim(),
      slug: (slug || name).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      description: description.trim(),
      metaTitle: metaTitle.trim() || `${name.trim()} | Blog Category`,
      metaDescription: metaDescription.trim() || description.trim(),
      displayOrder: parseInt(displayOrder, 10) || 1,
      isActive,
      postCount: 0,
    };

    onSave(newCategory);
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal-content" style={{ maxWidth: '520px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: 'var(--radius-sm)', backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FolderPlus size={15} />
            </div>
            <div>
              <h3 style={{ fontSize: '0.92rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>Create Blog Category</h3>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-subtle)' }}>Organize editorial content for search engines</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)' }}>
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
              Category Name <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Sustainable Fashion Guides"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              className="input-field"
              style={{ width: '100%', fontSize: '0.82rem', padding: '7px 10px' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
              URL Slug <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              <span style={{ padding: '0 8px', fontSize: '0.72rem', color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)' }}>/blog?category=</span>
              <input
                type="text"
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                style={{ flex: 1, border: 'none', background: 'transparent', padding: '7px 8px', fontSize: '0.82rem', outline: 'none', fontFamily: 'var(--font-mono)' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
              Description
            </label>
            <textarea
              rows={2}
              placeholder="Brief summary explaining what this topic covers..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-field"
              style={{ width: '100%', fontSize: '0.82rem', padding: '7px 10px', resize: 'vertical' }}
            />
          </div>

          <div style={{ padding: '10px 12px', background: 'rgba(16, 185, 129, 0.05)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(16, 185, 129, 0.15)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', fontWeight: 700, color: '#059669' }}>
              <Globe size={13} />
              <span>SEO Search Meta Tags</span>
            </div>

            <div>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-subtle)', marginBottom: '3px' }}>
                <span>Meta Title</span>
                <span>{metaTitle.length} chars</span>
              </label>
              <input
                type="text"
                placeholder="Custom browser and search engine title"
                value={metaTitle}
                onChange={(e) => setMetaTitle(e.target.value)}
                className="input-field"
                style={{ width: '100%', fontSize: '0.78rem', padding: '5px 8px' }}
              />
            </div>

            <div>
              <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-subtle)', marginBottom: '3px' }}>
                <span>Meta Description</span>
                <span>{metaDescription.length} chars</span>
              </label>
              <textarea
                rows={2}
                placeholder="Google search results snippet description..."
                value={metaDescription}
                onChange={(e) => setMetaDescription(e.target.value)}
                className="input-field"
                style={{ width: '100%', fontSize: '0.78rem', padding: '5px 8px', resize: 'vertical' }}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                Display Priority
              </label>
              <input
                type="number"
                min="1"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
                className="input-field"
                style={{ width: '100%', fontSize: '0.82rem', padding: '7px 10px' }}
              />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', paddingTop: '20px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-main)' }}>
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  style={{ accentColor: 'var(--primary)', width: '15px', height: '15px' }}
                />
                <span>Active on Storefront</span>
              </label>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border)' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn"
              style={{ fontSize: '0.78rem', padding: '6px 12px', background: 'var(--bg-subtle)' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              style={{ fontSize: '0.78rem', padding: '6px 14px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Save size={13} />
              <span>Create Category</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

