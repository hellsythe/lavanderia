'use client';

import { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';

/**
 * EmptyState — design-system LavanderPro.
 * Centred icon + plain-text statement. Used in tables / lists with no results.
 */
export interface EmptyStateProps extends HTMLAttributes<HTMLDivElement> {
  icon?: ReactNode;
  title: string;
  description?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        'py-10 px-4 gap-2',
        className,
      )}
      {...props}
    >
      {icon && <div className="opacity-30 mb-1 [&_svg]:h-8 [&_svg]:w-8">{icon}</div>}
      <p className="text-[13px] text-fg font-semibold">{title}</p>
      {description && <p className="text-meta text-muted">{description}</p>}
    </div>
  );
}