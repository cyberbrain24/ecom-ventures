import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Play,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import { MetricCard } from '../components/ui/MetricCard';
import { SecurityAuditReportResponse } from '../types/system';
import { api, apiErrorMessage } from '../lib/api';

export const SecurityAuditPage: React.FC = () => {
  const [report, setReport] = useState<SecurityAuditReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lastAuditedAt, setLastAuditedAt] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const runAudit = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const res = await api.get<{ data: SecurityAuditReportResponse }>('/platform/security/audit');
      setReport(res.data.data);
      setLastAuditedAt(res.data.data.timestamp);
    } catch (err) {
      setReport(null);
      setLastAuditedAt(null);
      setErrorMessage(apiErrorMessage(err, 'Could not run the security audit.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runAudit();
  }, []);

  return (
    <div className="space-y-3.5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
        <div>
          <h1 className="text-lg font-bold text-slate-900 tracking-tight">Security Auditing & Penetration Compliance</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Automated multi-tenant isolation verification, cryptographic encryption checks, and boundary tests.
          </p>
        </div>

        <button
          onClick={runAudit}
          disabled={isLoading}
          className="inline-flex items-center px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold rounded-md shadow-sm transition space-x-1.5 disabled:opacity-50"
        >
          {isLoading ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Play className="h-3.5 w-3.5" />
          )}
          <span>{isLoading ? 'Executing...' : 'Run Security Audit'}</span>
        </button>
      </div>

      {errorMessage && (
        <div role="alert" className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 whitespace-pre-line">
          {errorMessage}
        </div>
      )}

      {/* Security Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard
          title="Audit Verdict"
          value={report?.overall_verdict || '—'}
          subtitle="Audit result"
          icon={ShieldCheck}
          trendPositive={report?.overall_verdict === 'PASS'}
        />
        <MetricCard
          title="Passed Checks"
          value={report?.passed_checks ?? '—'}
          subtitle="Passed audit checks"
          icon={CheckCircle2}
          trendPositive={report ? report.failed_checks === 0 : undefined}
        />
        <MetricCard
          title="Warnings"
          value={report?.warning_checks ?? '—'}
          subtitle="Reported warnings"
          icon={AlertTriangle}
        />
        <MetricCard
          title="Critical Flags"
          value={report?.failed_checks ?? '—'}
          subtitle="Reported failures"
          icon={ShieldAlert}
        />
      </div>

      {/* Overall Verdict Banner */}
      {report && (
        <div
          className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-sm ${
            report.overall_verdict === 'PASS'
              ? 'bg-emerald-50 border-emerald-200'
              : report.overall_verdict === 'WARN'
              ? 'bg-amber-50 border-amber-200'
              : 'bg-rose-50 border-rose-200'
          }`}
        >
          <div className="flex items-center space-x-3">
            <div
              className={`h-8 w-8 rounded-md flex items-center justify-center text-white font-bold flex-shrink-0 ${
                report.overall_verdict === 'PASS'
                  ? 'bg-emerald-600'
                  : report.overall_verdict === 'WARN'
                  ? 'bg-amber-600'
                  : 'bg-rose-600'
              }`}
            >
              {report.overall_verdict === 'PASS' ? (
                <ShieldCheck className="h-4 w-4" />
              ) : (
                <ShieldAlert className="h-4 w-4" />
              )}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span
                  className={`text-sm font-bold tracking-wide ${
                    report.overall_verdict === 'PASS'
                      ? 'text-emerald-900'
                      : report.overall_verdict === 'WARN'
                      ? 'text-amber-900'
                      : 'text-rose-900'
                  }`}
                >
                  AUDIT VERDICT: {report.overall_verdict}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 rounded font-bold bg-white/80 border border-slate-200 text-slate-700">
                  {report.passed_checks} / {report.checks_run} Checks Passed
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Last executed:{' '}
                {lastAuditedAt ? new Date(lastAuditedAt).toLocaleString() : 'Unknown'}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4 text-xs">
            <div className="text-center">
              <span className="block font-bold text-emerald-700 text-sm leading-tight">{report.passed_checks}</span>
              <span className="text-[10px] text-slate-500">Passed</span>
            </div>
            <div className="text-center">
              <span className="block font-bold text-amber-600 text-sm leading-tight">{report.warning_checks}</span>
              <span className="text-[10px] text-slate-500">Warnings</span>
            </div>
            <div className="text-center">
              <span className="block font-bold text-rose-600 text-sm leading-tight">{report.failed_checks}</span>
              <span className="text-[10px] text-slate-500">Violations</span>
            </div>
          </div>
        </div>
      )}

      {/* Findings Breakdown */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-3.5 py-2 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900">Isolation & Cryptographic Check Invariants</h3>
          <span className="text-[10px] text-slate-500 font-mono">Server audit report</span>
        </div>

        <div className="divide-y divide-slate-100">
          {report ? report.findings.map((finding, idx) => (
            <div key={idx} className="p-3 hover:bg-slate-50/50 transition flex items-start space-x-3">
              <div className="mt-0.5 flex-shrink-0">
                {finding.status === 'PASS' ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : finding.status === 'WARN' ? (
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                ) : (
                  <ShieldAlert className="h-4 w-4 text-rose-600" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 truncate">{finding.name}</h4>
                  <span
                    className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded ${
                      finding.status === 'PASS'
                        ? 'bg-emerald-100 text-emerald-800'
                        : finding.status === 'WARN'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-rose-100 text-rose-800'
                    }`}
                  >
                    {finding.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">{finding.description}</p>
                <div className="mt-1.5 p-2 bg-slate-50 rounded border border-slate-200 text-[10.5px] font-mono text-slate-700">
                  <span className="text-slate-400 font-semibold">Evidence:</span> {finding.details}
                </div>
              </div>
            </div>
          )) : (
            <p className="p-4 text-xs text-slate-500">
              {errorMessage ? 'Audit results are unavailable until the request succeeds.' : 'Run the audit to load results.'}
            </p>
          )}
        </div>
      </div>

    </div>
  );
};
