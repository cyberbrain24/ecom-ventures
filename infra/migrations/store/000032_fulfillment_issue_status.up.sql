-- Phase 32: Fulfillment Queue Issue Status Flagging

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS issue_status VARCHAR(32) NOT NULL DEFAULT 'NONE';

CREATE INDEX IF NOT EXISTS idx_orders_issue_status ON orders(issue_status);
