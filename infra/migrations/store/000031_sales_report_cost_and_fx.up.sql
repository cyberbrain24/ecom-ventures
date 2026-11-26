-- Phase 31: Sales Report COGS Snapshot & Tenant USD Exchange Rate

ALTER TABLE store_settings
    ADD COLUMN IF NOT EXISTS usd_exchange_rate NUMERIC(10, 2) NOT NULL DEFAULT 132.00;

ALTER TABLE order_items
    ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12, 2);

-- Backfill unit_cost for existing order items from variant or product cost_price
UPDATE order_items oi
SET unit_cost = COALESCE(pv.cost_price, p.cost_price, 0)
FROM product_variants pv
LEFT JOIN products p ON p.id = pv.product_id
WHERE oi.variant_id = pv.id
  AND oi.unit_cost IS NULL;
