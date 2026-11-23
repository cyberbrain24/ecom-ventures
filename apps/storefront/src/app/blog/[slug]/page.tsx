import React from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getStorefrontConfig } from '../../../lib/api';
import { getStorefrontBlogPostBySlug } from '../../../lib/blog-api';
import {
  Clock,
  Calendar,
  Eye,
  ChevronRight,
  Share2,
  Tag,
  ArrowLeft,
  ShoppingBag,
  ExternalLink,
  Sparkles,
  BookOpen
} from 'lucide-react';

interface BlogPostPageProps {
  params: { slug: string };
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const headersList = headers();
  const host = headersList.get('x-storefront-host') || '';
  const post = await getStorefrontBlogPostBySlug(host, params.slug);

  if (!post) {
    return { title: 'Article Not Found | Journal' };
  }

  const metaTitle = post.meta_title || post.title;
  const metaDesc = post.meta_description || post.excerpt;
  const canonicalUrl = post.canonical_url || `https://${host}/blog/${post.slug}`;
  const ogImg = post.og_image_url || post.featured_image_url;
  const twImg = post.twitter_image_url || post.featured_image_url;

  const keywords = [
    ...(post.focus_keyword ? [post.focus_keyword] : []),
    ...(post.secondary_keywords || []),
    ...(post.tags || []),
  ];

  return {
    title: metaTitle,
    description: metaDesc,
    keywords: keywords.length > 0 ? keywords : undefined,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: post.meta_robots || 'index, follow',
    openGraph: {
      title: post.og_title || metaTitle,
      description: post.og_description || metaDesc,
      url: canonicalUrl,
      type: 'article',
      publishedTime: post.published_at || post.created_at,
      modifiedTime: post.updated_at,
      authors: [post.author_name],
      images: ogImg
        ? [
            {
              url: ogImg,
              alt: post.featured_image_alt || post.title,
            },
          ]
        : [],
    },
    twitter: {
      card: 'summary_large_image',
      title: post.twitter_title || metaTitle,
      description: post.twitter_description || metaDesc,
      images: twImg ? [twImg] : [],
    },
  };
}

