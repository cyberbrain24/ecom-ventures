import { authorizedRequest } from './api';
import {
  AccountTransactionRecord,
  PaymentReconciliationItem,
  StoreExpenseRecord,
  StorePayoutRecord,
} from '../types/store';

export interface AccountsOverviewData {
  gross_revenue: number;
  total_gateway_fees: number;
  total_shipping_deducted: number;
  net_revenue: number;
  total_expenses: number;
  total_payouts_received: number;
  estimated_cogs: number;
  net_profit: number;
  operating_margin_pct: number;
  currency: string;
  pending_settlement_count: number;
  discrepancy_count: number;
}

export interface ProfitLossData {
  period: string;
  gross_sales: number;
  discounts_and_returns: number;
  gateway_fees: number;
  shipping_costs: number;
  net_revenue: number;
  cost_of_goods_sold: number;
  gross_profit: number;
  gross_margin_pct: number;
  expenses_by_category: Record<string, number>;
  total_expenses: number;
  net_profit: number;
  net_margin_pct: number;
  currency: string;
}

export async function fetchAccountsOverview(): Promise<AccountsOverviewData | null> {
  try {
    const res = await authorizedRequest<any>('/accounts/overview');
    return res?.data ?? res;
  } catch {
    return null;
  }
}

export async function fetchProfitLoss(): Promise<ProfitLossData | null> {
  try {
    const res = await authorizedRequest<any>('/accounts/profit-loss');
    return res?.data ?? res;
  } catch {
    return null;
  }
}

export async function fetchAccountTransactions(): Promise<AccountTransactionRecord[]> {
  try {
    const res = await authorizedRequest<any>('/accounts/transactions');
    const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
    return list.map((item: any) => ({
      id: item.id,
      orderId: item.order_id,
      orderNumber: item.order_number,
      gateway: item.gateway,
      gatewayTransactionId: item.gateway_transaction_id,
      grossAmount: Number(item.gross_amount) || 0,
      gatewayFee: Number(item.gateway_fee) || 0,
      shippingDeduction: Number(item.shipping_deduction) || 0,
      netPayout: Number(item.net_payout) || 0,
      currency: item.currency || 'BDT',
      status: item.status,
      settlementStatus: item.settlement_status,
      customerName: item.customer_name || 'Customer',
      timestamp: item.created_at,
      notes: item.notes,
    }));
  } catch {
    return [];
  }
}

export async function fetchExpenses(): Promise<StoreExpenseRecord[]> {
  try {
    const res = await authorizedRequest<any>('/accounts/expenses');
    const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
    return list.map((item: any) => ({
      id: item.id,
      category: item.category,
      title: item.title,
      amount: Number(item.amount) || 0,
      currency: item.currency || 'BDT',
      receiptUrl: item.receipt_url,
      loggedBy: item.logged_by,
      expenseDate: item.expense_date,
      notes: item.notes,
    }));
  } catch {
    return [];
  }
}

export async function createExpense(expense: {
  category: string;
  title: string;
  amount: number;
  currency: string;
  expense_date: string;
  receipt_url?: string;
  notes?: string;
}): Promise<void> {
  await authorizedRequest<void>('/accounts/expenses', {
    method: 'POST',
    body: JSON.stringify(expense),
  });
}

export async function deleteExpense(id: string): Promise<void> {
  await authorizedRequest<void>(`/accounts/expenses/${id}`, {
    method: 'DELETE',
  });
}

export async function fetchPayouts(): Promise<StorePayoutRecord[]> {
  try {
    const res = await authorizedRequest<any>('/accounts/payouts');
    const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
    return list.map((item: any) => ({
      id: item.id,
      payoutReference: item.payout_reference || item.payoutReference || item.id,
      amount: Number(item.amount) || 0,
      currency: item.currency || 'BDT',
      gateway: item.gateway || 'Direct Bank',
      destinationBank: item.destination_bank || item.destinationBank || 'Standard Chartered',
      accountNumberMask: item.account_number_mask || item.accountNumberMask || '•••• 8821',
      status: (item.status === 'COMPLETED' ? 'COMPLETED' : item.status === 'FAILED' ? 'FAILED' : 'PENDING'),
      period: item.period || 'Current',
      processedAt: item.settled_at || item.initiated_at || item.processedAt || '',
    }));
  } catch {
    return [];
  }
}

export async function fetchReconciliation(): Promise<PaymentReconciliationItem[]> {
  try {
    const res = await authorizedRequest<any>('/accounts/reconciliation');
    const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
    return list.map((item: any) => ({
      orderNumber: item.order_number,
      customerName: item.customer_name,
      gateway: item.gateway,
      gatewayStatus: item.gateway_status,
      storeOrderStatus: item.store_order_status,
      expectedAmount: Number(item.expected_amount) || 0,
      receivedAmount: Number(item.received_amount) || 0,
      discrepancyAmount: Number(item.discrepancy_amount) || 0,
      reconciled: Boolean(item.reconciled),
      issueReason: item.issue_reason,
      timestamp: item.timestamp,
    }));
  } catch {
    return [];
  }
}
