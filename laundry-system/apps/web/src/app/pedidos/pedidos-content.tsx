'use client';

import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardMeta,
  CardTitle,
  EmptyState,
  FilterGroup,
  FilterPill,
  IconButton,
  Pagination,
  SearchInput,
  Spinner,
  StatusPill,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@lavanderpro/ui';
import type { Order, OrderStatus } from '@lavanderpro/shared-types';
import {
  Inbox,
  PackageCheck,
  Truck,
  XCircle,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Sidebar } from '~/components/sidebar';
import { Topbar } from '~/components/topbar';
import { useAuth } from '~/stores/auth-store';
import {
  useChangeOrderStatus,
  useOrders,
} from '~/stores/orders-queries';

const STATUS_LABELS: Record<OrderStatus, string> = {
  received: 'Recibido',
  in_process: 'En proceso',
  ready: 'Listo',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

// Filtros de estado: "all" = sin filtro (muestra los activos+recientes).
const STATUS_FILTERS: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Todos' },
  { value: 'received', label: 'Recibidos' },
  { value: 'in_process', label: 'En proceso' },
  { value: 'ready', label: 'Listos' },
  { value: 'delivered', label: 'Entregados' },
  { value: 'cancelled', label: 'Cancelados' },
];

// Transición de estado "happy path": recibido → en proceso → listo → entregado.
// (Cancelar es la rama de salida y se muestra por separado.)
const NEXT_STATUS: Partial<
  Record<OrderStatus, { to: OrderStatus; label: string; icon: typeof PackageCheck }>
> = {
  received: { to: 'in_process', label: 'Iniciar proceso', icon: PackageCheck },
  in_process: { to: 'ready', label: 'Marcar listo', icon: PackageCheck },
  ready: { to: 'delivered', label: 'Entregar', icon: Truck },
};

const PAGE_SIZE = 20;

/**
 * PedidosContent — gestión de pedidos.
 *
 * Sigue el patrón canónico de admin pages (DESIGN.md §6 + skill
 * lavanderpro-admin-ui): AppShell + PageHeader + Card + SearchInput +
 * FilterGroup (filtros de estado) + Table con acciones inline.
 *
 * Diferencias con categorías/servicios/clientes:
 * - Sin "Nuevo" — los pedidos se crean desde el POS.
 * - Acciones de fila no son edit/delete estándar: son cambio de estado
 *   (avanzar al siguiente, o cancelar). Mismas IconButton + Button
 *   que el resto, sin perder consistencia visual.
 * - Paginación incluida (los pedidos pueden ser muchos).
 */
export function PedidosContent() {
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);

  const tenant = useAuth((s) => s.tenant);
  const changeStatus = useChangeOrderStatus();

  const apiParams = useMemo(
    () => ({
      status: filter === 'all' ? undefined : [filter],
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    }),
    [filter, page],
  );

  const { data: orders = [], isLoading, error } = useOrders(apiParams);

  // Filtro client-side adicional por texto (code, customerName, notes).
  // El server ya filtra por status; este filtro es puramente UX local
  // (no round-trip al server).
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.code.toLowerCase().includes(q) ||
        o.customerName.toLowerCase().includes(q) ||
        (o.notes ?? '').toLowerCase().includes(q),
    );
  }, [orders, query]);

  const total = orders.length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const handleChange = (order: Order, to: OrderStatus) => {
    changeStatus.mutate({ id: order.id, status: to });
  };

  return (
    <AppShell>
      <main id="main" className="flex-1 p-5 sm:p-6">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3 flex-wrap">
              <CardTitle>Listado</CardTitle>
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
              <SearchInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onClear={query ? () => setQuery('') : undefined}
                placeholder="Buscar por código, cliente o notas…"
              />
            </div>
            <CardMeta>
              {isLoading
                ? '…'
                : `${filtered.length} resultado${filtered.length === 1 ? '' : 's'}`}
            </CardMeta>
          </CardHeader>
          <CardBody className="p-0">
            {error ? (
              <EmptyState
                icon={<XCircle className="text-danger" />}
                title="Error al cargar pedidos"
                description={error instanceof Error ? error.message : 'Error desconocido'}
              />
            ) : !isLoading && filtered.length === 0 ? (
              <EmptyState
                icon={<Inbox />}
                title={query || filter !== 'all' ? 'Sin resultados' : 'Sin pedidos'}
                description={
                  query
                    ? 'Probá con otro término o filtro.'
                    : filter !== 'all'
                      ? 'No hay pedidos en este estado.'
                      : 'Aún no se han creado pedidos.'
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
                    {filtered.map((o) => {
                      const itemsCount = o.items.length;
                      const pieces = o.items.reduce(
                        (sum, i) => sum + (i.unit === 'piece' ? i.quantity : 0),
                        0,
                      );
                      const kg = o.items.reduce(
                        (sum, i) => sum + (i.unit === 'kg' ? i.quantity : 0),
                        0,
                      );
                      const next = NEXT_STATUS[o.status];
                      return (
                        <TableRow key={o.id}>
                          <TableCell className="font-mono text-[12px] text-muted">
                            {o.code}
                          </TableCell>
                          <TableCell className="font-semibold">
                            {o.customerName}
                          </TableCell>
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
                          <TableCell className="text-right num font-semibold">
                            ${o.total.toLocaleString('es-MX')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="inline-flex items-center gap-1">
                              {next && (
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => handleChange(o, next.to)}
                                  disabled={changeStatus.isPending}
                                >
                                  <next.icon className="h-3 w-3" />
                                  {next.label}
                                </Button>
                              )}
                              {o.status === 'in_process' && (
                                <IconButton
                                  icon={<XCircle className="h-3.5 w-3.5" />}
                                  ariaLabel="Cancelar pedido"
                                  onClick={() => handleChange(o, 'cancelled')}
                                  disabled={changeStatus.isPending}
                                />
                              )}
                            </div>
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
                  pageSize={PAGE_SIZE}
                  onPageChange={setPage}
                />
              </>
            )}
          </CardBody>
        </Card>
      </main>
    </AppShell>
  );
}

/* =========================================================================
 * AppShell — wrapper local con Sidebar + Topbar (mismo patrón que
 * categorías / servicios / clientes).
 * ========================================================================= */

function AppShell({ children }: { children: React.ReactNode }) {
  const tenant = useAuth((s) => s.tenant);
  return (
    <div className="min-h-screen bg-canvas grid grid-cols-app">
      <Sidebar />
      <div className="min-w-0 flex flex-col">
        <Topbar title="Pedidos" breadcrumb={tenant?.name ?? 'Activos y recientes'} />
        {children}
      </div>
    </div>
  );
}