import React, { useState, useEffect } from 'react';
import { Plus, Trash2, FileText, FolderPlus, Eye, Globe } from 'lucide-react';
import { StoreBlogCategory, StoreBlogPost, StoreBrand } from '../types/store';
import { EmptyState } from './StoreStatusNotices';
import {
  createBlogCategory,
  createBlogPost,
  deleteBlogCategory,
  deleteBlogPost,
  fetchBlogCategories,
  fetchBlogPosts,
} from '../lib/blog-api';

interface BlogViewProps {
  currentStore: StoreBrand;
  posts?: StoreBlogPost[];
  categories?: StoreBlogCategory[];
}

export const BlogView: React.FC<BlogViewProps> = ({ currentStore }) => {
  const [activeTab, setActiveTab] = useState<'posts' | 'categories'>('posts');
  const [posts, setPosts] = useState<StoreBlogPost[]>([]);
  const [categories, setCategories] = useState<StoreBlogCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Post Modal State
  const [isPostModalOpen, setIsPostModalOpen] = useState(false);
  const [postTitle, setPostTitle] = useState('');
  const [postSlug, setPostSlug] = useState('');
  const [postExcerpt, setPostExcerpt] = useState('');
  const [postContent, setPostContent] = useState('');
  const [postCategory, setPostCategory] = useState('');
  const [postMetaTitle, setPostMetaTitle] = useState('');
  const [postMetaDesc, setPostMetaDesc] = useState('');
  const [postFocusKeyword, setPostFocusKeyword] = useState('');
  const [postStatus, setPostStatus] = useState('PUBLISHED');

  // Category Modal State
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [catName, setCatName] = useState('');
  const [catSlug, setCatSlug] = useState('');
  const [catDesc, setCatDesc] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [pList, cList] = await Promise.all([fetchBlogPosts(), fetchBlogCategories()]);
      setPosts(pList);
      setCategories(cList);
    } catch {
      setNotice({ type: 'error', text: 'Failed to load blog posts & categories.' });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentStore.slug]);

  const handleCreatePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postTitle.trim() || !postSlug.trim() || !postContent.trim()) return;

    setIsSubmitting(true);
    setNotice(null);
    try {
      await createBlogPost({
        title: postTitle.trim(),
        slug: postSlug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        content: postContent,
        excerpt: postExcerpt.trim() || undefined,
        category_id: postCategory || undefined,
        status: postStatus,
        meta_title: postMetaTitle.trim() || postTitle.trim(),
        meta_description: postMetaDesc.trim() || postExcerpt.trim(),
        focus_keyword: postFocusKeyword.trim() || undefined,
      });
      setNotice({ type: 'success', text: 'Blog post published successfully.' });
      setIsPostModalOpen(false);
      setPostTitle('');
      setPostSlug('');
      setPostExcerpt('');
      setPostContent('');
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Failed to create blog post.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePost = async (id: string) => {
    if (!confirm('Are you sure you want to delete this article?')) return;
    try {
      await deleteBlogPost(id);
      setNotice({ type: 'success', text: 'Article deleted.' });
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Failed to delete post.' });
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim() || !catSlug.trim()) return;

    setIsSubmitting(true);
    setNotice(null);
    try {
      await createBlogCategory({
        name: catName.trim(),
        slug: catSlug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        description: catDesc.trim() || undefined,
      });
      setNotice({ type: 'success', text: 'Blog category created.' });
      setIsCategoryModalOpen(false);
      setCatName('');
      setCatSlug('');
      setCatDesc('');
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Failed to create category.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return;
    try {
      await deleteBlogCategory(id);
      setNotice({ type: 'success', text: 'Category deleted.' });
      await loadData();
    } catch (err: any) {
      setNotice({ type: 'error', text: err?.message || 'Failed to delete category.' });
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
            Blog & SEO Editorial Hub
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
            Content marketing, organic search articles & categories for <code>{currentStore.name}</code>
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          {activeTab === 'posts' ? (
            <button className="btn btn-primary btn-sm" onClick={() => setIsPostModalOpen(true)} style={{ gap: '6px' }}>
              <Plus size={14} />
              <span>Write Article</span>
            </button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={() => setIsCategoryModalOpen(true)} style={{ gap: '6px' }}>
              <FolderPlus size={14} />
              <span>New Category</span>
            </button>
          )}
        </div>
      </div>

      {notice && (
        <div className={`notice notice-${notice.type === 'success' ? 'success' : 'warning'}`} style={{ marginBottom: '14px' }}>
          {notice.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border)', marginBottom: '12px', paddingBottom: '8px' }}>
        <button onClick={() => setActiveTab('posts')} className={`btn btn-sm ${activeTab === 'posts' ? 'btn-primary' : 'btn-secondary'}`}>
          <FileText size={14} />
          <span>Articles ({posts.length})</span>
        </button>
        <button onClick={() => setActiveTab('categories')} className={`btn btn-sm ${activeTab === 'categories' ? 'btn-primary' : 'btn-secondary'}`}>
          <Globe size={14} />
          <span>Categories ({categories.length})</span>
        </button>
      </div>

      {activeTab === 'posts' && (
        <div className="card" style={{ padding: 0 }}>
          {posts.length === 0 ? (
            <EmptyState message="No blog articles published yet. Click 'Write Article' to publish store news and SEO content." />
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Slug</th>
                    <th>Category</th>
                    <th>Status</th>
                    <th>Views</th>
                    <th style={{ width: '80px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((p) => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.title}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>/blog/{p.slug}</td>
                      <td>{p.categoryName || 'General'}</td>
                      <td>
                        <span className={`badge ${p.status === 'PUBLISHED' ? 'badge-active' : 'badge-outline'}`}>{p.status}</span>
                      </td>
                      <td>{p.viewCount}</td>
                      <td>
                        <button
                          onClick={() => handleDeletePost(p.id)}
                          className="btn btn-sm btn-secondary"
                          style={{ color: '#dc2626', padding: '4px 8px' }}
                          title="Delete article"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="card" style={{ padding: 0 }}>
          {categories.length === 0 ? (
            <EmptyState message="No editorial categories created yet. Group articles into topics like Style Guides, Care Tips, etc." />
          ) : (
            <div className="table-container" style={{ border: 'none' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Category Name</th>
                    <th>Slug</th>
                    <th>Description</th>
                    <th>Articles</th>
                    <th style={{ width: '80px' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.map((c) => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem' }}>{c.slug}</td>
                      <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{c.description || '—'}</td>
                      <td>{c.postCount ?? 0}</td>
                      <td>
                        <button
                          onClick={() => handleDeleteCategory(c.id)}
                          className="btn btn-sm btn-secondary"
                          style={{ color: '#dc2626', padding: '4px 8px' }}
                          title="Delete category"
                        >
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Write Article Modal */}
      {isPostModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsPostModalOpen(false)}>
          <div className="modal-container" style={{ maxWidth: '640px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Write Blog Article</h2>
              <button className="btn-close" onClick={() => setIsPostModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleCreatePost} style={{ padding: '20px' }}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Article Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. How to Care for 18k Solid Gold Jewelry"
                  value={postTitle}
                  onChange={(e) => {
                    setPostTitle(e.target.value);
                    if (!postSlug) {
                      setPostSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                    }
                  }}
                  className="form-input"
                />
              </div>

              <div className="form-grid" style={{ marginBottom: '14px' }}>
                <div className="form-group">
                  <label className="form-label">URL Slug</label>
                  <input
                    type="text"
                    required
                    placeholder="how-to-care-for-gold-jewelry"
                    value={postSlug}
                    onChange={(e) => setPostSlug(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    value={postCategory}
                    onChange={(e) => setPostCategory(e.target.value)}
                    className="form-input"
                  >
                    <option value="">Select category...</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Short Summary / Excerpt</label>
                <textarea
                  rows={2}
                  placeholder="Key summary for search previews..."
                  value={postExcerpt}
                  onChange={(e) => setPostExcerpt(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Article Content (Markdown / HTML)</label>
                <textarea
                  rows={8}
                  required
                  placeholder="Write the full article content here..."
                  value={postContent}
                  onChange={(e) => setPostContent(e.target.value)}
                  className="form-input"
                  style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem' }}
                />
              </div>

              <div className="form-grid" style={{ marginBottom: '20px' }}>
                <div className="form-group">
                  <label className="form-label">Focus Keyword (SEO)</label>
                  <input
                    type="text"
                    placeholder="e.g. gold jewelry care"
                    value={postFocusKeyword}
                    onChange={(e) => setPostFocusKeyword(e.target.value)}
                    className="form-input"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Status</label>
                  <select
                    value={postStatus}
                    onChange={(e) => setPostStatus(e.target.value)}
                    className="form-input"
                  >
                    <option value="PUBLISHED">Published</option>
                    <option value="DRAFT">Draft</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsPostModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="btn btn-primary">
                  {isSubmitting ? 'Publishing...' : 'Publish Article'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* New Category Modal */}
      {isCategoryModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsCategoryModalOpen(false)}>
          <div className="modal-container" style={{ maxWidth: '440px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0 }}>Create Blog Category</h2>
              <button className="btn-close" onClick={() => setIsCategoryModalOpen(false)}>×</button>
            </div>

            <form onSubmit={handleCreateCategory} style={{ padding: '20px' }}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Category Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Styling & Looks"
                  value={catName}
                  onChange={(e) => {
                    setCatName(e.target.value);
                    if (!catSlug) {
                      setCatSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-'));
                    }
                  }}
                  className="form-input"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label className="form-label">Category Slug</label>
                <input
                  type="text"
                  required
                  placeholder="styling-and-looks"
                  value={catSlug}
                  onChange={(e) => setCatSlug(e.target.value)}
                  className="form-input"
                />
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label className="form-label">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Brief description of this article topic..."
                  value={catDesc}
                  onChange={(e) => setCatDesc(e.target.value)}
                  className="form-input"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsCategoryModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting} className="btn btn-primary">
                  {isSubmitting ? 'Saving...' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
