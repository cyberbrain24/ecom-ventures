-- Ecom Ventures: Store Database OrderPulse Analytics & Bottleneck Engine
-- Migration Version: 000023_orderpulse_bottleneck_engine.up.sql

ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS delay_blocker_reason VARCHAR(100),
    ADD COLUMN IF NOT EXISTS cancellation_root_cause VARCHAR(100),
    ADD COLUMN IF NOT EXISTS return_root_cause VARCHAR(100),
    ADD COLUMN IF NOT EXISTS is_partial_split BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS parent_order_id UUID REFERENCES orders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_orders_delay_blocker ON orders(delay_blocker_reason) WHERE delay_blocker_reason IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_cancellation_cause ON orders(cancellation_root_cause) WHERE cancellation_root_cause IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_orders_return_cause ON orders(return_root_cause) WHERE return_root_cause IS NOT NULL;

-- Line item return root-cause tracking for Catalog R&D matrix
ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS item_status VARCHAR(50) NOT NULL DEFAULT 'DELIVERED', -- DELIVERED, RETURNED, CANCELLED
    ADD COLUMN IF NOT EXISTS return_reason VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_order_items_return_reason ON order_items(return_reason) WHERE return_reason IS NOT NULL;

INSERT INTO store_schema_migrations (version) VALUES ('000023')
ON CONFLICT (version) DO NOTHING;
