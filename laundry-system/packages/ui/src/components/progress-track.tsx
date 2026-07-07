'use client';

import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

/**
 * ProgressTrack — design-system LavanderPro.
 * 4px tall track, 2px radius. Fill uses --accent.
 */
export interface ProgressTrackProps extends HTMLAttributes<HTMLDivElement> {
  value: number; // 0..100
}

export function ProgressTrack({ value, className, ...props }: ProgressTrackProps) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      className={cn('h-1 bg-border rounded-sm overflow-hidden', className)}
      {...props}
    >
      <div
        className="h-full bg-accent transition-[width] duration-chart"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}