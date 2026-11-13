-- Ecom Ventures: Revert Central Platform Database Core Schema
-- Migration Version: 000001_create_platform_core_schema.down.sql

DROP TRIGGER IF EXISTS trg_store_themes_updated_at ON store_themes;
DROP TRIGGER IF EXISTS trg_themes_updated_at ON themes;
DROP TRIGGER IF EXISTS trg_domains_updated_at ON domains;
DROP TRIGGER IF EXISTS trg_stores_updated_at ON stores;
DROP TRIGGER IF EXISTS trg_platform_users_updated_at ON platform_users;

DROP FUNCTION IF EXISTS update_updated_at_column();

DROP TABLE IF EXISTS audit_logs;
DROP TABLE IF EXISTS store_provisioning_logs;
DROP TABLE IF EXISTS store_themes;
DROP TABLE IF EXISTS themes;
DROP TABLE IF EXISTS domains;
DROP TABLE IF EXISTS stores;
DROP TABLE IF EXISTS platform_users;

DROP TYPE IF EXISTS provisioning_step_status;
DROP TYPE IF EXISTS domain_ssl_status;
DROP TYPE IF EXISTS store_status;
DROP TYPE IF EXISTS platform_user_status;
DROP TYPE IF EXISTS platform_user_role;
