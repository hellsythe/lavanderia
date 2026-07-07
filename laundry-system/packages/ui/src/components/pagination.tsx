'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { HTMLAttributes } from 'react';
import { cn } from '../lib/cn';
import { Button } from './button';

export interface PaginationProps extends HTMLAttributes<HTMLDivElement> {
  page: number;
  totalPages: number;
  total: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
}

export function Pagination({
  page,
  totalPages,
  total,
  pageSize = 10,
  onPageChange,
  className,
  ...props
}: PaginationProps) {
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  return (
    <div
      className={cn(
        'flex items-center justify-between flex-wrap gap-2',
        'px-4 py-3 border-t border-border',
        className,
      )}
      {...props}
    >
      <span className="text-caption text-muted num">
        Mostrando {start}–{end} de {total} · Página {page} de {totalPages}
      </span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-3 w-3" />
          Anterior
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
        >
          Siguiente
          <ChevronRight className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}