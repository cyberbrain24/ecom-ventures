import React, { useState, useMemo } from 'react';
import {
  X,
  Save,
  FileText,
  Search,
  Globe,
  Share2,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Sparkles,
  Smartphone,
  Monitor
} from 'lucide-react';
import { StoreBlogPost, StoreBlogCategory, SEOAnalysisData } from '../types/store';

interface EditPostModalProps {
  post: StoreBlogPost;
  categories: StoreBlogCategory[];
  brandDomain: string;
  onClose: () => void;
  onSave: (post: StoreBlogPost) => void;
}

export const EditPostModal: React.FC<EditPostModalProps> = ({
  post,
  categories,
  brandDomain,
  onClose,
  onSave,
}) => {
  const [activeTab, setActiveTab] = useState<'content' | 'seo' | 'social'>('content');
  const [serpDevice, setSerpDevice] = useState<'desktop' | 'mobile'>('desktop');

  // Content state
  const [title, setTitle] = useState(post.title);
  const [slug, setSlug] = useState(post.slug);
  const [categoryId, setCategoryId] = useState(post.categoryId || '');
  const [excerpt, setExcerpt] = useState(post.excerpt || '');
  const [content, setContent] = useState(post.content || '');
  const [featuredImageUrl, setFeaturedImageUrl] = useState(post.featuredImageUrl || '');
  const [featuredImageAlt, setFeaturedImageAlt] = useState(post.featuredImageAlt || '');
  const [authorName, setAuthorName] = useState(post.authorName || 'Editorial Team');
  const [authorAvatarUrl, setAuthorAvatarUrl] = useState(post.authorAvatarUrl || '');
  const [status, setStatus] = useState<'DRAFT' | 'PUBLISHED' | 'SCHEDULED' | 'ARCHIVED'>(post.status);
  const [tagsInput, setTagsInput] = useState(post.tags?.join(', ') || '');

  // SEO state
  const [focusKeyword, setFocusKeyword] = useState(post.focusKeyword || '');
  const [secondaryKeywordsInput, setSecondaryKeywordsInput] = useState(post.secondaryKeywords?.join(', ') || '');
  const [metaTitle, setMetaTitle] = useState(post.metaTitle || '');
  const [metaDescription, setMetaDescription] = useState(post.metaDescription || '');
  const [canonicalUrl, setCanonicalUrl] = useState(post.canonicalUrl || '');
  const [metaRobots, setMetaRobots] = useState(post.metaRobots || 'index, follow');
  const [schemaType, setSchemaType] = useState<'BlogPosting' | 'Article' | 'NewsArticle'>(post.schemaType || 'BlogPosting');

  // Social state
  const [ogTitle, setOgTitle] = useState(post.ogTitle || '');
  const [ogDescription, setOgDescription] = useState(post.ogDescription || '');
  const [ogImageUrl, setOgImageUrl] = useState(post.ogImageUrl || '');

  const selectedCategory = categories.find((c) => c.id === categoryId);

  // Real-time SEO analysis calculation
  const seoAudit = useMemo<SEOAnalysisData>(() => {
    const cleanContent = content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    const words = cleanContent ? cleanContent.split(/\s+/) : [];
    const wordCount = cleanContent ? words.length : 0;
    const readingTime = Math.max(1, Math.ceil(wordCount / 200));

    const effectiveTitle = (metaTitle || title).trim();
    const effectiveDesc = (metaDescription || excerpt).trim();
    const effectiveSlug = slug.toLowerCase().trim();
    const fk = focusKeyword.toLowerCase().trim();

    const titleLen = effectiveTitle.length;
    let titleStatus: 'GOOD' | 'TOO_SHORT' | 'TOO_LONG' = 'GOOD';
    if (titleLen < 40) titleStatus = 'TOO_SHORT';
    else if (titleLen > 70) titleStatus = 'TOO_LONG';

    const descLen = effectiveDesc.length;
    let metaDescStatus: 'GOOD' | 'TOO_SHORT' | 'TOO_LONG' = 'GOOD';
    if (descLen < 120) metaDescStatus = 'TOO_SHORT';
    else if (descLen > 165) metaDescStatus = 'TOO_LONG';

    const inTitle = fk ? effectiveTitle.toLowerCase().includes(fk) : false;
    const inMeta = fk ? effectiveDesc.toLowerCase().includes(fk) : false;
    const inSlug = fk ? effectiveSlug.includes(fk.replace(/[^a-z0-9]+/g, '-')) : false;
    const inContent = fk ? cleanContent.toLowerCase().includes(fk) : false;
    const hasAlt = Boolean(featuredImageAlt.trim());

    const recs: string[] = [];
    let score = 0;

    if (titleStatus === 'GOOD') score += 15;
    else if (titleLen > 0) {
      score += 5;
      recs.push(titleStatus === 'TOO_SHORT' ? 'Title under 40 chars. Aim for 50-60.' : 'Title exceeds 70 chars.');
    }

    if (metaDescStatus === 'GOOD') score += 15;
    else if (descLen > 0) {
      score += 5;
      recs.push(metaDescStatus === 'TOO_SHORT' ? 'Meta description under 120 chars.' : 'Meta description over 165 chars.');
    }

    if (inTitle) score += 15;
    else if (fk) recs.push(`Add focus keyword "${focusKeyword}" into the title.`);

    if (inMeta) score += 15;
    else if (fk) recs.push(`Add focus keyword "${focusKeyword}" to meta description.`);

    if (inSlug) score += 10;
    else if (fk) recs.push(`Include focus keyword in the URL slug.`);

    if (inContent) score += 10;
    else if (fk) recs.push(`Mention focus keyword "${focusKeyword}" in the content.`);

    if (hasAlt) score += 10;
    else recs.push('Provide Featured Image Alt Text for Google Images.');

    if (wordCount >= 300) score += 10;
    else if (wordCount >= 100) {
      score += 5;
      recs.push('Content is under 300 words. Longer content ranks higher.');
    } else {
      recs.push('Expand content to at least 300 words.');
    }

    return {
      score: Math.min(100, score),
      titleLength: titleLen,
      titleStatus,
      metaDescriptionLength: descLen,
      metaDescStatus,
      focusKeywordInTitle: inTitle,
      focusKeywordInMeta: inMeta,
      focusKeywordInSlug: inSlug,
      focusKeywordInContent: inContent,
      hasFeaturedImageAlt: hasAlt,
      wordCount,
      readingTime,
      recommendations: recs,
    };
  }, [title, metaTitle, excerpt, metaDescription, slug, focusKeyword, content, featuredImageAlt]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    const secondaryKeywords = secondaryKeywordsInput
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    const updatedPost: StoreBlogPost = {
      ...post,
      categoryId: categoryId || undefined,
      categoryName: selectedCategory?.name,
      categorySlug: selectedCategory?.slug,
      title: title.trim(),
      slug: (slug || title).toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      excerpt: excerpt.trim(),
      content: content.trim(),
      featuredImageUrl: featuredImageUrl.trim(),
      featuredImageAlt: featuredImageAlt.trim() || title.trim(),
      authorName: authorName.trim() || 'Editorial Team',
      authorAvatarUrl: authorAvatarUrl.trim(),
      status,
      publishedAt: status === 'PUBLISHED' && !post.publishedAt ? new Date().toISOString() : post.publishedAt,
      readingTimeMinutes: seoAudit.readingTime,
      tags,
      metaTitle: metaTitle.trim() || `${title.trim()} | Store Journal`,
      metaDescription: metaDescription.trim() || excerpt.trim(),
      focusKeyword: focusKeyword.trim(),
      secondaryKeywords,
      canonicalUrl: canonicalUrl.trim(),
      metaRobots,
      ogTitle: ogTitle.trim() || metaTitle.trim() || title.trim(),
      ogDescription: ogDescription.trim() || metaDescription.trim() || excerpt.trim(),
      ogImageUrl: ogImageUrl.trim() || featuredImageUrl.trim(),
      twitterTitle: ogTitle.trim() || metaTitle.trim() || title.trim(),
      twitterDescription: ogDescription.trim() || metaDescription.trim() || excerpt.trim(),
      twitterImageUrl: ogImageUrl.trim() || featuredImageUrl.trim(),
      schemaType,
      seoScore: seoAudit.score,
      seoAnalysis: seoAudit,
      updatedAt: new Date().toISOString(),
    };

    onSave(updatedPost);
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return '#10b981';
    if (score >= 50) return '#f59e0b';
    return '#ef4444';
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1000 }}>
      <div className="modal-content" style={{ maxWidth: '880px', width: '95vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
        
        {/* Header */}
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#ffffff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: 'var(--radius-sm)', backgroundColor: 'var(--primary-glow)', color: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileText size={17} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ fontSize: '0.98rem', fontWeight: 800, margin: 0, color: 'var(--text-main)' }}>Edit Blog Article</h3>
                <span style={{ fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px', background: `${getScoreColor(seoAudit.score)}15`, color: getScoreColor(seoAudit.score), fontWeight: 800, border: `1px solid ${getScoreColor(seoAudit.score)}40` }}>
                  SEO Score: {seoAudit.score}/100
                </span>
              </div>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-subtle)' }}>/{post.slug}</span>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-subtle)' }}>
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', gap: '4px', padding: '8px 20px', background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
          <button
            type="button"
            onClick={() => setActiveTab('content')}
            style={{
              padding: '6px 14px',
              fontSize: '0.78rem',
              fontWeight: 700,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'content' ? '#ffffff' : 'transparent',
              color: activeTab === 'content' ? 'var(--primary)' : 'var(--text-subtle)',
              boxShadow: activeTab === 'content' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <FileText size={13} />
            <span>Editorial Content</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('seo')}
            style={{
              padding: '6px 14px',
              fontSize: '0.78rem',
              fontWeight: 700,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'seo' ? '#ffffff' : 'transparent',
              color: activeTab === 'seo' ? '#059669' : 'var(--text-subtle)',
              boxShadow: activeTab === 'seo' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Globe size={13} />
            <span>100% SEO Intelligence ({seoAudit.score}%)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('social')}
            style={{
              padding: '6px 14px',
              fontSize: '0.78rem',
              fontWeight: 700,
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              cursor: 'pointer',
              background: activeTab === 'social' ? '#ffffff' : 'transparent',
              color: activeTab === 'social' ? '#0284c7' : 'var(--text-subtle)',
              boxShadow: activeTab === 'social' ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Share2 size={13} />
            <span>Social & Schema.org</span>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          
          {/* TAB 1: EDITORIAL CONTENT */}
          {activeTab === 'content' && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                    Article Headline / Title <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="input-field"
                    style={{ width: '100%', fontSize: '0.84rem', padding: '8px 10px', fontWeight: 600 }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                    Category
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="input-field"
                    style={{ width: '100%', fontSize: '0.82rem', padding: '8px 10px' }}
                  >
                    <option value="">-- No Category --</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                  Permalink URL Slug <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-subtle)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                  <span style={{ padding: '0 10px', fontSize: '0.72rem', color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)' }}>
                    https://{brandDomain}/blog/
                  </span>
                  <input
                    type="text"
                    required
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    style={{ flex: 1, border: 'none', background: 'transparent', padding: '7px 8px', fontSize: '0.8rem', outline: 'none', fontFamily: 'var(--font-mono)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                  Summary / Excerpt
                </label>
                <textarea
                  rows={2}
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', fontSize: '0.82rem', padding: '8px 10px', resize: 'vertical' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)' }}>
                    Article Body Content (HTML or Markdown) <span style={{ color: '#ef4444' }}>*</span>
                  </label>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-subtle)', fontFamily: 'var(--font-mono)' }}>
                    {seoAudit.wordCount} words • ~{seoAudit.readingTime} min read
                  </span>
                </div>
                <textarea
                  rows={8}
                  required
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', fontSize: '0.82rem', padding: '10px', fontFamily: 'var(--font-mono)', resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                    Featured Cover Image URL
                  </label>
                  <input
                    type="url"
                    value={featuredImageUrl}
                    onChange={(e) => setFeaturedImageUrl(e.target.value)}
                    className="input-field"
                    style={{ width: '100%', fontSize: '0.8rem', padding: '7px 10px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                    <span>Image Alt Text (SEO Essential)</span>
                    {!featuredImageAlt && <span style={{ color: '#ef4444', fontSize: '0.68rem' }}>Required for 100% SEO</span>}
                  </label>
                  <input
                    type="text"
                    value={featuredImageAlt}
                    onChange={(e) => setFeaturedImageAlt(e.target.value)}
                    className="input-field"
                    style={{ width: '100%', fontSize: '0.8rem', padding: '7px 10px', borderColor: !featuredImageAlt ? '#fca5a5' : 'var(--border)' }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                    Author Name
                  </label>
                  <input
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="input-field"
                    style={{ width: '100%', fontSize: '0.8rem', padding: '7px 10px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                    Publication Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as any)}
                    className="input-field"
                    style={{ width: '100%', fontSize: '0.8rem', padding: '7px 10px', fontWeight: 600 }}
                  >
                    <option value="PUBLISHED">Published (Live Online)</option>
                    <option value="DRAFT">Draft (Unpublished)</option>
                    <option value="SCHEDULED">Scheduled</option>
                    <option value="ARCHIVED">Archived</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                    Tags (Comma Separated)
                  </label>
                  <input
                    type="text"
                    value={tagsInput}
                    onChange={(e) => setTagsInput(e.target.value)}
                    className="input-field"
                    style={{ width: '100%', fontSize: '0.8rem', padding: '7px 10px' }}
                  />
                </div>
              </div>
            </>
          )}

          {/* TAB 2: 100% SEO INTELLIGENCE */}
          {activeTab === 'seo' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              
              {/* Target Focus Keyword */}
              <div style={{ padding: '12px 14px', background: '#f0fdf4', borderRadius: 'var(--radius-sm)', border: '1px solid #bbf7d0' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.76rem', fontWeight: 800, color: '#166534', marginBottom: '4px' }}>
                  <span>Primary Target Focus Keyword</span>
                  <span style={{ fontSize: '0.7rem', color: '#15803d' }}>Google Search Target</span>
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: '#15803d' }} />
                    <input
                      type="text"
                      placeholder="e.g. modern silk styling"
                      value={focusKeyword}
                      onChange={(e) => setFocusKeyword(e.target.value)}
                      className="input-field"
                      style={{ width: '100%', paddingLeft: '32px', fontSize: '0.82rem', padding: '7px 10px 7px 32px', borderColor: '#86efac', fontWeight: 600 }}
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Secondary keywords (comma separated)..."
                    value={secondaryKeywordsInput}
                    onChange={(e) => setSecondaryKeywordsInput(e.target.value)}
                    className="input-field"
                    style={{ flex: 1, fontSize: '0.8rem', padding: '7px 10px' }}
                  />
                </div>
              </div>

              {/* Live SERP Preview Card */}
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', background: '#ffffff' }}>
                <div style={{ padding: '8px 14px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Sparkles size={13} style={{ color: '#059669' }} />
                    Google Search Result Snippet Preview (SERP)
                  </span>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      onClick={() => setSerpDevice('desktop')}
                      style={{ padding: '3px 8px', fontSize: '0.7rem', border: 'none', borderRadius: '4px', cursor: 'pointer', background: serpDevice === 'desktop' ? '#059669' : '#e2e8f0', color: serpDevice === 'desktop' ? '#ffffff' : '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Monitor size={11} /> Desktop
                    </button>
                    <button
                      type="button"
                      onClick={() => setSerpDevice('mobile')}
                      style={{ padding: '3px 8px', fontSize: '0.7rem', border: 'none', borderRadius: '4px', cursor: 'pointer', background: serpDevice === 'mobile' ? '#059669' : '#e2e8f0', color: serpDevice === 'mobile' ? '#ffffff' : '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Smartphone size={11} /> Mobile
                    </button>
                  </div>
                </div>

                <div style={{ padding: '14px', maxWidth: serpDevice === 'mobile' ? '380px' : '620px', fontFamily: 'arial, sans-serif' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 800 }}>
                      G
                    </div>
                    <div style={{ fontSize: '0.74rem', color: '#202124', lineHeight: 1.2 }}>
                      <span style={{ fontWeight: 600 }}>{brandDomain}</span>
                      <span style={{ color: '#5f6368' }}> › blog › {slug || 'article-slug'}</span>
                    </div>
                  </div>
                  <div style={{ fontSize: '1.05rem', color: '#1a0dab', fontWeight: 500, lineHeight: 1.3, marginBottom: '4px', cursor: 'pointer' }}>
                    {metaTitle || title}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: '#4d5156', lineHeight: 1.4 }}>
                    {metaDescription || excerpt}
                  </div>
                </div>
              </div>

              {/* Title & Description Counters */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      Search Meta Title
                    </label>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: seoAudit.titleStatus === 'GOOD' ? '#10b981' : '#f59e0b' }}>
                      {seoAudit.titleLength}/60 chars ({seoAudit.titleStatus})
                    </span>
                  </div>
                  <input
                    type="text"
                    value={metaTitle}
                    onChange={(e) => setMetaTitle(e.target.value)}
                    className="input-field"
                    style={{ width: '100%', fontSize: '0.8rem', padding: '7px 10px' }}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)' }}>
                      Search Meta Description
                    </label>
                    <span style={{ fontSize: '0.7rem', fontWeight: 700, color: seoAudit.metaDescStatus === 'GOOD' ? '#10b981' : '#f59e0b' }}>
                      {seoAudit.metaDescriptionLength}/160 chars ({seoAudit.metaDescStatus})
                    </span>
                  </div>
                  <input
                    type="text"
                    value={metaDescription}
                    onChange={(e) => setMetaDescription(e.target.value)}
                    className="input-field"
                    style={{ width: '100%', fontSize: '0.8rem', padding: '7px 10px' }}
                  />
                </div>
              </div>

              {/* 10-Point SEO Checklist Box */}
              <div style={{ padding: '12px 14px', background: '#ffffff', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: '0.76rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Real-Time SEO Checklist</span>
                  <span style={{ color: getScoreColor(seoAudit.score) }}>{seoAudit.score}% Compliance</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '0.73rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: seoAudit.focusKeywordInTitle ? '#15803d' : '#94a3b8' }}>
                    {seoAudit.focusKeywordInTitle ? <CheckCircle2 size={13} style={{ color: '#10b981' }} /> : <AlertCircle size={13} />}
                    <span>Keyword in Title & Headline</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: seoAudit.focusKeywordInMeta ? '#15803d' : '#94a3b8' }}>
                    {seoAudit.focusKeywordInMeta ? <CheckCircle2 size={13} style={{ color: '#10b981' }} /> : <AlertCircle size={13} />}
                    <span>Keyword in Meta Description</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: seoAudit.focusKeywordInSlug ? '#15803d' : '#94a3b8' }}>
                    {seoAudit.focusKeywordInSlug ? <CheckCircle2 size={13} style={{ color: '#10b981' }} /> : <AlertCircle size={13} />}
                    <span>Keyword in URL Permalink Slug</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: seoAudit.focusKeywordInContent ? '#15803d' : '#94a3b8' }}>
                    {seoAudit.focusKeywordInContent ? <CheckCircle2 size={13} style={{ color: '#10b981' }} /> : <AlertCircle size={13} />}
                    <span>Keyword in Article Body Copy</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: seoAudit.hasFeaturedImageAlt ? '#15803d' : '#94a3b8' }}>
                    {seoAudit.hasFeaturedImageAlt ? <CheckCircle2 size={13} style={{ color: '#10b981' }} /> : <AlertCircle size={13} />}
                    <span>Featured Image Alt Text Present</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: seoAudit.wordCount >= 300 ? '#15803d' : '#94a3b8' }}>
                    {seoAudit.wordCount >= 300 ? <CheckCircle2 size={13} style={{ color: '#10b981' }} /> : <AlertCircle size={13} />}
                    <span>Comprehensive Word Count ({seoAudit.wordCount} words)</span>
                  </div>
                </div>

                {seoAudit.recommendations.length > 0 && (
                  <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px solid #f1f5f9' }}>
                    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#f59e0b', marginBottom: '4px' }}>
                      Recommendations to Reach 100%:
                    </div>
                    <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '0.7rem', color: '#64748b' }}>
                      {seoAudit.recommendations.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Advanced Technical SEO Directives */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                    Canonical URL Override
                  </label>
                  <input
                    type="url"
                    value={canonicalUrl}
                    onChange={(e) => setCanonicalUrl(e.target.value)}
                    className="input-field"
                    style={{ width: '100%', fontSize: '0.78rem', padding: '7px 10px' }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                    Search Robots Directive
                  </label>
                  <select
                    value={metaRobots}
                    onChange={(e) => setMetaRobots(e.target.value)}
                    className="input-field"
                    style={{ width: '100%', fontSize: '0.78rem', padding: '7px 10px' }}
                  >
                    <option value="index, follow">index, follow (Standard Default)</option>
                    <option value="noindex, follow">noindex, follow (Hide from search, follow links)</option>
                    <option value="index, nofollow">index, nofollow</option>
                    <option value="noindex, nofollow">noindex, nofollow (Complete exclusion)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: SOCIAL OPEN GRAPH & SCHEMA */}
          {activeTab === 'social' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ padding: '10px 12px', background: '#f0f9ff', borderRadius: 'var(--radius-sm)', border: '1px solid #bae6fd' }}>
                <span style={{ fontSize: '0.74rem', fontWeight: 700, color: '#0369a1', display: 'block', marginBottom: '2px' }}>
                  Open Graph (Facebook, LinkedIn) & Twitter Cards
                </span>
                <span style={{ fontSize: '0.7rem', color: '#0284c7' }}>
                  Controls how rich previews render when shared on social networks. Leaves blank to mirror SEO meta tags automatically.
                </span>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                  Social Share Title
                </label>
                <input
                  type="text"
                  value={ogTitle}
                  onChange={(e) => setOgTitle(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', fontSize: '0.8rem', padding: '7px 10px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                  Social Share Description
                </label>
                <textarea
                  rows={2}
                  value={ogDescription}
                  onChange={(e) => setOgDescription(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', fontSize: '0.8rem', padding: '7px 10px', resize: 'vertical' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                  Social Share Preview Image URL (1200x630px recommended)
                </label>
                <input
                  type="url"
                  value={ogImageUrl}
                  onChange={(e) => setOgImageUrl(e.target.value)}
                  className="input-field"
                  style={{ width: '100%', fontSize: '0.8rem', padding: '7px 10px' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '4px' }}>
                  Google Schema.org Structured Data Type
                </label>
                <select
                  value={schemaType}
                  onChange={(e) => setSchemaType(e.target.value as any)}
                  className="input-field"
                  style={{ width: '100%', fontSize: '0.8rem', padding: '7px 10px' }}
                >
                  <option value="BlogPosting">BlogPosting (Recommended for brand articles)</option>
                  <option value="Article">Article (General purpose publication)</option>
                  <option value="NewsArticle">NewsArticle (Time-sensitive announcements)</option>
                </select>
              </div>
            </div>
          )}

          {/* Bottom Actions */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', color: 'var(--text-subtle)' }}>
              <HelpCircle size={13} />
              <span>Full CRUD & 100% SEO compliance verified</span>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                onClick={onClose}
                className="btn"
                style={{ fontSize: '0.78rem', padding: '7px 14px', background: 'var(--bg-subtle)' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ fontSize: '0.78rem', padding: '7px 18px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Save size={13} />
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

