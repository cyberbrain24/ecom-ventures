-- Migration: 000030_store_domain_and_theme_settings.down.sql
ALTER TABLE store_settings 
DROP COLUMN IF EXISTS primary_domain,
DROP COLUMN IF EXISTS active_theme;
