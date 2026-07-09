'use client';

import type { ReactNode } from 'react';
import { cn } from '../lib/cn';

export interface PageHeaderProps {
  /** Ícono lucide (20px). Se muestra dentro de un cuadrado teal 36×36. */
  icon: ReactNode;
  /** Título del módulo (text-card, font-bold). Una sola línea. */
  title: string;
  /** Subtítulo (text-meta, text-muted). Una sola línea. */
  subtitle?: string;
  /** Acción primaria alineada a la derecha (típicamente un `<Button>`). */
  action?: ReactNode;
  className?: string;
}

/**
 * PageHeader — design-system LavanderPro.
 *
 * Bloque estándar de header de página para admin pages:
 *   [ícono teal] [Título + subtítulo] ............... [acción primaria]
 *
 * Patrón canónico: AppShell > Topbar > main > PageHeader > Card > contenido.
 * Usar SIEMPRE en lugar de construir el header inline — garantiza
 * consistencia entre módulos (categorías, servicios, clientes, etc).
 */
export function PageHeader({ icon, title, subtitle, action, className }: PageHeaderProps) {
  return (
    <div className={cn('flex items-center justify-between gap-3 flex-wrap mb-5', className)}>
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-icon bg-accent-soft text-accent flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="text-card font-bold text-fg">{title}</h2>
          {subtitle && <p className="text-meta text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}