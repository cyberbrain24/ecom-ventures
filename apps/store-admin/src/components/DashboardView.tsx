import React from 'react';
import {
  TrendingUp,
  ShoppingBag,
  Package,
  AlertTriangle,
  ArrowUpRight,
  Truck,
  Tag,
  CreditCard,
  CheckCircle2,
  Clock,
  Sparkles,
  Users,
  DollarSign
} from 'lucide-react';
import { StoreOrder, StoreProduct, StoreBrand } from '../types/store';

interface DashboardViewProps {
  currentStore: StoreBrand;
  orders: StoreOrder[];
  products: StoreProduct[];
  onNavigateTab: (tab: any) => void;
  onUpdateOrderStatus: (orderId: string, newStatus: any) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  currentStore,
  orders,
  products,
  onNavigateTab,
  onUpdateOrderStatus,
}) => {
  const totalRevenue = orders
    .filter((o) => o.paymentStatus === 'PAID')
    .reduce((sum, o) => sum + o.totalAmount, 0);

  const totalOrdersCount = orders.length;
  const pendingOrdersCount = orders.filter((o) => o.status === 'PENDING' || o.status === 'CONFIRMED').length;
  const activeProductsCount = products.filter((p) => p.status === 'ACTIVE').length;
  const lowStockCount = products.filter((p) => p.inventoryCount < 10).length;
  const totalCustomersCount = new Set(orders.map((o) => o.customerEmail || o.customerPhone)).size || 1;
  const averageOrderValue = totalOrdersCount > 0 ? Math.round(totalRevenue / totalOrdersCount) : 0;

  return (
    <div>
      {/* Brand Context Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, #090d16 0%, #131b2e 100%)',
          color: 'white',
          padding: '16px 20px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span
              style={{
                backgroundColor: 'rgba(16, 185, 129, 0.2)',
                color: '#34d399',
                padding: '3px 9px',
                borderRadius: '9999px',
                fontSize: '0.74rem',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34d399' }} />
              Store Online & Active
            </span>
            <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>
              Status: <strong style={{ color: '#f1f5f9' }}>Serving Customers</strong>
            </span>
          </div>
          <h1 style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em', color: '#ffffff' }}>
            {currentStore.name} — Store Administration
          </h1>
          <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '3px' }}>
            Connected Domain: <a href={`http://${currentStore.primaryDomain}:3002`} target="_blank" rel="noreferrer" style={{ color: '#38bdf8', textDecoration: 'none', fontWeight: 600 }}>{currentStore.primaryDomain}</a> | Currency: {currentStore.currency} | Timezone: {currentStore.timezone}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => onNavigateTab('catalog')}
            className="btn btn-primary"
            style={{ padding: '8px 16px', fontSize: '0.84rem' }}
          >
            <Package size={16} />
            <span>Manage Catalog</span>
          </button>
          <a
            href={`http://localhost:3002?brand=${currentStore.slug}`}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            style={{ padding: '8px 16px', fontSize: '0.84rem', background: 'rgba(255, 255, 255, 0.1)', color: 'white', borderColor: 'rgba(255, 255, 255, 0.2)' }}
          >
            <span>View Public Storefront</span>
            <ArrowUpRight size={16} />
          </a>
        </div>
      </div>

      {/* KPI Stats Grid - 7 Column Box Card Design */}
      <div className="stats-grid">
        {/* 1. Total Revenue */}
        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Total Revenue</div>
            <div className="stat-val">৳{totalRevenue.toLocaleString()}</div>
            <div className="stat-sub" style={{ color: '#059669', fontWeight: 600 }}>
              <TrendingUp size={12} /> +18.4%
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
            <TrendingUp size={18} />
          </div>
        </div>

        {/* 2. Total Orders */}
        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Total Orders</div>
            <div className="stat-val">{totalOrdersCount}</div>
            <div className="stat-sub" style={{ color: '#0284c7', fontWeight: 600 }}>
              <CheckCircle2 size={12} /> 100% fulfill
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#f0f9ff', color: '#0284c7' }}>
            <ShoppingBag size={18} />
          </div>
        </div>

        {/* 3. Pending Queue */}
        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Pending Queue</div>
            <div className="stat-val" style={{ color: pendingOrdersCount > 0 ? '#f59e0b' : 'var(--text-main)' }}>
              {pendingOrdersCount}
            </div>
            <div className="stat-sub" style={{ color: pendingOrdersCount > 0 ? '#d97706' : 'var(--text-subtle)' }}>
              <Clock size={12} /> Needs action
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}>
            <Clock size={18} />
          </div>
        </div>

        {/* 4. Active Catalog SKUs */}
        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Active SKUs</div>
            <div className="stat-val">{activeProductsCount}</div>
            <div className="stat-sub" style={{ color: '#6366f1', fontWeight: 600 }}>
              <Sparkles size={12} /> Live items
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#eef2ff', color: '#6366f1' }}>
            <Package size={18} />
          </div>
        </div>

        {/* 5. Low Stock Alerts */}
        <div className="stat-card" style={{ borderLeft: lowStockCount > 0 ? '3px solid #ef4444' : undefined }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Stock Alerts</div>
            <div className="stat-val" style={{ color: lowStockCount > 0 ? '#dc2626' : 'var(--text-main)' }}>
              {lowStockCount}
            </div>
            <div className="stat-sub" style={{ color: lowStockCount > 0 ? '#b91c1c' : 'var(--text-subtle)' }}>
              <AlertTriangle size={12} /> Below 10 units
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#fee2e2', color: '#dc2626' }}>
            <AlertTriangle size={18} />
          </div>
        </div>

        {/* 6. Customers */}
        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Shoppers</div>
            <div className="stat-val">{totalCustomersCount}</div>
            <div className="stat-sub" style={{ color: '#059669' }}>
              <Users size={12} /> Active profiles
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#ecfdf5', color: '#059669' }}>
            <Users size={18} />
          </div>
        </div>

        {/* 7. Average Order Value (AOV) */}
        <div className="stat-card">
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="stat-label">Avg Order (AOV)</div>
            <div className="stat-val">৳{averageOrderValue.toLocaleString()}</div>
            <div className="stat-sub" style={{ color: '#64748b' }}>
              <CreditCard size={12} /> Per transaction
            </div>
          </div>
          <div className="stat-icon" style={{ background: '#f1f5f9', color: '#475569' }}>
            <CreditCard size={18} />
          </div>
        </div>
      </div>

      {/* Quick Action Shortcuts */}
      <div className="card" style={{ padding: '16px 20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚡ Quick Store Actions:</span>
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button onClick={() => onNavigateTab('catalog')} className="btn btn-secondary btn-sm">
              <Package size={14} /> Add Product
            </button>
            <button onClick={() => onNavigateTab('orders')} className="btn btn-secondary btn-sm">
              <ShoppingBag size={14} /> Process Orders ({orders.filter(o => o.status === 'PENDING' || o.status === 'CONFIRMED').length})
            </button>
            <button onClick={() => onNavigateTab('logistics')} className="btn btn-secondary btn-sm">
              <Truck size={14} /> Dispatch Courier
            </button>
            <button onClick={() => onNavigateTab('promotions')} className="btn btn-secondary btn-sm">
              <Tag size={14} /> Create Coupon
            </button>
            <button onClick={() => onNavigateTab('payments')} className="btn btn-secondary btn-sm">
              <CreditCard size={14} /> Gateway Config
            </button>
          </div>
        </div>
      </div>

      {/* Recent Orders Section */}
      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Recent Customer Orders</div>
            <div className="card-desc">Real-time purchase events synced from public brand storefront</div>
          </div>
          <button onClick={() => onNavigateTab('orders')} className="btn btn-secondary btn-sm">
            View All Orders ({orders.length})
          </button>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Items</th>
                <th>Total (BDT)</th>
                <th>Payment</th>
                <th>Order Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {orders.slice(0, 5).map((order) => (
                <tr key={order.id}>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>{order.orderNumber}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{order.customerName}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{order.customerPhone}</div>
                  </td>
                  <td>{order.items.map((i) => `${i.quantity}x ${i.productTitle}`).join(', ')}</td>
                  <td style={{ fontWeight: 700, color: 'var(--primary)' }}>৳ {order.totalAmount.toLocaleString()}</td>
                  <td>
                    <span className={`badge ${order.paymentStatus === 'PAID' ? 'badge-active' : 'badge-pending'}`}>
                      {order.paymentMethod} ({order.paymentStatus})
                    </span>
                  </td>
                  <td>
                    <span
                      className={`badge ${
                        order.status === 'DELIVERED'
                          ? 'badge-active'
                          : order.status === 'SHIPPED'
                          ? 'badge-shipped'
                          : order.status === 'PROCESSING' || order.status === 'CONFIRMED'
                          ? 'badge-pending'
                          : 'badge-outline'
                      }`}
                    >
                      {order.status}
                    </span>
                  </td>
                  <td>
                    {order.status === 'CONFIRMED' && (
                      <button
                        onClick={() => onUpdateOrderStatus(order.id, 'PROCESSING')}
                        className="btn btn-primary btn-sm"
                      >
                        Process
                      </button>
                    )}
                    {order.status === 'PROCESSING' && (
                      <button
                        onClick={() => onUpdateOrderStatus(order.id, 'SHIPPED')}
                        className="btn btn-primary btn-sm"
                        style={{ backgroundColor: '#0284c7' }}
                      >
                        <Truck size={12} /> Dispatch
                      </button>
                    )}
                    {order.status === 'SHIPPED' && (
                      <button
                        onClick={() => onUpdateOrderStatus(order.id, 'DELIVERED')}
                        className="btn btn-secondary btn-sm"
                      >
                        Complete
                      </button>
                    )}
                    {order.status === 'DELIVERED' && (
                      <span style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 600 }}>Delivered</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
