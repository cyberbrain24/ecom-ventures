-- Migration: Add Fulfillment Queue, Urgent Parcel and Courier Risk flags
-- Version: 000015_fulfillment_queue_flags.up.sql

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_ready BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_print_ready BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS courier_risk_level VARCHAR(20) NOT NULL DEFAULT 'LOW',
    ADD COLUMN IF NOT EXISTS courier_delivery_ratio NUMERIC(5,2) NOT NULL DEFAULT 0.00;

CREATE INDEX IF NOT EXISTS idx_orders_fulfillment_queue
    ON orders (is_urgent DESC, created_at ASC)
    WHERE status IN ('PENDING', 'CONFIRMED', 'PROCESSING');
