'use client';

import { Droplets } from 'lucide-react';

export interface BrandIconProps {
  size?: number;
}

/**
 * BrandIcon — icon de marca oficial de LavanderPro.
 *
 * Replica el `assets/brand-icon.svg` extraído del design-system.
 * Gota blanca sobre cuadrado `--accent` (teal #0F766E), border-radius 8px.
 *
 * El color SIEMPRE es teal — fidelidad con DESIGN.md §2.
 * Para otras marcas usar un componente distinto en la app consumidora.
 */
export function BrandIcon({ size = 36 }: BrandIconProps) {
  return (
    <div
      className="grid place-items-center bg-accent text-accent-fg rounded-icon shrink-0"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Droplets
        style={{ width: size * 0.55, height: size * 0.55 }}
        strokeWidth={1.8}
      />
    </div>
  );
}