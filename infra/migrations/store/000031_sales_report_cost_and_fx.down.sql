-- Rollback Phase 31: Sales Report COGS Snapshot & Tenant USD Exchange Rate

ALTER TABLE order_items
    DROP COLUMN IF EXISTS unit_cost;

ALTER TABLE store_settings
    DROP COLUMN IF EXISTS usd_exchange_rate;
