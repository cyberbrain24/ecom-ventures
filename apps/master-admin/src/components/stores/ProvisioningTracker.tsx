/**
 * ProvisioningTracker shows live provisioning progress by polling the store's provisioning logs.
 * Polling stops on a terminal state (completed or failed) and when the component unmounts.
 * Failure reasons come from the API; poll errors are shown inline with a retry action.
 */

import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock, AlertCircle, Loader2, RotateCcw } from 'lucide-react';
import { ProvisioningLog } from '../../types/store';
import { api, apiErrorMessage } from '../../lib/api';

interface ProvisioningTrackerProps {
  storeId: string;
  storeSlug: string;
  onComplete: () => void;
  onFailed: (errorMsg: string) => void;
}

/** Number of consecutive failed polls before the tracker shows an error and stops. */
const MAX_CONSECUTIVE_POLL_ERRORS = 3;

const PIPELINE_STEPS = [
  { key: 'VALIDATE_SPECIFICATION', label: 'Validate Identity & Slug Uniqueness' },
  { key: 'ENCRYPT_CREDENTIALS', label: 'Encrypt Database Credentials' },
  { key: 'CREATE_PHYSICAL_DATABASE', label: 'Create Dedicated PostgreSQL Database' },
  { key: 'APPLY_STORE_MIGRATIONS', label: 'Apply Store Schema Migrations' },
  { key: 'SEED_STORE_SETTINGS', label: 'Seed Store Settings & Currency' },
  { key: 'PROVISIONING_COMPLETE', label: 'Finalize Activation' },
];

/**
 * Renders the provisioning pipeline for one store and reports completion or failure upward.
 *
 * @param props - Store id and slug, plus completion and failure callbacks
 * @returns The provisioning progress panel
 */
export const ProvisioningTracker: React.FC<ProvisioningTrackerProps> = ({
  storeId,
  storeSlug,
  onComplete,
  onFailed,
}) => {
  const [logs, setLogs] = useState<ProvisioningLog[]>([]);
  const [terminal, setTerminal] = useState<'none' | 'completed' | 'failed'>('none');
  const [failureReason, setFailureReason] = useState<string | null>(null);
  const [failedStepKey, setFailedStepKey] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  // Callbacks are read through refs so that a parent re-render does not restart polling.
  const onCompleteRef = useRef(onComplete);
  const onFailedRef = useRef(onFailed);
  useEffect(() => {
    onCompleteRef.current = onComplete;
    onFailedRef.current = onFailed;
  }, [onComplete, onFailed]);

  useEffect(() => {
    if (terminal !== 'none') return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let consecutiveErrors = 0;

    const pollLogs = async () => {
      try {
        const res = await api.get<{ data: ProvisioningLog[] }>(`/platform/stores/${storeId}/provisioning-logs`);
        if (!Array.isArray(res.data?.data)) {
          throw new Error('The server returned provisioning logs in an unexpected format.');
        }
        if (cancelled) return;
        consecutiveErrors = 0;
        setPollError(null);
        const fetched = res.data.data;
        setLogs(fetched);

        const failedLog = fetched.find((l) => l.status === 'FAILED');
        if (failedLog) {
          const reason = failedLog.error_message?.trim()
            ? failedLog.error_message
            : `The server did not record a reason for the failed step "${failedLog.step}".`;
          setFailedStepKey(failedLog.step);
          setFailureReason(reason);
          setTerminal('failed');
          onFailedRef.current(reason);
          return;
        }

        const completedFinalLog = fetched.find(
          (l) => l.step === 'PROVISIONING_COMPLETE' && l.status === 'COMPLETED'
        );
        if (completedFinalLog) {
          setTerminal('completed');
          onCompleteRef.current();
          return;
        }

        timer = setTimeout(pollLogs, 1500);
      } catch (err) {
        if (cancelled) return;
        consecutiveErrors += 1;
        const message = apiErrorMessage(err, 'Could not read provisioning progress.');
        setPollError(message);
        if (consecutiveErrors >= MAX_CONSECUTIVE_POLL_ERRORS) {
          // Stop automatic polling; the admin can retry explicitly.
          return;
        }
        timer = setTimeout(pollLogs, 2500);
      }
    };

    pollLogs();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [storeId, terminal, retryToken]);

  const handleRetry = () => {
    setPollError(null);
    setRetryToken((t) => t + 1);
  };

  return (
    <div className="bg-slate-900 text-white rounded-2xl p-8 border border-slate-800 shadow-2xl max-w-2xl mx-auto">
      <div className="text-center mb-8">
        <h3 className="text-xl font-bold tracking-tight">Provisioning Brand: {storeSlug}</h3>
        <p className="text-sm text-slate-400 mt-1">
          {terminal === 'none'
            ? 'Automated multi-database setup in progress. Do not navigate away.'
            : 'Provisioning has reached a final state.'}
        </p>
      </div>

      <div className="space-y-4">
        {PIPELINE_STEPS.map((step, idx) => {
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

      {terminal === 'completed' && (
        <div role="status" className="mt-8 text-center bg-emerald-950/40 border border-emerald-500/40 p-4 rounded-xl">
          <p className="text-emerald-300 font-semibold text-sm">
            Store successfully provisioned and activated.
          </p>
        </div>
      )}

      {terminal === 'failed' && (
        <div role="alert" className="mt-8 bg-rose-950/50 border border-rose-500/40 p-4 rounded-xl space-y-2">
          <p className="text-rose-300 font-semibold text-sm">
            Provisioning failed{failedStepKey ? ` at step "${failedStepKey}"` : ''}.
          </p>
          <p className="text-rose-200 text-xs break-words">Reason: {failureReason}</p>
        </div>
      )}

      {pollError && terminal === 'none' && (
        <div role="alert" className="mt-8 bg-amber-950/40 border border-amber-500/40 p-4 rounded-xl space-y-3">
          <p className="text-amber-200 text-xs">
            Provisioning progress could not be read: {pollError}
          </p>
          <button
            type="button"
            onClick={handleRetry}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 border border-amber-400/60 rounded-md text-xs font-semibold text-amber-100 hover:bg-amber-900/40"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Retry</span>
          </button>
        </div>
      )}
    </div>
  );
};
