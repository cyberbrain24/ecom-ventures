export interface AdminStaffUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'SUPER_ADMIN' | 'PLATFORM_STAFF';
  status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  last_login_at?: string;
  created_at: string;
}

export interface AuditLogItem {
  id: string;
  user_id?: string;
  user_email: string;
  action: string;
  resource_type: string;
  resource_id: string;
  store_id?: string;
  payload_before?: any;
  payload_after?: any;
  client_ip: string;
  user_agent?: string;
  created_at: string;
}

export interface TenantPoolMetric {
  slug: string;
  db_name: string;
  status: string;
  active_conns: number;
  idle_conns: number;
}

export interface StreamQueueMetric {
  stream_key: string;
  consumer_group: string;
  pending_entries: number;
  status: string;
}

export interface ClusterOverviewResponse {
  platform_db: {
    host: string;
    port: number;
    database: string;
    status: string;
    max_open: number;
    open_conns: number;
    in_use: number;
    idle: number;
  };
  tenant_pools: TenantPoolMetric[];
  redis: {
    host: string;
    port: number;
    status: string;
    streams: StreamQueueMetric[];
  };
  maintenance_mode: boolean;
  timestamp: string;
}

export interface SecurityCheckFinding {
  name: string;
  description: string;
  status: 'PASS' | 'WARN' | 'FAIL';
  details: string;
  timestamp: string;
}

export interface SecurityAuditReportResponse {
  timestamp: string;
  checks_run: number;
  passed_checks: number;
  warning_checks: number;
  failed_checks: number;
  overall_verdict: 'PASS' | 'WARN' | 'FAIL';
  findings: SecurityCheckFinding[];
}
