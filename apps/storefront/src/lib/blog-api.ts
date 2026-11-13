import {
  StorefrontBlogCategory,
  StorefrontBlogPostCard,
  StorefrontBlogPostDetail,
  StorefrontBlogListResponse,
} from '../types/blog';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080/api/v1';

const FALLBACK_CATEGORIES: StorefrontBlogCategory[] = [
  {
    id: 'b1a2c3d4-0001-4000-8000-000000000001',
    name: 'Style & Guides',
    slug: 'style-guides',
    description: 'Expert fashion curation, modern styling tips, and essential wardrobe essentials.',
    meta_title: 'Style & Wardrobe Guides | Expert Fashion Insights',
    meta_description: 'Discover seasonal styling guides, outfit pairing inspirations, and contemporary fashion tips.',
    display_order: 1,
    is_active: true,
    post_count: 1,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
  },
  {
    id: 'b1a2c3d4-0001-4000-8000-000000000002',
    name: 'Craftsmanship & Care',
    slug: 'craftsmanship-care',
    description: 'Behind the seams: artisanal production, textile preservation, and sustainable garment care.',
    meta_title: 'Garment Care & Artisan Craftsmanship | Preservation Guide',
    meta_description: 'Learn how to properly care for premium fabrics, full-grain leathers, and tailored garments.',
    display_order: 2,
    is_active: true,
    post_count: 1,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
  },
  {
    id: 'b1a2c3d4-0001-4000-8000-000000000003',
    name: 'Brand Stories',
    slug: 'brand-stories',
    description: 'Interviews with artisans, material sourcing journeys, and design philosophy.',
    meta_title: 'Our Stories & Sustainable Philosophy | Brand Journal',
    meta_description: 'Explore the heritage, ethical production commitments, and creative inspirations.',
    display_order: 3,
    is_active: true,
    post_count: 0,
    created_at: '2026-11-01T00:00:00Z',
    updated_at: '2026-11-01T00:00:00Z',
  },
];

