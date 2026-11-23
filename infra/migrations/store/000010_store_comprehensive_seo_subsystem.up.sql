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
