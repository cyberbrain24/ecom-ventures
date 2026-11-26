-- Rollback Phase 32: Fulfillment Queue Issue Status Flagging

DROP INDEX IF EXISTS idx_orders_issue_status;

ALTER TABLE orders
    DROP COLUMN IF EXISTS issue_status;