const FALLBACK_POSTS: StorefrontBlogPostDetail[] = [
  {
    id: 'f1a2c3d4-0001-4000-8000-000000000001',
    category_id: 'b1a2c3d4-0001-4000-8000-000000000001',
    category_name: 'Style & Guides',
    category_slug: 'style-guides',
    title: 'The Ultimate Guide to Modern Silk Styling: Day-to-Evening Transition',
    slug: 'ultimate-guide-modern-silk-styling',
    excerpt: 'Discover how to effortlessly elevate your everyday wardrobe with versatile mulberry silk ensembles designed for all-day comfort and sophistication.',
    content: `<h2>Elevating Everyday Elegance with Pure Silk</h2>
<p>Mulberry silk has long been celebrated as the queen of textiles, balancing unmatched breathability with subtle, natural luster. In modern fashion, silk is no longer reserved exclusively for formal galas or black-tie occasions. Today’s minimalist wardrobe embraces silk as an everyday luxury that flows effortlessly from high-stakes boardroom meetings to ambient evening dinners.</p>
<h3>1. The Foundation: Tailored Silk Blouse & High-Waist Trousers</h3>
<p>When selecting your daytime base, opt for relaxed cuts with clean architectural lines. A muted ivory or sage silk shirt provides understated polish when tucked into tailored pleated wool trousers. The breathable, thermoregulating properties of 100% mulberry silk ensure you remain cool during active mornings and comfortable in climate-controlled spaces.</p>
<blockquote>"Luxury is not about ostentation; it is the quiet tactile satisfaction of fine natural fibers moving effortlessly with the body."</blockquote>
<h3>2. The Seamless Evening Transformation</h3>
<p>Transitioning into dusk requires only deliberate adjustments in accessorizing and layering. Swap daytime structured tote bags for a sleek structured leather clutch, unbutton the mandarin collar for a softer neckline, and add sculpted brass jewelry to catch ambient candlelight.</p>
<h3>3. Silk Longevity & Preservation</h3>
<p>To preserve the exquisite sheen of hand-dyed mulberry silk, hand-wash in tepid water with pH-neutral detergent and dry flat away from direct sunlight. Never wring natural silk; instead, gently press between clean cotton towels to absorb excess moisture.</p>`,
    featured_image_url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&auto=format&fit=crop&q=80',
    featured_image_alt: 'Model styled in elegant modern mulberry silk blouse for evening transition',
    author_name: 'Zara Rahman',
    author_avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80',
    status: 'PUBLISHED',
    published_at: '2026-11-07T12:00:00Z',
    reading_time_minutes: 5,
    view_count: 143,
    tags: ['Silk Styling', 'Fashion Guide', 'Capsule Wardrobe', 'Sustainable Luxury'],
    meta_title: 'Modern Silk Styling Guide: Day-to-Evening Transition | Brand Journal',
    meta_description: 'Master the art of modern silk styling. Learn how to transition pure mulberry silk outfits from business daytime to evening elegance with minimal adjustments.',
    focus_keyword: 'modern silk styling',
    secondary_keywords: ['mulberry silk fashion', 'day to evening outfit', 'luxury capsule wardrobe'],
    canonical_url: '',
    meta_robots: 'index, follow',
    og_title: 'The Art of Modern Silk Styling: Daytime to Dusk Perfection',
    og_description: 'Step-by-step masterclass on styling pure mulberry silk for versatile, refined luxury across every hour.',
    og_image_url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&auto=format&fit=crop&q=80',
    twitter_title: 'The Art of Modern Silk Styling: Daytime to Dusk Perfection',
    twitter_description: 'Step-by-step masterclass on styling pure mulberry silk for versatile, refined luxury across every hour.',
    twitter_image_url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&auto=format&fit=crop&q=80',
    schema_type: 'BlogPosting',
    seo_score: 96,
    created_at: '2026-11-07T12:00:00Z',
    updated_at: '2026-11-07T12:00:00Z',
    products: [
      {
        id: 'prod-001',
        title: 'Silk Evening Gown — Emerald Edition',
        slug: 'silk-evening-gown',
        price: 18500,
        featured_image_url: 'https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=600&auto=format&fit=crop&q=80',
        in_stock: true,
      },
    ],
  },
  {
    id: 'f1a2c3d4-0001-4000-8000-000000000002',
    category_id: 'b1a2c3d4-0001-4000-8000-000000000002',
    category_name: 'Craftsmanship & Care',
    category_slug: 'craftsmanship-care',
    title: 'How to Care for Handcrafted Full-Grain Leather: The Definitive Longevity Guide',
    slug: 'how-to-care-for-full-grain-leather',
    excerpt: 'Preserve the rich character and natural patina of your premium full-grain leather bags and footwear with our master craftsman conditioning rituals.',
    content: `<h2>Understanding Full-Grain Leather Character</h2>
<p>Unlike bonded or corrected top-grain alternatives, full-grain leather retains the natural hide’s outer layer in its entirety. This preserves maximum tensile strength, breathability, and natural pebble texture. With conscientious care, full-grain accessories don’t wear out—they age gracefully, developing an irreplaceable heirloom patina over decades.</p>
<h3>1. Routine Dusting and Microfiber Cleansing</h3>
<p>Begin each conditioning session by removing surface particulate matter with a soft, lint-free horsehair brush or slightly damp microfiber cloth. Allow the leather to dry completely at room temperature before applying any balms or emollients.</p>
<h3>2. Natural Beeswax & Lanolin Conditioning</h3>
<p>Every three to four months, massage a conservative dollop of organic beeswax and lanolin cream using gentle circular motions. Let the oils penetrate the grain for 20 minutes before gently buffing to a deep, satin sheen.</p>
<blockquote>"Well-maintained leather is living testimony to a journey well-traveled. Treat it with respect, and it will outlive generations."</blockquote>
<h3>3. Moisture Protection & Humidity Protocols</h3>
<p>Store your leather goods in breathable unbleached cotton dust bags. Never store in airtight plastic bins where trapped moisture can promote mildew. Should you encounter heavy monsoon rain, stuff the interior with undyed tissue paper and dry naturally at room temperature.</p>`,
    featured_image_url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=1200&auto=format&fit=crop&q=80',
    featured_image_alt: 'Handcrafted full-grain leather bag treated with natural beeswax conditioning',
    author_name: 'Tariq Chowdhury',
    author_avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&auto=format&fit=crop&q=80',
    status: 'PUBLISHED',
    published_at: '2026-11-04T10:00:00Z',
    reading_time_minutes: 4,
    view_count: 210,
    tags: ['Leather Care', 'Artisan Craft', 'Patina', 'Product Longevity'],
    meta_title: 'How to Care for Full-Grain Leather Goods | Expert Preservation Guide',
    meta_description: 'Learn professional care techniques for handcrafted full-grain leather bags and accessories. Discover conditioning tips to cultivate a deep, lustrous patina.',
    focus_keyword: 'care for full-grain leather',
    secondary_keywords: ['leather conditioning guide', 'clean leather bag', 'leather patina maintenance'],
    canonical_url: '',
    meta_robots: 'index, follow',
    og_title: 'How to Care for Premium Full-Grain Leather: Essential Longevity Tips',
    og_description: 'Protect and nourish your handcrafted leather goods with this comprehensive care regimen for deep, lustrous patina.',
    og_image_url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=1200&auto=format&fit=crop&q=80',
    twitter_title: 'How to Care for Premium Full-Grain Leather: Essential Longevity Tips',
    twitter_description: 'Protect and nourish your handcrafted leather goods with this comprehensive care regimen for deep, lustrous patina.',
    twitter_image_url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=1200&auto=format&fit=crop&q=80',
    schema_type: 'BlogPosting',
    seo_score: 98,
    created_at: '2026-11-04T10:00:00Z',
    updated_at: '2026-11-04T10:00:00Z',
  },
];

