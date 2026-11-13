import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-16">
      <div className="max-w-md w-full text-center space-y-6">
        <div className="text-7xl font-black text-[var(--brand-primary)] font-mono">404</div>
        <h1 className="text-2xl font-bold text-slate-900 font-[var(--brand-font-heading)]">
          Page Not Found
        </h1>
        <p className="text-sm text-slate-600">
          The page or product you are looking for does not exist or may have been moved.
        </p>
        <div>
          <Link
            href="/"
            className="inline-flex items-center space-x-2 px-5 py-2.5 bg-[var(--brand-primary)] text-white text-sm font-semibold rounded-[var(--brand-radius)] hover:opacity-95 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Homepage</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
