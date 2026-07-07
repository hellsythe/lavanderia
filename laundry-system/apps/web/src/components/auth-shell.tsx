'use client';

import { Alert } from '@lavanderpro/ui';
import { type ReactNode } from 'react';
import { BrandIcon } from '@lavanderpro/ui';

/**
 * AuthShell — layout compartido para login/registro.
 *
 * Compone primitivos del design system (BrandIcon, Alert, Button, Input).
 *
 * **Dónde vive:** apps/web/components/auth-shell.tsx
 * **Por qué:** Es una composición específica de LavanderPro que une
 * BrandIcon + el form layout + el footer. NO es una primitiva reutilizable
 * fuera del producto — otros productos LavanderPro deberían tener su propio
 * AuthShell si replican este patrón.
 *
 * Si añades una primitiva nueva (ej. Tag, Chip, Toast) va en packages/ui,
 * no aquí.
 */
interface AuthShellProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
  alert?: { type: 'error' | 'success' | 'info' | 'warning'; message: string } | null;
}

export function AuthShell({ title, subtitle, children, footer, alert }: AuthShellProps) {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center px-4 py-6">
      <div className="w-full max-w-auth bg-surface border border-border rounded-md shadow-default p-7 sm:p-8">
        <div className="flex items-center gap-2.5 mb-7">
          <BrandIcon size={36} />
          <div className="flex flex-col">
            <span className="text-[17px] font-bold text-fg leading-tight tracking-[-0.01em]">
              LavanderPro
            </span>
            <span className="text-label uppercase text-muted leading-tight">Industrial</span>
          </div>
        </div>

        <h1 className="text-[22px] font-bold text-fg tracking-[-0.02em] mb-1.5">{title}</h1>
        <p className="text-nav text-muted mb-6">{subtitle}</p>

        {alert && (
          <Alert
            variant={alert.type}
            className="mb-4"
          >
            {alert.message}
          </Alert>
        )}

        {children}

        {footer && (
          <div className="mt-6 pt-5 border-t border-border text-center text-[13px] text-muted">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}