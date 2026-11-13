-- Ecom Ventures: Store Database Orders Risk Scoring & Headless Courier Pipeline
-- Migration Version: 000007_orders_risk_scoring_call_notes.up.sql

-- 1. Augment Orders with Digital-First Ledger Balances, Risk Flags, and Courier Metadata
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS due_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    ADD COLUMN IF NOT EXISTS risk_score_flags JSONB NOT NULL DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS courier_consignment_id VARCHAR(100),
    ADD COLUMN IF NOT EXISTS courier_tracking_code VARCHAR(100),
    ADD COLUMN IF NOT EXISTS courier_status_sync_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS special_note TEXT,
    ADD COLUMN IF NOT EXISTS shipping_district VARCHAR(100),
    ADD COLUMN IF NOT EXISTS shipping_thana VARCHAR(100);

-- Update due_amount for any existing orders where total > 0 and due is 0
UPDATE orders
SET due_amount = GREATEST(0.00, total_amount - paid_amount)
WHERE due_amount = 0.00 AND total_amount > 0.00 AND paid_amount = 0.00;

-- 2. Create Timestamped Order Call Notes Table
CREATE TABLE IF NOT EXISTS order_call_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    staff_name VARCHAR(100) NOT NULL,
    note TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_call_notes_order_id ON order_call_notes(order_id);
CREATE INDEX IF NOT EXISTS idx_order_call_notes_created_at ON order_call_notes(created_at);

-- 3. Indexes for Risk Lookups and Courier Operations
CREATE INDEX IF NOT EXISTS idx_orders_customer_phone ON orders(customer_phone);
CREATE INDEX IF NOT EXISTS idx_orders_courier_consignment_id ON orders(courier_consignment_id);

