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

-- Initial seed data for standard streetwear bundle tiers
INSERT INTO bundle_tiers (id, name, required_items_count, discount_percentage, badge_text, subtitle, perks, has_free_delivery, display_order, is_active)
VALUES
    (
        'a1b2c3d4-e5f6-7890-abcd-111111111111',
        'Duo',
        2,
        5.00,
        'POPULAR',
        'Mix & Match Any 2 Products From Our Collection',
        '["SAVE 5%", "Everyday Pair Saver"]'::jsonb,
        FALSE,
        1,
        TRUE
    ),
    (
        'a1b2c3d4-e5f6-7890-abcd-222222222222',
        'Trio',
        3,
        10.00,
        'MOST POPULAR',
        'Mix & Match Any 3 Products From Our Collection',
        '["SAVE 10%", "FREE DELIVERY ALL OVER BANGLADESH", "Fan Favorite Bundle"]'::jsonb,
        TRUE,
        2,
        TRUE
    ),
    (
        'a1b2c3d4-e5f6-7890-abcd-333333333333',
        '4 Pack',
        4,
        12.00,
        'BEST VALUE',
        'Mix & Match Any 4 Products From Our Collection',
        '["SAVE 12%", "FREE DELIVERY ALL OVER BANGLADESH", "Complete Wardrobe Upgrade"]'::jsonb,
        TRUE,
        3,
        TRUE
    ),
    (
        'a1b2c3d4-e5f6-7890-abcd-444444444444',
        '5 Pack',
        5,
        15.00,
        'MAXIMUM VALUE',
        'Mix & Match Any 5 Products From Our Collection',
        '["SAVE 15%", "FREE DELIVERY ALL OVER BANGLADESH", "Maximum Percentage Savings"]'::jsonb,
        TRUE,
        4,
        TRUE
    )
ON CONFLICT (id) DO NOTHING;

