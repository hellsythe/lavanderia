'use client';

import { forwardRef, type HTMLAttributes } from 'react';
import { cn } from '../lib/cn';

export interface SpinnerProps extends HTMLAttributes<HTMLSpanElement> {
  /**
   * Tamaño del spinner.
   * - `xs` (12px) — inline en texto / labels
   * - `sm` (14px) — dentro de botones primary
   * - `md` (16px) — dentro de input/botón medianos
   * - `lg` (24px) — secciones inline (cards)
   * - `xl` (32px) — pantalla completa / hidratación
   *
   * @default 'md'
   */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /**
   * Tono del spinner.
   * - `default` (--muted border, --accent top) — sobre fondo claro
   * - `inverse` (white/40 border, white top) — sobre fondo teal/oscuro (botones primary)
   * - `muted` (--border/60 border, --muted top) — deshabilitado / loading pasivo
   *
   * @default 'default'
   */
  tone?: 'default' | 'inverse' | 'muted';
  /**
   * Texto accesible (screen readers). Si se omite, usa "Cargando…".
   */
  label?: string;
}

const sizeMap = {
  xs: 'h-3 w-3 border',
  sm: 'h-3.5 w-3.5 border-2',
  md: 'h-4 w-4 border-2',
  lg: 'h-6 w-6 border-2',
  xl: 'h-8 w-8 border-2',
} as const;

const toneMap = {
  default: 'border-muted/30 border-t-accent',
  inverse: 'border-white/40 border-t-white',
  muted: 'border-border border-t-muted',
} as const;

/**
 * Spinner — design-system LavanderPro.
 *
 * Indicador de carga circular. Usar SIEMPRE en lugar del patrón inline
 * `<span className="inline-block h-X w-X border-2 border-muted/30 border-t-accent rounded-full animate-spin" />`.
 *
 * Reglas:
 * - Tamaño `xl` + `default` para "página hidratando" (full screen).
 * - Tamaño `sm` + `inverse` dentro de botones primary (submit en form).
 * - Tamaño `xs` o `sm` + `default` para inputs con loading inline.
 * - SIEMPRE pasarlo dentro de un contenedor centrado (flex items-center justify-center).
 */
export const Spinner = forwardRef<HTMLSpanElement, SpinnerProps>(
  ({ className, size = 'md', tone = 'default', label = 'Cargando…', ...props }, ref) => {
    return (
      <span
        ref={ref}
        role="status"
        aria-label={label}
        className={cn(
          'inline-block rounded-full animate-spin shrink-0',
          sizeMap[size],
          toneMap[tone],
          className,
        )}
        {...props}
      />
    );
  },
);
Spinner.displayName = 'Spinner';