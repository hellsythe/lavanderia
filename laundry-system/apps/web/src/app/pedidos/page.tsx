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
  Pagination,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@lavanderpro/ui';
import {
  CircleCheck,
  Clock,
  Inbox,
  Package,
  PackageCheck,
  Truck,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type { Order, OrderStatus } from '@lavanderpro/shared-types';
import { Sidebar } from '~/components/sidebar';
import { Topbar } from '~/components/topbar';
import {
  useChangeOrderStatus,
  useOrders,
} from '~/stores/orders-queries';
import { useAuth } from '~/stores/auth-store';

const STATUS_LABELS: Record<OrderStatus, string> = {
  received: 'Recibido',
  in_process: 'En proceso',
  ready: 'Listo',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

const STATUS_FILTERS: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'received', label: 'Recibidos' },
  { value: 'in_process', label: 'En proceso' },
  { value: 'ready', label: 'Listos' },
  { value: 'delivered', label: 'Entregados' },
  { value: 'cancelled', label: 'Cancelados' },
];

const NEXT_STATUS: Partial<Record<OrderStatus, { to: OrderStatus; label: string; icon: typeof Clock }>> = {
  received: { to: 'in_process', label: 'Iniciar proceso', icon: Clock },
  in_process: { to: 'ready', label: 'Marcar listo', icon: PackageCheck },
  ready: { to: 'delivered', label: 'Entregar', icon: Truck },
};

export default function PedidosPage() {
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const tenant = useAuth((s) => s.tenant);
  const changeStatus = useChangeOrderStatus();

  const apiParams = useMemo(
    () => ({
      status: filter === 'all' ? undefined : [filter],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    [filter, page],
  );

  const { data: orders = [], isLoading, error } = useOrders(apiParams);

  const total = orders.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const handleChange = (order: Order, to: OrderStatus) => {
    changeStatus.mutate({ id: order.id, status: to });
  };

  return (
    <div className="min-h-screen bg-canvas grid grid-cols-app">
      <Sidebar />
      <div className="min-w-0 flex flex-col">
        <Topbar title="Pedidos" breadcrumb={`${tenant?.name ?? ''} · Activos y recientes`} />
        <main id="main" className="flex-1 p-5 sm:p-6">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 flex-wrap">
                <CardTitle>Pedidos</CardTitle>
                <FilterGroup>
                  {STATUS_FILTERS.map((f) => (
                    <FilterPill
                      key={f.value}
                      active={filter === f.value}
                      onClick={() => {
                        setFilter(f.value);
                        setPage(1);
                      }}
                    >
                      {f.label}
                    </FilterPill>
                  ))}
                </FilterGroup>
              </div>
              <CardMeta>
                {isLoading ? 'Cargando…' : `${total} en total`}
              </CardMeta>
            </CardHeader>
            <CardBody className="p-0">
              {error ? (
                <EmptyState
                  icon={<XCircle className="text-danger" />}
                  title="Error al cargar pedidos"
                  description={error instanceof Error ? error.message : 'Error desconocido'}
                />
              ) : !isLoading && total === 0 ? (
                <EmptyState
                  icon={<Inbox />}
                  title="Sin pedidos"
                  description={
                    filter === 'all'
                      ? 'Aún no se han creado pedidos.'
                      : 'No hay pedidos en este estado.'
                  }
                />
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <tr>
                        <TableHead>N° Orden</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Prendas</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </tr>
                    </TableHeader>
                    <TableBody>
                      {orders.map((o) => {
                        const itemsCount = o.items.length;
                        const pieces = o.items.reduce(
                          (sum: number, i) => sum + (i.unit === 'piece' ? i.quantity : 0),
                          0,
                        );
                        const kg = o.items.reduce(
                          (sum: number, i) => sum + (i.unit === 'kg' ? i.quantity : 0),
                          0,
                        );
                        const next = NEXT_STATUS[o.status];
                        return (
                          <TableRow key={o.id}>
                            <TableCell className="font-mono text-[12px] text-muted">
                              {o.code}
                            </TableCell>
                            <TableCell className="font-semibold">{o.customerName}</TableCell>
                            <TableCell className="text-muted">
                              {itemsCount > 0
                                ? `${itemsCount} ${kg > 0 ? `· ${kg.toFixed(1)} kg` : ''} ${pieces > 0 ? `· ${pieces} pzas` : ''}`.trim()
                                : '—'}
                            </TableCell>
                            <TableCell>
                              <StatusPill status={o.status}>
                                {STATUS_LABELS[o.status]}
                              </StatusPill>
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              ${o.total.toLocaleString('es-MX')}
                            </TableCell>
                            <TableCell className="text-right">
                              {next && (
                                <button
                                  type="button"
                                  onClick={() => handleChange(o, next.to)}
                                  disabled={changeStatus.isPending}
                                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-sm bg-surface text-accent border border-border text-[12px] font-bold hover:bg-accent-soft transition-colors duration-ui disabled:opacity-60"
                                >
                                  <next.icon className="h-3 w-3" />
                                  {next.label}
                                </button>
                              )}
                              {o.status === 'in_process' && (
                                <button
                                  type="button"
                                  onClick={() => handleChange(o, 'cancelled')}
                                  disabled={changeStatus.isPending}
                                  aria-label="Cancelar pedido"
                                  className="ml-1 h-7 w-7 grid place-items-center rounded-sm text-muted hover:bg-danger-soft hover:text-danger transition-colors duration-ui"
                                >
                                  <XCircle className="h-3.5 w-3.5" />
                                </button>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  <Pagination
                    page={page}
                    totalPages={totalPages}
                    total={total}
                    pageSize={pageSize}
                    onPageChange={setPage}
                  />
                </>
              )}
            </CardBody>
          </Card>
        </main>
      </div>
    </div>
  );
}