/**
 * ProvisioningTracker provides a real-time visual progress monitor polling
 * store provisioning logs until completion or failure.
 */

import React, { useEffect, useState, useRef } from 'react';
import { CheckCircle2, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { ProvisioningLog } from '../../types/store';
import { api } from '../../lib/api';

interface ProvisioningTrackerProps {
  storeId: string;
  storeSlug: string;
  onComplete: () => void;
  onFailed: (errorMsg: string) => void;
}

export const ProvisioningTracker: React.FC<ProvisioningTrackerProps> = ({
  storeId,
  storeSlug,
  onComplete,
  onFailed,
}) => {
  const [logs, setLogs] = useState<ProvisioningLog[]>([]);
  const [isDone, setIsDone] = useState(false);
  const [hasFailed, setHasFailed] = useState(false);
  const failureReportedRef = useRef(false);

  useEffect(() => {
    let timer: NodeJS.Timeout;

    const pollLogs = async () => {
      try {
        const res = await api.get<{ data: ProvisioningLog[] }>(`/platform/stores/${storeId}/provisioning-logs`);
        const fetchedLogs = Array.isArray(res.data) ? res.data : (res.data.data || []);
        setLogs(fetchedLogs);

        const failedLog = fetchedLogs.find((l) => l.status === 'FAILED');
        if (failedLog && !failureReportedRef.current) {
          failureReportedRef.current = true;
          setHasFailed(true);
          onFailed(failedLog.error_message || 'Store provisioning failed during step: ' + failedLog.step);
          return;
        }

        const completedFinalLog = fetchedLogs.find(
          (l) => l.step === 'PROVISIONING_COMPLETE' && l.status === 'COMPLETED'
        );

        if (completedFinalLog) {
          setIsDone(true);
          onComplete();
          return;
        }

        // Continue polling every 1.5 seconds if still in progress
        timer = setTimeout(pollLogs, 1500);
      } catch (err) {
        console.error('Error fetching provisioning logs', err);
        timer = setTimeout(pollLogs, 2500);
      }
    };

    pollLogs();

    return () => clearTimeout(timer);
  }, [storeId, onComplete, onFailed]);

  const pipelineSteps = [
    { key: 'VALIDATE_SPECIFICATION', label: 'Validate Identity & Slug Uniqueness' },
    { key: 'ENCRYPT_CREDENTIALS', label: 'AES-256-GCM Credential Encryption' },
    { key: 'CREATE_PHYSICAL_DATABASE', label: 'Instantiate Dedicated PostgreSQL Database' },
    { key: 'APPLY_STORE_MIGRATIONS', label: 'Execute Baseline Schema Migrations' },
    { key: 'SEED_STORE_SETTINGS', label: 'Seed Operational Settings & Currency' },
    { key: 'PROVISIONING_COMPLETE', label: 'Finalize Activation & Prime Cache' },
  ];

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-8 border border-slate-800 shadow-2xl max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h3 className="text-xl font-bold tracking-tight">Provisioning Brand: {storeSlug}</h3>
        <p className="text-sm text-slate-400 mt-1">
          Automated multi-database setup in progress. Do not navigate away.
        </p>
      </div>

      <div className="space-y-4">
        {pipelineSteps.map((step, idx) => {
          const logItem = logs.find((l) => l.step === step.key);
          const isCompleted = logItem?.status === 'COMPLETED';
          const isInProgress = logItem?.status === 'IN_PROGRESS';
          const isFailed = logItem?.status === 'FAILED';

          return (
            <div
              key={step.key}
              className={`flex items-center justify-between p-4 rounded-xl border transition ${
                isCompleted
                  ? 'bg-slate-950/60 border-emerald-500/30'
                  : isInProgress
                  ? 'bg-teal-950/30 border-teal-500/50 shadow-sm shadow-teal-500/10'
                  : isFailed
                  ? 'bg-rose-950/40 border-rose-500/50'
                  : 'bg-slate-950/20 border-slate-800/60 opacity-60'
              }`}
            >
              <div className="flex items-center space-x-3.5">
                <span className="text-xs font-mono text-slate-500 w-5">0{idx + 1}</span>
                <span className="text-sm font-medium text-slate-200">{step.label}</span>
              </div>

              <div>
                {isCompleted && <CheckCircle2 className="h-5 w-5 text-emerald-400" />}
                {isInProgress && <Loader2 className="h-5 w-5 text-teal-400 animate-spin" />}
                {isFailed && <AlertCircle className="h-5 w-5 text-rose-400" />}
                {!isCompleted && !isInProgress && !isFailed && (
                  <Clock className="h-5 w-5 text-slate-600" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {isDone && (
        <div className="mt-8 text-center bg-emerald-950/40 border border-emerald-500/40 p-4 rounded-xl">
          <p className="text-emerald-300 font-semibold text-sm">
            Store successfully provisioned and activated!
          </p>
        </div>
      )}

      {hasFailed && (
        <div className="mt-8 text-center bg-rose-950/50 border border-rose-500/40 p-4 rounded-xl">
          <p className="text-rose-300 font-semibold text-sm">
            Provisioning pipeline encountered a critical error. Compensating rollback applied.
          </p>
        </div>
      )}
    </div>
  );
};
