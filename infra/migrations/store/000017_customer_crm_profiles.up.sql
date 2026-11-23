-- Migration: 000017_customer_crm_profiles.up.sql
-- Description: Adds CRM profiles, membership tiers, staff behavioral notes, blacklisting, and hierarchical geographic addresses.

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'customer_membership_tier') THEN
        CREATE TYPE customer_membership_tier AS ENUM ('STANDARD', 'SILVER', 'GOLD', 'VIP_BLACK');
    END IF;
END $$;

-- 1. Upgrade customers table for phone-first identity and CRM profiling
ALTER TABLE customers
    ALTER COLUMN email DROP NOT NULL,
    ALTER COLUMN password_hash DROP NOT NULL;

-- Drop previous unique email constraint to allow phone-first customers without emails
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_email_key;

-- Ensure conditional unique index on email (only when email is provided and non-empty)
DROP INDEX IF EXISTS idx_customers_email;
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_email_unique ON customers(LOWER(email))
    WHERE email IS NOT NULL AND email != '';

-- Add CRM profiling columns if they do not exist
ALTER TABLE customers
    ADD COLUMN IF NOT EXISTS membership_tier customer_membership_tier NOT NULL DEFAULT 'STANDARD',
    ADD COLUMN IF NOT EXISTS date_of_birth DATE,
    ADD COLUMN IF NOT EXISTS crm_notes TEXT NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS is_blacklisted BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS blacklist_reason TEXT NOT NULL DEFAULT '';

-- Ensure unique phone index for Phone-First Unified Identity (Pillar 1)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_phone_unique ON customers(phone)
    WHERE phone IS NOT NULL AND phone != '';

CREATE INDEX IF NOT EXISTS idx_customers_membership_tier ON customers(membership_tier);
CREATE INDEX IF NOT EXISTS idx_customers_is_blacklisted ON customers(is_blacklisted);

-- 2. Upgrade customer_addresses for Hierarchical Geographic Address Architecture (Pillar 3)
ALTER TABLE customer_addresses
    ADD COLUMN IF NOT EXISTS district VARCHAR(100),
    ADD COLUMN IF NOT EXISTS thana VARCHAR(100);

-- Backfill district and thana from city/state_province where missing
UPDATE customer_addresses SET district = city WHERE district IS NULL OR district = '';
UPDATE customer_addresses SET thana = COALESCE(state_province, city) WHERE thana IS NULL OR thana = '';
