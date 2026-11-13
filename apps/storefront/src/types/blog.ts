export interface StorefrontBlogCategory {
  id: string;
  name: string;
  slug: string;
  description?: string;
  meta_title?: string;
  meta_description?: string;
  display_order: number;
  is_active: boolean;
  post_count?: number;
  created_at: string;
  updated_at: string;
}

export interface StorefrontBlogPostCard {
  id: string;
  category_id?: string;
  category_name?: string;
  category_slug?: string;
  title: string;
  slug: string;
  excerpt: string;
  featured_image_url: string;
  featured_image_alt: string;
  author_name: string;
  author_avatar_url: string;
  status: 'PUBLISHED' | 'DRAFT' | 'ARCHIVED';
  published_at?: string;
  reading_time_minutes: number;
  view_count: number;
  tags: string[];
  meta_title?: string;
  meta_description?: string;
  focus_keyword?: string;
  secondary_keywords?: string[];
  canonical_url?: string;
  meta_robots?: string;
  og_title?: string;
  og_description?: string;
  og_image_url?: string;
  twitter_title?: string;
  twitter_description?: string;
  twitter_image_url?: string;
  schema_type: string;
  seo_score: number;
  created_at: string;
  updated_at: string;
}

export interface StorefrontBlogProduct {
  id: string;
  title: string;
  slug: string;
  price: number;
  featured_image_url: string;
  in_stock: boolean;
}

export interface StorefrontBlogPostDetail extends StorefrontBlogPostCard {
  content: string;
  category?: StorefrontBlogCategory;
  products?: StorefrontBlogProduct[];
  related_posts?: StorefrontBlogPostCard[];
  schema_org_json_ld?: string;
  breadcrumbs_json_ld?: string;
  seo_checklist?: {
    score: number;
    title_status: string;
    meta_desc_status: string;
    focus_keyword_in_title: boolean;
    focus_keyword_in_meta: boolean;
    focus_keyword_in_slug: boolean;
    focus_keyword_in_content: boolean;
    has_featured_image_alt: boolean;
    word_count: number;
    reading_time: number;
    recommendations: string[];
  };
}

export interface StorefrontBlogListResponse {
  posts: StorefrontBlogPostCard[];
  meta: {
    page: number;
    limit: number;
    total_count: number;
    total_pages: number;
  };
}

