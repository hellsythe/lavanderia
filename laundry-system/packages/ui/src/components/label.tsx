'use client';

import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type LabelHTMLAttributes } from 'react';
import { cn } from '../lib/cn';

const labelStyles = cva('', {
  variants: {
    variant: {
      caps: 'label-caps',
      field:
        'block text-[12px] font-semibold text-fg mb-1',
    },
  },
  defaultVariants: {
    variant: 'field',
  },
});

export interface LabelProps
  extends LabelHTMLAttributes<HTMLLabelElement>,
    VariantProps<typeof labelStyles> {}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, variant, ...props }, ref) => (
    <label ref={ref} className={cn(labelStyles({ variant }), className)} {...props} />
  ),
);
Label.displayName = 'Label';