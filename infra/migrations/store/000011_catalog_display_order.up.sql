-- Merchant-controlled display order for the catalog.
--   products.sort_order      position in the main product list (and storefront default order)
--   products.featured_order  position inside the featured list shown on the storefront home page
--   attributes.sort_order    position of an attribute in the attribute list
-- categories already carry display_order.
-- Keep this identical to catalog.EnsureOrderingSchema (backend/internal/store/catalog/schema.go).
ALTER TABLE products ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS featured_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE attributes ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_products_sort_order ON products (sort_order ASC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_products_featured_order ON products (featured_order ASC) WHERE is_featured = TRUE;
