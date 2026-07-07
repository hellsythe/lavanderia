'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

/**
 * StatusPill — design-system LavanderPro.
 *
 * Status semánticos para órdenes:
 * - proceso (warning): en proceso
 * - listo (success): listo para entregar
 * - pendiente (info): pendiente de pago/recoger
 * - entregado (muted): entregado
 * - cancelado (danger): cancelado
 */
const pillStyles = cva(
  [
    'inline-flex items-center gap-1.5',
    'px-2.5 py-0.5 rounded-pill',
    'text-badge font-bold leading-tight',
  ].join(' '),
  {
    variants: {
      status: {
        proceso:
          'bg-warning-soft text-warning [&_.pill-dot]:bg-warning',
        listo:
          'bg-success-soft text-success [&_.pill-dot]:bg-success',
        pendiente:
          'bg-info-soft text-info [&_.pill-dot]:bg-info',
        entregado:
          'bg-surface-2 text-muted [&_.pill-dot]:bg-muted',
        cancelado:
          'bg-danger-soft text-danger [&_.pill-dot]:bg-danger',
        neutral:
          'bg-surface-2 text-muted [&_.pill-dot]:bg-muted',
      },
    },
    defaultVariants: {
      status: 'neutral',
    },
  },
);

export interface StatusPillProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof pillStyles> {
  dot?: boolean;
}

export function StatusPill({
  className,
  status,
  dot = true,
  children,
  ...props
}: StatusPillProps) {
  return (
    <span className={cn(pillStyles({ status }), className)} {...props}>
      {dot && <span className="pill-dot h-1.5 w-1.5 rounded-full" aria-hidden />}
      {children}
    </span>
  );
}