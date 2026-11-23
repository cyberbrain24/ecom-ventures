import { authorizedRequest } from './api';
import { CourierConfig, ShipmentRecord } from '../types/store';

export async function fetchCourierConfigs(): Promise<CourierConfig[]> {
  try {
    const res = await authorizedRequest<any>('/settings/logistics');
    const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
    
    // Default list of carriers supported in Bangladesh
    const carriers: Array<'Steadfast' | 'Pathao' | 'RedX'> = ['Steadfast', 'Pathao', 'RedX'];
    
    return carriers.map((carrierName) => {
      const match = list.find((item: any) => 
        String(item.carrier || '').toUpperCase() === carrierName.toUpperCase()
      );
      return {
        provider: carrierName,
        apiKey: match?.api_key || '',
        secretKey: match?.secret_key || '',
        isActive: Boolean(match?.is_enabled),
        autoDispatch: Boolean(match?.is_test_mode === false),
        webhookStatus: match?.webhook_key ? 'ACTIVE' : 'UNCONFIGURED',
      };
    });
  } catch (err) {
    console.error('Failed to fetch courier configs:', err);
    return [];
  }
}

export async function saveCourierConfig(config: {
  carrier: 'STEADFAST' | 'PATHAO' | 'REDX';
  is_enabled: boolean;
  is_test_mode: boolean;
  api_key: string;
  secret_key: string;
  client_id?: string;
  webhook_key?: string;
}): Promise<void> {
  await authorizedRequest<void>('/settings/logistics', {
    method: 'PUT',
    body: JSON.stringify(config),
  });
}

export async function fetchShipments(): Promise<ShipmentRecord[]> {
  try {
    const res = await authorizedRequest<any>('/logistics/shipments');
    const list = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
    return list.map((item: any) => ({
      id: item.id,
      orderNumber: item.orderNumber || item.order_number || '',
      carrier: item.carrier || 'Steadfast',
      trackingNumber: item.trackingNumber || item.tracking_number || '',
      recipientName: item.recipientName || item.recipient_name || '',
      recipientCity: item.recipientCity || item.recipient_city || '',
      status: (item.status === 'DELIVERED' ? 'DELIVERED' : item.status === 'OUT_FOR_DELIVERY' ? 'OUT_FOR_DELIVERY' : 'IN_TRANSIT'),
      shippedAt: item.shippedAt || item.shipped_at || '',
      estimatedDelivery: item.estimatedDelivery || item.estimated_delivery || '',
    }));
  } catch (err) {
    console.error('Failed to fetch shipments:', err);
    return [];
  }
}
