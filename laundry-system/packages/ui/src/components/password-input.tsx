'use client';

import { Eye, EyeOff } from 'lucide-react';
import { forwardRef, useState, type InputHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export interface PasswordInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  invalid?: boolean;
}

/**
 * PasswordInput — Input con toggle show/hide.
 * Replica el `.password-wrap` del design-system.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ className, invalid, ...props }, ref) => {
    const [visible, setVisible] = useState(false);

    return (
      <div className="relative">
        <input
          ref={ref}
          type={visible ? 'text' : 'password'}
          aria-invalid={invalid || undefined}
          autoComplete={props.autoComplete ?? 'current-password'}
          className={cn(
            'w-full h-9 pl-3 pr-10 py-1.5',
            'bg-surface-2 text-fg text-[13px]',
            'border rounded-sm',
            'placeholder:text-muted',
            'transition-[border-color,background-color,box-shadow] duration-ui',
            invalid
              ? 'border-danger bg-danger-soft focus:border-danger focus:shadow-[0_0_0_3px_rgba(220,38,38,.15)]'
              : 'border-border focus:bg-surface focus:border-accent focus:shadow-focus-ring',
            'disabled:opacity-60 disabled:pointer-events-none',
            className,
          )}
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={visible}
          className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 grid place-items-center text-muted hover:bg-canvas hover:text-fg rounded-sm transition-colors duration-ui"
        >
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = 'PasswordInput';