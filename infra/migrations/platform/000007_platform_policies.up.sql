-- Ecom Ventures: Platform Policies Configuration
-- Migration Version: 000007_platform_policies.up.sql

CREATE TABLE IF NOT EXISTS platform_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
    allow_new_store_provisioning BOOLEAN NOT NULL DEFAULT TRUE,
    enforce_custom_domain_ssl BOOLEAN NOT NULL DEFAULT TRUE,
    default_store_currency VARCHAR(10) NOT NULL DEFAULT 'BDT',
    default_store_timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Dhaka',
    max_stores_per_account INTEGER NOT NULL DEFAULT 10,
    session_ttl_minutes INTEGER NOT NULL DEFAULT 1440,
    audit_log_retention_days INTEGER NOT NULL DEFAULT 90,
    api_rate_limit_per_min INTEGER NOT NULL DEFAULT 120,
    support_contact_email VARCHAR(255) NOT NULL DEFAULT 'support@dropiobd.com',
    updated_by VARCHAR(255) NOT NULL DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed singleton platform policy configuration row
INSERT INTO platform_policies (
    id,
    maintenance_mode,
    allow_new_store_provisioning,
    enforce_custom_domain_ssl,
    default_store_currency,
    default_store_timezone,
    max_stores_per_account,
    session_ttl_minutes,
    audit_log_retention_days,
    api_rate_limit_per_min,
    support_contact_email
) VALUES (
    '00000000-0000-0000-0000-000000000001',
    FALSE,
    TRUE,
    TRUE,
    'BDT',
    'Asia/Dhaka',
    10,
    1440,
    90,
    120,
    'support@dropiobd.com'
) ON CONFLICT (id) DO NOTHING;
