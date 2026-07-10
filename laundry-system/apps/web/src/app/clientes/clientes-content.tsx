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
  CreateCustomerInputSchema,
  type UpdateCustomerInput,
} from '@lavanderpro/shared-types';
import type { CustomerSnapshot } from '@lavanderpro/db-client';
import { Inbox, Pencil, Plus, Trash2, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Sidebar } from '~/components/sidebar';
import { Topbar } from '~/components/topbar';
import { OfflineBanner } from '~/components/offline-banner';
import { useAuth } from '~/stores/auth-store';
import {
  useCreateCustomer,
  useCustomers,
  useDeleteCustomer,
  useUpdateCustomer,
} from '~/stores/customers-queries';

type FormData = {
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  rfc?: string;
  legalName?: string;
};

/**
 * ClientesContent — UI CRUD completa de Customer.
 *
 * Sigue el patrón canónico de admin pages (DESIGN.md §6 + skill
 * lavanderpro-admin-ui). Customer tiene: nombre (required), al menos
 * uno de {phone, email} (regla de contacto), dirección opcional, y
 * datos fiscales opcionales (RFC + razón social) para facturación.
 *
 * Offline-first: mutations aplican al cache local primero (Dexie) y
 * luego se encolan para sync.
 */
export function ClientesContent() {
  const tenant = useAuth((s) => s.tenant);
  const hydrated = useAuth((s) => s.hydrated);
  const tenantId = tenant?.id;

  const { data, isLoading } = useCustomers({ tenantId });
  const customers: CustomerSnapshot[] = data ?? [];

  const createMut = useCreateCustomer(tenantId ?? '');
  const updateMut = useUpdateCustomer(tenantId ?? '');
  const deleteMut = useDeleteCustomer(tenantId ?? '');

  const [editing, setEditing] = useState<CustomerSnapshot | null>(null);
  const [openingCreate, setOpeningCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filtro client-side
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      if (c.phone?.toLowerCase().includes(q)) return true;
      if (c.email?.toLowerCase().includes(q)) return true;
      if (c.rfc?.toLowerCase().includes(q)) return true;
      if (c.legalName?.toLowerCase().includes(q)) return true;
      return false;
    });
  }, [customers, query]);

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
          icon={<Users className="h-5 w-5" />}
          title="Clientes"
          subtitle="Tu cartera de clientes con datos de contacto y fiscales."
          action={
            <Button onClick={() => setOpeningCreate(true)}>
              <Plus className="h-3.5 w-3.5" />
              Nuevo cliente
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
                placeholder="Buscar cliente, RFC, teléfono…"
              />
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
                title={query ? 'Sin resultados' : 'Sin clientes'}
                description={
                  query
                    ? 'Probá con otro término.'
                    : 'Creá tu primer cliente para empezar a registrar pedidos.'
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <tr>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Contacto</TableHead>
                    <TableHead>RFC</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <div className="font-semibold">{c.name}</div>
                        {c.legalName && (
                          <div className="text-meta text-muted line-clamp-1">
                            {c.legalName}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-meta text-muted">
                        {c.phone && <div>{c.phone}</div>}
                        {c.email && <div className="line-clamp-1">{c.email}</div>}
                        {!c.phone && !c.email && <span>—</span>}
                      </TableCell>
                      <TableCell>
                        {c.rfc ? (
                          <span className="inline-flex items-center justify-center min-w-[60px] h-5 px-2 rounded-pill bg-surface-2 text-meta text-fg font-bold num">
                            {c.rfc}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <IconButton
                            icon={<Pencil className="h-3.5 w-3.5" />}
                            ariaLabel={`Editar ${c.name}`}
                            onClick={() => setEditing(c)}
                          />
                          <IconButton
                            icon={<Trash2 className="h-3.5 w-3.5" />}
                            ariaLabel={`Eliminar ${c.name}`}
                            onClick={() => setDeletingId(c.id)}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>

        <CustomerFormModal
          open={openingCreate || editing !== null}
          initial={editing ?? undefined}
          onClose={() => {
            setOpeningCreate(false);
            setEditing(null);
          }}
          onSubmit={async (data) => {
            if (editing) {
              // Update: enviar solo campos provistos (undefined = no tocar).
              const updatePayload: UpdateCustomerInput = {};
              if (data.name !== undefined) updatePayload.name = data.name;
              if (data.phone !== undefined) updatePayload.phone = data.phone;
              if (data.email !== undefined) updatePayload.email = data.email;
              if (data.address !== undefined) updatePayload.address = data.address;
              if (data.notes !== undefined) updatePayload.notes = data.notes;
              if (data.rfc !== undefined) updatePayload.rfc = data.rfc;
              if (data.legalName !== undefined) updatePayload.legalName = data.legalName;
              await updateMut.mutateAsync({ id: editing.id, input: updatePayload });
            } else {
              // Create: enviar todos los campos. El Zod refinement ya
              // validó que al menos uno de phone/email esté presente.
              await createMut.mutateAsync({
                name: data.name,
                phone: data.phone,
                email: data.email,
                address: data.address,
                notes: data.notes,
                rfc: data.rfc,
                legalName: data.legalName,
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
          title="Eliminar cliente"
          description="Esta acción no se puede deshacer. Los pedidos históricos conservarán al cliente por nombre, pero dejará de estar disponible para nuevos pedidos."
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
 * AppShell — wrapper local con Sidebar + Topbar.
 * ========================================================================= */

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas grid grid-cols-app">
      <Sidebar />
      <div className="min-w-0 flex flex-col">
        <Topbar title="Clientes" breadcrumb="Cartera" />
        {children}
      </div>
    </div>
  );
}

/* =========================================================================
 * Form Modal — create / edit
 * ========================================================================= */

function CustomerFormModal({
  open,
  initial,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  initial?: CustomerSnapshot;
  onClose: () => void;
  onSubmit: (data: FormData) => Promise<void>;
  submitting: boolean;
}) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(CreateCustomerInputSchema),
    defaultValues: {
      name: initial?.name ?? '',
      phone: initial?.phone ?? '',
      email: initial?.email ?? '',
      address: initial?.address ?? '',
      notes: initial?.notes ?? '',
      rfc: initial?.rfc ?? '',
      legalName: initial?.legalName ?? '',
    },
  });

  useEffect(() => {
    if (open) {
      reset({
        name: initial?.name ?? '',
        phone: initial?.phone ?? '',
        email: initial?.email ?? '',
        address: initial?.address ?? '',
        notes: initial?.notes ?? '',
        rfc: initial?.rfc ?? '',
        legalName: initial?.legalName ?? '',
      });
    }
  }, [open, initial, reset]);

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()}>
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>{initial ? 'Editar cliente' : 'Nuevo cliente'}</Modal.Title>
          <Modal.Description>
            Indicá al menos un teléfono o un correo. Los datos fiscales son
            opcionales (solo los necesitás si vas a facturar).
          </Modal.Description>
        </Modal.Header>
        <form
          onSubmit={handleSubmit(async (data) => {
            try {
              await onSubmit(data);
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'Error al guardar';
              // 409 (nombre duplicado) o refinement (falta phone/email) → inline
              setError('name', { type: 'manual', message: msg });
            }
          })}
          noValidate
        >
          <Modal.Body>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cust-name" variant="caps">
                  Nombre
                </Label>
                <Input
                  id="cust-name"
                  placeholder="Hotel Costa Bella"
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

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cust-phone" variant="caps">
                    Teléfono
                  </Label>
                  <Input
                    id="cust-phone"
                    type="tel"
                    placeholder="55 1234 5678"
                    autoComplete="off"
                    invalid={!!errors.phone}
                    {...register('phone')}
                  />
                  {errors.phone && (
                    <span className="text-meta text-danger font-semibold mt-0.5">
                      {errors.phone.message}
                    </span>
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="cust-email" variant="caps">
                    Correo
                  </Label>
                  <Input
                    id="cust-email"
                    type="email"
                    placeholder="contacto@hotel.com"
                    autoComplete="off"
                    invalid={!!errors.email}
                    {...register('email')}
                  />
                  {errors.email && (
                    <span className="text-meta text-danger font-semibold mt-0.5">
                      {errors.email.message}
                    </span>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cust-address" variant="caps">
                  Dirección <span className="text-muted normal-case font-normal">(opcional)</span>
                </Label>
                <Input
                  id="cust-address"
                  placeholder="Av. Reforma 123, CDMX"
                  autoComplete="off"
                  {...register('address')}
                />
              </div>

              {/* Datos fiscales (opcionales, para facturación) */}
              <div className="rounded-md border border-border p-3 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-label uppercase text-muted">Datos fiscales</span>
                  <span className="text-meta text-muted">— opcionales</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cust-rfc" variant="caps">
                      RFC
                    </Label>
                    <Input
                      id="cust-rfc"
                      placeholder="HCB950815ABC"
                      maxLength={13}
                      autoComplete="off"
                      className="num"
                      invalid={!!errors.rfc}
                      {...register('rfc')}
                    />
                    {errors.rfc && (
                      <span className="text-meta text-danger font-semibold mt-0.5">
                        {errors.rfc.message}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="cust-legal" variant="caps">
                      Razón social
                    </Label>
                    <Input
                      id="cust-legal"
                      placeholder="Hotel Costa Bella S.A. de C.V."
                      autoComplete="off"
                      invalid={!!errors.legalName}
                      {...register('legalName')}
                    />
                    {errors.legalName && (
                      <span className="text-meta text-danger font-semibold mt-0.5">
                        {errors.legalName.message}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="cust-notes" variant="caps">
                  Notas <span className="text-muted normal-case font-normal">(opcional)</span>
                </Label>
                <Textarea
                  id="cust-notes"
                  placeholder="Cliente VIP, descuento 10% los martes…"
                  {...register('notes')}
                />
              </div>
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
                'Crear cliente'
              )}
            </Button>
          </Modal.Footer>
        </form>
      </Modal.Content>
    </Modal>
  );
}