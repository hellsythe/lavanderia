'use client';

import { Check } from 'lucide-react';
import { cn } from '../lib/cn';

export interface StepperStep {
  id: string;
  label: string;
}

export interface StepperProps {
  steps: StepperStep[];
  current: number; // 0-based
  className?: string;
}

export function Stepper({ steps, current, className }: StepperProps) {
  const total = steps.length;
  const progress = (current / (total - 1)) * 100;

  return (
    <div className={cn('w-full', className)}>
      <div
        className="relative h-1 bg-border rounded-sm overflow-hidden mb-4"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={total}
        aria-valuenow={current + 1}
        aria-label="Progreso de configuración"
      >
        <div
          className="absolute inset-y-0 left-0 bg-accent transition-[width] duration-lift"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex items-center justify-between">
        {steps.map((step, idx) => {
          const state =
            idx < current ? 'completed' : idx === current ? 'active' : 'pending';
          return (
            <div
              key={step.id}
              className="flex flex-col items-center gap-1.5 flex-1"
              aria-current={state === 'active' ? 'step' : undefined}
            >
              <div
                className={cn(
                  'h-7 w-7 rounded-full flex items-center justify-center',
                  'text-[12px] font-bold leading-none',
                  'transition-colors duration-ui',
                  state === 'completed' && 'bg-accent text-accent-fg',
                  state === 'active' && 'bg-accent text-accent-fg',
                  state === 'pending' && 'bg-surface text-muted border border-border',
                )}
              >
                {state === 'completed' ? <Check className="h-3.5 w-3.5" /> : idx + 1}
              </div>
              <span
                className={cn(
                  'text-label uppercase text-center',
                  state === 'active' ? 'text-accent' : 'text-muted',
                )}
              >
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}