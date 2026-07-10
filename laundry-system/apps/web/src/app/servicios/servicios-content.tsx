'use client';

import {
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardMeta,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  IconButton,
  Input,
  Label,
  Modal,
  PageHeader,
  SearchInput,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Textarea,
} from '@lavanderpro/ui';
import {
  CreateServiceInputSchema,
  type ServiceUnit,
  type UpdateServiceInput,
} from '@lavanderpro/shared-types';
import type { CategorySnapshot, ServiceSnapshot } from '@lavanderpro/db-client';
import { Box, Inbox, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Sidebar } from '~/components/sidebar';
import { Topbar } from '~/components/topbar';
import { OfflineBanner } from '~/components/offline-banner';
import { useAuth } from '~/stores/auth-store';
import { useCategories } from '~/stores/categories-queries';
import {
  useCreateService,
  useDeleteService,
  useServices,
  useUpdateService,
} from '~/stores/services-queries';

type FormData = {
  name: string;
  description?: string;
  categoryId?: string | null;
  unit: ServiceUnit;
  unitPrice: number;
  minQuantity: number;
  active: boolean;
};

const UNIT_OPTIONS: { value: ServiceUnit; label: string; short: string }[] = [
  { value: 'kg', label: 'Kilogramo', short: 'kg' },
  { value: 'piece', label: 'Pieza', short: 'pz' },
];

/**
 * ServiciosContent — UI CRUD completa de Service.
 *
 * Sigue el patrón canónico de admin pages (DESIGN.md §6 + skill
 * lavanderpro-admin-ui). Service pertenece a una categoría, tiene
 * descripción, precio, unidad (kg|piece) y cantidad mínima.
 *
 * Offline-first: mutations aplican al cache local primero (Dexie) y
 * luego se encolan para sync.
 */
