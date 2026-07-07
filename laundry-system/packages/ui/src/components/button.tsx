'use client';

import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

/**
 * Button — design-system LavanderPro.
 *
 * Variants:
 * - primary: teal accent (--accent)
 * - secondary: surface + border
 * - ghost: transparent, used in cards
 * - danger: --danger
 * - outline: bordered teal accent
 */
const buttonStyles = cva(
  [
    'inline-flex items-center justify-center gap-1.5',
    'font-bold whitespace-nowrap',
    'transition-[background-color,color,border-color,transform,box-shadow] duration-ui',
    'disabled:opacity-70 disabled:pointer-events-none',
    'press',
  ].join(' '),
  {
    variants: {
      variant: {
        primary:
          'bg-accent text-accent-fg hover:bg-[#0d6960] active:bg-[#0a544c]',
        secondary:
          'bg-surface text-muted border border-border hover:bg-canvas hover:text-fg',
        ghost: 'bg-transparent text-fg hover:bg-canvas',
        danger:
          'bg-danger text-white hover:bg-[#b91c1c] active:bg-[#991b1b]',
        outline:
          'bg-surface text-accent border border-accent hover:bg-accent-soft',
      },
      size: {
        sm: 'h-7 px-2.5 rounded-sm text-[11px]',
        md: 'h-8 px-3 rounded-sm text-[12px]',
        lg: 'h-10 px-4 rounded-md text-[13px]',
        icon: 'h-[34px] w-[34px] rounded-icon',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonStyles> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        className={cn(buttonStyles({ variant, size }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';