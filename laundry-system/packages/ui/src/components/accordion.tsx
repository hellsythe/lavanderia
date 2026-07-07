'use client';

import { ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { cn } from '../lib/cn';

/**
 * Accordion — design-system LavanderPro.
 * Grouped sections with collapsible bodies.
 */
export interface AccordionItem {
  id: string;
  title: string;
  meta?: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export interface AccordionProps {
  items: AccordionItem[];
  className?: string;
}

export function Accordion({ items, className }: AccordionProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {items.map((item) => (
        <AccordionRow key={item.id} item={item} />
      ))}
    </div>
  );
}

function AccordionRow({ item }: { item: AccordionItem }) {
  const [open, setOpen] = useState(item.defaultOpen ?? false);

  return (
    <div className="border border-border rounded-md bg-surface">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full flex items-center justify-between gap-2',
          'px-3 py-2.5',
          'text-[13px] font-bold text-fg text-left',
          'transition-colors duration-ui hover:bg-surface-2',
        )}
      >
        <span>{item.title}</span>
        <span className="flex items-center gap-2">
          {item.meta && <span className="text-meta text-muted font-normal">{item.meta}</span>}
          <ChevronDown
            className={cn(
              'h-4 w-4 text-muted transition-transform duration-slide',
              open && 'rotate-180',
            )}
          />
        </span>
      </button>
      {open && <div className="p-2 flex flex-col gap-2">{item.children}</div>}
    </div>
  );
}