DROP INDEX IF EXISTS idx_products_featured_order;
DROP INDEX IF EXISTS idx_products_sort_order;
ALTER TABLE attributes DROP COLUMN IF EXISTS sort_order;
ALTER TABLE products DROP COLUMN IF EXISTS featured_order;
ALTER TABLE products DROP COLUMN IF EXISTS sort_order;
