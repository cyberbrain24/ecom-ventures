-- Ecom Ventures: Platform Storage Settings (Cloudflare R2 Integration)
-- Migration Version: 000005_platform_storage_settings.up.sql

CREATE TABLE IF NOT EXISTS platform_storage_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL DEFAULT 'local', -- 'local' or 'cloudflare_r2'
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Cloudflare R2 Credentials (S3-Compatible)
    account_id VARCHAR(255) NOT NULL DEFAULT '',
    bucket_name VARCHAR(255) NOT NULL DEFAULT '',
    access_key_id VARCHAR(255) NOT NULL DEFAULT '',
    secret_access_key_encrypted TEXT NOT NULL DEFAULT '',
    public_url VARCHAR(500) NOT NULL DEFAULT '',
    region VARCHAR(50) NOT NULL DEFAULT 'auto',
    
    -- Local fallback settings
    local_base_path VARCHAR(255) NOT NULL DEFAULT './uploads',
    local_base_url VARCHAR(500) NOT NULL DEFAULT 'http://localhost:8080/uploads',
    
    last_tested_at TIMESTAMP WITH TIME ZONE,
    last_test_status VARCHAR(50),
    last_test_error TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Seed singleton storage configuration row
INSERT INTO platform_storage_settings (
    id, provider, is_active, local_base_path, local_base_url
) VALUES (
    '00000000-0000-0000-0000-000000000001', 'local', TRUE, './uploads', 'http://localhost:8080/uploads'
) ON CONFLICT (id) DO NOTHING;
