'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

/**
 * Input — design-system LavanderPro.
 * Focus: accent border + 3px soft ring (rgba(15,118,110,.12)).
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <input
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          'w-full h-8 px-2.5 py-1.5',
          'bg-surface-2 text-fg text-[13px]',
          'border rounded-sm',
          'placeholder:text-muted',
          'transition-[border-color,background-color,box-shadow] duration-ui',
          invalid
            ? 'border-danger focus:border-danger focus:shadow-[0_0_0_3px_rgba(220,38,38,.15)]'
            : 'border-border focus:bg-surface focus:border-accent focus:shadow-focus-ring',
          'disabled:opacity-60 disabled:pointer-events-none',
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = 'Input';