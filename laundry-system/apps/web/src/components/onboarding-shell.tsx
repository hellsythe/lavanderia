'use client';

import { BrandIcon, Stepper, type StepperStep } from '@lavanderpro/ui';
import type { ReactNode } from 'react';

interface OnboardingShellProps {
  steps: StepperStep[];
  current: number;
  title: string;
  subtitle?: string;
  children: ReactNode;
}

/**
 * OnboardingShell — wrapper con la estética del design system (DESIGN.md §6):
 * - `.onboarding-card`: max-width 560px, padding 32px 28px
 * - Misma surface/border/shadow que las auth cards
 * - Stepper arriba con icono de marca + título + subtítulo
 */
export function OnboardingShell({
  steps,
  current,
  title,
  subtitle,
  children,
}: OnboardingShellProps) {
  return (
    <main id="main" className="min-h-screen bg-canvas flex items-start sm:items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-[560px] bg-surface border border-border rounded-md shadow-default p-7 sm:p-8 mt-4 sm:mt-0">
        <div className="flex items-center gap-3 mb-5">
          <BrandIcon size={36} />
          <div className="min-w-0">
            <h1 className="text-title font-bold text-fg">{title}</h1>
            {subtitle && <p className="text-meta text-muted">{subtitle}</p>}
          </div>
        </div>

        <div className="mb-6">
          <Stepper steps={steps} current={current} />
        </div>

        <div>{children}</div>
      </div>
    </main>
  );
}