'use client';

import { type HTMLAttributes, type ThHTMLAttributes, type TdHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

/**
 * DataTable — design-system LavanderPro.
 *
 * Spec:
 * - thead th: 10px ALL-CAPS, 0.07em, muted, nowrap
 * - tbody tr: border-top --border, hover --surface-2
 * - td: 11px 16px padding, tabular-nums
 * - empty state: <tr.empty-row><td colspan>N</td>...
 */

export function Table({ className, ...props }: HTMLAttributes<HTMLTableElement>) {
  return (
    <div className="w-full overflow-x-auto">
      <table
        className={cn('w-full border-collapse text-[13px]', className)}
        {...props}
      />
    </div>
  );
}

export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-surface-2', className)} {...props} />;
}

export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('', className)} {...props} />;
}

export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return (
    <tr
      className={cn(
        'border-t border-border transition-colors duration-fast',
        'hover:bg-surface-2',
        className,
      )}
      {...props}
    />
  );
}

export function TableHead({ className, ...props }: ThHTMLAttributes<HTMLTableCellElement>) {
  return (
    <th
      className={cn(
        'text-left text-label font-bold text-muted uppercase',
        'px-4 py-2.5 whitespace-nowrap',
        className,
      )}
      {...props}
    />
  );
}

export function TableCell({ className, ...props }: TdHTMLAttributes<HTMLTableCellElement>) {
  return (
    <td
      className={cn('px-4 py-2.5 text-fg num', className)}
      {...props}
    />
  );
}

export function TableEmpty({
  colspan,
  children,
}: {
  colspan: number;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td colSpan={colspan} className="p-0">
        {children}
      </td>
    </tr>
  );
}