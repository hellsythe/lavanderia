'use client';

import {
  Card,
  CardBody,
  CardHeader,
  CardMeta,
  CardTitle,
  EmptyState,
  FilterGroup,
  FilterPill,
  KpiCard,
  Pagination,
  ProgressTrack,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  cn,
} from '@lavanderpro/ui';
import type { Order, OrderStatus } from '@lavanderpro/shared-types';
import {
  CheckCircle2,
  Coins,
  Inbox,
  PackageCheck,
  Sparkles,
  Timer,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Sidebar } from '~/components/sidebar';
import { Topbar } from '~/components/topbar';
import { OfflineBanner } from '~/components/offline-banner';
import {
  useChangeOrderStatus,
  useOrderCounts,
  useOrders,
} from '~/stores/orders-queries';

const STATUS_LABELS: Record<OrderStatus, string> = {
  received: 'Recibido',
  in_process: 'En proceso',
  ready: 'Listo',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

const TOP_CLIENTS = [
  { name: 'Hotel Costa Bella', initials: 'HC', orders: 47 },
  { name: 'Spa Las Palmas', initials: 'SP', orders: 38 },
  { name: 'Restaurante El Patio', initials: 'RP', orders: 32 },
  { name: 'Gimnasio IronFit', initials: 'IF', orders: 28 },
  { name: 'Clínica Dental Plus', initials: 'CD', orders: 22 },
];

const REVENUE_WEEK = [
  { day: 'L', value: 60 },
  { day: 'M', value: 78 },
  { day: 'M', value: 65 },
  { day: 'J', value: 88 },
  { day: 'V', value: 92 },
  { day: 'S', value: 100 },
  { day: 'D', value: 70 },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-canvas grid grid-cols-app">
      <Sidebar />
      <div className="min-w-0 flex flex-col">
        <Topbar title="Panel Principal" breadcrumb="Resumen de hoy" />
        <main id="main" className="flex-1 p-5 sm:p-6 flex flex-col gap-5">
          <OfflineBanner />
          <KpiStrip />
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 items-start">
            <div className="xl:col-span-2 flex flex-col gap-3">
              <ActiveOrdersCard />
              <RecentHistoryCard />
            </div>
            <div className="flex flex-col gap-3">
              <RevenueCard />
              <CycleTimeCard />
              <TopClientsCard />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/* --------------------------- KPI Strip --------------------------- */

function KpiStrip() {
  const { data: counts, isLoading } = useOrderCounts();

  const active =
    (counts?.received ?? 0) +
    (counts?.in_process ?? 0) +
    (counts?.ready ?? 0);

  // Heurística para KPIs secundarios hasta tener módulo de reportes
  const totalToday = (counts?.delivered ?? 0) * 320; // placeholder mientras no haya payments
  const cyclePct = 70;
  const cycleMin = 42;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      <KpiCard
        label="Pedidos Activos"
        value={isLoading ? '…' : String(active)}
        delta={{ value: 'En proceso + listos + recibidos', direction: 'neutral' }}
        icon={<Sparkles className="h-4 w-4" />}
        iconTone="warning"
      />
      <KpiCard
        label="Entregados Hoy"
        value={isLoading ? '…' : String(counts?.delivered ?? 0)}
        delta={{ value: 'Cierre del día en curso', direction: 'neutral' }}
        icon={<Coins className="h-4 w-4" />}
        iconTone="success"
      />
      <KpiCard
        label="Listos p/ entregar"
        value={isLoading ? '…' : String(counts?.ready ?? 0)}
        delta={{ value: 'Esperan recogida del cliente', direction: 'neutral' }}
        icon={<PackageCheck className="h-4 w-4" />}
        iconTone="accent"
      />
      <KpiCard
        label="Ingresos Hoy"
        value={`$${(totalToday || 0).toLocaleString('es-MX')}`}
        delta={{ value: 'Módulo payments pendiente', direction: 'neutral' }}
        icon={<Coins className="h-4 w-4" />}
        iconTone="info"
      />
      <KpiCard
        label="Tiempo de Ciclo"
        value={`${cycleMin}m`}
        delta={{ value: 'Módulo métricas pendiente', direction: 'neutral' }}
        icon={<Timer className="h-4 w-4" />}
        iconTone="purple"
      />
    </div>
  );
}

/* --------------------------- Active Orders --------------------------- */

function ActiveOrdersCard() {
  const [filter, setFilter] = useState<'all' | 'in_process' | 'ready' | 'received'>('all');
  const { data: orders = [], isLoading } = useOrders({
    status: filter === 'all' ? ['in_process', 'ready', 'received'] : [filter],
    limit: 8,
  });
  const total = orders.length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3 flex-wrap">
          <CardTitle>Pedidos Activos</CardTitle>
          <FilterGroup>
            <FilterPill active={filter === 'all'} onClick={() => setFilter('all')}>
              Todos
            </FilterPill>
            <FilterPill active={filter === 'in_process'} onClick={() => setFilter('in_process')}>
              En proceso
            </FilterPill>
            <FilterPill active={filter === 'ready'} onClick={() => setFilter('ready')}>
              Listo
            </FilterPill>
            <FilterPill active={filter === 'received'} onClick={() => setFilter('received')}>
              Recibido
            </FilterPill>
          </FilterGroup>
        </div>
        <CardMeta>{isLoading ? '…' : `${total} en vuelo`}</CardMeta>
      </CardHeader>
      <CardBody className="p-0">
        {!isLoading && orders.length === 0 ? (
          <EmptyState
            icon={<Inbox />}
            title="Sin pedidos en este estado"
            description="Cuando se creen pedidos activos aparecerán aquí."
          />
        ) : (
          <Table>
            <TableHeader>
              <tr>
                <TableHead>N° Orden</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Prendas</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </tr>
            </TableHeader>
            <TableBody>
              {(orders ?? []).map((o) => (
                <ActiveOrderRow key={o.id} order={o} />
              ))}
            </TableBody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}

function ActiveOrderRow({ order }: { order: Order }) {
  const changeStatus = useChangeOrderStatus();
  const pieces = order.items.reduce(
    (sum, i) => sum + (i.unit === 'piece' ? i.quantity : 0),
    0,
  );
  const kg = order.items.reduce(
    (sum, i) => sum + (i.unit === 'kg' ? i.quantity : 0),
    0,
  );

  const nextStatus: Record<OrderStatus, OrderStatus | null> = {
    received: 'in_process',
    in_process: 'ready',
    ready: 'delivered',
    delivered: null,
    cancelled: null,
  };
  const next = nextStatus[order.status];

  return (
    <TableRow
      tabIndex={0}
      role="button"
      onClick={() => {
        if (next) changeStatus.mutate({ id: order.id, status: next });
      }}
      onKeyDown={(e) => {
        if ((e.key === 'Enter' || e.key === ' ') && next) {
          e.preventDefault();
          changeStatus.mutate({ id: order.id, status: next });
        }
      }}
      className="cursor-pointer"
      aria-label={`Avanzar pedido ${order.code}`}
    >
      <TableCell className="font-mono text-[12px] text-muted">{order.code}</TableCell>
      <TableCell className="font-semibold">{order.customerName}</TableCell>
      <TableCell className="text-muted">
        {pieces > 0 ? `${pieces} pzas` : ''}
        {kg > 0 ? `${pieces > 0 ? ' · ' : ''}${kg.toFixed(1)} kg` : ''}
        {pieces === 0 && kg === 0 ? '—' : ''}
      </TableCell>
      <TableCell>
        <StatusPill status={order.status}>{STATUS_LABELS[order.status]}</StatusPill>
      </TableCell>
      <TableCell className="text-right font-semibold">
        ${order.total.toLocaleString('es-MX')}
      </TableCell>
    </TableRow>
  );
}

/* --------------------------- Recent History --------------------------- */

function RecentHistoryCard() {
  const { data: delivered = [], isLoading } = useOrders({ status: ['delivered'], limit: 5 });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pedidos Entregados Recientes</CardTitle>
        <CardMeta>
          {isLoading ? '…' : `${delivered.length} en el último mes`}
        </CardMeta>
      </CardHeader>
      <CardBody className="p-0">
        {!isLoading && delivered.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 />}
            title="Sin entregas recientes"
            description="Los pedidos entregados aparecerán aquí."
          />
        ) : (
          <>
            <Table>
              <TableHeader>
                <tr>
                  <TableHead>N° Orden</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Entregado</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {(delivered ?? []).map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono text-[12px] text-muted">
                      {o.code}
                    </TableCell>
                    <TableCell className="font-semibold">{o.customerName}</TableCell>
                    <TableCell className="font-mono text-[12px] text-muted">
                      {o.deliveredAt
                        ? new Date(o.deliveredAt).toLocaleTimeString('es-MX', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      ${o.total.toLocaleString('es-MX')}
                    </TableCell>
                    <TableCell className="text-right">
                      <StatusPill status="entregado">
                        <CheckCircle2 className="h-3 w-3" /> Entregado
                      </StatusPill>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pagination
              page={1}
              totalPages={Math.max(1, Math.ceil(delivered.length / 5))}
              total={delivered.length}
              onPageChange={() => {
                /* TODO: paginación real cuando se implemente reportes */
              }}
            />
          </>
        )}
      </CardBody>
    </Card>
  );
}

/* --------------------------- Static Cards --------------------------- */

function RevenueCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <CardTitle>Ingresos</CardTitle>
          <FilterGroup>
            <FilterPill>Día</FilterPill>
            <FilterPill active>Semana</FilterPill>
            <FilterPill>Mes</FilterPill>
          </FilterGroup>
        </div>
        <CardMeta>
          <TrendingUp className="inline h-3 w-3 mr-1 text-success" />
          Módulo payments pendiente
        </CardMeta>
      </CardHeader>
      <CardBody>
        <div className="text-display-revenue text-fg num mb-1">$—</div>
        <div className="text-meta text-muted mb-4">Esta semana · Lun–Dom</div>
        <div className="flex items-end gap-1.5 h-[88px]">
          {REVENUE_WEEK.map((bar, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <div className="w-full flex items-end h-[68px]">
                <div
                  className={cn(
                    'w-full rounded-t-sm transition-[height] duration-chart',
                    i === 5 ? 'bg-accent' : 'bg-border',
                  )}
                  style={{ height: `${bar.value}%`, minHeight: 3 }}
                />
              </div>
              <span className="text-bar text-muted num">{bar.day}</span>
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

function CycleTimeCard() {
  const pct = (42 / 60) * 100;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Tiempo de Ciclo Promedio</CardTitle>
        <CardMeta>Meta: 60 min</CardMeta>
      </CardHeader>
      <CardBody>
        <div className="flex items-baseline gap-2 mb-3">
          <div className="text-display-cycle text-fg num leading-none">42</div>
          <span className="text-meta text-muted font-semibold">min</span>
        </div>
        <ProgressTrack value={pct} />
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Stat label="Mínimo" value="28m" tone="success" />
          <Stat label="Máximo" value="71m" tone="danger" />
          <Stat label="Lavado" value="22m" tone="info" />
          <Stat label="Secado" value="20m" tone="warning" />
        </div>
      </CardBody>
    </Card>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: 'success' | 'danger' | 'info' | 'warning';
}) {
  const tones = {
    success: 'bg-success-soft text-success',
    danger: 'bg-danger-soft text-danger',
    info: 'bg-info-soft text-info',
    warning: 'bg-warning-soft text-warning',
  };
  return (
    <div className={cn('rounded-icon px-3 py-2', tones[tone])}>
      <div className="text-label uppercase opacity-80">{label}</div>
      <div className="text-[15px] font-bold num mt-0.5">{value}</div>
    </div>
  );
}

function TopClientsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Top Clientes</CardTitle>
        <CardMeta>Últimos 30 días</CardMeta>
      </CardHeader>
      <CardBody className="p-0">
        <ul className="divide-y divide-border">
          {TOP_CLIENTS.map((c) => (
            <li
              key={c.name}
              className="flex items-center gap-3 px-4 py-3 hover:bg-surface-2 transition-colors duration-fast"
            >
              <div className="h-9 w-9 rounded-full bg-accent-soft text-accent flex items-center justify-center font-bold text-[12px]">
                {c.initials}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-fg truncate">{c.name}</div>
                <div className="text-meta text-muted">{c.orders} pedidos</div>
              </div>
              <div className="text-right">
                <div className="text-[15px] font-bold text-accent num">{c.orders}</div>
                <div className="text-label uppercase text-muted">Pedidos</div>
              </div>
            </li>
          ))}
        </ul>
        <div className="px-4 py-3 border-t border-border text-center">
          <span className="text-meta text-muted">
            <Users className="inline h-3 w-3 mr-1" />
            Módulo de reportes próximamente
          </span>
        </div>
      </CardBody>
    </Card>
  );
}