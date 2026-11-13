import React from 'react';
import type { Metadata } from 'next';
import { headers } from 'next/headers';
import Link from 'next/link';
import { getStorefrontConfig } from '../../lib/api';
import { getStorefrontBlogCategories, getStorefrontBlogPosts } from '../../lib/blog-api';
import {
  BookOpen,
  Calendar,
  Clock,
  ArrowRight,
  Search,
  Sparkles,
  ChevronRight,
  FolderOpen,
  User,
  Tag
} from 'lucide-react';

interface BlogPageProps {
  searchParams: {
    category?: string;
    search?: string;
    page?: string;
  };
}

export async function generateMetadata({ searchParams }: BlogPageProps): Promise<Metadata> {
  const headersList = headers();
  const host = headersList.get('x-storefront-host') || 'localhost';
  const config = await getStorefrontConfig(host);
  const brandName = config?.store.name || 'Store';

  const title = searchParams.category
    ? `${searchParams.category.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} | ${brandName} Journal`
    : `Editorial & Guides | ${brandName} Journal`;

  const description = `Read insightful guides, styling advice, and artisan craftsmanship stories from ${brandName}. Curated for modern refinement.`;

  return {
    title,
    description,
    keywords: [
      'fashion blog',
      'styling guide',
      'artisan craft',
      'wardrobe care',
      brandName.toLowerCase(),
      'editorial journal',
    ],
    alternates: {
      canonical: `https://${host}/blog`,
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: `https://${host}/blog`,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default async function BlogIndexPage({ searchParams }: BlogPageProps) {
  const headersList = headers();
  const host = headersList.get('x-storefront-host') || 'localhost';

  const [config, categories, blogData] = await Promise.all([
    getStorefrontConfig(host),
    getStorefrontBlogCategories(host),
    getStorefrontBlogPosts(host, searchParams),
  ]);

  if (!config) {
    return null;
  }

  const posts = blogData.posts || [];
  const heroPost = !searchParams.category && !searchParams.search && posts.length > 0 ? posts[0] : null;
  const gridPosts = heroPost ? posts.slice(1) : posts;

  // Schema.org Blog/CollectionPage JSON-LD
  const collectionJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: `${config.store.name} Journal & Editorial`,
    description: `Curated style guides, garment care insights, and craftsmanship stories from ${config.store.name}.`,
    url: `https://${host}/blog`,
    publisher: {
      '@type': 'Organization',
      name: config.store.name,
      logo: {
        '@type': 'ImageObject',
        url: config.store.logo_url || '',
      },
    },
    blogPost: posts.map((p) => ({
      '@type': 'BlogPosting',
      headline: p.title,
      url: `https://${host}/blog/${p.slug}`,
      datePublished: p.published_at || p.created_at,
      image: p.featured_image_url,
      author: {
        '@type': 'Person',
        name: p.author_name,
      },
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center space-x-2 text-xs text-slate-500 mb-6">
          <Link href="/" className="hover:text-[var(--brand-primary)] transition">
            Home
          </Link>
          <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
          <span className="font-semibold text-slate-900">Journal & Guides</span>
          {searchParams.category && (
            <>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-[var(--brand-primary)] capitalize">
                {searchParams.category.replace(/-/g, ' ')}
              </span>
            </>
          )}
        </nav>

        {/* Hero Header Section */}
        <div className="border-b border-slate-200 pb-8 sm:pb-12 mb-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--brand-primary)]/10 text-[var(--brand-primary)] text-xs font-semibold mb-3">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Editorial & Curated Insights</span>
              </div>
              <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-950 font-[var(--brand-font-heading)] tracking-tight">
                {config.store.name} Journal
              </h1>
              <p className="mt-3 text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
                Explore in-depth articles on fabric preservation, sustainable fashion, capsule wardrobe curation,
                and master artisanal craftsmanship.
              </p>
            </div>

            {/* Quick Search Input */}
            <form method="get" action="/blog" className="relative w-full md:w-72">
              <input
                type="text"
                name="search"
                defaultValue={searchParams.search || ''}
                placeholder="Search articles..."
                className="w-full pl-9 pr-4 py-2.5 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] focus:bg-white transition"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              {searchParams.category && (
                <input type="hidden" name="category" value={searchParams.category} />
              )}
            </form>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pt-6 scrollbar-none">
            <Link
              href="/blog"
              className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                !searchParams.category
                  ? 'bg-slate-950 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All Articles
            </Link>
            {categories.map((cat) => {
              const isActive = searchParams.category === cat.slug;
              return (
                <Link
                  key={cat.id}
                  href={`/blog?category=${cat.slug}`}
                  className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition ${
                    isActive
                      ? 'bg-[var(--brand-primary)] text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {cat.name}
                  {cat.post_count !== undefined && cat.post_count > 0 && (
                    <span className="ml-1.5 opacity-80 text-[10px]">({cat.post_count})</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Featured Hero Article (when on main listing) */}
        {heroPost && (
          <div className="mb-14">
            <article className="group relative rounded-2xl bg-white border border-slate-200 shadow-xs overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0 hover:shadow-md transition">
              <div className="lg:col-span-7 relative h-64 sm:h-80 lg:h-full min-h-[340px] overflow-hidden bg-slate-100">
                <img
                  src={heroPost.featured_image_url}
                  alt={heroPost.featured_image_alt || heroPost.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                />
                <div className="absolute top-4 left-4">
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/95 backdrop-blur-xs text-slate-900 shadow-xs">
                    {heroPost.category_name || 'Featured Story'}
                  </span>
                </div>
              </div>

              <div className="lg:col-span-5 p-6 sm:p-8 lg:p-10 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {heroPost.reading_time_minutes} min read
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(heroPost.published_at || heroPost.created_at).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </span>
                  </div>

                  <h2 className="text-xl sm:text-2xl font-bold text-slate-950 group-hover:text-[var(--brand-primary)] transition line-clamp-3">
                    <Link href={`/blog/${heroPost.slug}`}>{heroPost.title}</Link>
                  </h2>

                  <p className="mt-3 text-sm text-slate-600 line-clamp-4 leading-relaxed">
                    {heroPost.excerpt}
                  </p>
                </div>

                <div className="pt-6 mt-6 border-t border-slate-100 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <img
                      src={heroPost.author_avatar_url}
                      alt={heroPost.author_name}
                      className="w-8 h-8 rounded-full object-cover border border-slate-200"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-900">{heroPost.author_name}</div>
                      <div className="text-[10px] text-slate-500">Staff Contributor</div>
                    </div>
                  </div>

                  <Link
                    href={`/blog/${heroPost.slug}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[var(--brand-primary)] hover:underline"
                  >
                    <span>Read Guide</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            </article>
          </div>
        )}

        {/* Regular Post Grid */}
        {gridPosts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {gridPosts.map((post) => (
              <article
                key={post.id}
                className="group flex flex-col bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden hover:shadow-md hover:border-slate-300 transition"
              >
                <Link href={`/blog/${post.slug}`} className="relative h-48 sm:h-52 overflow-hidden bg-slate-100">
                  <img
                    src={post.featured_image_url}
                    alt={post.featured_image_alt || post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                    loading="lazy"
                  />
                  {post.category_name && (
                    <span className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/90 backdrop-blur-xs text-slate-900 shadow-2xs">
                      {post.category_name}
                    </span>
                  )}
                </Link>

                <div className="p-5 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-2">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {post.reading_time_minutes} min read
                      </span>
                      <span>•</span>
                      <span>
                        {new Date(post.published_at || post.created_at).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-950 group-hover:text-[var(--brand-primary)] transition line-clamp-2">
                      <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                    </h3>

                    <p className="mt-2 text-xs sm:text-sm text-slate-600 line-clamp-3 leading-relaxed">
                      {post.excerpt}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <img
                        src={post.author_avatar_url}
                        alt={post.author_name}
                        className="w-6 h-6 rounded-full object-cover border border-slate-200"
                      />
                      <span className="text-xs font-medium text-slate-700">{post.author_name}</span>
                    </div>

                    <Link
                      href={`/blog/${post.slug}`}
                      className="text-xs font-semibold text-[var(--brand-primary)] flex items-center gap-1 hover:underline"
                    >
                      <span>Read</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="text-center py-16 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
            <FolderOpen className="w-12 h-12 text-slate-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900">No articles found</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
              {searchParams.search
                ? `No articles matched your query "${searchParams.search}". Try different search terms or clear filters.`
                : 'Check back soon for freshly published guides and stories.'}
            </p>
            {(searchParams.search || searchParams.category) && (
              <div className="mt-4">
                <Link
                  href="/blog"
                  className="inline-flex items-center px-4 py-2 rounded-lg text-xs font-semibold bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 transition shadow-2xs"
                >
                  Reset all filters
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Brand Newsletter Curation Callout */}
        <div className="mt-16 sm:mt-20 p-8 sm:p-12 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 text-white relative overflow-hidden">
          <div className="max-w-2xl relative z-10">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--brand-primary)]">
              Exclusive Journal Editions
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold font-[var(--brand-font-heading)] mt-2">
              Stay ahead with curated style dispatches
            </h3>
            <p className="mt-3 text-xs sm:text-sm text-slate-300 leading-relaxed">
              Receive seasonal lookbooks, fabric care guides, and exclusive limited collection releases directly
              in your inbox once a fortnight.
            </p>
            <form
              onSubmit={undefined}
              className="mt-6 flex flex-col sm:flex-row gap-3 max-w-md"
            >
              <input
                type="email"
                placeholder="Enter your email"
                required
                className="px-4 py-2.5 rounded-lg text-xs sm:text-sm text-slate-900 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--brand-primary)] flex-1"
              />
              <button
                type="button"
                className="px-5 py-2.5 rounded-lg text-xs sm:text-sm font-bold bg-[var(--brand-primary)] text-white hover:opacity-90 transition whitespace-nowrap"
              >
                Subscribe
              </button>
            </form>
          </div>
          <div className="absolute right-0 bottom-0 opacity-10 pointer-events-none translate-x-12 translate-y-12">
            <BookOpen size={300} />
          </div>
        </div>
      </div>
    </>
  );
}

