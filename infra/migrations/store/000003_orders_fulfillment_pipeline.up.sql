-- Ecom Ventures: Store Database Order Lifecycle & Fulfillment Enhancements
-- Migration Version: 000003_orders_fulfillment_pipeline.up.sql

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS customer_email VARCHAR(255),
    ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50),
    ADD COLUMN IF NOT EXISTS shipping_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50);

ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS product_title VARCHAR(255),
    ADD COLUMN IF NOT EXISTS variant_title VARCHAR(255);

ALTER TABLE order_shipments
    ADD COLUMN IF NOT EXISTS tracking_url TEXT,
    ADD COLUMN IF NOT EXISTS notes TEXT;

ALTER TABLE payment_transactions
    ADD COLUMN IF NOT EXISTS transaction_id VARCHAR(150),
    ADD COLUMN IF NOT EXISTS raw_response TEXT;

ALTER TABLE order_status_history
    ADD COLUMN IF NOT EXISTS old_status VARCHAR(50),
    ADD COLUMN IF NOT EXISTS performed_by VARCHAR(100),
    ADD COLUMN IF NOT EXISTS notes TEXT;
