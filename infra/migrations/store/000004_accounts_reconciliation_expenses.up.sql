-- Ecom Ventures: Store Database Accounts, Reconciliation, and Expenses
-- Migration Version: 000004_accounts_reconciliation_expenses.up.sql

-- 1. Account Transactions: Linked directly to completed orders and payment gateways
CREATE TABLE IF NOT EXISTS account_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    order_number VARCHAR(100),
    gateway VARCHAR(50) NOT NULL,
    gateway_transaction_id VARCHAR(150),
    gross_amount NUMERIC(12, 2) NOT NULL,
    gateway_fee NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    shipping_deduction NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    net_payout NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'BDT',
    status VARCHAR(50) NOT NULL DEFAULT 'PAID',
    settlement_status VARCHAR(50) NOT NULL DEFAULT 'UNSETTLED',
    customer_name VARCHAR(150),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    settled_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_account_transactions_order_id ON account_transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_account_transactions_status ON account_transactions(status);
CREATE INDEX IF NOT EXISTS idx_account_transactions_settlement ON account_transactions(settlement_status);
CREATE INDEX IF NOT EXISTS idx_account_transactions_gateway ON account_transactions(gateway);
CREATE INDEX IF NOT EXISTS idx_account_transactions_created ON account_transactions(created_at);

-- 2. Account Expenses: Manual logs for brand-specific operational costs
CREATE TABLE IF NOT EXISTS account_expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'BDT',
    receipt_url TEXT,
    logged_by VARCHAR(150) NOT NULL,
    expense_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_account_expenses_category ON account_expenses(category);
CREATE INDEX IF NOT EXISTS idx_account_expenses_date ON account_expenses(expense_date);

-- 3. Account Payouts: Merchant settlements transferred to brand owner's bank account
CREATE TABLE IF NOT EXISTS account_payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payout_reference VARCHAR(100) NOT NULL UNIQUE,
    amount NUMERIC(12, 2) NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'BDT',
    gateway VARCHAR(50) NOT NULL,
    destination_bank VARCHAR(150) NOT NULL,
    account_number_mask VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'COMPLETED',
    period_start DATE,
    period_end DATE,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_account_payouts_status ON account_payouts(status);
CREATE INDEX IF NOT EXISTS idx_account_payouts_processed ON account_payouts(processed_at);
