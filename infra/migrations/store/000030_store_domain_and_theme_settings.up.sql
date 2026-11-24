-- Migration: 000030_store_domain_and_theme_settings.up.sql
-- Scope: Add primary_domain and active_theme to store_settings for direct tenant-level queryability

ALTER TABLE store_settings 
ADD COLUMN IF NOT EXISTS primary_domain VARCHAR(255) NOT NULL DEFAULT '',
ADD COLUMN IF NOT EXISTS active_theme VARCHAR(100) NOT NULL DEFAULT '';
