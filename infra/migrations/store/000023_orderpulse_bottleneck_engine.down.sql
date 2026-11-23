-- Ecom Ventures: Store Database OrderPulse Analytics & Bottleneck Engine Down Migration
-- Migration Version: 000023_orderpulse_bottleneck_engine.down.sql

DROP INDEX IF EXISTS idx_order_items_return_reason;
ALTER TABLE order_items
    DROP COLUMN IF EXISTS return_reason,
    DROP COLUMN IF EXISTS item_status;

DROP INDEX IF EXISTS idx_orders_return_cause;
DROP INDEX IF EXISTS idx_orders_cancellation_cause;
DROP INDEX IF EXISTS idx_orders_delay_blocker;

ALTER TABLE orders
    DROP COLUMN IF EXISTS parent_order_id,
    DROP COLUMN IF EXISTS is_partial_split,
    DROP COLUMN IF EXISTS return_root_cause,
    DROP COLUMN IF EXISTS cancellation_root_cause,
    DROP COLUMN IF EXISTS delay_blocker_reason;

DELETE FROM store_schema_migrations WHERE version = '000023';
