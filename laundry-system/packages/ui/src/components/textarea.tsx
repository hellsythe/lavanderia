'use client';

import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

/**
 * Textarea — design-system LavanderPro.
 */
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, invalid, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        aria-invalid={invalid || undefined}
        className={cn(
          'w-full min-h-[80px] px-2.5 py-2',
          'bg-surface-2 text-fg text-[13px]',
          'border rounded-sm resize-y',
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
Textarea.displayName = 'Textarea';