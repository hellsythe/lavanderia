'use client';

import {
  Card,
  CardBody,
  CardHeader,
  CardMeta,
  CardTitle,
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
import {
  CheckCircle2,
  Coins,
  PackageCheck,
  Sparkles,
  Timer,
  TrendingUp,
  Users,
} from 'lucide-react';
import { Sidebar } from '~/components/sidebar';
import { Topbar } from '~/components/topbar';

const ACTIVE_ORDERS = [
  { id: 'ORD-2847', code: 'ORD-2847', customer: 'María González', items: 8, total: 1240, status: 'proceso' as const, since: '08:15' },
  { id: 'ORD-2848', code: 'ORD-2848', customer: 'Roberto Sánchez', items: 4, total: 480, status: 'proceso' as const, since: '08:42' },
  { id: 'ORD-2849', code: 'ORD-2849', customer: 'Ana Martínez', items: 12, total: 1860, status: 'listo' as const, since: '07:30' },
  { id: 'ORD-2850', code: 'ORD-2850', customer: 'Luis Hernández', items: 6, total: 720, status: 'pendiente' as const, since: '09:10' },
  { id: 'ORD-2851', code: 'ORD-2851', customer: 'Patricia Ruiz', items: 3, total: 360, status: 'listo' as const, since: '07:55' },
  { id: 'ORD-2852', code: 'ORD-2852', customer: 'Jorge Vargas', items: 15, total: 2340, status: 'proceso' as const, since: '09:25' },
];

const HISTORY = [
  { id: 'ORD-2830', customer: 'Fernando Cruz', delivered: '07:15', total: 980 },
  { id: 'ORD-2831', customer: 'Silvia Moreno', delivered: '07:45', total: 1240 },
  { id: 'ORD-2832', customer: 'Andrés López', delivered: '08:00', total: 540 },
  { id: 'ORD-2833', customer: 'Gabriela Reyes', delivered: '08:20', total: 1620 },
  { id: 'ORD-2834', customer: 'Tomás Aguilar', delivered: '08:35', total: 780 },
];

const TOP_CLIENTS = [
  { name: 'Hotel Costa Bella', initials: 'HC', orders: 47, lastOrder: '04 jul' },
  { name: 'Spa Las Palmas', initials: 'SP', orders: 38, lastOrder: '05 jul' },
  { name: 'Restaurante El Patio', initials: 'RP', orders: 32, lastOrder: '03 jul' },
  { name: 'Gimnasio IronFit', initials: 'IF', orders: 28, lastOrder: '05 jul' },
  { name: 'Clínica Dental Plus', initials: 'CD', orders: 22, lastOrder: '02 jul' },
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
        <main id="main" className="flex-1 p-5 sm:p-6">
          <KpiStrip />

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mt-5">
            <div className="xl:col-span-2">
              <ActiveOrdersCard />
            </div>
            <div className="flex flex-col gap-5">
              <RevenueCard />
              <CycleTimeCard />
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 mt-5">
            <div className="xl:col-span-2">
              <HistoryCard />
            </div>
            <TopClientsCard />
          </div>
        </main>
      </div>
    </div>
  );
}

function KpiStrip() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      <KpiCard
        label="Pedidos Activos"
        value="24"
        delta={{ value: '+3 vs. ayer', direction: 'up' }}
        icon={<Sparkles className="h-4 w-4" />}
        iconTone="warning"
      />
      <KpiCard
        label="Ingresos Hoy"
        value="$4,280"
        delta={{ value: '+12% vs. ayer', direction: 'up' }}
        icon={<Coins className="h-4 w-4" />}
        iconTone="success"
      />
      <KpiCard
        label="Clientes Registrados"
        value="186"
        delta={{ value: '+5 esta semana', direction: 'up' }}
        icon={<Users className="h-4 w-4" />}
        iconTone="info"
      />
      <KpiCard
        label="Tiempo de Ciclo"
        value="42m"
        delta={{ value: '−4 min vs. meta', direction: 'up' }}
        icon={<Timer className="h-4 w-4" />}
        iconTone="purple"
      />
      <KpiCard
        label="Listos p/ entregar"
        value="9"
        delta={{ value: '2 pendientes', direction: 'neutral' }}
        icon={<PackageCheck className="h-4 w-4" />}
        iconTone="accent"
      />
    </div>
  );
}

function ActiveOrdersCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <CardTitle>Pedidos Activos</CardTitle>
          <FilterGroup>
            <FilterPill active>Todos</FilterPill>
            <FilterPill>En proceso</FilterPill>
            <FilterPill>Listo</FilterPill>
            <FilterPill>Pendiente</FilterPill>
          </FilterGroup>
        </div>
        <CardMeta>{ACTIVE_ORDERS.length} en vuelo</CardMeta>
      </CardHeader>
      <CardBody className="p-0">
        <Table>
          <TableHeader>
            <tr>
              <TableHead>N° Orden</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Prendas</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Desde</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {ACTIVE_ORDERS.map((o) => (
              <TableRow key={o.id} tabIndex={0} role="button" className="cursor-pointer">
                <TableCell className="font-mono text-[12px] text-muted">{o.code}</TableCell>
                <TableCell className="font-semibold">{o.customer}</TableCell>
                <TableCell className="text-muted">{o.items} pzas</TableCell>
                <TableCell>
                  <StatusPill status={o.status}>
                    {o.status === 'proceso' && 'En proceso'}
                    {o.status === 'listo' && 'Listo'}
                    {o.status === 'pendiente' && 'Pendiente'}
                  </StatusPill>
                </TableCell>
                <TableCell className="text-right font-semibold">
                  ${o.total.toLocaleString('es-MX')}
                </TableCell>
                <TableCell className="text-right font-mono text-[12px] text-muted">
                  {o.since}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardBody>
    </Card>
  );
}

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
          +18% vs. semana anterior
        </CardMeta>
      </CardHeader>
      <CardBody>
        <div className="text-display-revenue text-fg num mb-1">$28,940</div>
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

function HistoryCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Historial de Pedidos</CardTitle>
        <CardMeta>Entregados hoy</CardMeta>
      </CardHeader>
      <CardBody className="p-0">
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
            {HISTORY.map((h) => (
              <TableRow key={h.id}>
                <TableCell className="font-mono text-[12px] text-muted">{h.id}</TableCell>
                <TableCell className="font-semibold">{h.customer}</TableCell>
                <TableCell className="font-mono text-[12px] text-muted">{h.delivered}</TableCell>
                <TableCell className="text-right font-semibold">
                  ${h.total.toLocaleString('es-MX')}
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
          totalPages={4}
          total={HISTORY.length + 7}
          onPageChange={() => {}}
        />
      </CardBody>
    </Card>
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
                <div className="text-meta text-muted">Último: {c.lastOrder}</div>
              </div>
              <div className="text-right">
                <div className="text-[15px] font-bold text-accent num">{c.orders}</div>
                <div className="text-label uppercase text-muted">Pedidos</div>
              </div>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}