'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

/**
 * FilterPill — design-system LavanderPro.
 * Tab-style pill group: container with bg-canvas, active pill is white with shadow.
 */
const filterStyles = cva(
  [
    'inline-flex items-center justify-center',
    'h-7 px-3',
    'rounded-sm text-[12px] font-semibold',
    'transition-[background-color,color,box-shadow] duration-ui',
    'press',
    'disabled:pointer-events-none disabled:opacity-60',
  ].join(' '),
  {
    variants: {
      active: {
        true: 'bg-surface text-fg shadow-default',
        false: 'bg-transparent text-muted hover:text-fg',
      },
    },
    defaultVariants: {
      active: false,
    },
  },
);

export interface FilterPillProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof filterStyles> {}

export const FilterPill = forwardRef<HTMLButtonElement, FilterPillProps>(
  ({ className, active, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-pressed={active ? true : false}
      className={cn(filterStyles({ active: active === true }), className)}
      {...props}
    />
  ),
);
FilterPill.displayName = 'FilterPill';

export interface FilterGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
}

export function FilterGroup({ className, children, ...props }: FilterGroupProps) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-0.5',
        'p-0.5 bg-canvas rounded-md',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}