import { authorizedRequest } from './api';
import {
  StoreOrder,
  FulfillmentQueueResponse,
  OrderStatus,
} from '../types/store';

export interface OrdersListResponse {
  orders: StoreOrder[];
  statusCounts: Record<string, number>;
  total: number;
  page: number;
  limit: number;
}

/**
 * Fetches all orders with status filtering from the backend.
 */
export async function fetchStoreOrders(
  status = 'ALL',
  search = '',
  page = 1,
  limit = 50
): Promise<OrdersListResponse> {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (status && status !== 'ALL') {
    query.set('status', status);
  }
  if (search) {
    query.set('search', search);
  }

  const res = await authorizedRequest<any>(`/orders?${query.toString()}`, {
    method: 'GET',
  });

  const orders: StoreOrder[] = (res.orders || []).map((o: any) => ({
    id: o.id,
    orderNumber: o.order_number,
    customerName: o.shipping_address?.recipient_name || o.customer_email || 'Customer',
    customerEmail: o.customer_email || '',
    customerPhone: o.customer_phone || o.shipping_address?.phone || '',
    shippingAddress: o.shipping_address?.street_address || '',
    city: o.shipping_address?.city || '',
    district: o.shipping_district || o.shipping_address?.city || '',
    thana: o.shipping_thana || o.shipping_address?.state_province || '',
    items: (o.items || []).map((it: any) => ({
      id: it.id,
      productTitle: it.product_title || it.title || 'Item',
      sku: it.sku || '',
      quantity: it.quantity || 1,
      unitPrice: it.unit_price || 0,
      totalPrice: it.total_price || 0,
      productImage: it.image_url || undefined,
    })),
    subtotal: o.subtotal || 0,
    shippingFee: o.shipping_fee || 0,
    discountAmount: o.discount_amount || 0,
    totalAmount: o.total_amount || 0,
    paidAmount: o.paid_amount || 0,
    dueAmount: (o.total_amount || 0) - (o.paid_amount || 0),
    status: o.status as OrderStatus,
    paymentMethod: o.payment_method || 'COD',
    paymentStatus: o.payment_status || 'PENDING',
    specialNote: o.special_note || undefined,
    is_urgent: o.is_urgent,
    is_ready: o.is_ready,
    is_print_ready: o.is_print_ready,
    courier_risk_level: o.courier_risk_level,
    courier_delivery_ratio: o.courier_delivery_ratio,
    consignmentId: o.courier_consignment_id || undefined,
    trackingNumber: o.courier_tracking_code || undefined,
    callNotes: (o.call_notes || []).map((cn: any) => ({
      id: cn.id,
      staffName: cn.staff_name || 'Staff',
      note: cn.note || '',
      createdAt: cn.created_at,
    })),
    createdAt: o.created_at,
  }));

  return {
    orders,
    statusCounts: res.status_counts || {},
    total: res.total || orders.length,
    page: res.page || page,
    limit: res.limit || limit,
  };
}

/**
 * Fetches the prioritized Warehouse Fulfillment Queue.
 */
export async function fetchFulfillmentQueue(
  urgentOnly = false,
  page = 1,
  limit = 50,
  status = '',
  search = ''
): Promise<FulfillmentQueueResponse> {
  const query = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });
  if (urgentOnly) {
    query.set('urgent_only', 'true');
  }
  if (status) {
    query.set('status', status);
  }
  if (search.trim()) {
    query.set('search', search.trim());
  }

  const res = await authorizedRequest<any>(
    `/orders/fulfillment-queue?${query.toString()}`,
    {
      method: 'GET',
    }
  );

  const items = (res.items || []).map((it: any) => {
    const o = it.order;
    return {
      order: {
        id: o.id,
        orderNumber: o.order_number,
        customerName: o.shipping_address?.recipient_name || o.shipping_address?.full_name || o.customer_email || 'Customer',
        customerEmail: o.customer_email || '',
        customerPhone: o.customer_phone || o.shipping_address?.phone || '',
        shippingAddress: o.shipping_address?.street_address || o.shipping_address?.address_line1 || '',
        city: o.shipping_address?.city || '',
        district: o.shipping_district || o.shipping_address?.district || o.shipping_address?.city || '',
        thana: o.shipping_thana || o.shipping_address?.thana || o.shipping_address?.state_province || '',
        items: (o.items || []).map((oi: any) => ({
          id: oi.id,
          productTitle: oi.product_title || oi.title || 'Product',
          variantTitle: oi.variant_title || '',
          sku: oi.sku || '',
          quantity: oi.quantity || 1,
          unitPrice: oi.unit_price || 0,
          totalPrice: oi.total_price || 0,
          productImage: oi.image_url || undefined,
        })),
        subtotal: o.subtotal || 0,
        shippingFee: o.shipping_fee || 0,
        discountAmount: o.discount_amount || 0,
        totalAmount: o.total_amount || 0,
        paidAmount: o.paid_amount || 0,
        dueAmount: (o.total_amount || 0) - (o.paid_amount || 0),
        status: o.status as OrderStatus,
        paymentMethod: o.payment_method || 'COD',
        paymentStatus: o.payment_status || 'PENDING',
        consignmentId: o.courier_consignment_id || undefined,
        trackingNumber: o.courier_tracking_code || undefined,
        specialNote: o.special_note || o.notes || undefined,
        callNotes: (o.call_notes || []).map((cn: any) => ({
          id: cn.id,
          staffName: cn.staff_name || cn.performed_by || 'Staff',
          note: cn.note || '',
          createdAt: cn.created_at,
        })),
        is_urgent: o.is_urgent,
        is_ready: o.is_ready,
        is_print_ready: o.is_print_ready,
        issue_status: o.issue_status || 'NONE',
        courier_risk_level: o.courier_risk_level,
        courier_delivery_ratio: o.courier_delivery_ratio,
        createdAt: o.created_at,
      },
      aging_hours: it.aging_hours || 0,
      aging_tier: it.aging_tier || 'NORMAL',
      is_delayed_hub_alert: Boolean(it.is_delayed_hub_alert),
    };
  });

  return {
    items,
    summary: res.summary || {
      total_queue_count: items.length,
      urgent_count: 0,
      ready_to_ship_count: 0,
      print_pending_count: 0,
      delayed_alert_count: 0,
    },
    total: res.total || items.length,
    page: res.page || page,
    limit: res.limit || limit,
  };
}

