import React, { useState, useMemo } from 'react';
import {
  FileText,
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  Globe,
  Eye,
  CheckCircle2,
  AlertCircle,
  FolderPlus,
  Layers,
  Sparkles,
  ExternalLink,
  Tag,
  Clock,
  User
} from 'lucide-react';
import { StoreBlogPost, StoreBlogCategory, StoreBrand } from '../types/store';
import { CreatePostModal } from './CreatePostModal';
import { EditPostModal } from './EditPostModal';
import { CreateBlogCategoryModal } from './CreateBlogCategoryModal';
import { EditBlogCategoryModal } from './EditBlogCategoryModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface BlogViewProps {
  currentStore: StoreBrand;
  posts: StoreBlogPost[];
  categories: StoreBlogCategory[];
  onAddPost: (post: StoreBlogPost) => void;
  onUpdatePost: (post: StoreBlogPost) => void;
  onDeletePost: (postId: string) => void;
  onAddCategory: (category: StoreBlogCategory) => void;
  onUpdateCategory: (category: StoreBlogCategory) => void;
  onDeleteCategory: (categoryId: string) => void;
}

export const BlogView: React.FC<BlogViewProps> = ({
  currentStore,
  posts,
  categories,
  onAddPost,
  onUpdatePost,
  onDeletePost,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'posts' | 'categories'>('posts');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');

  // Modal states
  const [isCreatePostOpen, setIsCreatePostOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<StoreBlogPost | null>(null);
  const [deletingPost, setDeletingPost] = useState<StoreBlogPost | null>(null);

  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<StoreBlogCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<StoreBlogCategory | null>(null);

  // Filtered posts
  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchesSearch =
        searchQuery === '' ||
        post.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        post.slug.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (post.focusKeyword?.toLowerCase() ?? '').includes(searchQuery.toLowerCase()) ||
        (post.tags ?? []).some((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory = categoryFilter === 'ALL' || post.categoryId === categoryFilter;
      const matchesStatus = statusFilter === 'ALL' || post.status === statusFilter;

      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [posts, searchQuery, categoryFilter, statusFilter]);

  // High-level statistics
  const stats = useMemo(() => {
    const total = posts.length;
    const published = posts.filter((p) => p.status === 'PUBLISHED').length;
    const drafts = posts.filter((p) => p.status === 'DRAFT').length;
    const totalViews = posts.reduce((sum, p) => sum + (p.viewCount || 0), 0);
    const avgScore =
      total > 0 ? Math.round(posts.reduce((sum, p) => sum + (p.seoScore || 0), 0) / total) : 0;
    const avgReadTime =
      total > 0 ? Math.round(posts.reduce((sum, p) => sum + (p.readingTimeMinutes || 3), 0) / total) : 3;

    return { total, published, drafts, totalViews, avgScore, avgReadTime };
  }, [posts]);

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10b981';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      
      {/* Top Header & Metrics */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h1 style={{ fontSize: '1.25rem', fontWeight: 900, margin: 0, color: 'var(--text-main)', letterSpacing: '-0.02em' }}>
              Blog & 100% SEO Content Engine
            </h1>
            <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '2px 8px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.12)', color: '#059669', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
              OFFICIAL BLOG: {currentStore.name}
            </span>
          </div>
          <p style={{ margin: '3px 0 0', fontSize: '0.76rem', color: 'var(--text-subtle)' }}>
            Publish high-intent organic search content, manage Google SERP snippets, and drive qualified search traffic to your storefront.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setIsCreateCategoryOpen(true)}
            className="btn"
            style={{ fontSize: '0.78rem', padding: '7px 12px', background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FolderPlus size={14} />
            <span>New Category</span>
          </button>
          <button
            onClick={() => setIsCreatePostOpen(true)}
            className="btn btn-primary"
            style={{ fontSize: '0.78rem', padding: '7px 16px', display: 'flex', alignItems: 'center', gap: '6px', background: '#059669', borderColor: '#059669' }}
          >
            <Plus size={14} />
            <span>Create Article</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Grid - 7 Column Box Card Design */}
      <div className="stats-grid">
        {/* 1. Total Articles */}
        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Total Articles</div>
            <div className="stat-val">{stats.total}</div>
            <div className="stat-sub" style={{ color: '#059669', fontWeight: 600 }}>
              <FileText size={11} /> All content
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
            <FileText size={16} />
          </div>
        </div>

        {/* 2. Published Live */}
        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Published Live</div>
            <div className="stat-val" style={{ color: '#059669' }}>{stats.published}</div>
            <div className="stat-sub" style={{ color: '#10b981' }}>
              <CheckCircle2 size={11} /> Google indexed
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#dcfce7', color: '#15803d' }}>
            <CheckCircle2 size={16} />
          </div>
        </div>

        {/* 3. Draft Queue */}
        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Draft Queue</div>
            <div className="stat-val" style={{ color: stats.drafts > 0 ? '#f59e0b' : 'var(--text-main)' }}>{stats.drafts}</div>
            <div className="stat-sub" style={{ color: stats.drafts > 0 ? '#d97706' : 'var(--text-subtle)' }}>
              <Clock size={11} /> Work in progress
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
            <Clock size={16} />
          </div>
        </div>

        {/* 4. Average SEO Score */}
        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Avg SEO Score</div>
            <div className="stat-val" style={{ color: getScoreColor(stats.avgScore) }}>
              {stats.avgScore}%
            </div>
            <div className="stat-sub" style={{ color: getScoreColor(stats.avgScore), fontWeight: 700 }}>
              <Sparkles size={11} /> SEO health
            </div>
          </div>
          <div className="stat-icon" style={{ background: stats.avgScore >= 80 ? '#ecfdf5' : '#fffbeb', color: getScoreColor(stats.avgScore) }}>
            <Sparkles size={16} />
          </div>
        </div>

        {/* 5. Organic Reads */}
        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Organic Reads</div>
            <div className="stat-val" style={{ color: '#0284c7' }}>{stats.totalViews.toLocaleString()}</div>
            <div className="stat-sub" style={{ color: '#0284c7' }}>
              <Eye size={11} /> Total reads
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#f0f9ff', color: '#0284c7' }}>
            <Eye size={16} />
          </div>
        </div>

        {/* 6. Active Categories */}
        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Categories</div>
            <div className="stat-val">{categories.length}</div>
            <div className="stat-sub" style={{ color: '#6366f1' }}>
              <Layers size={11} /> Taxonomies
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#eef2ff', color: '#6366f1' }}>
            <Layers size={16} />
          </div>
        </div>

        {/* 7. Average Read Time */}
        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Avg Read Time</div>
            <div className="stat-val">{stats.avgReadTime}m</div>
            <div className="stat-sub" style={{ color: '#64748b' }}>
              <Clock size={11} /> Per reader
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#f1f5f9', color: '#475569' }}>
            <Clock size={16} />
          </div>
        </div>
      </div>

      {/* Main Panel Box */}
      <div style={{ background: '#ffffff', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', overflow: 'hidden' }}>
        
        {/* Subtabs Bar */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: '#f8fafc', padding: '0 16px' }}>
          <button
            onClick={() => setActiveSubTab('posts')}
            style={{
              padding: '11px 16px',
              fontSize: '0.8rem',
              fontWeight: 700,
              border: 'none',
              background: 'transparent',
              color: activeSubTab === 'posts' ? '#059669' : 'var(--text-subtle)',
              borderBottom: activeSubTab === 'posts' ? '2px solid #059669' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <FileText size={14} />
            <span>Editorial Articles ({posts.length})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('categories')}
            style={{
              padding: '11px 16px',
              fontSize: '0.8rem',
              fontWeight: 700,
              border: 'none',
              background: 'transparent',
              color: activeSubTab === 'categories' ? '#059669' : 'var(--text-subtle)',
              borderBottom: activeSubTab === 'categories' ? '2px solid #059669' : '2px solid transparent',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <Layers size={14} />
            <span>Taxonomy Categories ({categories.length})</span>
          </button>
        </div>

        {/* Filter Controls Bar */}
        {activeSubTab === 'posts' && (
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center', justifyContent: 'space-between', background: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '240px' }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: '320px' }}>
                <Search size={14} style={{ position: 'absolute', left: '10px', top: '8px', color: 'var(--text-subtle)' }} />
                <input
                  type="text"
                  placeholder="Search articles, tags, keywords..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', paddingLeft: '32px', fontSize: '0.78rem', padding: '6px 10px 6px 32px' }}
                />
              </div>

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="input-field"
                style={{ fontSize: '0.78rem', padding: '6px 10px', minWidth: '140px' }}
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="input-field"
                style={{ fontSize: '0.78rem', padding: '6px 10px', minWidth: '120px' }}
              >
                <option value="ALL">All Statuses</option>
                <option value="PUBLISHED">Published</option>
                <option value="DRAFT">Draft</option>
                <option value="SCHEDULED">Scheduled</option>
                <option value="ARCHIVED">Archived</option>
              </select>
            </div>

            <div style={{ fontSize: '0.74rem', color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)' }}>
              Showing {filteredPosts.length} of {posts.length} articles
            </div>
          </div>
        )}

        {/* TAB 1: ARTICLES TABLE */}
        {activeSubTab === 'posts' && (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-subtle)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '10px 14px', width: '70px' }}>Media</th>
                  <th style={{ padding: '10px 14px' }}>Article & URL Slug</th>
                  <th style={{ padding: '10px 14px' }}>Category</th>
                  <th style={{ padding: '10px 14px' }}>Author / Date</th>
                  <th style={{ padding: '10px 14px' }}>Status</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>100% SEO Score</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right' }}>Views</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', width: '110px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPosts.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-subtle)' }}>
                      <FileText size={28} style={{ opacity: 0.3, margin: '0 auto 8px', display: 'block' }} />
                      <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>No blog articles found</div>
                      <p style={{ margin: '4px 0 12px', fontSize: '0.74rem' }}>Create your first SEO-optimized article to capture organic search traffic.</p>
                      <button onClick={() => setIsCreatePostOpen(true)} className="btn btn-primary" style={{ fontSize: '0.76rem', padding: '6px 14px', background: '#059669', borderColor: '#059669' }}>
                        Create First Article
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredPosts.map((post) => (
                    <tr key={post.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.15s' }}>
                      
                      {/* Image Thumbnail with Alt Badge */}
                      <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                        <div style={{ position: 'relative', width: '54px', height: '38px', borderRadius: '4px', overflow: 'hidden', background: '#e2e8f0' }}>
                          {post.featuredImageUrl ? (
                            <img
                              src={post.featuredImageUrl}
                              alt={post.featuredImageAlt}
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>
                              <FileText size={16} />
                            </div>
                          )}
                          <span
                            title={post.featuredImageAlt ? `Alt: ${post.featuredImageAlt}` : 'Missing Alt text!'}
                            style={{
                              position: 'absolute',
                              bottom: 0,
                              right: 0,
                              padding: '1px 3px',
                              fontSize: '0.55rem',
                              fontWeight: 800,
                              background: post.featuredImageAlt ? '#10b981' : '#ef4444',
                              color: '#ffffff',
                              borderRadius: '2px 0 0 0',
                            }}
                          >
                            ALT
                          </span>
                        </div>
                      </td>

                      {/* Title & Slug */}
                      <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '0.82rem', lineHeight: 1.3 }}>
                          {post.title}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '3px' }}>
                          <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-subtle)' }}>
                            /blog/{post.slug}
                          </span>
                          {post.focusKeyword && (
                            <span style={{ fontSize: '0.65rem', background: '#f1f5f9', padding: '1px 6px', borderRadius: '10px', color: '#475569', fontWeight: 600 }}>
                              🎯 {post.focusKeyword}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                        <span style={{ fontSize: '0.72rem', background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7', padding: '3px 8px', borderRadius: '12px', fontWeight: 700 }}>
                          {post.categoryName || 'Uncategorized'}
                        </span>
                      </td>

                      {/* Author & Date */}
                      <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                        <div style={{ fontSize: '0.76rem', fontWeight: 600, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <User size={12} style={{ color: 'var(--text-subtle)' }} />
                          {post.authorName}
                        </div>
                        <div style={{ fontSize: '0.68rem', color: 'var(--text-subtle)', marginTop: '2px' }}>
                          {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : 'Unpublished'} • {post.readingTimeMinutes} min
                        </div>
                      </td>

                      {/* Status */}
                      <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            background:
                              post.status === 'PUBLISHED'
                                ? 'rgba(16, 185, 129, 0.12)'
                                : post.status === 'DRAFT'
                                ? 'rgba(100, 116, 139, 0.12)'
                                : 'rgba(245, 158, 11, 0.12)',
                            color:
                              post.status === 'PUBLISHED'
                                ? '#059669'
                                : post.status === 'DRAFT'
                                ? '#475569'
                                : '#d97706',
                          }}
                        >
                          {post.status}
                        </span>
                      </td>

                      {/* 100% SEO Score Pill */}
                      <td style={{ padding: '10px 14px', verticalAlign: 'middle', textAlign: 'center' }}>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            padding: '3px 8px',
                            borderRadius: '12px',
                            background: `${getScoreColor(post.seoScore || 0)}15`,
                            color: getScoreColor(post.seoScore || 0),
                            border: `1px solid ${getScoreColor(post.seoScore || 0)}40`,
                            fontWeight: 800,
                            fontSize: '0.72rem',
                          }}
                        >
                          <Sparkles size={11} />
                          <span>{post.seoScore || 0}/100</span>
                        </div>
                      </td>

                      {/* Views */}
                      <td style={{ padding: '10px 14px', verticalAlign: 'middle', textAlign: 'right', fontWeight: 700, color: 'var(--text-main)' }}>
                        {post.viewCount || 0}
                      </td>

                      {/* Action Buttons (Pencil for Edit, Trash2 for Delete Approval Modal) */}
                      <td style={{ padding: '10px 14px', verticalAlign: 'middle', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            onClick={() => setEditingPost(post)}
                            title="Edit Article & SEO"
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '4px',
                              border: '1px solid var(--border)',
                              background: '#ffffff',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--text-main)',
                            }}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => setDeletingPost(post)}
                            title="Delete Article"
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '4px',
                              border: '1px solid #fee2e2',
                              background: '#fef2f2',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#dc2626',
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* TAB 2: CATEGORIES TABLE */}
        {activeSubTab === 'categories' && (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.78rem' }}>
              <thead>
                <tr style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--text-subtle)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '10px 14px' }}>Category Name & Slug</th>
                  <th style={{ padding: '10px 14px' }}>Description</th>
                  <th style={{ padding: '10px 14px' }}>Search Meta Title</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Articles</th>
                  <th style={{ padding: '10px 14px', textAlign: 'center' }}>Status</th>
                  <th style={{ padding: '10px 14px', textAlign: 'right', width: '100px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ padding: '36px', textAlign: 'center', color: 'var(--text-subtle)' }}>
                      <Layers size={28} style={{ opacity: 0.3, margin: '0 auto 8px', display: 'block' }} />
                      <div style={{ fontWeight: 700, fontSize: '0.84rem' }}>No blog categories created</div>
                      <button onClick={() => setIsCreateCategoryOpen(true)} className="btn btn-primary" style={{ fontSize: '0.76rem', padding: '6px 14px', marginTop: '10px' }}>
                        Create Category
                      </button>
                    </td>
                  </tr>
                ) : (
                  categories.map((cat) => (
                    <tr key={cat.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '10px 14px', verticalAlign: 'middle' }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{cat.name}</div>
                        <div style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-subtle)', marginTop: '2px' }}>
                          /blog?category={cat.slug}
                        </div>
                      </td>

                      <td style={{ padding: '10px 14px', verticalAlign: 'middle', maxWidth: '240px', color: '#475569', fontSize: '0.74rem' }}>
                        {cat.description || <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>No description</span>}
                      </td>

                      <td style={{ padding: '10px 14px', verticalAlign: 'middle', color: '#059669', fontSize: '0.74rem', fontWeight: 600 }}>
                        {cat.metaTitle || `${cat.name} | Category`}
                      </td>

                      <td style={{ padding: '10px 14px', verticalAlign: 'middle', textAlign: 'center', fontWeight: 800 }}>
                        {cat.postCount || posts.filter((p) => p.categoryId === cat.id).length}
                      </td>

                      <td style={{ padding: '10px 14px', verticalAlign: 'middle', textAlign: 'center' }}>
                        <span
                          style={{
                            fontSize: '0.68rem',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '12px',
                            background: cat.isActive ? 'rgba(16, 185, 129, 0.12)' : 'rgba(100, 116, 139, 0.12)',
                            color: cat.isActive ? '#059669' : '#475569',
                          }}
                        >
                          {cat.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>

                      <td style={{ padding: '10px 14px', verticalAlign: 'middle', textAlign: 'right' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '6px' }}>
                          <button
                            onClick={() => setEditingCategory(cat)}
                            title="Edit Category"
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '4px',
                              border: '1px solid var(--border)',
                              background: '#ffffff',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: 'var(--text-main)',
                            }}
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => setDeletingCategory(cat)}
                            title="Delete Category"
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '4px',
                              border: '1px solid #fee2e2',
                              background: '#fef2f2',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#dc2626',
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODALS */}
      {isCreatePostOpen && (
        <CreatePostModal
          categories={categories}
          brandDomain={`${currentStore.slug}.dropiobd.localhost`}
          onClose={() => setIsCreatePostOpen(false)}
          onSave={(newPost) => {
            onAddPost(newPost);
            setIsCreatePostOpen(false);
          }}
        />
      )}

      {editingPost && (
        <EditPostModal
          post={editingPost}
          categories={categories}
          brandDomain={`${currentStore.slug}.dropiobd.localhost`}
          onClose={() => setEditingPost(null)}
          onSave={(updated) => {
            onUpdatePost(updated);
            setEditingPost(null);
          }}
        />
      )}

      {isCreateCategoryOpen && (
        <CreateBlogCategoryModal
          onClose={() => setIsCreateCategoryOpen(false)}
          onSave={(newCat) => {
            onAddCategory(newCat);
            setIsCreateCategoryOpen(false);
          }}
        />
      )}

      {editingCategory && (
        <EditBlogCategoryModal
          category={editingCategory}
          onClose={() => setEditingCategory(null)}
          onSave={(updated) => {
            onUpdateCategory(updated);
            setEditingCategory(null);
          }}
        />
      )}

      {/* Delete Post Approval Modal (Mandated by Universal CRUD Rule) */}
      <ConfirmDeleteModal
        isOpen={Boolean(deletingPost)}
        title="Approval Required: Delete Blog Article"
        itemName={deletingPost?.title || ''}
        itemType="Blog Article"
        warningMessage="Are you sure you want to delete this article? This will permanently remove the content, search index metadata, and permalink from the storefront."
        confirmButtonText="Confirm & Delete Article"
        onConfirm={() => {
          if (deletingPost) {
            onDeletePost(deletingPost.id);
            setDeletingPost(null);
          }
        }}
        onClose={() => setDeletingPost(null)}
      />

      {/* Delete Category Approval Modal (Mandated by Universal CRUD Rule) */}
      <ConfirmDeleteModal
        isOpen={Boolean(deletingCategory)}
        title="Approval Required: Delete Blog Category"
        itemName={deletingCategory?.name || ''}
        itemType="Blog Taxonomy Category"
        warningMessage="Are you sure you want to delete this category? Any articles currently assigned to this category will become uncategorized."
        confirmButtonText="Confirm & Delete Category"
        onConfirm={() => {
          if (deletingCategory) {
            onDeleteCategory(deletingCategory.id);
            setDeletingCategory(null);
          }
        }}
        onClose={() => setDeletingCategory(null)}
      />

    </div>
  );
};

