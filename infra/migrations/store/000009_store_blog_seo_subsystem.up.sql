-- Ecom Ventures: Dedicated Store Database Schema Extension
-- Migration Version: 000009_store_blog_seo_subsystem.up.sql
-- Scope: 100% SEO-focused Blog & Editorial Content Subsystem

CREATE TABLE IF NOT EXISTS blog_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(150) NOT NULL,
    slug VARCHAR(150) NOT NULL UNIQUE,
    description TEXT,
    meta_title VARCHAR(255),
    meta_description TEXT,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_blog_categories_slug ON blog_categories (slug);
CREATE INDEX IF NOT EXISTS idx_blog_categories_active_order ON blog_categories (is_active, display_order ASC);

CREATE TABLE IF NOT EXISTS blog_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID REFERENCES blog_categories(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    excerpt TEXT,
    content TEXT NOT NULL,
    featured_image_url TEXT,
    featured_image_alt VARCHAR(255),
    author_name VARCHAR(100) NOT NULL DEFAULT 'Editorial Team',
    author_avatar_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'PUBLISHED', 'SCHEDULED', 'ARCHIVED')),
    published_at TIMESTAMP WITH TIME ZONE,
    reading_time_minutes INTEGER NOT NULL DEFAULT 3,
    view_count INTEGER NOT NULL DEFAULT 0,
    tags TEXT[] NOT NULL DEFAULT '{}',
    
    -- 100% SEO Focused Columns
    meta_title VARCHAR(255),
    meta_description TEXT,
    focus_keyword VARCHAR(100),
    secondary_keywords TEXT[] NOT NULL DEFAULT '{}',
    canonical_url TEXT,
    meta_robots VARCHAR(50) NOT NULL DEFAULT 'index, follow',
    og_title VARCHAR(255),
    og_description TEXT,
    og_image_url TEXT,
    twitter_title VARCHAR(255),
    twitter_description TEXT,
    twitter_image_url TEXT,
    schema_type VARCHAR(50) NOT NULL DEFAULT 'BlogPosting',
    seo_score INTEGER NOT NULL DEFAULT 0,
    seo_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_status_published ON blog_posts (status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts (slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_category_id ON blog_posts (category_id);
CREATE INDEX IF NOT EXISTS idx_blog_posts_tags ON blog_posts USING GIN (tags);

CREATE TABLE IF NOT EXISTS blog_post_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    post_id UUID NOT NULL REFERENCES blog_posts(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(post_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_blog_post_products_post ON blog_post_products (post_id);
CREATE INDEX IF NOT EXISTS idx_blog_post_products_product ON blog_post_products (product_id);
