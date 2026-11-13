-- Down migration for 000010_store_comprehensive_seo_subsystem
ALTER TABLE categories DROP COLUMN IF EXISTS meta_robots;
ALTER TABLE categories DROP COLUMN IF EXISTS canonical_url;
ALTER TABLE categories DROP COLUMN IF EXISTS focus_keyword;
ALTER TABLE categories DROP COLUMN IF EXISTS meta_description;
ALTER TABLE categories DROP COLUMN IF EXISTS meta_title;

ALTER TABLE products DROP COLUMN IF EXISTS og_image_url;
ALTER TABLE products DROP COLUMN IF EXISTS meta_robots;
ALTER TABLE products DROP COLUMN IF EXISTS canonical_url;
ALTER TABLE products DROP COLUMN IF EXISTS focus_keyword;
ALTER TABLE products DROP COLUMN IF EXISTS meta_description;
ALTER TABLE products DROP COLUMN IF EXISTS meta_title;

ALTER TABLE store_settings DROP COLUMN IF EXISTS sitemap_enabled;
ALTER TABLE store_settings DROP COLUMN IF EXISTS robots_txt_custom;
ALTER TABLE store_settings DROP COLUMN IF EXISTS pinterest_verification;
ALTER TABLE store_settings DROP COLUMN IF EXISTS bing_site_verification;
ALTER TABLE store_settings DROP COLUMN IF EXISTS google_site_verification;
ALTER TABLE store_settings DROP COLUMN IF EXISTS twitter_handle;
ALTER TABLE store_settings DROP COLUMN IF EXISTS default_og_image_url;
ALTER TABLE store_settings DROP COLUMN IF EXISTS apple_touch_icon_url;
ALTER TABLE store_settings DROP COLUMN IF EXISTS favicon_url;
ALTER TABLE store_settings DROP COLUMN IF EXISTS default_keywords;
ALTER TABLE store_settings DROP COLUMN IF EXISTS default_meta_description;
ALTER TABLE store_settings DROP COLUMN IF EXISTS default_meta_title;
ALTER TABLE store_settings DROP COLUMN IF EXISTS meta_title_template;

