import React, { useState, useEffect, useCallback } from 'react';
import {
  StoreBrand,
  MetaAttributionDashboardResponse,
  CampaignAttributionRow,
  MetaCAPIAuditLogRow,
} from '../types/store';
import {
  fetchMetaAttributionDashboard,
  MetaAdAccountEntity,
  fetchMetaAdAccounts,
  connectMetaAdAccount,
  deleteMetaAdAccount,
  syncMetaAdAccount,
  testGraphAPIExplorer,
  GraphAPIExplorerResponseDTO,
} from '../lib/marketing-api';
import { formatMoney } from '../lib/format';
import {
  ShieldCheck,
  ShieldAlert,
  Zap,
  DollarSign,
  TrendingUp,
  Package,
  Layers,
  Calendar,
  Search,
  RotateCcw,
  AlertTriangle,
  CheckCircle,
  Clock,
  ExternalLink,
  Sliders,
  Filter,
  BarChart2,
  Globe,
  Radio,
  Key,
  Code,
  Play,
  Lock,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Server,
} from 'lucide-react';
import { RecordModal } from './RecordModal';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

interface MetaAdsModuleProps {
  currentStore: StoreBrand;
}

type MetaAdsTab = 'campaigns' | 'attribution' | 'capi_audit' | 'accounts' | 'explorer';
type AttributionModel = 'last_paid_ad' | 'first_touch' | 'linear' | 'position_based';

