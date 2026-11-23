-- 000022_order_lifecycle_12_states.up.sql
-- Expands order_status enum to accommodate the complete 12-state transactional machine

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'PLACED';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'REVIEW';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'DELAYED';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'HOLD';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'APPROVAL_PENDING';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'PARTIALLY_DELIVERED';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'RETURNED';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'MANUALLY_CANCELLED';
