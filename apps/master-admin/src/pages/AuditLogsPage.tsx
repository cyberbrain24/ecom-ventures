import React, { useEffect, useState } from 'react';
import { ShieldAlert, Search, Filter, Eye, RefreshCw, X, Code, Activity, Database, Globe, ShieldCheck, UserCheck } from 'lucide-react';
import { MetricCard } from '../components/ui/MetricCard';
import { AuditLogItem } from '../types/system';
import { api, apiErrorMessage } from '../lib/api';

export const AuditLogsPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [inspectedLog, setInspectedLog] = useState<AuditLogItem | null>(null);

  const fetchLogs = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const param = actionFilter !== 'ALL' ? `?action=${actionFilter}` : '';
      const res = await api.get<{ data: AuditLogItem[] }>(`/platform/audit-logs${param}`);
      setLogs(res.data.data || []);
    } catch (err) {
      setLogs([]);
      setErrorMessage(apiErrorMessage(err, 'Could not load audit logs.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter]);

  const filteredLogs = logs.filter((l) => {
    const matchesSearch =
      l.user_email.toLowerCase().includes(search.toLowerCase()) ||
      l.action.toLowerCase().includes(search.toLowerCase()) ||
      l.resource_id.toLowerCase().includes(search.toLowerCase()) ||
      l.client_ip.toLowerCase().includes(search.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="space-y-3.5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Platform Audit Trail & Forensic Ledger</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable log of all administrative actions, tenant database mutations, and security events.
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="inline-flex items-center px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-md shadow-sm transition space-x-1.5"
        >
          <RefreshCw className="h-3.5 w-3.5 text-slate-500" />
          <span>Refresh Ledger</span>
        </button>
      </div>

      {errorMessage && (
        <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 whitespace-pre-line">
          {errorMessage}
        </div>
      )}

      {/* Counts below cover only the events returned by the server for the current filter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <MetricCard
          title="Events Loaded"
          value={isLoading ? 'Loading' : logs.length}
          subtitle="Returned by the server"
          icon={Activity}
        />
        <MetricCard
          title="Store Events"
          value={isLoading ? 'Loading' : logs.filter((l) => l.action.includes('STORE')).length}
          subtitle="Action names with STORE"
          icon={Database}
        />
        <MetricCard
          title="Security Events"
          value={isLoading ? 'Loading' : logs.filter((l) => l.action.includes('SECURITY')).length}
          subtitle="Action names with SECURITY"
          icon={ShieldAlert}
        />
        <MetricCard
          title="Source IPs"
          value={isLoading ? 'Loading' : new Set(logs.map((l) => l.client_ip)).size}
          subtitle="Distinct client IPs"
          icon={Globe}
        />
        <MetricCard
          title="Domain Events"
          value={isLoading ? 'Loading' : logs.filter((l) => l.action.includes('DOMAIN')).length}
          subtitle="Action names with DOMAIN"
          icon={ShieldCheck}
        />
        <MetricCard
          title="Staff Events"
          value={isLoading ? 'Loading' : logs.filter((l) => l.action.includes('STAFF') || l.action.includes('USER')).length}
          subtitle="Action names with STAFF or USER"
          icon={UserCheck}
        />
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="p-2.5 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2.5 bg-slate-50/50">
          <div className="relative w-full sm:w-72">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Search by operator, action, resource..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-md text-slate-700 focus:outline-none focus:ring-1 focus:ring-teal-500"
            >
              <option value="ALL">All Actions</option>
              <option value="STORE_PROVISIONED">STORE_PROVISIONED</option>
              <option value="STORE_STATUS_UPDATED">STORE_STATUS_UPDATED</option>
              <option value="DOMAIN_ATTACHED">DOMAIN_ATTACHED</option>
              <option value="THEME_ASSIGNED">THEME_ASSIGNED</option>
              <option value="STAFF_CREATED">STAFF_CREATED</option>
              <option value="SECURITY_AUDIT_RUN">SECURITY_AUDIT_RUN</option>
            </select>
          </div>
        </div>

        {/* Records */}
        {isLoading ? (
          <div className="p-8 text-center text-slate-500 text-xs">Loading audit records...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">
            {errorMessage ? 'Audit events could not be loaded.' : 'No matching audit events found.'}
          </div>
        ) : (
          <div className="overflow-x-auto -mx-3.5 sm:mx-0">
            <table className="w-full text-left text-xs min-w-[640px]">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 uppercase text-[10px] font-semibold tracking-wider">
                <tr>
                  <th className="px-3.5 py-2">Timestamp (UTC)</th>
                  <th className="px-3.5 py-2">Operator</th>
                  <th className="px-3.5 py-2">Administrative Action</th>
                  <th className="px-3.5 py-2">Target Resource</th>
                  <th className="px-3.5 py-2">Source IP</th>
                  <th className="px-3.5 py-2 text-right">Payload</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition">
                    <td className="px-3.5 py-1.5 text-slate-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="px-3.5 py-1.5 font-sans">
                      <span className="font-semibold text-slate-800 text-xs">{log.user_email}</span>
                    </td>
                    <td className="px-3.5 py-1.5 font-sans">
                      <span
                        className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                          log.action.includes('STORE')
                            ? 'bg-teal-50 text-teal-700 border border-teal-200'
                            : log.action.includes('SECURITY')
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : log.action.includes('DOMAIN')
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : 'bg-slate-100 text-slate-700 border border-slate-200'
                        }`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td className="px-3.5 py-1.5 text-slate-600">
                      <span className="text-slate-400">{log.resource_type}/</span>
                      <span className="font-bold text-slate-800">{log.resource_id}</span>
                    </td>
                    <td className="px-3.5 py-1.5 text-slate-500">{log.client_ip}</td>
                    <td className="px-3.5 py-1.5 text-right font-sans">
                      <button
                        onClick={() => setInspectedLog(log)}
                        className="inline-flex items-center px-2 py-0.5 text-[10.5px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded transition border border-teal-200 space-x-1"
                      >
                        <Eye className="h-3 w-3" />
                        <span>Inspect</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payload Diff Inspector Modal */}
      {inspectedLog && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-2xl w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-900 text-white">
              <div className="flex items-center space-x-2">
                <Code className="h-4 w-4 text-teal-400" />
                <h3 className="font-bold text-sm tracking-wide">
                  Audit Event Payload: <span className="text-teal-300 font-mono">{inspectedLog.action}</span>
                </h3>
              </div>
              <button
                onClick={() => setInspectedLog(null)}
                className="text-slate-400 hover:text-white rounded-lg p-1"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div>
                  <span className="text-slate-500 font-semibold">Operator:</span>{' '}
                  <span className="font-mono text-slate-900">{inspectedLog.user_email}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Timestamp:</span>{' '}
                  <span className="font-mono text-slate-900">{new Date(inspectedLog.created_at).toISOString()}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Client IP:</span>{' '}
                  <span className="font-mono text-slate-900">{inspectedLog.client_ip}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-semibold">Resource:</span>{' '}
                  <span className="font-mono text-slate-900">{inspectedLog.resource_type}/{inspectedLog.resource_id}</span>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                  Mutation State (After Change)
                </h4>
                {inspectedLog.payload_after || inspectedLog.payload_before ? (
                  <pre className="bg-slate-950 text-emerald-400 p-4 rounded-lg text-xs font-mono overflow-x-auto leading-relaxed border border-slate-800">
                    {JSON.stringify(inspectedLog.payload_after || inspectedLog.payload_before, null, 2)}
                  </pre>
                ) : (
                  <p className="text-xs text-slate-500">No payload recorded for this event.</p>
                )}
              </div>

              {inspectedLog.user_agent && (
                <div className="text-[11px] text-slate-500 font-mono">
                  <span className="font-semibold">User Agent:</span> {inspectedLog.user_agent}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex justify-end">
              <button
                onClick={() => setInspectedLog(null)}
                className="px-4 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-semibold hover:bg-slate-800 transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
