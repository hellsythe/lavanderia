'use client';

import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '../lib/cn';

/**
 * KpiCard — design-system LavanderPro.
 *
 * Layout:
 * ┌────────────────────────┐
 * │ LABEL             [ico]│
 * │ VALUE                 │
 * │ delta vs. ayer       │
 * └────────────────────────┘
 *
 * Icon background uses --{semantic}-soft.
 */
export interface KpiCardProps extends HTMLAttributes<HTMLDivElement> {
  label: string;
  value: string | number;
  delta?: { value: string; direction: 'up' | 'down' | 'neutral' };
  icon: ReactNode;
  iconTone?: 'warning' | 'success' | 'info' | 'danger' | 'purple' | 'accent';
}

const toneBg = {
  warning: 'bg-warning-soft text-warning',
  success: 'bg-success-soft text-success',
  info: 'bg-info-soft text-info',
  danger: 'bg-danger-soft text-danger',
  purple: 'bg-purple-soft text-purple',
  accent: 'bg-accent-soft text-accent',
};

const deltaColor = {
  up: 'text-success',
  down: 'text-danger',
  neutral: 'text-muted',
};

export function KpiCard({
  label,
  value,
  delta,
  icon,
  iconTone = 'accent',
  className,
  ...props
}: KpiCardProps) {
  return (
    <div
      className={cn(
        'group relative bg-surface border border-border rounded-md',
        'shadow-default hover:shadow-hover',
        'transition-shadow duration-lift hover:-translate-y-0.5',
        'p-4 cursor-pointer',
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between mb-2">
        <span className="text-label-kpi text-muted uppercase">{label}</span>
        <div
          className={cn(
            'h-[34px] w-[34px] rounded-icon flex items-center justify-center',
            toneBg[iconTone],
          )}
        >
          {icon}
        </div>
      </div>

      <div className="text-display-kpi text-fg num leading-none mb-1.5">{value}</div>

      {delta && (
        <div className={cn('text-meta font-semibold', deltaColor[delta.direction])}>
          {delta.value}
        </div>
      )}
    </div>
  );
}