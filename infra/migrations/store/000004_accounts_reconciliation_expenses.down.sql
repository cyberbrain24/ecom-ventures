-- Ecom Ventures: Rollback Store Database Accounts, Reconciliation, and Expenses
-- Migration Version: 000004_accounts_reconciliation_expenses.down.sql

DROP TABLE IF EXISTS account_payouts;
DROP TABLE IF EXISTS account_expenses;
DROP TABLE IF EXISTS account_transactions;
