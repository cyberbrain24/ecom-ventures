/**
 * DNSInstructionsModal displays DNS TXT ownership verification instructions
 * and CNAME storefront traffic routing records with copy-to-clipboard functionality.
 */

import React from 'react';
import { X, Copy, Check, Globe, Shield } from 'lucide-react';
import { DomainItem } from '../../types/domain';

interface DNSInstructionsModalProps {
  domain: DomainItem;
  onClose: () => void;
  onVerify: () => void;
  isVerifying: boolean;
  /** Verification error from the last attempt, shown inside the modal. */
  errorMessage?: string | null;
}

/**
 * DNSInstructionsModal shows the TXT ownership record for a domain and the CNAME routing record.
 * The platform does not expose an edge CNAME target yet, so that value is shown as not available
 * instead of a hard-coded hostname.
 *
 * @param props - Domain, close and verify handlers, busy flag, and inline error text
 * @returns The DNS instructions modal
 */
export const DNSInstructionsModal: React.FC<DNSInstructionsModalProps> = ({
  domain,
  onClose,
  onVerify,
  isVerifying,
  errorMessage = null,
}) => {
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
        {/* Modal Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-teal-500/20 text-teal-400 rounded-lg">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">DNS Configuration Instructions</h3>
              <p className="text-xs text-slate-400 mt-0.5">Domain: {domain.domain}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          <p className="text-sm text-slate-600 leading-relaxed">
            Configure the following DNS records with your domain registrar (e.g., Cloudflare, Namecheap, GoDaddy) to route traffic and issue SSL certificates.
          </p>

          {/* Record 1: Verification TXT */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                <Shield className="h-3.5 w-3.5 text-teal-600" />
                <span>1. Domain Ownership Verification (TXT Record)</span>
              </span>
              <span className="text-[11px] bg-teal-100 text-teal-800 font-semibold px-2 py-0.5 rounded">
                Required
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs font-mono">
              <div className="bg-white p-2.5 rounded border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-sans">Type</span>
                <span className="font-bold text-slate-800">TXT</span>
              </div>
              <div className="bg-white p-2.5 rounded border border-slate-200 col-span-2 flex justify-between items-center">
                <div>
                  <span className="text-[10px] text-slate-400 block font-sans">Host / Name</span>
                  <span className="font-bold text-slate-800">_ecom-challenge.{domain.domain}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(`_ecom-challenge.${domain.domain}`, 'host')}
                  className="p-1 hover:bg-slate-100 rounded text-slate-500"
                >
                  {copiedKey === 'host' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
              <div className="bg-white p-2.5 rounded border border-slate-200 col-span-3 flex justify-between items-center">
                <div className="truncate mr-2">
                  <span className="text-[10px] text-slate-400 block font-sans">Value / Content</span>
                  <span className="font-bold text-teal-600">{domain.verification_token}</span>
                </div>
                <button
                  onClick={() => copyToClipboard(domain.verification_token, 'token')}
                  className="p-1 hover:bg-slate-100 rounded text-slate-500 shrink-0"
                >
                  {copiedKey === 'token' ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
          </div>

          {/* Record 2: Traffic Routing CNAME */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
              2. Storefront Traffic Routing (CNAME Record)
            </span>

            <div className="grid grid-cols-3 gap-2 text-xs font-mono">
              <div className="bg-white p-2.5 rounded border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-sans">Type</span>
                <span className="font-bold text-slate-800">CNAME</span>
              </div>
              <div className="bg-white p-2.5 rounded border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-sans">Name</span>
                <span className="font-bold text-slate-800">@ or shop</span>
              </div>
              <div className="bg-white p-2.5 rounded border border-slate-200">
                <span className="text-[10px] text-slate-400 block font-sans">Target</span>
                <span className="font-semibold text-slate-500 font-sans">Not configured</span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 font-sans">
              The server does not report an edge CNAME target yet. Get the target from the platform owner before adding this record.
            </p>
          </div>
        </div>

        {errorMessage && (
          <div role="alert" className="mx-6 mb-0 mt-0 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-800 whitespace-pre-line">
            {errorMessage}
          </div>
        )}

        {/* Modal Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            Close Instructions
          </button>
          <button
            onClick={onVerify}
            disabled={isVerifying}
            className="px-5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-semibold shadow-sm transition disabled:opacity-50"
          >
            {isVerifying ? 'Checking DNS Records...' : 'Verify DNS TXT Now'}
          </button>
        </div>
      </div>
    </div>
  );
};
