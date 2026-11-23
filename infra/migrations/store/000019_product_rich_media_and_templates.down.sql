-- 000019_product_rich_media_and_templates.down.sql
DROP TABLE IF EXISTS product_category_links;
ALTER TABLE products DROP COLUMN IF EXISTS size_guide_template;
ALTER TABLE products DROP COLUMN IF EXISTS product_option_layout;
ALTER TABLE products DROP COLUMN IF EXISTS cost_price;
ALTER TABLE products DROP COLUMN IF EXISTS video_muted;
ALTER TABLE products DROP COLUMN IF EXISTS video_autoplay;
ALTER TABLE products DROP COLUMN IF EXISTS video_url;
