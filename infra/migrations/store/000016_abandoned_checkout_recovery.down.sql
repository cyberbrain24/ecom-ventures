-- 000016_abandoned_checkout_recovery.down.sql
DROP TABLE IF EXISTS abandoned_checkouts CASCADE;
DROP TYPE IF EXISTS abandoned_checkout_status CASCADE;
