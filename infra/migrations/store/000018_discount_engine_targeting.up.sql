-- Migration: 000018_discount_engine_targeting.up.sql
-- Description: Adds hierarchical category targeting, product whitelist/blacklist arrays, and phone-first usage auditing.

-- 1. Ensure coupons table exists (if not created dynamically by code)
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    discount_type VARCHAR(30) NOT NULL,
    discount_value NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    min_subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    max_discount_amount NUMERIC(12, 2),
    max_uses INT NOT NULL DEFAULT 0,
    max_uses_per_customer INT NOT NULL DEFAULT 1,
    times_used INT NOT NULL DEFAULT 0,
    valid_from TIMESTAMP WITH TIME ZONE NOT NULL,
    valid_to TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add targeting columns to coupons table
ALTER TABLE coupons
    ADD COLUMN IF NOT EXISTS applicable_category_ids UUID[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS included_product_ids UUID[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS excluded_product_ids UUID[] NOT NULL DEFAULT '{}';

-- 3. Ensure coupon_usages table exists and upgrade for phone-first tracking
CREATE TABLE IF NOT EXISTS coupon_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
    order_id VARCHAR(100),
    customer_id VARCHAR(100),
    customer_email VARCHAR(255) NOT NULL DEFAULT '',
    customer_phone VARCHAR(50) NOT NULL DEFAULT '',
    discount_amount NUMERIC(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE coupon_usages
    ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(50) NOT NULL DEFAULT '';

-- Make customer_email nullable / default empty to allow phone-only checkouts
ALTER TABLE coupon_usages
    ALTER COLUMN customer_email DROP NOT NULL;

-- 4. Create performant indexes
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_is_active ON coupons(is_active);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_phone ON coupon_usages(coupon_id, customer_phone);
CREATE INDEX IF NOT EXISTS idx_coupon_usages_email ON coupon_usages(coupon_id, customer_email);
