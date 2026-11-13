-- Ecom Ventures: Revert Store Database Baseline Schema
-- Migration Version: 000001_init_store_schema.down.sql

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
DROP TRIGGER IF EXISTS trg_customers_updated_at ON customers;
DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
DROP TRIGGER IF EXISTS trg_categories_updated_at ON categories;
DROP TRIGGER IF EXISTS trg_store_staff_updated_at ON store_staff;
DROP TRIGGER IF EXISTS trg_store_settings_updated_at ON store_settings;

DROP FUNCTION IF EXISTS update_store_updated_at_column();

DROP TABLE IF EXISTS store_schema_migrations;
DROP TABLE IF EXISTS order_items;
DROP TABLE IF EXISTS orders;
DROP TABLE IF EXISTS customers;
DROP TABLE IF EXISTS inventory_levels;
DROP TABLE IF EXISTS products;
DROP TABLE IF EXISTS categories;
DROP TABLE IF EXISTS store_staff;
DROP TABLE IF EXISTS store_settings;
DROP TABLE IF EXISTS store_metadata;

DROP TYPE IF EXISTS payment_status;
DROP TYPE IF EXISTS order_status;
DROP TYPE IF EXISTS product_status;
DROP TYPE IF EXISTS store_staff_role;
