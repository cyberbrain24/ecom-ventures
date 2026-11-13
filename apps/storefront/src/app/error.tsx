'use client';

import React from 'react';
import { RotateCcw } from 'lucide-react';

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="h-16 w-16 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto text-2xl font-bold font-mono">
          !
        </div>
        <h1 className="text-2xl font-bold text-slate-900 font-[var(--brand-font-heading)]">
          Something went wrong
        </h1>
        <p className="text-sm text-slate-600">
          An unexpected error occurred while loading this page. Our technical team has been notified.
        </p>
        <div>
          <button
            onClick={() => reset()}
            className="inline-flex items-center space-x-2 px-5 py-2.5 bg-[var(--brand-primary)] text-white text-sm font-semibold rounded-[var(--brand-radius)] hover:opacity-95 transition"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Try Again</span>
          </button>
        </div>
      </div>
    </div>
  );
}