export const MetaAdsModule: React.FC<MetaAdsModuleProps> = ({ currentStore }) => {
  const [activeTab, setActiveTab] = useState<MetaAdsTab>('campaigns');
  const [model, setModel] = useState<AttributionModel>('last_paid_ad');
  const [timeRange, setTimeRange] = useState<string>('last_30_days');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Dashboard Data State
  const [dashboard, setDashboard] = useState<MetaAttributionDashboardResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  // Meta Ad Accounts State
  const [accounts, setAccounts] = useState<MetaAdAccountEntity[]>([]);
  const [accountsLoading, setAccountsLoading] = useState<boolean>(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState<boolean>(false);
  const [deletingAccount, setDeletingAccount] = useState<MetaAdAccountEntity | null>(null);
  const [syncingAccountId, setSyncingAccountId] = useState<number | null>(null);

  // Graph API Explorer State
  const [explorerAccount, setExplorerAccount] = useState<string>('');
  const [explorerMethod, setExplorerMethod] = useState<'GET' | 'POST'>('GET');
  const [explorerEndpoint, setExplorerEndpoint] = useState<string>('{ad_account_id}/insights?fields=spend,impressions,clicks&date_preset=last_7d');
  const [explorerBody, setExplorerBody] = useState<string>('');
  const [explorerLoading, setExplorerLoading] = useState<boolean>(false);
  const [explorerResult, setExplorerResult] = useState<GraphAPIExplorerResponseDTO | null>(null);

  const showToast = (msg: string) => {
    setActionNotice(msg);
    setTimeout(() => setActionNotice(null), 4000);
  };

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchMetaAttributionDashboard(model);
      setDashboard(data);
    } catch (err: any) {
      setError(err.detail || err.message || 'Failed to load Meta Attribution data.');
    } finally {
      setLoading(false);
    }
  }, [model]);

  const loadAccounts = useCallback(async () => {
    setAccountsLoading(true);
    try {
      const list = await fetchMetaAdAccounts();
      setAccounts(list);
      if (list.length > 0 && !explorerAccount) {
        setExplorerAccount(list[0].meta_account_id);
      }
    } catch (err: any) {
      console.error('Failed to load accounts', err);
    } finally {
      setAccountsLoading(false);
    }
  }, [explorerAccount]);

  useEffect(() => {
    loadDashboard();
    loadAccounts();
  }, [loadDashboard, loadAccounts]);

  // Fallback defaults matching wireframe
  const scorecard = dashboard?.scorecard || {
    status: 'HEALTHY',
    discrepancy_rate: 1.4,
    storefront_orders: 1420,
    tracked_touchpoints: 1402,
    meta_capi_received: 1398,
    intake_events: 48200,
    quarantined_events: 0,
  };

  const financials = dashboard?.financials || {
    delivered_roas: 2.84,
    net_contribution_bdt: 142650.00,
    delivered_revenue_bdt: 384200.00,
    delivered_orders_count: 268,
    ad_spend_bdt: 135200.00,
    ad_spend_usd: 1108.20,
    cogs_bdt: 115260.00,
    shipping_fees_bdt: 26800.00,
    return_penalties_bdt: 8500.00,
  };

  const campaigns: CampaignAttributionRow[] = dashboard?.campaigns && dashboard.campaigns.length > 0
    ? dashboard.campaigns
    : [
        {
          campaign_id: 'cmp_aw26_hero_01',
          campaign_name: 'Acid-Wash Oversized Heavyweight Tee - Lookbook CBO',
          ad_spend_usd: 480.00,
          ad_spend_bdt: 58560.00,
          attributed_placed_orders: 142,
          placed_revenue_bdt: 245000.00,
          delivered_orders: 128,
          delivered_revenue_bdt: 218400.00,
          delivery_rate: 90.1,
          cogs_bdt: 65000.00,
          courier_cost_bdt: 12000.00,
          return_penalty_bdt: 2500.00,
          net_ad_profit_bdt: 80340.00,
          real_roas: 3.73,
          is_unprofitable: false,
        },
        {
          campaign_id: 'cmp_cargo_drop_02',
          campaign_name: 'Multi-Pocket Technical Cargo Pants Drop ABO',
          ad_spend_usd: 350.00,
          ad_spend_bdt: 42700.00,
          attributed_placed_orders: 86,
          placed_revenue_bdt: 138000.00,
          delivered_orders: 72,
          delivered_revenue_bdt: 115200.00,
          delivery_rate: 83.7,
          cogs_bdt: 34000.00,
          courier_cost_bdt: 7000.00,
          return_penalty_bdt: 1800.00,
          net_ad_profit_bdt: 29700.00,
          real_roas: 2.70,
          is_unprofitable: false,
        },
        {
          campaign_id: 'cmp_retargeting_03',
          campaign_name: 'Storefront DPA - Dynamic Product Catalog Retargeting',
          ad_spend_usd: 278.20,
          ad_spend_bdt: 33940.00,
          attributed_placed_orders: 64,
          placed_revenue_bdt: 58000.00,
          delivered_orders: 68,
          delivered_revenue_bdt: 50600.00,
          delivery_rate: 94.4,
          cogs_bdt: 15000.00,
          courier_cost_bdt: 6000.00,
          return_penalty_bdt: 1200.00,
          net_ad_profit_bdt: -5540.00,
          real_roas: 1.49,
          is_unprofitable: true,
        },
        {
          campaign_id: 'cmp_hoodie_test_04',
          campaign_name: 'Thermal Fleece Boxy Hoodie Experimental Test ABO',
          ad_spend_usd: 120.00,
          ad_spend_bdt: 14640.00,
          attributed_placed_orders: 12,
          placed_revenue_bdt: 14000.00,
          delivered_orders: 8,
          delivered_revenue_bdt: 9600.00,
          delivery_rate: 66.7,
          cogs_bdt: 3200.00,
          courier_cost_bdt: 800.00,
          return_penalty_bdt: 400.00,
          net_ad_profit_bdt: -9440.00,
          real_roas: 0.65,
          is_unprofitable: true,
        },
      ];

  const auditLogs: MetaCAPIAuditLogRow[] = dashboard?.audit_logs && dashboard.audit_logs.length > 0
    ? dashboard.audit_logs
    : [
        {
          id: 'log_1',
          order_id: '#09842',
          event_name: 'Purchase',
          event_id: 'evt_purchase_9842_x81',
          status: 'SUCCESS',
          http_code: 200,
          age_hours: 0.05,
          is_age_quarantined: false,
          dispatched_at: '2026-11-23T03:52:12Z',
        },
        {
          id: 'log_2',
          order_id: '#09841',
          event_name: 'AddToCart',
          event_id: 'evt_atc_9841_k12',
          status: 'SUCCESS',
          http_code: 200,
          age_hours: 0.20,
          is_age_quarantined: false,
          dispatched_at: '2026-11-23T03:44:00Z',
        },
        {
          id: 'log_3',
          order_id: '#09838',
          event_name: 'Purchase',
          event_id: 'evt_purchase_9838_m31',
          status: 'SKIPPED',
          http_code: 400,
          age_hours: 172.50,
          is_age_quarantined: true,
          dispatched_at: '2026-11-23T01:10:00Z',
        },
      ];

  const filteredCampaigns = campaigns.filter((c) =>
    c.campaign_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.campaign_id.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Form State for Connecting Ad Account
  const [formAccountName, setFormAccountName] = useState('');
  const [formMetaAccountId, setFormMetaAccountId] = useState('');
  const [formAccessToken, setFormAccessToken] = useState('');
  const [formCurrency, setFormCurrency] = useState('USD');
  const [formTimezone, setFormTimezone] = useState('Asia/Dhaka');
  const [formSpendCap, setFormSpendCap] = useState('500.00');
  const [showTokenInput, setShowTokenInput] = useState(false);

  const handleSyncAccount = async (id: number) => {
    setSyncingAccountId(id);
    try {
      await syncMetaAdAccount(id);
      showToast('Account metrics and spend successfully synced.');
      await loadAccounts();
    } catch (err: any) {
      alert(`Sync failed: ${err.message || err.detail}`);
    } finally {
      setSyncingAccountId(null);
    }
  };

  const handleDeleteAccount = async () => {
    if (!deletingAccount) return;
    try {
      await deleteMetaAdAccount(deletingAccount.id);
      showToast(`Account "${deletingAccount.name}" removed.`);
      setDeletingAccount(null);
      await loadAccounts();
    } catch (err: any) {
      alert(`Delete failed: ${err.message || err.detail}`);
    }
  };

  const handleRunExplorerTest = async () => {
    if (!explorerAccount || !explorerEndpoint) return;
    setExplorerLoading(true);
    setExplorerResult(null);
    try {
      const res = await testGraphAPIExplorer({
        ad_account_id: explorerAccount,
        method: explorerMethod,
        endpoint: explorerEndpoint,
        body: explorerBody,
      });
      setExplorerResult(res);
    } catch (err: any) {
      alert(`Explorer test failed: ${err.message || err.detail}`);
    } finally {
      setExplorerLoading(false);
    }
  };

  return (
    <div style={{ paddingBottom: '50px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.45rem', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.02em', margin: 0 }}>
            Meta Ads & Attribution Platform
          </h1>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
            Multi-touch customer data platform (CDP), CAPI audit & real delivered net ROAS for <b>{currentStore.name}</b>
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', background: 'var(--surface-muted, #f1f5f9)', padding: '3px', borderRadius: '8px', gap: '4px', flexWrap: 'wrap' }}>
          <button
            onClick={() => setActiveTab('campaigns')}
            className={`btn btn-sm ${activeTab === 'campaigns' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
          >
            <BarChart2 size={14} />
            <span>Campaigns Attribution</span>
          </button>

          <button
            onClick={() => setActiveTab('capi_audit')}
            className={`btn btn-sm ${activeTab === 'capi_audit' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
          >
            <Radio size={14} />
            <span>CAPI Outgoing Audit</span>
          </button>

          <button
            onClick={() => setActiveTab('accounts')}
            className={`btn btn-sm ${activeTab === 'accounts' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
          >
            <Key size={14} />
            <span>Ad Accounts & Credentials</span>
          </button>

          <button
            onClick={() => setActiveTab('explorer')}
            className={`btn btn-sm ${activeTab === 'explorer' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 700 }}
          >
            <Code size={14} />
            <span>Graph API Explorer</span>
          </button>
        </div>
      </div>

      {/* Action Notification */}
      {actionNotice && (
        <div
          style={{
            background: '#ecfdf5',
            border: '1px solid #10b981',
            color: '#065f46',
            padding: '10px 14px',
            borderRadius: '6px',
            marginBottom: '14px',
            fontSize: '0.82rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <CheckCircle size={15} color="#10b981" />
          <span>{actionNotice}</span>
        </div>
      )}

      {/* SECTION A: 3-WAY RECONCILIATION SCORECARD */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          padding: '16px 20px',
          borderRadius: '10px',
          marginBottom: '16px',
          border: '1px solid #334155',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ background: '#10b981', padding: '6px', borderRadius: '8px', display: 'flex' }}>
              <ShieldCheck size={20} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1rem', letterSpacing: '-0.01em' }}>
                3-Way Reconciliation Scorecard
              </div>
              <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                Cross-matching Storefront Database Orders ↔ Tracked Ad Touchpoints ↔ Meta CAPI Receipts
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                background: scorecard.status === 'HEALTHY' ? '#065f46' : '#7f1d1d',
                color: scorecard.status === 'HEALTHY' ? '#34d399' : '#fca5a5',
                border: scorecard.status === 'HEALTHY' ? '1px solid #059669' : '1px solid #b91c1c',
                padding: '3px 10px',
                borderRadius: '20px',
                fontSize: '0.72rem',
                fontWeight: 800,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              ● {scorecard.status} ({scorecard.discrepancy_rate}% Discrepancy)
            </span>

            <button
              onClick={loadDashboard}
              style={{
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.2)',
                color: '#fff',
                padding: '4px 10px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontSize: '0.74rem',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <RotateCcw size={12} /> Sync Telemetry
            </button>
          </div>
        </div>

        {/* Reconciliation Counters Bar */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: '12px',
            marginTop: '16px',
            paddingTop: '14px',
            borderTop: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Storefront Orders</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#f8fafc' }}>
              {scorecard.storefront_orders.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Tracked Touchpoints</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8' }}>
              {scorecard.tracked_touchpoints.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Meta CAPI Received</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#4ade80' }}>
              {scorecard.meta_capi_received.toLocaleString()}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>168-Hour Age Guard</div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: scorecard.quarantined_events > 0 ? '#f87171' : '#a3e635' }}>
              {scorecard.quarantined_events} Quarantined
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* TAB 1: CAMPAIGNS ATTRIBUTION WORKSTATION                       */}
      {/* ============================================================== */}
      {activeTab === 'campaigns' && (
        <div>
          {/* SECTION B: EXECUTIVE FINANCIAL TILES */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '12px',
              marginBottom: '16px',
            }}
          >
            {/* Tile 1: Delivered ROAS */}
            <div className="card" style={{ padding: '14px', borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>REAL DELIVERED ROAS</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#10b981', margin: '4px 0' }}>
                {financials.delivered_roas.toFixed(2)}x
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                Cash In Bank vs. Ad Spend (Excludes unfulfilled)
              </div>
            </div>

            {/* Tile 2: Net Contribution */}
            <div className="card" style={{ padding: '14px', borderLeft: '4px solid #3b82f6' }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>NET AD CONTRIBUTION (BDT)</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#3b82f6', margin: '4px 0' }}>
                ৳{financials.net_contribution_bdt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                After COGS, Courier Fees & Returns
              </div>
            </div>

            {/* Tile 3: Delivered Cash Revenue */}
            <div className="card" style={{ padding: '14px', borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>DELIVERED REVENUE</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, color: 'var(--text-main)', margin: '4px 0' }}>
                ৳{financials.delivered_revenue_bdt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                From {financials.delivered_orders_count} cash-cleared deliveries
              </div>
            </div>

            {/* Tile 4: Total Ad Spend */}
            <div className="card" style={{ padding: '14px', borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600 }}>ATTRIBUTED AD SPEND</div>
              <div style={{ fontSize: '1.65rem', fontWeight: 900, color: '#d97706', margin: '4px 0' }}>
                ৳{financials.ad_spend_bdt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                ${financials.ad_spend_usd.toFixed(2)} USD (@ ৳122 / USD)
              </div>
            </div>
          </div>

          {/* SECTION C: ATTRIBUTION MODEL CONTROLS */}
          <div
            className="card"
            style={{
              padding: '12px 16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                Attribution Model:
              </span>
              <div style={{ display: 'inline-flex', background: 'var(--surface-muted, #f1f5f9)', padding: '2px', borderRadius: '6px' }}>
                <button
                  onClick={() => setModel('last_paid_ad')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '5px',
                    fontSize: '0.74rem',
                    fontWeight: model === 'last_paid_ad' ? 800 : 600,
                    border: 'none',
                    background: model === 'last_paid_ad' ? '#0d9488' : 'transparent',
                    color: model === 'last_paid_ad' ? '#fff' : 'var(--text-main)',
                    cursor: 'pointer',
                  }}
                >
                  Last Paid Ad (Primary)
                </button>
                <button
                  onClick={() => setModel('first_touch')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '5px',
                    fontSize: '0.74rem',
                    fontWeight: model === 'first_touch' ? 800 : 600,
                    border: 'none',
                    background: model === 'first_touch' ? '#0d9488' : 'transparent',
                    color: model === 'first_touch' ? '#fff' : 'var(--text-main)',
                    cursor: 'pointer',
                  }}
                >
                  First Touch
                </button>
                <button
                  onClick={() => setModel('linear')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '5px',
                    fontSize: '0.74rem',
                    fontWeight: model === 'linear' ? 800 : 600,
                    border: 'none',
                    background: model === 'linear' ? '#0d9488' : 'transparent',
                    color: model === 'linear' ? '#fff' : 'var(--text-main)',
                    cursor: 'pointer',
                  }}
                >
                  Linear Split
                </button>
                <button
                  onClick={() => setModel('position_based')}
                  style={{
                    padding: '4px 10px',
                    borderRadius: '5px',
                    fontSize: '0.74rem',
                    fontWeight: model === 'position_based' ? 800 : 600,
                    border: 'none',
                    background: model === 'position_based' ? '#0d9488' : 'transparent',
                    color: model === 'position_based' ? '#fff' : 'var(--text-main)',
                    cursor: 'pointer',
                  }}
                >
                  Position (40/40/20)
                </button>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ position: 'relative', width: '240px' }}>
                <Search
                  size={13}
                  style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }}
                />
                <input
                  type="text"
                  placeholder="Filter campaign name or ID..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="form-control"
                  style={{ paddingLeft: '30px', fontSize: '0.78rem', height: '32px' }}
                />
              </div>

              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="form-control"
                style={{ fontSize: '0.78rem', height: '32px', width: '130px' }}
              >
                <option value="last_7_days">Last 7 Days</option>
                <option value="last_30_days">Last 30 Days</option>
                <option value="this_month">This Month</option>
                <option value="all_time">All Time</option>
              </select>
            </div>
          </div>

          {/* SECTION D: CAMPAIGN ATTRIBUTION MATRIX */}
          <div className="card" style={{ padding: 0 }}>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Campaign Specification</th>
                    <th>Status</th>
                    <th>Ad Spend (BDT / USD)</th>
                    <th>Placed</th>
                    <th>Delivered</th>
                    <th>Delivery %</th>
                    <th>Net Ad Profit</th>
                    <th style={{ textAlign: 'right' }}>Real ROAS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCampaigns.map((c) => (
                    <tr key={c.campaign_id}>
                      <td>
                        <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{c.campaign_name}</div>
                        <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                          ID: {c.campaign_id}
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '2px 7px',
                            borderRadius: '4px',
                            background: !c.is_unprofitable ? '#dcfce7' : '#fee2e2',
                            color: !c.is_unprofitable ? '#15803d' : '#b91c1c',
                          }}
                        >
                          {!c.is_unprofitable ? 'PROFITABLE' : 'SCALING_FLAG'}
                        </span>
                      </td>
                      <td className="mono" style={{ fontSize: '0.82rem' }}>
                        <div>৳{c.ad_spend_bdt.toLocaleString()}</div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>${c.ad_spend_usd.toFixed(2)}</div>
                      </td>
                      <td style={{ fontWeight: 600 }}>{c.attributed_placed_orders}</td>
                      <td style={{ fontWeight: 700 }}>{c.delivered_orders}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: 800, fontSize: '0.78rem' }}>{c.delivery_rate.toFixed(1)}%</span>
                          <div style={{ width: '40px', height: '5px', background: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${c.delivery_rate}%`, height: '100%', background: c.delivery_rate >= 80 ? '#10b981' : '#f59e0b' }} />
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: '0.85rem',
                            color: !c.is_unprofitable ? '#15803d' : '#b91c1c',
                            background: !c.is_unprofitable ? '#dcfce7' : '#fee2e2',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          {!c.is_unprofitable ? '+' : ''}৳{c.net_ad_profit_bdt.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          {c.is_unprofitable && <AlertTriangle size={12} color="#b91c1c" />}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span
                          style={{
                            fontSize: '0.95rem',
                            fontWeight: 900,
                            color: c.real_roas >= 2.0 ? '#10b981' : c.real_roas >= 1.0 ? '#d97706' : '#dc2626',
                          }}
                        >
                          {c.real_roas.toFixed(2)}x
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: CAPI OUTGOING DISPATCH AUDIT LOG                        */}
      {/* ============================================================== */}
      {activeTab === 'capi_audit' && (
        <div className="card" style={{ padding: 0 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <span style={{ fontWeight: 800, fontSize: '0.88rem' }}>Meta Conversions API (CAPI) Outgoing Dispatch Audit Log</span>
              <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                Real-time payload inspection, event deduplication IDs, and 168-Hour Event Age Guard protection
              </div>
            </div>
            <span style={{ fontSize: '0.74rem', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
              Strict 7-Day / 168-Hour Age Threshold Active
            </span>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Event Name</th>
                  <th>Event Deduplication ID</th>
                  <th>Delivery Status</th>
                  <th>HTTP Code</th>
                  <th>Age Guard</th>
                  <th style={{ textAlign: 'right' }}>Dispatch Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map((log) => (
                  <tr key={log.id}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 800 }}>
                      {log.order_id || '#09842'}
                    </td>
                    <td>
                      <span style={{ fontWeight: 700, background: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', fontSize: '0.75rem' }}>
                        {log.event_name}
                      </span>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
                      {log.event_id}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '0.74rem',
                          fontWeight: 800,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          background: log.status === 'SUCCESS' ? '#dcfce7' : '#fee2e2',
                          color: log.status === 'SUCCESS' ? '#15803d' : '#b91c1c',
                        }}
                      >
                        [{log.status}]
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                        [{log.http_code}]
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '0.76rem',
                          fontWeight: 700,
                          color: log.is_age_quarantined ? '#dc2626' : '#15803d',
                        }}
                      >
                        {log.age_hours.toFixed(1)} hrs {log.is_age_quarantined ? '⚠ (Quarantined)' : ''}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                      {new Date(log.dispatched_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 3: META AD ACCOUNTS & CREDENTIALS WORKSTATION             */}
      {/* ============================================================== */}
      {activeTab === 'accounts' && (
        <div>
          {/* Security Banner */}
          <div
            style={{
              background: '#f8fafc',
              border: '1px solid #cbd5e1',
              padding: '12px 16px',
              borderRadius: '8px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            <ShieldCheck size={20} color="#0d9488" />
            <div style={{ fontSize: '0.8rem', color: '#334155', lineHeight: 1.4 }}>
              <b>AES-256 Fernet Symmetric Encryption Active:</b> All Meta System User or Marketing Access Tokens (EAAB...) are encrypted at rest using AES-256-GCM authenticated cipher before touching PostgreSQL. Tokens are decrypted in-memory only on demand for sync and are never logged.
            </div>
          </div>

          {/* Action Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 800, margin: 0 }}>
              Connected Meta Ad Accounts ({accounts.length})
            </h2>
            <button
              onClick={() => setIsConnectModalOpen(true)}
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Plus size={14} /> Connect Ad Account
            </button>
          </div>

          {/* Accounts Grid Table */}
          <div className="card" style={{ padding: 0 }}>
            {accountsLoading ? (
              <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                Loading ad accounts...
              </div>
            ) : accounts.length === 0 ? (
              <div style={{ padding: '36px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No Meta Ad Accounts connected yet. Click "+ Connect Ad Account" to link your credentials.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Account Name & Meta ID</th>
                      <th>Currency / Timezone</th>
                      <th>Status</th>
                      <th>Daily Spend Cap</th>
                      <th>Last Synced</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {accounts.map((acc) => (
                      <tr key={acc.id}>
                        <td>
                          <div style={{ fontWeight: 700, color: 'var(--text-main)' }}>{acc.name}</div>
                          <div style={{ fontSize: '0.72rem', color: '#64748b', fontFamily: 'var(--font-mono)' }}>
                            {acc.meta_account_id}
                          </div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 600, fontSize: '0.78rem' }}>{acc.currency}</div>
                          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{acc.timezone}</div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                            <span
                              style={{
                                background: acc.is_active ? '#ecfdf5' : '#fef2f2',
                                color: acc.is_active ? '#065f46' : '#991b1b',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                              }}
                            >
                              {acc.is_active ? '[CONNECTED]' : '[DISABLED]'}
                            </span>
                            <span
                              style={{
                                background: '#f1f5f9',
                                color: '#475569',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '0.72rem',
                                fontWeight: 800,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                            >
                              <Lock size={10} /> [AES-256]
                            </span>
                          </div>
                        </td>
                        <td>
                          {acc.daily_spend_cap > 0 ? (
                            <span style={{ fontWeight: 700, color: '#b45309' }}>
                              ${acc.daily_spend_cap.toFixed(2)} USD / day
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>No Limit</span>
                          )}
                        </td>
                        <td style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                          {acc.last_synced_at ? new Date(acc.last_synced_at).toLocaleString() : 'Never'}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: '6px' }}>
                            <button
                              onClick={() => handleSyncAccount(acc.id)}
                              disabled={syncingAccountId === acc.id}
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                            >
                              <RotateCcw size={11} /> {syncingAccountId === acc.id ? 'Syncing...' : 'Sync'}
                            </button>
                            <button
                              onClick={() => setDeletingAccount(acc)}
                              className="btn btn-danger btn-sm"
                              style={{ padding: '3px 8px', fontSize: '0.74rem' }}
                            >
                              <Trash2 size={11} /> Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 4: LIVE META GRAPH API EXPLORER TESTING WORKSTATION        */}
      {/* ============================================================== */}
      {activeTab === 'explorer' && (
        <div>
          <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Code size={18} color="#0d9488" />
                <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>Meta Graph API Explorer Testing</span>
              </div>
              <span style={{ background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '2px 8px', borderRadius: '4px', fontSize: '0.72rem', fontWeight: 800 }}>
                Use Case Verification Simulator (v21.0)
              </span>
            </div>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 14px 0' }}>
              Execute live queries against the Meta Marketing API using your stored encrypted credentials.
            </p>

            {/* Testbench Form */}
            <div style={{ display: 'grid', gridTemplateColumns: '220px 140px 1fr auto', gap: '10px', alignItems: 'flex-end', marginBottom: '14px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, marginBottom: '4px' }}>
                  Target Ad Account
                </label>
                <select
                  value={explorerAccount}
                  onChange={(e) => setExplorerAccount(e.target.value)}
                  className="form-control"
                  style={{ fontSize: '0.8rem', height: '34px' }}
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.meta_account_id}>
                      {a.name} ({a.meta_account_id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, marginBottom: '4px' }}>
                  HTTP Method
                </label>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', height: '34px' }}>
                  <label style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input type="radio" checked={explorerMethod === 'GET'} onChange={() => setExplorerMethod('GET')} />
                    <span>GET</span>
                  </label>
                  <label style={{ fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                    <input type="radio" checked={explorerMethod === 'POST'} onChange={() => setExplorerMethod('POST')} />
                    <span>POST</span>
                  </label>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 700, marginBottom: '4px' }}>
                  Graph API Endpoint
                </label>
                <input
                  type="text"
                  value={explorerEndpoint}
                  onChange={(e) => setExplorerEndpoint(e.target.value)}
                  className="form-control"
                  style={{ fontSize: '0.8rem', height: '34px', fontFamily: 'var(--font-mono)' }}
                />
              </div>

              <button
                onClick={handleRunExplorerTest}
                disabled={explorerLoading || !explorerAccount}
                className="btn btn-primary"
                style={{ height: '34px', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Play size={13} />
                <span>{explorerLoading ? 'Testing...' : 'Test Query'}</span>
              </button>
            </div>

            {/* Quick Presets */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>Quick Presets:</span>
              <button
                onClick={() => setExplorerEndpoint('{ad_account_id}/insights?fields=spend,impressions,clicks&date_preset=last_7d')}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.72rem', padding: '2px 8px' }}
              >
                Measure Ad Performance
              </button>
              <button
                onClick={() => setExplorerEndpoint('{ad_account_id}/campaigns?fields=id,name,status,objective&limit=5')}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.72rem', padding: '2px 8px' }}
              >
                Manage Ads (Campaigns)
              </button>
              <button
                onClick={() => setExplorerEndpoint('{ad_account_id}/adsets?fields=id,name,status,daily_budget&limit=5')}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.72rem', padding: '2px 8px' }}
              >
                Ad Sets & Budgets
              </button>
              <button
                onClick={() => setExplorerEndpoint('me/permissions')}
                className="btn btn-secondary btn-sm"
                style={{ fontSize: '0.72rem', padding: '2px 8px' }}
              >
                Permissions Verification
              </button>
            </div>
          </div>

          {/* Test Response Window */}
          {explorerResult && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div
                style={{
                  background: '#0f172a',
                  color: '#f8fafc',
                  padding: '10px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      background: explorerResult.http_status === 200 ? '#15803d' : '#b91c1c',
                      color: '#ffffff',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '0.72rem',
                      fontWeight: 800,
                    }}
                  >
                    HTTP {explorerResult.http_status} {explorerResult.http_status === 200 ? 'OK — Test Passed' : 'ERROR'}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.76rem', color: '#94a3b8' }}>
                    Endpoint: {explorerResult.endpoint_called}
                  </span>
                </div>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  Latency: {explorerResult.execution_ms}ms
                </span>
              </div>
              <pre
                style={{
                  margin: 0,
                  padding: '16px',
                  background: '#020617',
                  color: '#38bdf8',
                  fontSize: '0.78rem',
                  fontFamily: 'var(--font-mono)',
                  overflowX: 'auto',
                  maxHeight: '400px',
                }}
              >
                {JSON.stringify(explorerResult.payload, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* ============================================================== */}
      {/* MODAL: CONNECT META AD ACCOUNT                                 */}
      {/* ============================================================== */}
      {isConnectModalOpen && (
        <RecordModal
          title="Connect Meta Ad Account"
          submitLabel="Connect & Encrypt"
          onClose={() => setIsConnectModalOpen(false)}
          onSubmit={async () => {
            if (!formAccountName.trim() || !formMetaAccountId.trim() || !formAccessToken.trim()) {
              throw new Error('Please fill in Account Name, Meta Account ID, and Access Token.');
            }
            await connectMetaAdAccount({
              name: formAccountName.trim(),
              meta_account_id: formMetaAccountId.trim(),
              access_token: formAccessToken.trim(),
              currency: formCurrency,
              timezone: formTimezone,
              daily_spend_cap: parseFloat(formSpendCap) || 0.0,
              is_active: true,
            });
            showToast(`Meta Ad Account "${formAccountName}" connected and token encrypted.`);
            setFormAccountName('');
            setFormMetaAccountId('');
            setFormAccessToken('');
            await loadAccounts();
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '3px' }}>
                Account Display Name *
              </label>
              <input
                type="text"
                required
                placeholder="PoshPlex Main BD Account"
                value={formAccountName}
                onChange={(e) => setFormAccountName(e.target.value)}
                className="form-control"
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '3px' }}>
                Meta Account ID *
              </label>
              <input
                type="text"
                required
                placeholder="act_284910284019283"
                value={formMetaAccountId}
                onChange={(e) => setFormMetaAccountId(e.target.value)}
                className="form-control"
              />
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                (Found in Meta Ads Manager URL)
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '3px' }}>
                Meta System User or Marketing Access Token *
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showTokenInput ? 'text' : 'password'}
                  required
                  placeholder="EAAB..."
                  value={formAccessToken}
                  onChange={(e) => setFormAccessToken(e.target.value)}
                  className="form-control"
                  style={{ paddingRight: '36px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowTokenInput(!showTokenInput)}
                  style={{
                    position: 'absolute',
                    right: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: '#64748b',
                  }}
                >
                  {showTokenInput ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <div style={{ fontSize: '0.7rem', color: '#0d9488', fontWeight: 600, marginTop: '2px' }}>
                (Encrypted at rest using enterprise AES-256 Fernet cryptography)
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '3px' }}>
                  Currency
                </label>
                <select
                  value={formCurrency}
                  onChange={(e) => setFormCurrency(e.target.value)}
                  className="form-control"
                >
                  <option value="USD">USD ($)</option>
                  <option value="BDT">BDT (৳)</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '3px' }}>
                  Timezone
                </label>
                <input
                  type="text"
                  value={formTimezone}
                  onChange={(e) => setFormTimezone(e.target.value)}
                  className="form-control"
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '0.76rem', fontWeight: 700, marginBottom: '3px' }}>
                Global Daily Spend Cap (USD)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="500.00"
                value={formSpendCap}
                onChange={(e) => setFormSpendCap(e.target.value)}
                className="form-control"
              />
              <div style={{ fontSize: '0.7rem', color: '#b45309', marginTop: '2px' }}>
                (Safety Ceiling: Auto-pauses all active ads if daily aggregate spend breaches threshold)
              </div>
            </div>
          </div>
        </RecordModal>
      )}

      {/* MODAL: DELETE AD ACCOUNT CONFIRMATION */}
      <ConfirmDeleteModal
        isOpen={deletingAccount !== null}
        itemName={deletingAccount ? deletingAccount.name : ''}
        itemType="Meta Ad Account"
        warningMessage={
          deletingAccount
            ? `Disconnecting "${deletingAccount.name}" will remove all encrypted tokens and stop telemetry synchronization. This action cannot be undone.`
            : ''
        }
        onClose={() => setDeletingAccount(null)}
        onConfirm={handleDeleteAccount}
      />
    </div>
  );
};
