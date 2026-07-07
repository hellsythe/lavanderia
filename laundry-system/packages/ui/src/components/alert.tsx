'use client';

import { AlertCircle, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import { type ReactNode } from 'react';
import { cn } from '../lib/cn';

/**
 * Alert — design-system LavanderPro.
 *
 * Replica del `<div class="alert alert-error">` documentado en
 * ../design-system/DESIGN.md §6.
 *
 * Variantes:
 * - error   → danger-soft / danger (errores de validación, server errors)
 * - success → success-soft / success (operación exitosa)
 * - info    → info-soft / info (notificaciones neutrales)
 * - warning → warning-soft / warning (advertencias antes de acción destructiva)
 *
 * Idiomatic: <Alert variant="error">{message}</Alert>
 * Custom icon: <Alert variant="success" icon={<CustomIcon />}>...</Alert>
 */
export interface AlertProps {
  variant?: 'error' | 'success' | 'info' | 'warning';
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
  /** Hide the icon entirely (e.g. for icon-less alerts) */
  noIcon?: boolean;
}

const variants = {
  error: {
    wrap: 'bg-danger-soft text-danger',
    Icon: AlertCircle,
  },
  success: {
    wrap: 'bg-success-soft text-success',
    Icon: CheckCircle2,
  },
  info: {
    wrap: 'bg-info-soft text-info',
    Icon: Info,
  },
  warning: {
    wrap: 'bg-warning-soft text-warning',
    Icon: AlertTriangle,
  },
} as const;

export function Alert({ variant = 'error', children, icon, className, noIcon }: AlertProps) {
  const IconCmp = icon
    ? null
    : (variants[variant].Icon as unknown as typeof AlertCircle);

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={cn(
        'flex items-start gap-2',
        'p-2.5 rounded-md',
        'text-[13px] font-semibold',
        variants[variant].wrap,
        className,
      )}
    >
      {!noIcon && (
        <span className="shrink-0 mt-px [&_svg]:h-4 [&_svg]:w-4">
          {icon ?? (IconCmp && <IconCmp />)}
        </span>
      )}
      <span className="flex-1 min-w-0">{children}</span>
    </div>
  );
}