export function ServiciosContent() {
  const tenant = useAuth((s) => s.tenant);
  const hydrated = useAuth((s) => s.hydrated);
  const tenantId = tenant?.id;

  const { data, isLoading } = useServices({ tenantId });
  const services: ServiceSnapshot[] = data ?? [];
  // Categorías — para el selector del form y filtro (offline-first).
  const { data: catData } = useCategories({ tenantId });
  const categories = catData ?? [];

  const createMut = useCreateService(tenantId ?? '');
  const updateMut = useUpdateService(tenantId ?? '');
  const deleteMut = useDeleteService(tenantId ?? '');

  const [editing, setEditing] = useState<ServiceSnapshot | null>(null);
  const [openingCreate, setOpeningCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filtros
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return services
      .filter((s) => categoryFilter === 'all' || s.categoryId === categoryFilter)
      .filter(
        (s) =>
          !q ||
          s.name.toLowerCase().includes(q) ||
          (s.description ?? '').toLowerCase().includes(q),
      )
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }, [services, query, categoryFilter]);

  if (!hydrated) {
    return (
      <AppShell>
        <main id="main" className="flex-1 p-5 sm:p-6 flex items-center justify-center">
          <Spinner size="xl" />
        </main>
      </AppShell>
    );
  }

  if (!tenantId) {
    return (
      <AppShell>
        <main id="main" className="flex-1 p-5 sm:p-6">
          <Alert variant="error">No hay tenant activo. Volvé a iniciar sesión.</Alert>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <main id="main" className="flex-1 p-5 sm:p-6">
        <OfflineBanner />
        <PageHeader
          icon={<Box className="h-5 w-5" />}
          title="Servicios"
          subtitle="Tu catálogo de servicios: precio, unidad y cantidad mínima."
          action={
            <Button onClick={() => setOpeningCreate(true)}>
              <Plus className="h-3.5 w-3.5" />
              Nuevo servicio
            </Button>
          }
        />

        <Card>
          <CardHeader>
            <div className="flex items-center gap-3 flex-wrap">
              <CardTitle>Listado</CardTitle>
              <SearchInput
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onClear={query ? () => setQuery('') : undefined}
                placeholder="Buscar servicio…"
              />
              {categories.length > 0 && (
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="h-7 px-2 bg-surface-2 text-[12px] text-fg border border-border rounded-sm focus:bg-surface focus:border-accent focus:shadow-focus-ring focus:outline-none transition-colors"
                  aria-label="Filtrar por categoría"
                >
                  <option value="all">Todas las categorías</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <CardMeta>
              {isLoading
                ? '…'
                : `${filtered.length} resultado${filtered.length === 1 ? '' : 's'}`}
            </CardMeta>
          </CardHeader>
          <CardBody className="p-0">
            {!isLoading && filtered.length === 0 ? (
              <EmptyState
                icon={<Inbox />}
                title={
                  query || categoryFilter !== 'all'
                    ? `Sin resultados`
                    : 'Sin servicios'
                }
                description={
                  query || categoryFilter !== 'all'
                    ? 'Probá con otro término o filtro.'
                    : 'Creá tu primer servicio para empezar a operar.'
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <tr>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead className="text-right">Precio</TableHead>
                    <TableHead className="text-center">Unidad</TableHead>
                    <TableHead className="text-right">Mín.</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {filtered.map((s) => {
                    const cat = categories.find((c) => c.id === s.categoryId);
                    const unit = UNIT_OPTIONS.find((u) => u.value === s.unit)?.short ?? s.unit;
                    return (
                      <TableRow key={s.id}>
                        <TableCell>
                          <div className="font-semibold">{s.name}</div>
                          {s.description && (
                            <div className="text-meta text-muted line-clamp-1">
                              {s.description}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-meta text-muted">
                          {cat?.name ?? '—'}
                        </TableCell>
                        <TableCell className="text-right num">
                          ${s.unitPrice.toLocaleString('es-MX')}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center justify-center min-w-[32px] h-5 px-2 rounded-pill bg-surface-2 text-meta text-fg font-bold">
                            /{unit}
                          </span>
                        </TableCell>
                        <TableCell className="text-right num text-muted">
                          {s.minQuantity}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center gap-1">
                            <IconButton
                              icon={<Pencil className="h-3.5 w-3.5" />}
                              ariaLabel={`Editar ${s.name}`}
                              onClick={() => setEditing(s)}
                            />
                            <IconButton
                              icon={<Trash2 className="h-3.5 w-3.5" />}
                              ariaLabel={`Eliminar ${s.name}`}
                              onClick={() => setDeletingId(s.id)}
                            />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>

        <ServiceFormModal
          open={openingCreate || editing !== null}
          categories={categories}
          initial={editing ?? undefined}
          onClose={() => {
            setOpeningCreate(false);
            setEditing(null);
          }}
          onSubmit={async (data) => {
            if (editing) {
              const updatePayload: UpdateServiceInput = {
                name: data.name,
                description: data.description ?? undefined,
                categoryId: data.categoryId ?? undefined,
                unit: data.unit,
                unitPrice: data.unitPrice,
                minQuantity: data.minQuantity,
                active: data.active,
              };
              await updateMut.mutateAsync({ id: editing.id, input: updatePayload });
            } else {
              await createMut.mutateAsync({
                name: data.name,
                description: data.description,
                categoryId: data.categoryId ?? null,
                unit: data.unit,
                unitPrice: data.unitPrice,
                minQuantity: data.minQuantity,
                active: data.active,
              });
            }
            setOpeningCreate(false);
            setEditing(null);
          }}
          submitting={createMut.isPending || updateMut.isPending}
        />

        <ConfirmDialog
          open={deletingId !== null}
          onOpenChange={(o) => !o && setDeletingId(null)}
          title="Eliminar servicio"
          description="Esta acción no se puede deshacer. El servicio dejará de estar disponible en el POS y los pedidos históricos lo conservarán por nombre."
          confirmTone="danger"
          confirmLabel="Eliminar"
          pendingLabel="Eliminando…"
          pending={deleteMut.isPending}
          onConfirm={async () => {
            if (!deletingId) return;
            await deleteMut.mutateAsync(deletingId);
            setDeletingId(null);
          }}
        />
      </main>
    </AppShell>
  );
}

/* =========================================================================
 * AppShell — wrapper local con Sidebar + Topbar. App-specific (no DS).
 * ========================================================================= */

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas grid grid-cols-app">
      <Sidebar />
      <div className="min-w-0 flex flex-col">
        <Topbar title="Servicios" breadcrumb="Catálogo" />
        {children}
      </div>
    </div>
  );
}

/* =========================================================================
 * Form Modal — create / edit
 * ========================================================================= */

function ServiceFormModal({
  open,
  categories,
  initial,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  categories: CategorySnapshot[];
  initial?: ServiceSnapshot;
  onClose: () => void;
  onSubmit: (data: FormData) => Promise<void>;
  submitting: boolean;
}) {
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(CreateServiceInputSchema),
    defaultValues: {
      name: initial?.name ?? '',
      description: initial?.description ?? '',
      categoryId: initial?.categoryId ?? null,
      unit: initial?.unit ?? 'piece',
      unitPrice: initial?.unitPrice ?? 0,
      minQuantity: initial?.minQuantity ?? 1,
      active: initial?.active ?? true,
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: initial?.name ?? '',
        description: initial?.description ?? '',
        categoryId: initial?.categoryId ?? null,
        unit: initial?.unit ?? 'piece',
        unitPrice: initial?.unitPrice ?? 0,
        minQuantity: initial?.minQuantity ?? 1,
        active: initial?.active ?? true,
      });
    }
  }, [open, initial, reset]);

  const unit = watch('unit');

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()}>
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>{initial ? 'Editar servicio' : 'Nuevo servicio'}</Modal.Title>
        </Modal.Header>
        <form
          onSubmit={handleSubmit(async (data) => {
            try {
              await onSubmit(data);
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'Error al guardar';
              // 409 (conflicto de nombre único) → mostrar inline
              setError('name', { type: 'manual', message: msg });
            }
          })}
          noValidate
        >
          <Modal.Body>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="svc-name" variant="caps">
                  Nombre
                </Label>
                <Input
                  id="svc-name"
                  placeholder="Lavado industrial"
                  autoComplete="off"
                  invalid={!!errors.name}
                  {...register('name')}
                />
                {errors.name && (
                  <span className="text-meta text-danger font-semibold mt-0.5">
                    {errors.name.message}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="svc-description" variant="caps">
                  Descripción <span className="text-muted normal-case font-normal">(opcional)</span>
                </Label>
                <Textarea
                  id="svc-description"
                  placeholder="Para hoteles y restaurantes. Tiempo: 35 min."
                  {...register('description')}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="svc-category" variant="caps">
                    Categoría
                  </Label>
                  <select
                    id="svc-category"
                    className="h-8 px-2 bg-surface-2 text-[13px] text-fg border border-border rounded-sm focus:bg-surface focus:border-accent focus:shadow-focus-ring focus:outline-none"
                    value={watch('categoryId') ?? ''}
                    onChange={(e) =>
                      setValue('categoryId', e.target.value || null)
                    }
                  >
                    <option value="">— Sin categoría —</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="svc-unit" variant="caps">
                    Unidad
                  </Label>
                  <div className="flex gap-1.5">
                    {UNIT_OPTIONS.map((u) => (
                      <label
                        key={u.value}
                        className={`flex-1 flex items-center justify-center gap-2 h-8 px-3 rounded-sm border cursor-pointer text-[13px] font-semibold transition-colors ${
                          unit === u.value
                            ? 'bg-accent-soft text-accent border-accent'
                            : 'bg-surface-2 text-muted border-border hover:border-muted'
                        }`}
                      >
                        <input
                          type="radio"
                          value={u.value}
                          className="sr-only"
                          checked={unit === u.value}
                          onChange={() => setValue('unit', u.value)}
                        />
                        /{u.short}
                        <span className="font-normal">— {u.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="svc-price" variant="caps">
                    Precio unitario
                  </Label>
                  <Input
                    id="svc-price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    invalid={!!errors.unitPrice}
                    {...register('unitPrice', { valueAsNumber: true })}
                  />
                  {errors.unitPrice && (
                    <span className="text-meta text-danger font-semibold mt-0.5">
                      {errors.unitPrice.message}
                    </span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="svc-min-qty" variant="caps">
                    Cantidad mínima
                  </Label>
                  <Input
                    id="svc-min-qty"
                    type="number"
                    step="1"
                    min="1"
                    placeholder="1"
                    invalid={!!errors.minQuantity}
                    {...register('minQuantity', { valueAsNumber: true })}
                  />
                  {errors.minQuantity && (
                    <span className="text-meta text-danger font-semibold mt-0.5">
                      {errors.minQuantity.message}
                    </span>
                  )}
                </div>
              </div>

              <label className="flex items-center gap-2 text-meta text-fg cursor-pointer select-none mt-1">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-[var(--accent)] cursor-pointer"
                  {...register('active')}
                />
                Servicio activo
              </label>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
              disabled={submitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Spinner size="sm" tone="inverse" />
                  Guardando…
                </>
              ) : initial ? (
                'Guardar cambios'
              ) : (
                'Crear servicio'
              )}
            </Button>
          </Modal.Footer>
        </form>
      </Modal.Content>
    </Modal>
  );
}