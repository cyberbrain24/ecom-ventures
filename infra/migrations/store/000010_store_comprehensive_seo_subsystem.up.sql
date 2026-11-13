-- Ecom Ventures: Dedicated Store Database Extended Schema
-- Migration Version: 000010_store_comprehensive_seo_subsystem.up.sql
-- Scope: Store-wide SEO Settings, Favicon, Webmaster Verification, Category & Product SEO Metadata

-- 1. Store Settings SEO & Branding Extensions
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS meta_title_template VARCHAR(255) NOT NULL DEFAULT '%s | {store_name}';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS default_meta_title VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS default_meta_description TEXT NOT NULL DEFAULT '';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS default_keywords TEXT NOT NULL DEFAULT '';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS favicon_url TEXT NOT NULL DEFAULT '';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS apple_touch_icon_url TEXT NOT NULL DEFAULT '';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS default_og_image_url TEXT NOT NULL DEFAULT '';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS twitter_handle VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS google_site_verification VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS bing_site_verification VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS pinterest_verification VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS robots_txt_custom TEXT NOT NULL DEFAULT '';
ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS sitemap_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- 2. Product Master Catalog SEO Metadata
ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_title VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_description TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS focus_keyword VARCHAR(150) NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS canonical_url TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS meta_robots VARCHAR(50) NOT NULL DEFAULT 'index, follow';
ALTER TABLE products ADD COLUMN IF NOT EXISTS og_image_url TEXT NOT NULL DEFAULT '';

-- 3. Taxonomy Categories SEO Metadata
ALTER TABLE categories ADD COLUMN IF NOT EXISTS meta_title VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS meta_description TEXT NOT NULL DEFAULT '';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS focus_keyword VARCHAR(150) NOT NULL DEFAULT '';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS canonical_url TEXT NOT NULL DEFAULT '';
ALTER TABLE categories ADD COLUMN IF NOT EXISTS meta_robots VARCHAR(50) NOT NULL DEFAULT 'index, follow';

-- 4. Initial SEO Defaults & Seeding for Existing Store Records
UPDATE store_settings
SET
    meta_title_template = COALESCE(NULLIF(meta_title_template, ''), '%s | ' || store_name),
    default_meta_title = COALESCE(NULLIF(default_meta_title, ''), store_name || ' | Official Online Store & Catalog'),
    default_meta_description = COALESCE(NULLIF(default_meta_description, ''), 'Shop authentic, premium merchandise with doorstep delivery and verified quality at ' || store_name || '.'),
    default_keywords = COALESCE(NULLIF(default_keywords, ''), 'ecommerce, online store, fashion, shopping, ' || lower(store_name)),
    favicon_url = COALESCE(NULLIF(favicon_url, ''), 'https://images.unsplash.com/photo-1544441893-675973e31985?w=64&auto=format&fit=crop&q=80'),
    apple_touch_icon_url = COALESCE(NULLIF(apple_touch_icon_url, ''), 'https://images.unsplash.com/photo-1544441893-675973e31985?w=180&auto=format&fit=crop&q=80'),
    default_og_image_url = COALESCE(NULLIF(default_og_image_url, ''), 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&auto=format&fit=crop&q=80'),
    twitter_handle = COALESCE(NULLIF(twitter_handle, ''), '@' || lower(replace(store_name, ' ', '')))
WHERE id = (SELECT id FROM store_settings LIMIT 1);

-- Seed sensible product SEO defaults where blank
UPDATE products
SET
    meta_title = COALESCE(NULLIF(meta_title, ''), title || ' | Buy Online'),
    meta_description = COALESCE(NULLIF(meta_description, ''), COALESCE(NULLIF(summary, ''), 'Buy ' || title || ' with verified quality guarantee and fast doorstep delivery.')),
    focus_keyword = COALESCE(NULLIF(focus_keyword, ''), lower(title)),
    meta_robots = 'index, follow'
WHERE meta_title = '' OR meta_description = '';

-- Seed sensible category SEO defaults where blank
UPDATE categories
SET
    meta_title = COALESCE(NULLIF(meta_title, ''), name || ' Collection | Authentic Range'),
    meta_description = COALESCE(NULLIF(meta_description, ''), COALESCE(NULLIF(description, ''), 'Explore our curated ' || name || ' collection crafted with uncompromising quality.')),
    focus_keyword = COALESCE(NULLIF(focus_keyword, ''), lower(name)),
    meta_robots = 'index, follow'
WHERE meta_title = '' OR meta_description = '';

