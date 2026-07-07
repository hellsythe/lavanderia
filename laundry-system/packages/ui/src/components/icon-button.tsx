'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../lib/cn';

/**
 * IconButton — design-system LavanderPro.
 * 34px square on desktop, 44px on mobile.
 */
export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: ReactNode;
  badge?: number | boolean;
  ariaLabel: string;
  size?: 'desktop' | 'mobile';
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, icon, badge, ariaLabel, size = 'desktop', ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        aria-label={ariaLabel}
        className={cn(
          'relative inline-flex items-center justify-center',
          'border border-border rounded-icon bg-surface text-fg',
          'transition-[background-color,color,border-color] duration-ui',
          'hover:bg-canvas hover:text-fg active:translate-y-px',
          'disabled:opacity-60 disabled:pointer-events-none',
          size === 'desktop' ? 'h-[34px] w-[34px]' : 'h-11 w-11',
          className,
        )}
        {...props}
      >
        <span className="block [&_svg]:h-[15px] [&_svg]:w-[15px] [&_svg]:stroke-[1.8]">
          {icon}
        </span>
        {badge && (
          <span
            className={cn(
              'absolute -top-0.5 -right-0.5',
              'min-w-[14px] h-3.5 px-1',
              'bg-warning text-white rounded-pill',
              'text-[10px] font-bold num flex items-center justify-center',
            )}
            aria-hidden
          />
        )}
      </button>
    );
  },
);
IconButton.displayName = 'IconButton';