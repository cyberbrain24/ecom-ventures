import { authorizedRequest } from './api';
import { PaymentGatewayConfig, PaymentTransaction } from '../types/store';

export async function fetchPaymentConfigs(): Promise<PaymentGatewayConfig[]> {
  try {
    const res = await authorizedRequest<any>('/settings/payments');
    const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
    
    const standardGateways: Array<{ id: 'bkash' | 'nagad' | 'sslcommerz' | 'stripe' | 'cod'; name: string }> = [
      { id: 'bkash', name: 'bKash Direct' },
      { id: 'nagad', name: 'Nagad Gateway' },
      { id: 'sslcommerz', name: 'SSLCommerz Hosted' },
      { id: 'stripe', name: 'Stripe International' },
      { id: 'cod', name: 'Cash on Delivery (COD)' },
    ];

    return standardGateways.map((gw) => {
      const match = list.find((item: any) => 
        String(item.gateway || '').toLowerCase() === gw.id.toLowerCase()
      );
      return {
        id: gw.id,
        name: gw.name,
        isEnabled: match ? Boolean(match.is_enabled) : (gw.id === 'cod'),
        isDefault: match ? Boolean(match.is_default) : (gw.id === 'cod'),
        isSandbox: match ? Boolean(match.is_test_mode) : false,
        merchantId: match?.account_id || match?.client_id || '',
        supportedCurrencies: gw.id === 'stripe' ? ['USD', 'EUR', 'BDT'] : ['BDT'],
      };
    });
  } catch (err) {
    console.error('Failed to fetch payment configs:', err);
    return [];
  }
}

export async function savePaymentConfig(config: {
  gateway: 'BKASH' | 'NAGAD' | 'SSLCOMMERZ' | 'STRIPE' | 'COD';
  is_enabled: boolean;
  is_default?: boolean;
  is_test_mode: boolean;
  account_id?: string;
  client_id?: string;
  client_secret?: string;
  webhook_key?: string;
}): Promise<void> {
  await authorizedRequest<void>('/settings/payments', {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

export async function setDefaultPaymentGateway(gateway: string): Promise<void> {
  await authorizedRequest<void>(`/settings/payments/${gateway.toUpperCase()}/default`, {
    method: 'POST',
  });
}

export async function togglePaymentGateway(gateway: string, isEnabled: boolean): Promise<void> {
  await authorizedRequest<void>(`/settings/payments/${gateway.toUpperCase()}/toggle`, {
    method: 'PATCH',
    body: JSON.stringify({ is_enabled: isEnabled }),
  });
}

export async function fetchPaymentTransactions(): Promise<PaymentTransaction[]> {
  try {
    const res = await authorizedRequest<any>('/accounts/transactions');
    const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
    return list.map((item: any) => ({
      id: item.id,
      orderNumber: item.order_number || item.orderNumber || '',
      gateway: item.gateway || 'COD',
      transactionReference: item.gateway_transaction_id || item.transactionReference || item.id,
      amount: Number(item.gross_amount) || Number(item.amount) || 0,
      status: (item.status === 'PAID' ? 'SUCCESS' : item.status === 'FAILED' ? 'FAILED' : 'PENDING'),
      timestamp: item.created_at || item.timestamp || '',
    }));
  } catch (err) {
    console.error('Failed to fetch payment transactions:', err);
    return [];
  }
}