/**
 * Toggles warehouse fulfillment flags (is_ready, is_print_ready).
 */
export async function updateFulfillmentFlags(
  orderId: string,
  flags: { is_ready?: boolean; is_print_ready?: boolean; is_urgent?: boolean; issue_status?: string }
): Promise<void> {
  await authorizedRequest<void>(
    `/orders/${encodeURIComponent(orderId)}/fulfillment-flags`,
    {
      method: 'PATCH',
      body: JSON.stringify(flags),
    }
  );
}

/**
 * Triggers batch tracking status sync for pending courier shipments.
 */
export async function syncCouriers(): Promise<{ synced_count: number; updated_count: number }> {
  return authorizedRequest<{ synced_count: number; updated_count: number }>(
    '/logistics/sync-couriers',
    {
      method: 'POST',
    }
  );
}

/**
 * Updates order status.
 */
export async function updateOrderStatus(
  orderId: string,
  status: OrderStatus,
  notes = ''
): Promise<void> {
  await authorizedRequest<void>(
    `/orders/${encodeURIComponent(orderId)}/status`,
    {
      method: 'PATCH',
      body: JSON.stringify({ status, notes }),
    }
  );
}

/**
 * Adds an inline call note / delivery instruction to an order.
 */
export async function addOrderCallNote(
  orderId: string,
  note: string,
  staffName = 'Admin'
): Promise<void> {
  await authorizedRequest<void>(
    `/orders/${encodeURIComponent(orderId)}/call-notes`,
    {
      method: 'POST',
      body: JSON.stringify({ staff_name: staffName, note }),
    }
  );
}

/**
 * Dispatches an order to courier (Steadfast API).
 */
export async function dispatchOrderCourier(
  orderId: string,
  carrier = 'STEADFAST'
): Promise<any> {
  return await authorizedRequest<any>(
    `/logistics/dispatch/${encodeURIComponent(orderId)}?carrier=${encodeURIComponent(carrier)}`,
    {
      method: 'POST',
    }
  );
}

/**
 * Fetches OrderPulse Analytics and Diagnostics.
 */
export async function fetchOrderPulseDiagnostics(): Promise<any> {
  return await authorizedRequest<any>(`/orders/orderpulse/diagnostics`, {
    method: 'GET',
  });
}

/**
 * Updates OrderPulse tags (delay blocker, cancellation reason, return reason) inline.
 */
export async function updateOrderPulseTags(
  orderId: string,
  tags: { delay_blocker_reason?: string; cancellation_root_cause?: string; return_root_cause?: string }
): Promise<void> {
  await authorizedRequest<void>(
    `/orders/${encodeURIComponent(orderId)}/orderpulse-tags`,
    {
      method: 'PATCH',
      body: JSON.stringify(tags),
    }
  );
}

/**
 * Executes a 1-click Partial Delivery Split.
 */
export async function executePartialSplit(
  orderId: string,
  splitReq: { items: { item_id: string; action: string; return_reason?: string }[]; notes?: string }
): Promise<void> {
  await authorizedRequest<void>(
    `/orders/${encodeURIComponent(orderId)}/partial-split`,
    {
      method: 'POST',
      body: JSON.stringify(splitReq),
    }
  );
}
