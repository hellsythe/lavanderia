'use client';

import { useNetworkStore, useSyncStore } from '@lavanderpro/sync-engine';
import { CheckCircle2, CloudOff, RefreshCw, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';

export function SyncIndicator() {
  const network = useNetworkStore((s) => s.state);
  const pending = useSyncStore((s) => s.pendingCount);
  const isSyncing = useSyncStore((s) => s.isSyncing);
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);

  // Tick para que "hace X min" se actualice
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const isOffline = network === 'offline';
  const isSyncing_ = isSyncing || network === 'syncing';

  let icon, label, color, bg;
  if (isOffline) {
    icon = <CloudOff className="h-3.5 w-3.5" />;
    label = pending > 0
      ? `Sin conexión — ${pending} en cola`
      : 'Sin conexión';
    color = 'text-warning';
    bg = 'bg-warning-soft';
  } else if (isSyncing_) {
    icon = (
      <RefreshCw
        className="h-3.5 w-3.5 animate-spin"
        aria-label="Sincronizando"
      />
    );
    label = pending > 0
      ? `Sincronizando ${pending}…`
      : 'Sincronizando…';
    color = 'text-info';
    bg = 'bg-info-soft';
  } else if (pending > 0) {
    icon = <RefreshCw className="h-3.5 w-3.5" />;
    label = `${pending} pendiente${pending > 1 ? 's' : ''}`;
    color = 'text-warning';
    bg = 'bg-warning-soft';
  } else {
    icon = <CheckCircle2 className="h-3.5 w-3.5" />;
    label = lastSyncAt > 0
      ? `Sincronizado ${formatRelative(lastSyncAt)}`
      : 'Sincronizado';
    color = 'text-success';
    bg = 'bg-success-soft';
  }

  return (
    <div
      className={`flex items-center gap-1.5 h-7 px-2.5 rounded-pill text-[12px] font-bold ${color} ${bg}`}
      title={label}
    >
      {isOffline ? icon : <Wifi className="h-3.5 w-3.5" />}
      <span className="hidden md:inline">{label}</span>
    </div>
  );
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 60_000) return 'hace un momento';
  if (diff < 3_600_000) return `hace ${Math.floor(diff / 60_000)} min`;
  if (diff < 86_400_000) return `hace ${Math.floor(diff / 3_600_000)} h`;
  return new Date(ts).toLocaleDateString('es-MX');
}