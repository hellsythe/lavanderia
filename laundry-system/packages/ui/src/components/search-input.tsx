'use client';

import { Search, X } from 'lucide-react';
import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export interface SearchInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onClear?: () => void;
}

/**
 * SearchInput — design-system LavanderPro.
 * Default 190px width, 140px on mobile.
 * Focus ring uses --accent at 12% alpha.
 */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, onClear, value, ...props }, ref) => {
    return (
      <div className={cn('relative inline-block w-full sm:w-[190px]', className)}>
        <Search
          className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none"
          aria-hidden
        />
        <input
          ref={ref}
          type="search"
          value={value}
          className={cn(
            'w-full h-7 pl-7 pr-7',
            'bg-surface-2 text-fg text-[12px]',
            'border border-border rounded-sm',
            'placeholder:text-muted',
            'transition-[border-color,background-color,box-shadow] duration-ui',
            'focus:bg-surface focus:border-accent focus:shadow-focus-ring focus:outline-none',
          )}
          {...props}
        />
        {value && onClear && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Limpiar búsqueda"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-4 w-4 flex items-center justify-center text-muted hover:text-fg"
          >
            <X className="h-3 w-3" />
          </button>
        )}
      </div>
    );
  },
);
SearchInput.displayName = 'SearchInput';