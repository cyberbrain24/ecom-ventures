import React, { useCallback, useEffect, useState } from 'react';
import { Activity, AlertCircle, CheckCircle2, Clock, Play, RefreshCw, Server } from 'lucide-react';
import { WorkerTelemetryResponse } from '../../types/system';
import { api, apiErrorMessage } from '../../lib/api';

/**
 * WorkerTelemetryPanel displays live Redis Stream depths, active consumer groups,
 * distributed cron locks, and recent queued/DLQ job envelopes.
 */
export const WorkerTelemetryPanel: React.FC = () => {
  const [telemetry, setTelemetry] = useState<WorkerTelemetryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [triggeringJob, setTriggeringJob] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadTelemetry = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<{ data: WorkerTelemetryResponse }>('/platform/system/workers');
      setTelemetry(res.data.data);
    } catch (loadError) {
      setError(apiErrorMessage(loadError, 'Could not load worker telemetry.'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTelemetry();
  }, [loadTelemetry]);

  const handleTrigger = async (jobType: string) => {
    setTriggeringJob(jobType);
    setError(null);
    setNotice(null);
    try {
      const res = await api.post<{ data: { stream_id: string; job_type: string } }>('/platform/system/workers/trigger', {
        job_type: jobType,
        store_slug: 'platform',
      });
      setNotice(`Enqueued ${res.data.data.job_type} (stream ID ${res.data.data.stream_id}).`);
      await loadTelemetry();
    } catch (triggerError) {
      setError(apiErrorMessage(triggerError, `Failed to enqueue ${jobType}.`));
    } finally {
      setTriggeringJob(null);
    }
  };

  const statusBadge = (status: string) => {
    if (status === 'ACTIVE') {
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    }
    if (status === 'NO_ACTIVE_CONSUMERS') {
      return 'bg-amber-100 text-amber-800 border-amber-200';
    }
    return 'bg-rose-100 text-rose-800 border-rose-200';
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-600">
          Live Redis Stream telemetry from <span className="font-mono font-semibold">stream:ecom:jobs</span> and distributed cron locks.
        </p>
        <button
          type="button"
          onClick={() => void loadTelemetry()}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 whitespace-pre-line">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div role="status" className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {isLoading && !telemetry && <p className="text-xs text-slate-500">Loading live worker telemetry...</p>}

      {telemetry && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Consumer Pool</span>
                <Activity className="h-4 w-4 text-teal-600" />
              </div>
              <div className="mt-2">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-bold ${statusBadge(telemetry.worker_status)}`}>
                  {telemetry.worker_status}
                </span>
              </div>
              <p className="mt-1.5 text-[11px] text-slate-500">
                {telemetry.active_consumers.length} active consumer(s) in <span className="font-mono">{telemetry.consumer_group}</span>
              </p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Main Stream Depth</span>
                <Server className="h-4 w-4 text-slate-500" />
              </div>
              <div className="mt-2 text-xl font-bold text-slate-900 font-mono">{telemetry.stream_length}</div>
              <p className="mt-1 text-[11px] text-slate-500 font-mono truncate">{telemetry.stream_name}</p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Unacked Pending</span>
                <Clock className="h-4 w-4 text-amber-600" />
              </div>
              <div className="mt-2 text-xl font-bold text-slate-900 font-mono">{telemetry.pending_count}</div>
              <p className="mt-1 text-[11px] text-slate-500">In-flight or unacknowledged entries</p>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Dead-Letter Queue</span>
                <AlertCircle className="h-4 w-4 text-rose-600" />
              </div>
              <div className="mt-2 text-xl font-bold text-slate-900 font-mono">{telemetry.dlq_length}</div>
              <p className="mt-1 text-[11px] text-slate-500 font-mono truncate">{telemetry.dlq_stream_name}</p>
            </div>
          </div>

          {/* Distributed Cron Schedulers */}
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-900">Distributed Cron Schedulers</h3>
              <span className="text-[11px] text-slate-500">Redis SETNX lock telemetry</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-2">Task</th>
                    <th className="px-4 py-2">Interval</th>
                    <th className="px-4 py-2">Redis Lock Key</th>
                    <th className="px-4 py-2">Lock Status</th>
                    <th className="px-4 py-2 text-right">Manual Dispatch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {telemetry.schedulers.map((sched) => (
                    <tr key={sched.job_type}>
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-slate-900">{sched.label}</div>
                        <div className="font-mono text-[11px] text-slate-500">{sched.job_type}</div>
                      </td>
                      <td className="px-4 py-2.5 text-slate-600">{sched.interval}</td>
                      <td className="px-4 py-2.5 font-mono text-[11px] text-slate-600">{sched.lock_key}</td>
                      <td className="px-4 py-2.5">
                        {sched.locked ? (
                          <span className="inline-flex items-center rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-semibold text-teal-700">
                            LOCKED ({sched.lock_ttl_seconds}s)
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                            READY
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => void handleTrigger(sched.job_type)}
                          disabled={triggeringJob === sched.job_type || !telemetry.redis_connected}
                          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Play className="h-3 w-3 text-teal-600" />
                          {triggeringJob === sched.job_type ? 'Enqueuing...' : 'Run Now'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Active Consumers */}
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-900">Active Stream Consumers</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-2">Consumer Name</th>
                    <th className="px-4 py-2">Pending</th>
                    <th className="px-4 py-2">Idle (ms)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {telemetry.active_consumers.map((c) => (
                    <tr key={c.name}>
                      <td className="px-4 py-2 font-mono">{c.name}</td>
                      <td className="px-4 py-2 font-mono">{c.pending}</td>
                      <td className="px-4 py-2 font-mono">{c.idle_ms}</td>
                    </tr>
                  ))}
                  {telemetry.active_consumers.length === 0 && (
                    <tr>
                      <td className="px-4 py-4 text-center text-slate-500" colSpan={3}>
                        No worker daemon consumers are currently connected to {telemetry.consumer_group}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Stream Jobs */}
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100">
              <h3 className="text-xs font-bold text-slate-900">Recent Stream Entries (Latest 10)</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-2">Stream ID</th>
                    <th className="px-4 py-2">Job Type</th>
                    <th className="px-4 py-2">Store</th>
                    <th className="px-4 py-2">Attempts</th>
                    <th className="px-4 py-2">Enqueued At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {telemetry.recent_jobs.map((job) => (
                    <tr key={job.stream_id}>
                      <td className="px-4 py-2 font-mono text-[11px]">{job.stream_id}</td>
                      <td className="px-4 py-2 font-mono font-semibold">{job.type || 'RAW'}</td>
                      <td className="px-4 py-2 font-mono">{job.store_slug || 'platform'}</td>
                      <td className="px-4 py-2 font-mono">{job.attempt}/{job.max_retries}</td>
                      <td className="px-4 py-2 text-slate-600">
                        {job.enqueued_at ? new Date(job.enqueued_at).toLocaleString() : '—'}
                      </td>
                    </tr>
                  ))}
                  {telemetry.recent_jobs.length === 0 && (
                    <tr>
                      <td className="px-4 py-4 text-center text-slate-500" colSpan={5}>
                        No entries currently in {telemetry.stream_name}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <p className="text-[11px] text-slate-500">Updated {new Date(telemetry.timestamp).toLocaleString()}</p>
        </>
      )}
    </div>
  );
};
