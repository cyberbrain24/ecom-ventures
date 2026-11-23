-- Rollback: Remove Fulfillment Queue, Urgent Parcel and Courier Risk flags
-- Version: 000015_fulfillment_queue_flags.down.sql

DROP INDEX IF EXISTS idx_orders_fulfillment_queue;

ALTER TABLE orders
    DROP COLUMN IF EXISTS is_urgent,
    DROP COLUMN IF EXISTS is_ready,
    DROP COLUMN IF EXISTS is_print_ready,
    DROP COLUMN IF EXISTS courier_risk_level,
    DROP COLUMN IF EXISTS courier_delivery_ratio;
