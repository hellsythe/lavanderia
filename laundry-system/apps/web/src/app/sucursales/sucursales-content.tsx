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
} from '@lavanderpro/ui';
import { CreateBranchInputSchema } from '@lavanderpro/shared-types';
import type { CreateBranchInput, UpdateBranchInput } from '@lavanderpro/shared-types';
import type { BranchSnapshot } from '@lavanderpro/db-client';
import { Box, Inbox, MapPin, Pencil, Phone, Plus, Star, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Sidebar } from '~/components/sidebar';
import { Topbar } from '~/components/topbar';
import { OfflineBanner } from '~/components/offline-banner';
import { useAuth } from '~/stores/auth-store';
import { useBranches, useCreateBranch, useUpdateBranch, useDeleteBranch } from '~/stores/branches-queries';

type FormData = CreateBranchInput;

export function SucursalesContent() {
  const tenant = useAuth((s) => s.tenant);
  const hydrated = useAuth((s) => s.hydrated);
  const tenantId = tenant?.id;

  const { data, isLoading } = useBranches(tenantId);
  const branches: BranchSnapshot[] = data ?? [];

  const createMut = useCreateBranch(tenantId ?? '');
  const updateMut = useUpdateBranch(tenantId ?? '');
  const deleteMut = useDeleteBranch(tenantId ?? '');

  const [editing, setEditing] = useState<BranchSnapshot | null>(null);
  const [openingCreate, setOpeningCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        (b.address ?? '').toLowerCase().includes(q) ||
        (b.phone ?? '').toLowerCase().includes(q),
    );
  }, [branches, query]);

  if (!hydrated) {
    return (
      <AppShell>
        <main id="main" className="flex-1 p-5 sm:p-6 flex items-center justify-center">
          <Spinner size="xl" label="Cargando sesión" />
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
          title="Sucursales"
          subtitle="Gestioná las ubicaciones de tu lavandería."
          action={
            <Button onClick={() => setOpeningCreate(true)}>
              <Plus className="h-3.5 w-3.5" />
              Nueva sucursal
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
                placeholder="Buscar sucursal…"
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
                title={
                  query
                    ? `Sin resultados para «${query}»`
                    : 'Sin sucursales'
                }
                description={
                  query
                    ? 'Probá con otro término.'
                    : 'Creá tu primera sucursal para empezar a recibir pedidos.'
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <tr>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Dirección</TableHead>
                    <TableHead>Teléfono</TableHead>
                    <TableHead>Principal</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {filtered.map((b) => (
                    <TableRow key={b.id}>
                      <TableCell className="font-semibold">{b.name}</TableCell>
                      <TableCell className="text-muted">{b.address ?? '—'}</TableCell>
                      <TableCell className="text-muted">{b.phone ?? '—'}</TableCell>
                      <TableCell>
                        {b.isMain ? (
                          <span className="inline-flex items-center gap-1 bg-accent-soft text-accent rounded-pill px-2 py-px text-[10px] font-bold">
                            <Star className="h-3 w-3" />
                            Principal
                          </span>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <IconButton
                            icon={<Pencil className="h-3.5 w-3.5" />}
                            ariaLabel={`Editar ${b.name}`}
                            onClick={() => setEditing(b)}
                          />
                          {!b.isMain && (
                            <IconButton
                              icon={<Trash2 className="h-3.5 w-3.5" />}
                              ariaLabel={`Eliminar ${b.name}`}
                              onClick={() => setDeletingId(b.id)}
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardBody>
        </Card>

        <BranchFormModal
          open={openingCreate || editing !== null}
          initial={
            editing
              ? { name: editing.name, address: editing.address, phone: editing.phone, isMain: editing.isMain }
              : undefined
          }
          onClose={() => {
            setOpeningCreate(false);
            setEditing(null);
          }}
          onSubmit={async (data) => {
            if (editing) {
              await updateMut.mutateAsync({ id: editing.id, input: data });
            } else {
              await createMut.mutateAsync(data);
            }
            setOpeningCreate(false);
            setEditing(null);
          }}
          submitting={createMut.isPending || updateMut.isPending}
        />

        <ConfirmDialog
          open={deletingId !== null}
          onOpenChange={(o) => !o && setDeletingId(null)}
          title="Eliminar sucursal"
          description="La sucursal se marcará como inactiva. Los pedidos asociados no se eliminarán."
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
        <Topbar title="Sucursales" breadcrumb="Gestión de ubicaciones" />
        {children}
      </div>
    </div>
  );
}

/* =========================================================================
 * Form Modal — create / edit
 * ========================================================================= */

function BranchFormModal({
  open,
  initial,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  initial?: { name: string; address?: string; phone?: string; isMain: boolean };
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
    resolver: zodResolver(CreateBranchInputSchema),
  });

  useEffect(() => {
    if (open) {
      reset({
        name: initial?.name ?? '',
        address: initial?.address ?? '',
        phone: initial?.phone ?? '',
        isMain: initial?.isMain ?? false,
      });
    }
  }, [open, initial, reset]);

  const handleForm = async (data: FormData) => {
    try {
      await onSubmit(data);
    } catch (e) {
      setError('name', { type: 'manual', message: e instanceof Error ? e.message : 'Error al guardar' });
    }
  };

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()}>
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>{initial ? 'Editar sucursal' : 'Nueva sucursal'}</Modal.Title>
          <Modal.Description>
            Completá los datos de la sucursal. Solo el nombre es obligatorio.
          </Modal.Description>
        </Modal.Header>
        <form onSubmit={handleSubmit(handleForm)} noValidate>
          <Modal.Body>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="branch-name" variant="caps">Nombre</Label>
                <Input
                  id="branch-name"
                  placeholder="Sucursal Centro"
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
                <Label htmlFor="branch-address" variant="caps">Dirección</Label>
                <Input
                  id="branch-address"
                  placeholder="Av. Reforma 123, CDMX"
                  {...register('address')}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="branch-phone" variant="caps">Teléfono</Label>
                <Input
                  id="branch-phone"
                  type="tel"
                  placeholder="55 1234 5678"
                  {...register('phone')}
                />
              </div>
              <label className="flex items-center gap-2 text-meta text-fg cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-[var(--accent)] cursor-pointer"
                  {...register('isMain')}
                />
                <span>Marcar como sucursal principal</span>
              </label>
            </div>
          </Modal.Body>
          <Modal.Footer>
            <Button type="button" variant="secondary" onClick={onClose} disabled={submitting}>
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
                'Crear sucursal'
              )}
            </Button>
          </Modal.Footer>
        </form>
      </Modal.Content>
    </Modal>
  );
}
