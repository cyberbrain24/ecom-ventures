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

export interface PlatformPolicies {
  id: string;
  maintenance_mode: boolean;
  allow_new_store_provisioning: boolean;
  enforce_custom_domain_ssl: boolean;
  default_store_currency: string;
  default_store_timezone: string;
  max_stores_per_account: number;
  session_ttl_minutes: number;
  audit_log_retention_days: number;
  api_rate_limit_per_min: number;
  support_contact_email: string;
  updated_by: string;
  updated_at: string;
}

export type UpdatePlatformPoliciesPayload = Omit<PlatformPolicies, 'id' | 'updated_by' | 'updated_at'>;

export interface WorkerConsumerInfo {
  name: string;
  pending: number;
  idle_ms: number;
}

export interface SchedulerJobStatus {
  job_type: string;
  label: string;
  interval: string;
  lock_key: string;
  locked: boolean;
  lock_ttl_seconds: number;
}

export interface WorkerJobSummary {
  stream_id: string;
  id: string;
  type: string;
  store_slug: string;
  attempt: number;
  max_retries: number;
  enqueued_at: string;
  last_error?: string;
}

export interface WorkerTelemetryResponse {
  redis_connected: boolean;
  worker_status: 'ACTIVE' | 'NO_ACTIVE_CONSUMERS' | 'DISCONNECTED' | string;
  stream_name: string;
  dlq_stream_name: string;
  consumer_group: string;
  stream_length: number;
  dlq_length: number;
  pending_count: number;
  active_consumers: WorkerConsumerInfo[];
  schedulers: SchedulerJobStatus[];
  recent_jobs: WorkerJobSummary[];
  recent_dlq: WorkerJobSummary[];
  timestamp: string;
}