/**
 * Fetch all active blog categories for the tenant.
 */
export async function getStorefrontBlogCategories(host: string): Promise<StorefrontBlogCategory[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/storefront/blog/categories`, {
      headers: {
        Host: host,
        'X-Forwarded-Host': host,
      },
      next: {
        revalidate: 60,
        tags: [`blog-categories-${host}`],
      },
    });

    if (!res.ok) {
      return FALLBACK_CATEGORIES;
    }

    const payload = await res.json();
    const data = payload?.data !== undefined ? payload.data : payload;
    const list = (Array.isArray(data) ? data : []) as StorefrontBlogCategory[];
    return list.length > 0 ? list : FALLBACK_CATEGORIES;
  } catch (error) {
    return FALLBACK_CATEGORIES;
  }
}

/**
 * Fetch paginated blog posts with category and search filter support.
 */
export async function getStorefrontBlogPosts(
  host: string,
  params: {
    category?: string;
    search?: string;
    page?: string;
    limit?: string;
  }
): Promise<StorefrontBlogListResponse> {
  const query = new URLSearchParams();
  if (params.category) query.append('category', params.category);
  if (params.search) query.append('search', params.search);
  query.append('page', params.page || '1');
  query.append('limit', params.limit || '9');

  try {
    const res = await fetch(`${API_BASE_URL}/storefront/blog/posts?${query.toString()}`, {
      headers: {
        Host: host,
        'X-Forwarded-Host': host,
      },
      next: {
        revalidate: 60,
        tags: [`blog-posts-${host}`],
      },
    });

    if (!res.ok) {
      return filterFallbackPosts(params);
    }

    const payload = await res.json();
    const data = payload?.data !== undefined ? payload.data : payload;
    if (data && Array.isArray(data.posts) && data.posts.length > 0) {
      return data as StorefrontBlogListResponse;
    }

    return filterFallbackPosts(params);
  } catch (error) {
    return filterFallbackPosts(params);
  }
}

/**
 * Fetch an individual blog post by slug with full Schema.org structured data.
 */
export async function getStorefrontBlogPostBySlug(
  host: string,
  slug: string
): Promise<StorefrontBlogPostDetail | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/storefront/blog/posts/${slug}`, {
      headers: {
        Host: host,
        'X-Forwarded-Host': host,
      },
      next: {
        revalidate: 60,
        tags: [`blog-post-${slug}-${host}`],
      },
    });

    if (res.ok) {
      const payload = await res.json();
      const data = (payload?.data !== undefined ? payload.data : payload) as StorefrontBlogPostDetail;
      if (data && data.title) {
        return data;
      }
    }
  } catch (error) {
    // Fall through to fallback
  }

  const found = FALLBACK_POSTS.find((p) => p.slug === slug);
  if (found) {
    const related = FALLBACK_POSTS.filter((p) => p.slug !== slug);
    return {
      ...found,
      related_posts: related,
    };
  }

  return null;
}

function filterFallbackPosts(params: {
  category?: string;
  search?: string;
  page?: string;
  limit?: string;
}): StorefrontBlogListResponse {
  let list = [...FALLBACK_POSTS];

  if (params.category) {
    list = list.filter((p) => p.category_slug === params.category || p.category_id === params.category);
  }

  if (params.search) {
    const s = params.search.toLowerCase();
    list = list.filter(
      (p) =>
        p.title.toLowerCase().includes(s) ||
        p.excerpt.toLowerCase().includes(s) ||
        p.tags.some((t) => t.toLowerCase().includes(s))
    );
  }

  return {
    posts: list,
    meta: {
      page: 1,
      limit: parseInt(params.limit || '9', 10),
      total_count: list.length,
      total_pages: Math.max(1, Math.ceil(list.length / parseInt(params.limit || '9', 10))),
    },
  };
}

