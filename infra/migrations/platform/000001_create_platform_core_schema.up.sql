-- Ecom Ventures: Central Platform Database Core Schema
-- Migration Version: 000001_create_platform_core_schema.up.sql
-- Scope: Store registry, domain mappings, theme registry, platform auth, audit trail

-- 1. Enable required PostgreSQL extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Enumerated Types for platform-level states and roles
CREATE TYPE platform_user_role AS ENUM (
    'SUPER_ADMIN',
    'PLATFORM_STAFF'
);

CREATE TYPE platform_user_status AS ENUM (
    'ACTIVE',
    'SUSPENDED',
    'DEACTIVATED'
);

CREATE TYPE store_status AS ENUM (
    'PROVISIONING',
    'ACTIVE',
    'MAINTENANCE',
    'SUSPENDED',
    'ARCHIVED'
);

CREATE TYPE domain_ssl_status AS ENUM (
    'PENDING',
    'ACTIVE',
    'FAILED',
    'REVOKED'
);

CREATE TYPE provisioning_step_status AS ENUM (
    'PENDING',
    'IN_PROGRESS',
    'COMPLETED',
    'FAILED'
);

-- 3. Platform Administrators and Staff Table
CREATE TABLE IF NOT EXISTS platform_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role platform_user_role NOT NULL DEFAULT 'PLATFORM_STAFF',
    status platform_user_status NOT NULL DEFAULT 'ACTIVE',
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_platform_users_email ON platform_users(email);
CREATE INDEX idx_platform_users_status ON platform_users(status);

-- 4. Central Store Registry Table
-- Holds metadata and isolated database connection details for each store
CREATE TABLE IF NOT EXISTS stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    logo_url TEXT,
    status store_status NOT NULL DEFAULT 'PROVISIONING',
    
    -- Dedicated PostgreSQL Database Connection Credentials
    db_host VARCHAR(255) NOT NULL,
    db_port INTEGER NOT NULL DEFAULT 5432,
    db_name VARCHAR(63) NOT NULL UNIQUE,
    db_user VARCHAR(63) NOT NULL,
    db_password_encrypted TEXT NOT NULL,
    db_sslmode VARCHAR(30) NOT NULL DEFAULT 'disable',

    -- Primary contact information
    contact_email VARCHAR(255) NOT NULL,
    contact_phone VARCHAR(50),
    
    -- Metadata flags
    currency VARCHAR(3) NOT NULL DEFAULT 'BDT',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Dhaka',
    
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_stores_slug ON stores(slug);
CREATE INDEX idx_stores_status ON stores(status);

-- 5. Independent Domain Resolution & Custom Domains Table
CREATE TABLE IF NOT EXISTS domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    domain VARCHAR(255) NOT NULL UNIQUE,
    is_primary BOOLEAN NOT NULL DEFAULT FALSE,
    is_custom BOOLEAN NOT NULL DEFAULT TRUE,
    ssl_status domain_ssl_status NOT NULL DEFAULT 'PENDING',
    verification_token VARCHAR(128),
    verified_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_domains_domain ON domains(domain);
CREATE INDEX idx_domains_store_id ON domains(store_id);
CREATE UNIQUE INDEX idx_unique_primary_domain_per_store ON domains(store_id) WHERE is_primary = TRUE;

-- 6. Theme Blueprint & Registry Table
CREATE TABLE IF NOT EXISTS themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(50) NOT NULL UNIQUE,
    description TEXT,
    version VARCHAR(20) NOT NULL DEFAULT '1.0.0',
    preview_image_url TEXT,
    config_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_themes_slug ON themes(slug);
CREATE INDEX idx_themes_is_active ON themes(is_active);

-- 7. Store Theme Assignment and Dynamic Configurations
CREATE TABLE IF NOT EXISTS store_themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    theme_id UUID NOT NULL REFERENCES themes(id) ON DELETE RESTRICT,
    custom_config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    activated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_store_themes_store_id ON store_themes(store_id);
CREATE INDEX idx_store_themes_theme_id ON store_themes(theme_id);
CREATE UNIQUE INDEX idx_unique_active_theme_per_store ON store_themes(store_id) WHERE is_active = TRUE;

-- 8. Store Provisioning Pipeline Ledger
CREATE TABLE IF NOT EXISTS store_provisioning_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    step VARCHAR(100) NOT NULL,
    step_order INTEGER NOT NULL,
    status provisioning_step_status NOT NULL DEFAULT 'PENDING',
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    error_message TEXT,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_provisioning_logs_store_id ON store_provisioning_logs(store_id);
CREATE INDEX idx_provisioning_logs_status ON store_provisioning_logs(status);

-- 9. Central Platform Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES platform_users(id) ON DELETE SET NULL,
    user_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id VARCHAR(100) NOT NULL,
    store_id UUID REFERENCES stores(id) ON DELETE SET NULL,
    payload_before JSONB,
    payload_after JSONB,
    client_ip VARCHAR(45) NOT NULL,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_store_id ON audit_logs(store_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- 10. Update Trigger for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trg_platform_users_updated_at BEFORE UPDATE ON platform_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_stores_updated_at BEFORE UPDATE ON stores FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_domains_updated_at BEFORE UPDATE ON domains FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_themes_updated_at BEFORE UPDATE ON themes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_store_themes_updated_at BEFORE UPDATE ON store_themes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
