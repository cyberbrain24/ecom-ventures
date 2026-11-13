-- Ecom Ventures: Store Database Orders Risk Scoring & Headless Courier Pipeline Rollback
-- Migration Version: 000007_orders_risk_scoring_call_notes.down.sql

DROP TABLE IF EXISTS order_call_notes CASCADE;

ALTER TABLE orders
    DROP COLUMN IF EXISTS paid_amount,
    DROP COLUMN IF EXISTS due_amount,
    DROP COLUMN IF EXISTS risk_score_flags,
    DROP COLUMN IF EXISTS courier_consignment_id,
    DROP COLUMN IF EXISTS courier_tracking_code,
    DROP COLUMN IF EXISTS courier_status_sync_at,
    DROP COLUMN IF EXISTS special_note,
    DROP COLUMN IF EXISTS shipping_district,
    DROP COLUMN IF EXISTS shipping_thana;

