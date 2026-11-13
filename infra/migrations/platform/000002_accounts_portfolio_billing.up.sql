-- Ecom Ventures: Central Platform Database Portfolio Accounts & Brand Billing
-- Migration Version: 000002_accounts_portfolio_billing.up.sql

-- 1. Portfolio Financial Summaries: Daily/monthly aggregated financial rollups per store
CREATE TABLE IF NOT EXISTS portfolio_financial_summaries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    store_slug VARCHAR(50) NOT NULL,
    period_month VARCHAR(7) NOT NULL,
    gross_sales NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    net_sales NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    order_count INTEGER NOT NULL DEFAULT 0,
    aov NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cogs NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    total_expenses NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    net_profit NUMERIC(14, 2) NOT NULL DEFAULT 0.00,
    platform_fee_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(3) NOT NULL DEFAULT 'BDT',
    last_aggregated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_store_period UNIQUE (store_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_pfs_store_slug ON portfolio_financial_summaries(store_slug);
CREATE INDEX IF NOT EXISTS idx_pfs_period ON portfolio_financial_summaries(period_month);

-- 2. Brand Billing Records: Tracking platform usage fees, hosting cost allocations, and revenue sharing
CREATE TABLE IF NOT EXISTS brand_billing_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    store_name VARCHAR(100) NOT NULL,
    store_slug VARCHAR(50) NOT NULL,
    invoice_number VARCHAR(100) NOT NULL UNIQUE,
    billing_cycle VARCHAR(50) NOT NULL DEFAULT 'MONTHLY',
    base_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    revenue_share_percentage NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    revenue_share_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    hosting_allocation NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_due NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'BDT',
    status VARCHAR(50) NOT NULL DEFAULT 'INVOICED',
    due_date DATE NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bbr_store_id ON brand_billing_records(store_id);
CREATE INDEX IF NOT EXISTS idx_bbr_status ON brand_billing_records(status);
CREATE INDEX IF NOT EXISTS idx_bbr_due_date ON brand_billing_records(due_date);
