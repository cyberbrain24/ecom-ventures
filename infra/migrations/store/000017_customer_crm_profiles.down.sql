-- Migration: 000017_customer_crm_profiles.down.sql
-- Description: Reverts CRM profiles, membership tiers, and address hierarchy columns.

DROP INDEX IF EXISTS idx_customers_is_blacklisted;
DROP INDEX IF EXISTS idx_customers_membership_tier;
DROP INDEX IF EXISTS idx_customers_phone_unique;
DROP INDEX IF EXISTS idx_customers_email_unique;

ALTER TABLE customer_addresses
    DROP COLUMN IF EXISTS thana,
    DROP COLUMN IF EXISTS district;

ALTER TABLE customers
    DROP COLUMN IF EXISTS blacklist_reason,
    DROP COLUMN IF EXISTS is_blacklisted,
    DROP COLUMN IF EXISTS crm_notes,
    DROP COLUMN IF EXISTS date_of_birth,
    DROP COLUMN IF EXISTS membership_tier;

DROP TYPE IF EXISTS customer_membership_tier;
