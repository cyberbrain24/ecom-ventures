-- Ecom Ventures: Store Database Campaigns Attribution & Meta CAPI Audit Engine
-- Migration Version: 000024_campaigns_attribution_capi_audit.up.sql

-- 1. Raw Event Touchpoint Intake & Identity Stitching
CREATE TABLE IF NOT EXISTS customer_touchpoints (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    visitor_id UUID NOT NULL,
    session_id VARCHAR(100),
    customer_phone VARCHAR(50),
    event_name VARCHAR(50) NOT NULL, -- PageView, ViewContent, AddToCart, InitiateCheckout, Purchase
    event_id VARCHAR(100) NOT NULL,  -- Deterministic key matching browser pixel for CAPI deduplication
    url TEXT,
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(150),
    utm_content VARCHAR(150),
    utm_term VARCHAR(150),
    campaign_id VARCHAR(100),
    adset_id VARCHAR(100),
    ad_id VARCHAR(100),
    fbclid TEXT,
    fbp VARCHAR(100),
    fbc VARCHAR(100),
    ip_address VARCHAR(50),
    user_agent TEXT,
    is_bot BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_touchpoints_visitor_id ON customer_touchpoints(visitor_id);
CREATE INDEX IF NOT EXISTS idx_touchpoints_phone ON customer_touchpoints(customer_phone) WHERE customer_phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_touchpoints_campaign ON customer_touchpoints(utm_campaign, campaign_id);
CREATE INDEX IF NOT EXISTS idx_touchpoints_event_id ON customer_touchpoints(event_id);
CREATE INDEX IF NOT EXISTS idx_touchpoints_created ON customer_touchpoints(created_at);

-- 2. Meta Ads Campaigns Metadata & Ad Spend Ledger
CREATE TABLE IF NOT EXISTS meta_ad_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id VARCHAR(100) NOT NULL UNIQUE,
    campaign_name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, PAUSED, ARCHIVED
    ad_spend_usd NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    ad_spend_bdt NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    impressions BIGINT NOT NULL DEFAULT 0,
    clicks BIGINT NOT NULL DEFAULT 0,
    synced_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_meta_campaigns_status ON meta_ad_campaigns(status);

-- 3. Order Multi-Touch Attribution Linkage
CREATE TABLE IF NOT EXISTS order_attributions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE UNIQUE,
    visitor_id UUID,
    first_touch_campaign_id VARCHAR(100),
    last_touch_campaign_id VARCHAR(100),
    last_paid_campaign_id VARCHAR(100),
    touchpoint_count INTEGER NOT NULL DEFAULT 1,
    journey_json JSONB NOT NULL DEFAULT '[]'::jsonb,
    linear_credits JSONB NOT NULL DEFAULT '{}'::jsonb,
    position_credits JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_order_attr_last_paid ON order_attributions(last_paid_campaign_id);
CREATE INDEX IF NOT EXISTS idx_order_attr_first_touch ON order_attributions(first_touch_campaign_id);

-- 4. Meta Conversions API (CAPI) Outgoing Dispatch Audit Log & 168-Hour Age Guard
CREATE TABLE IF NOT EXISTS meta_capi_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    event_name VARCHAR(50) NOT NULL, -- Purchase, AddToCart, InitiateCheckout
    event_id VARCHAR(100) NOT NULL,  -- Deduplication key matching client pixel
    status VARCHAR(50) NOT NULL,     -- SUCCESS, SKIPPED, FAILED, QUARANTINED
    http_code INTEGER NOT NULL DEFAULT 200,
    error_message TEXT,
    age_hours NUMERIC(8, 2) NOT NULL DEFAULT 0.00, -- Against 168h Meta threshold
    is_age_quarantined BOOLEAN NOT NULL DEFAULT FALSE,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    response_body TEXT,
    dispatched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_capi_audit_order_id ON meta_capi_audit_logs(order_id);
CREATE INDEX IF NOT EXISTS idx_capi_audit_event_id ON meta_capi_audit_logs(event_id);
CREATE INDEX IF NOT EXISTS idx_capi_audit_status ON meta_capi_audit_logs(status);
CREATE INDEX IF NOT EXISTS idx_capi_audit_dispatched ON meta_capi_audit_logs(dispatched_at);

INSERT INTO store_schema_migrations (version) VALUES ('000024')
ON CONFLICT (version) DO NOTHING;
