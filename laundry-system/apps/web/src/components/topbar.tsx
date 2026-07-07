'use client';

import { Bell, Calendar, Menu, Search } from 'lucide-react';
import { IconButton } from '@lavanderpro/ui';

interface TopbarProps {
  title: string;
  breadcrumb?: string;
  onMenuClick?: () => void;
}

export function Topbar({ title, breadcrumb, onMenuClick }: TopbarProps) {
  const today = new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <header className="sticky top-0 z-20 h-topbar-h bg-surface border-b border-border flex items-center gap-3 px-4 sm:px-5">
      <button
        type="button"
        aria-label="Abrir menú"
        onClick={onMenuClick}
        className="md:hidden h-11 w-11 inline-flex items-center justify-center text-fg"
      >
        <Menu className="h-4 w-4" />
      </button>

      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-2">
          <h1 className="text-title font-bold text-fg truncate">{title}</h1>
          {breadcrumb && (
            <span className="text-caption text-muted hidden sm:inline">· {breadcrumb}</span>
          )}
        </div>
      </div>

      <div className="flex-1" />

      <div className="hidden md:flex items-center gap-1.5 text-caption text-muted">
        <Calendar className="h-3.5 w-3.5" />
        <span className="capitalize">{today}</span>
      </div>

      <div className="relative hidden sm:block">
        <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted pointer-events-none" />
        <input
          type="search"
          placeholder="Buscar pedido, cliente…"
          className="h-7 w-[200px] pl-7 pr-2 bg-surface-2 text-[12px] border border-border rounded-sm placeholder:text-muted focus:bg-surface focus:border-accent focus:shadow-focus-ring focus:outline-none transition-[border-color,background-color,box-shadow] duration-ui"
        />
      </div>

      <IconButton ariaLabel="Notificaciones" icon={<Bell />} badge={3} />
    </header>
  );
}