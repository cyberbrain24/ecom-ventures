-- Rollback migration for Product Reviews & Reputation Engine
DROP TRIGGER IF EXISTS trg_product_reviews_updated_at ON product_reviews;
DROP TABLE IF EXISTS review_images CASCADE;
DROP TABLE IF EXISTS product_reviews CASCADE;
DROP TYPE IF EXISTS review_status CASCADE;

DELETE FROM store_schema_migrations WHERE version = '000005';

