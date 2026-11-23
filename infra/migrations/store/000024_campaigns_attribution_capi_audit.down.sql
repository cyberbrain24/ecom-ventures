-- Ecom Ventures: Store Database Campaigns Attribution & Meta CAPI Audit Engine Down Migration
-- Migration Version: 000024_campaigns_attribution_capi_audit.down.sql

DROP TABLE IF EXISTS meta_capi_audit_logs;
DROP TABLE IF EXISTS order_attributions;
DROP TABLE IF EXISTS meta_ad_campaigns;
DROP TABLE IF EXISTS customer_touchpoints;

DELETE FROM store_schema_migrations WHERE version = '000024';
