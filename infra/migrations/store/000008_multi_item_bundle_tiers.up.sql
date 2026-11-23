-- Ecom Ventures: Dedicated Store Database Schema Extension
-- Migration Version: 000008_multi_item_bundle_tiers.up.sql
-- Scope: Multi-Item Bundle Tiers ("Buy More & Save") AOV multiplication engine

CREATE TABLE IF NOT EXISTS bundle_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    required_items_count INTEGER NOT NULL CHECK (required_items_count >= 2),
    discount_percentage NUMERIC(5, 2) NOT NULL CHECK (discount_percentage >= 0 AND discount_percentage <= 100),
    badge_text VARCHAR(50),
    subtitle VARCHAR(255),
    perks JSONB NOT NULL DEFAULT '[]'::jsonb,
    has_free_delivery BOOLEAN NOT NULL DEFAULT FALSE,
    display_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bundle_tiers_active_order ON bundle_tiers (is_active, display_order ASC);
