-- Ecom Ventures: Revert Store Database Extended Schema
-- Migration Version: 000002_extended_catalog_cart_orders.down.sql

DROP TRIGGER IF EXISTS trg_order_shipments_updated_at ON order_shipments;
DROP TRIGGER IF EXISTS trg_cart_items_updated_at ON cart_items;
DROP TRIGGER IF EXISTS trg_carts_updated_at ON carts;
DROP TRIGGER IF EXISTS trg_customer_addresses_updated_at ON customer_addresses;
DROP TRIGGER IF EXISTS trg_variant_inventory_updated_at ON variant_inventory;
DROP TRIGGER IF EXISTS trg_product_variants_updated_at ON product_variants;
DROP TRIGGER IF EXISTS trg_product_images_updated_at ON product_images;
DROP TRIGGER IF EXISTS trg_attribute_values_updated_at ON attribute_values;
DROP TRIGGER IF EXISTS trg_attributes_updated_at ON attributes;

ALTER TABLE order_items DROP COLUMN IF EXISTS variant_id;

DROP TABLE IF EXISTS order_status_history;
DROP TABLE IF EXISTS payment_transactions;
DROP TABLE IF EXISTS order_shipments;
DROP TYPE IF EXISTS shipment_status;

DROP TABLE IF EXISTS cart_items;
DROP TABLE IF EXISTS carts;
DROP TABLE IF EXISTS customer_addresses;
DROP TABLE IF EXISTS stock_movements;
DROP TYPE IF EXISTS stock_movement_reason;

DROP TABLE IF EXISTS variant_inventory;
DROP TABLE IF EXISTS variant_images;
DROP TABLE IF EXISTS variant_attribute_values;
DROP TABLE IF EXISTS product_variants;
DROP TABLE IF EXISTS product_images;
DROP TABLE IF EXISTS attribute_values;
DROP TABLE IF EXISTS attributes;

DELETE FROM store_schema_migrations WHERE version = '000002';
