-- Migration: 000018_discount_engine_targeting.down.sql
-- Description: Reverts targeting columns and phone-first tracking in coupons.

ALTER TABLE coupons
    DROP COLUMN IF EXISTS applicable_category_ids,
    DROP COLUMN IF EXISTS included_product_ids,
    DROP COLUMN IF EXISTS excluded_product_ids;

DROP INDEX IF EXISTS idx_coupon_usages_phone;
DROP INDEX IF EXISTS idx_coupon_usages_email;

ALTER TABLE coupon_usages
    DROP COLUMN IF EXISTS customer_phone;
