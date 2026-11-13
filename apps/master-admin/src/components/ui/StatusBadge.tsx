/**
 * StatusBadge renders visual state indicators for store operational lifecycles.
 */

import React from 'react';
import { StoreStatus } from '../../types/store';
import { cn } from '../../lib/utils';

interface StatusBadgeProps {
  status: StoreStatus;
  className?: string;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  const getStyles = () => {
    switch (status) {
      case 'ACTIVE':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'PROVISIONING':
        return 'bg-blue-50 text-blue-700 border-blue-200 animate-pulse';
      case 'MAINTENANCE':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      case 'SUSPENDED':
        return 'bg-rose-50 text-rose-700 border-rose-200';
      case 'ARCHIVED':
        return 'bg-slate-100 text-slate-600 border-slate-300';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2 py-0.5 rounded text-[10.5px] font-semibold tracking-wide border leading-tight',
        getStyles(),
        className
      )}
    >
      {status}
    </span>
  );
};
