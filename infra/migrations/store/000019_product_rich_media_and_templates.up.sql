-- 000019_product_rich_media_and_templates.up.sql
-- Adds rich media (YouTube video embed, autoplay, mute), short teaser description,
-- cost price on base product, size guide block, and option layout to products.

ALTER TABLE products ADD COLUMN IF NOT EXISTS video_url TEXT NOT NULL DEFAULT '';
ALTER TABLE products ADD COLUMN IF NOT EXISTS video_autoplay BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE products ADD COLUMN IF NOT EXISTS video_muted BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE products ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12, 2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS product_option_layout VARCHAR(50) NOT NULL DEFAULT 'simple';
ALTER TABLE products ADD COLUMN IF NOT EXISTS size_guide_template TEXT NOT NULL DEFAULT '';

-- Multi-category link mapping table
CREATE TABLE IF NOT EXISTS product_category_links (
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (product_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_product_category_links_product ON product_category_links(product_id);
CREATE INDEX IF NOT EXISTS idx_product_category_links_category ON product_category_links(category_id);
