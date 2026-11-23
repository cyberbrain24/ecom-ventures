ALTER TABLE domains
    ADD COLUMN IF NOT EXISTS provider_hostname_id TEXT;
