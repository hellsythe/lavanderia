'use client';

import { Minus, Plus } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';

/**
 * ServiceCard — design-system LavanderPo (POS).
 *
 * Card seleccionable con checkbox, info, precio unitario y stepper.
 * Estado activo: borde --accent + fondo --accent-soft.
 */
export interface ServiceCardProps {
  id: string;
  name: string;
  description?: string;
  unit: 'kg' | 'piece';
  unitPrice: number;
  quantity: number;
  icon?: ReactNode;
  onQuantityChange: (qty: number) => void;
}

export function ServiceCard({
  id,
  name,
  description,
  unit,
  unitPrice,
  quantity,
  icon,
  onQuantityChange,
}: ServiceCardProps) {
  const selected = quantity > 0;
  const unitLabel = unit === 'kg' ? 'kg' : 'pz';
  const priceLabel = `$${unitPrice.toLocaleString('es-MX')} / ${unitLabel}`;

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-3',
        'border rounded-md bg-surface',
        'transition-[border-color,background-color] duration-ui',
        selected
          ? 'border-accent bg-accent-soft'
          : 'border-border hover:border-muted',
      )}
    >
      <input
        type="checkbox"
        id={`svc-${id}`}
        checked={selected}
        onChange={(e) => onQuantityChange(e.target.checked ? 1 : 0)}
        className="mt-1 h-3.5 w-3.5 accent-[var(--accent)] cursor-pointer"
      />

      {icon && (
        <div
          className={cn(
            'h-9 w-9 rounded-icon flex items-center justify-center shrink-0',
            selected ? 'bg-accent text-accent-fg' : 'bg-surface-2 text-muted',
          )}
        >
          {icon}
        </div>
      )}

      <label
        htmlFor={`svc-${id}`}
        className="flex-1 min-w-0 cursor-pointer"
      >
        <div className="text-[13px] font-semibold text-fg">{name}</div>
        {description && (
          <div className="text-meta text-muted mt-0.5 line-clamp-2">{description}</div>
        )}
        <div className="text-meta font-bold text-fg num mt-1">{priceLabel}</div>
      </label>

      {selected && (
        <Stepper
          value={quantity}
          onChange={onQuantityChange}
          unit={unitLabel}
        />
      )}
    </div>
  );
}

interface StepperProps {
  value: number;
  onChange: (n: number) => void;
  unit: string;
  min?: number;
  max?: number;
}

function Stepper({ value, onChange, unit, min = 0, max = 99 }: StepperProps) {
  const [local, setLocal] = useState(String(value));

  return (
    <div className="flex items-center bg-surface border border-border rounded-sm overflow-hidden">
      <button
        type="button"
        aria-label="Disminuir"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="h-7 w-7 flex items-center justify-center text-muted hover:bg-canvas hover:text-fg disabled:opacity-40 transition-colors duration-ui"
      >
        <Minus className="h-3 w-3" />
      </button>
      <input
        type="number"
        value={local}
        min={min}
        max={max}
        onChange={(e) => setLocal(e.target.value)}
        onBlur={() => {
          const n = Number(local);
          if (Number.isFinite(n)) onChange(Math.max(min, Math.min(max, n)));
          else setLocal(String(value));
        }}
        className="w-12 h-7 text-center text-[13px] font-semibold num bg-transparent border-x border-border focus:outline-none focus:bg-accent-soft"
      />
      <button
        type="button"
        aria-label="Aumentar"
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="h-7 w-7 flex items-center justify-center text-muted hover:bg-canvas hover:text-fg disabled:opacity-40 transition-colors duration-ui"
      >
        <Plus className="h-3 w-3" />
      </button>
      <span className="px-2 text-meta text-muted">{unit}</span>
    </div>
  );
}