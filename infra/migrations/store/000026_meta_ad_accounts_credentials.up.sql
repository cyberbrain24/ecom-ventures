-- Meta Ad Accounts & Credentials Architecture
-- Stores encrypted Meta System User / Marketing Access Tokens with AES-256 Fernet Encryption
-- Daily Spend Cap circuit breaker, currency/timezone, and live sync status

CREATE TABLE IF NOT EXISTS meta_ad_accounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(150) NOT NULL,
    meta_account_id VARCHAR(100) NOT NULL UNIQUE,
    access_token_encrypted TEXT NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Dhaka',
    daily_spend_cap NUMERIC(12,2) NOT NULL DEFAULT 0.00 CHECK (daily_spend_cap >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_meta_ad_accounts_active ON meta_ad_accounts(is_active);
CREATE INDEX IF NOT EXISTS idx_meta_ad_accounts_meta_id ON meta_ad_accounts(meta_account_id);

DROP TRIGGER IF EXISTS trg_meta_ad_accounts_updated_at ON meta_ad_accounts;
CREATE TRIGGER trg_meta_ad_accounts_updated_at BEFORE UPDATE ON meta_ad_accounts FOR EACH ROW EXECUTE FUNCTION update_store_updated_at_column();