export default async function BlogPostDetailPage({ params }: BlogPostPageProps) {
  const headersList = headers();
  const host = headersList.get('x-storefront-host') || '';

  const [config, post] = await Promise.all([
    getStorefrontConfig(host),
    getStorefrontBlogPostBySlug(host, params.slug),
  ]);

  if (!config || !post) {
    notFound();
  }

  const currentUrl = `https://${host}/blog/${post.slug}`;
  const shareText = encodeURIComponent(post.title);
  const shareUrl = encodeURIComponent(currentUrl);

  const formatJsonLd = (val: any, fallbackObj: any): string => {
    if (!val) return JSON.stringify(fallbackObj);
    if (typeof val === 'string') return val;
    return JSON.stringify(val);
  };

  // Schema.org JSON-LD structured data
  const schemaOrgJson = formatJsonLd(post.schema_org_json_ld, {
    '@context': 'https://schema.org',
    '@type': post.schema_type || 'BlogPosting',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': currentUrl,
    },
    headline: post.title,
    description: post.meta_description || post.excerpt,
    image: [post.featured_image_url],
    datePublished: post.published_at || post.created_at,
    dateModified: post.updated_at,
    author: {
      '@type': 'Person',
      name: post.author_name,
    },
    publisher: {
      '@type': 'Organization',
      name: config.store.name,
      logo: {
        '@type': 'ImageObject',
        url: config.store.logo_url || '',
      },
    },
  });

  const breadcrumbsJson = formatJsonLd(post.breadcrumbs_json_ld, {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: `https://${host}`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Journal',
        item: `https://${host}/blog`,
      },
      ...(post.category_name
        ? [
            {
              '@type': 'ListItem',
              position: 3,
              name: post.category_name,
              item: `https://${host}/blog?category=${post.category_slug}`,
            },
            {
              '@type': 'ListItem',
              position: 4,
              name: post.title,
              item: currentUrl,
            },
          ]
        : [
            {
              '@type': 'ListItem',
              position: 3,
              name: post.title,
              item: currentUrl,
            },
          ]),
    ],
  });

  return (
    <>
      {/* Schema.org Rich Structured Data for Search Engine Crawlers */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: schemaOrgJson }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: breadcrumbsJson }}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        {/* Back Link & Breadcrumbs */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-xs text-slate-500 overflow-x-auto">
            <Link href="/" className="hover:text-[var(--brand-primary)] transition whitespace-nowrap">
              Home
            </Link>
            <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
            <Link href="/blog" className="hover:text-[var(--brand-primary)] transition whitespace-nowrap">
              Journal
            </Link>
            {post.category_name && (
              <>
                <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
                <Link
                  href={`/blog?category=${post.category_slug}`}
                  className="hover:text-[var(--brand-primary)] transition whitespace-nowrap"
                >
                  {post.category_name}
                </Link>
              </>
            )}
            <ChevronRight className="w-3 h-3 text-slate-400 shrink-0" />
            <span className="font-medium text-slate-900 truncate max-w-[200px] sm:max-w-xs">
              {post.title}
            </span>
          </nav>

          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 transition self-start sm:self-auto"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Articles</span>
          </Link>
        </div>

        {/* Semantic Article Container */}
        <article itemScope itemType="https://schema.org/BlogPosting" className="space-y-8">
          {/* Article Header */}
          <header className="space-y-4">
            {post.category_name && (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[var(--brand-primary)]/10 text-[var(--brand-primary)]">
                <Tag className="w-3 h-3" />
                <span itemProp="articleSection">{post.category_name}</span>
              </div>
            )}

            <h1
              itemProp="headline"
              className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-950 font-[var(--brand-font-heading)] tracking-tight leading-tight"
            >
              {post.title}
            </h1>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed font-normal">
              {post.excerpt}
            </p>

            {/* Author & Telemetry Meta Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 py-4 border-y border-slate-100">
              <div className="flex items-center gap-3">
                <img
                  src={post.author_avatar_url}
                  alt={post.author_name}
                  className="w-10 h-10 rounded-full object-cover border border-slate-200"
                />
                <div>
                  <div className="text-sm font-bold text-slate-900" itemProp="author">
                    {post.author_name}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <time
                      dateTime={post.published_at || post.created_at}
                      itemProp="datePublished"
                    >
                      {new Date(post.published_at || post.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </time>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3 text-slate-400" />
                      {post.reading_time_minutes} min read
                    </span>
                    {post.view_count > 0 && (
                      <>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <Eye className="w-3 h-3 text-slate-400" />
                          {post.view_count} views
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Social Share Buttons */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium mr-1 hidden sm:inline">Share:</span>
                <a
                  href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 transition text-xs font-semibold"
                  title="Share on X"
                >
                  𝕏
                </a>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${shareUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 transition text-xs font-bold"
                  title="Share on Facebook"
                >
                  f
                </a>
                <a
                  href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`}
                  target="_blank"
                  rel="noreferrer"
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center p-2 rounded-lg bg-slate-50 hover:bg-slate-100 text-slate-700 transition text-xs font-bold"
                  title="Share on LinkedIn"
                >
                  in
                </a>
              </div>
            </div>
          </header>

          {/* Featured Image with Semantic Figure & Figcaption */}
          <figure className="rounded-2xl overflow-hidden bg-slate-100 border border-slate-200">
            <img
              src={post.featured_image_url}
              alt={post.featured_image_alt || post.title}
              itemProp="image"
              className="w-full max-h-[480px] object-cover"
            />
            {post.featured_image_alt && (
              <figcaption className="p-3 text-[11px] text-slate-500 text-center italic bg-slate-50 border-t border-slate-100">
                {post.featured_image_alt}
              </figcaption>
            )}
          </figure>

          {/* Formatted Article Prose Body */}
          <div
            itemProp="articleBody"
            className="prose prose-slate max-w-none prose-headings:font-bold prose-headings:text-slate-900 prose-h2:text-2xl prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3 prose-p:text-slate-700 prose-p:leading-relaxed prose-p:mb-4 prose-blockquote:border-l-4 prose-blockquote:border-[var(--brand-primary)] prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-slate-700 prose-blockquote:my-6 prose-ul:list-disc prose-ul:pl-5 prose-ul:mb-4 prose-li:text-slate-700 prose-li:mb-1.5"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

          {/* Tag Cloud */}
          {post.tags && post.tags.length > 0 && (
            <div className="pt-6 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1">Tags:</span>
                {post.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-3 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Product Showcase (if articles link directly to store products) */}
          {post.products && post.products.length > 0 && (
            <div className="mt-12 p-6 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex items-center gap-2 mb-4">
                <ShoppingBag className="w-4 h-4 text-[var(--brand-primary)]" />
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  Featured in this story
                </h3>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {post.products.map((prod) => (
                  <Link
                    key={prod.id}
                    href={`/product/${prod.slug}`}
                    className="group flex items-center gap-4 p-3 rounded-xl bg-white border border-slate-200 hover:border-[var(--brand-primary)] hover:shadow-xs transition"
                  >
                    <img
                      src={prod.featured_image_url}
                      alt={prod.title}
                      className="w-16 h-16 rounded-lg object-cover bg-slate-100 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate group-hover:text-[var(--brand-primary)] transition">
                        {prod.title}
                      </div>
                      <div className="text-xs font-semibold text-slate-700 mt-1">
                        {config.store.currency} {prod.price.toLocaleString()}
                      </div>
                      <div className="text-[10px] text-emerald-600 font-medium mt-0.5">
                        {prod.in_stock ? 'In Stock • Ready to ship' : 'Pre-order available'}
                      </div>
                    </div>
                    <ExternalLink className="w-4 h-4 text-slate-400 group-hover:text-[var(--brand-primary)] transition shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </article>

        {/* Related Articles Carousel / Grid */}
        {post.related_posts && post.related_posts.length > 0 && (
          <section className="mt-16 pt-12 border-t border-slate-200">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h3 className="text-xl font-bold text-slate-900 font-[var(--brand-font-heading)]">
                  Continue Reading
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">Related guides and stories you might enjoy</p>
              </div>
              <Link
                href="/blog"
                className="text-xs font-semibold text-[var(--brand-primary)] hover:underline flex items-center gap-1"
              >
                <span>View all</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {post.related_posts.slice(0, 2).map((rel) => (
                <article
                  key={rel.id}
                  className="group flex flex-col bg-white rounded-xl border border-slate-200 overflow-hidden hover:shadow-sm hover:border-slate-300 transition"
                >
                  <Link href={`/blog/${rel.slug}`} className="h-44 overflow-hidden bg-slate-100">
                    <img
                      src={rel.featured_image_url}
                      alt={rel.featured_image_alt || rel.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    />
                  </Link>
                  <div className="p-5 flex-1 flex flex-col justify-between">
                    <div>
                      <div className="text-[11px] text-slate-500 mb-1.5 flex items-center gap-2">
                        <span>{rel.category_name}</span>
                        <span>•</span>
                        <span>{rel.reading_time_minutes} min read</span>
                      </div>
                      <h4 className="text-sm font-bold text-slate-950 group-hover:text-[var(--brand-primary)] transition line-clamp-2">
                        <Link href={`/blog/${rel.slug}`}>{rel.title}</Link>
                      </h4>
                      <p className="text-xs text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">
                        {rel.excerpt}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-xs text-slate-600 font-medium">{rel.author_name}</span>
                      <Link
                        href={`/blog/${rel.slug}`}
                        className="text-xs font-semibold text-[var(--brand-primary)] hover:underline"
                      >
                        Read →
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
