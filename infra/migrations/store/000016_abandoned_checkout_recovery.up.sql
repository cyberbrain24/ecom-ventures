-- 000016_abandoned_checkout_recovery.up.sql
-- Poshplex Abandoned Checkout Recovery Engine: telemetry capture, anti-collision, tele-sales status & 1-click order genesis

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'abandoned_checkout_status') THEN
        CREATE TYPE abandoned_checkout_status AS ENUM (
            'pending',
            'called_busy',
            'called_followup',
            'declined',
            'converted'
        );
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS abandoned_checkouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    customer_name VARCHAR(150) NOT NULL DEFAULT '',
    customer_email VARCHAR(255) NOT NULL DEFAULT '',
    district VARCHAR(100) NOT NULL DEFAULT '',
    thana VARCHAR(100) NOT NULL DEFAULT '',
    address TEXT NOT NULL DEFAULT '',
    cart_items JSONB NOT NULL DEFAULT '[]'::jsonb,
    cart_total NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    status abandoned_checkout_status NOT NULL DEFAULT 'pending',
    call_notes TEXT NOT NULL DEFAULT '',
    scheduled_callback_at TIMESTAMP WITH TIME ZONE,
    agent_id UUID,
    converted_order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_abandoned_session_token ON abandoned_checkouts (session_token);
CREATE INDEX IF NOT EXISTS idx_abandoned_phone ON abandoned_checkouts (phone);
CREATE INDEX IF NOT EXISTS idx_abandoned_status_created ON abandoned_checkouts (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_abandoned_callback ON abandoned_checkouts (scheduled_callback_at) WHERE scheduled_callback_at IS NOT NULL;
