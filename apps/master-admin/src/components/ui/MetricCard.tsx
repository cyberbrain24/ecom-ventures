/**
 * MetricCard component for displaying high-level analytical indicators and trend deltas.
 */

import React from 'react';
import { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: string;
  trendPositive?: boolean;
  className?: string;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendPositive = true,
  className,
}) => {
  return (
    <div className={cn('bg-white p-3 rounded-lg border border-slate-200 shadow-xs min-w-0', className)}>
      <div className="flex items-center justify-between gap-1.5">
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-semibold text-slate-500 uppercase tracking-wider leading-none truncate">{title}</p>
          <p className="text-lg font-black text-slate-900 mt-1 leading-tight truncate">{value}</p>
        </div>
        <div className="h-7 w-7 rounded-md bg-teal-50 flex items-center justify-center text-teal-600 flex-shrink-0">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      {(subtitle || trend) && (
        <div className="mt-1.5 flex items-center text-[10px] truncate">
          {trend && (
            <span
              className={cn(
                'font-bold mr-1 flex-shrink-0',
                trendPositive ? 'text-emerald-600' : 'text-rose-600'
              )}
            >
              {trend}
            </span>
          )}
          {subtitle && <span className="text-slate-500 truncate">{subtitle}</span>}
        </div>
      )}
    </div>
  );
};
