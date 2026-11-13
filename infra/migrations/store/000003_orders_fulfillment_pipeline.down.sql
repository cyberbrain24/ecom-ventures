-- Migration Version: 000003_orders_fulfillment_pipeline.down.sql

ALTER TABLE order_status_history
    DROP COLUMN IF EXISTS old_status,
    DROP COLUMN IF EXISTS performed_by,
    DROP COLUMN IF EXISTS notes;

ALTER TABLE payment_transactions
    DROP COLUMN IF EXISTS transaction_id,
    DROP COLUMN IF EXISTS raw_response;

ALTER TABLE order_shipments
    DROP COLUMN IF EXISTS tracking_url,
    DROP COLUMN IF EXISTS notes;

ALTER TABLE order_items
    DROP COLUMN IF EXISTS product_title,
    DROP COLUMN IF EXISTS variant_title;

ALTER TABLE orders
    DROP COLUMN IF EXISTS customer_email,
    DROP COLUMN IF EXISTS customer_phone,
    DROP COLUMN IF EXISTS shipping_fee,
    DROP COLUMN IF EXISTS payment_method;
