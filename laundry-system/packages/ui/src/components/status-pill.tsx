'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

/**
 * StatusPill — design-system LavanderPro.
 *
 * Acepta tanto el enum de OrderStatus (inglés: 'received' | 'in_process' | ...)
 * como las etiquetas legacy en español del design system original
 * ('proceso' | 'listo' | 'pendiente' | 'entregado' | 'cancelado').
 *
 * Los colores semánticos se mantienen del design system:
 *   proceso / in_process → warning (amber)
 *   listo / ready        → success (green)
 *   pendiente / received → info (blue)
 *   entregado / delivered → muted
 *   cancelado / cancelled → danger
 */
type StatusVariant =
  | 'proceso'
  | 'listo'
  | 'pendiente'
  | 'entregado'
  | 'cancelado'
  | 'received'
  | 'in_process'
  | 'ready'
  | 'delivered'
  | 'cancelled'
  | 'neutral';

const pillStyles = cva(
  [
    'inline-flex items-center gap-1.5',
    'px-2.5 py-0.5 rounded-pill',
    'text-badge font-bold leading-tight',
  ].join(' '),
  {
    variants: {
      status: {
        proceso: 'bg-warning-soft text-warning [&_.pill-dot]:bg-warning',
        in_process: 'bg-warning-soft text-warning [&_.pill-dot]:bg-warning',
        listo: 'bg-success-soft text-success [&_.pill-dot]:bg-success',
        ready: 'bg-success-soft text-success [&_.pill-dot]:bg-success',
        pendiente: 'bg-info-soft text-info [&_.pill-dot]:bg-info',
        received: 'bg-info-soft text-info [&_.pill-dot]:bg-info',
        entregado: 'bg-surface-2 text-muted [&_.pill-dot]:bg-muted',
        delivered: 'bg-surface-2 text-muted [&_.pill-dot]:bg-muted',
        cancelado: 'bg-danger-soft text-danger [&_.pill-dot]:bg-danger',
        cancelled: 'bg-danger-soft text-danger [&_.pill-dot]:bg-danger',
        neutral: 'bg-surface-2 text-muted [&_.pill-dot]:bg-muted',
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
  children: React.ReactNode;
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