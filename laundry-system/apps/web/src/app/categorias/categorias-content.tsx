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
import { CreateServiceCategoryInputSchema } from '@lavanderpro/shared-types';
import type { CategorySnapshot } from '@lavanderpro/db-client';
import { Box, Inbox, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Sidebar } from '~/components/sidebar';
import { Topbar } from '~/components/topbar';
import { useAuth } from '~/stores/auth-store';
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from '~/stores/categories-queries';

type FormData = { name: string };

/**
 * CategoriasContent — UI CRUD completa de ServiceCategory.
 *
 * Sigue el patrón canónico de admin pages (DESIGN.md §6 + skill
 * lavanderpro-admin-ui) usando las primitivas de @lavanderpro/ui:
 * Spinner, PageHeader, ConfirmDialog, SearchInput, EmptyState.
 *
 * Offline-first: las mutations se aplican al cache local primero (Dexie)
 * y luego se encolan para sync. La lista se hidrata desde el cache
 * local instantáneamente y se refresca en background si hay red.
 */
export function CategoriasContent() {
  const tenant = useAuth((s) => s.tenant);
  const hydrated = useAuth((s) => s.hydrated);
  const tenantId = tenant?.id;

  const { data, isLoading } = useCategories({ tenantId });
  const categories: CategorySnapshot[] = data ?? [];

  const createMut = useCreateCategory(tenantId ?? '');
  const updateMut = useUpdateCategory(tenantId ?? '');
  const deleteMut = useDeleteCategory(tenantId ?? '');

  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [openingCreate, setOpeningCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Filtro client-side — sin debounce, opera sobre el cache local.
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.name.toLowerCase().includes(q));
  }, [categories, query]);

  // Hidratando: spinner centrado (AppShell ya montado).
  if (!hydrated) {
    return (
      <AppShell>
        <main id="main" className="flex-1 p-5 sm:p-6 flex items-center justify-center">
          <Spinner size="xl" label="Cargando sesión" />
        </main>
      </AppShell>
    );
  }

  // Sin tenant (caso borde — el AuthGate ya redirige, pero por si acaso).
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
        {/* Page header canónico (PageHeader primitive) */}
        <PageHeader
          icon={<Box className="h-5 w-5" />}
          title="Categorías de servicios"
          subtitle="Agrupá tus servicios para organizarlos en el POS y los reportes."
          action={
            <Button onClick={() => setOpeningCreate(true)}>
              <Plus className="h-3.5 w-3.5" />
              Nueva categoría
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
                placeholder="Buscar categoría…"
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
                    : 'Sin categorías'
                }
                description={
                  query
                    ? 'Probá con otro término.'
                    : 'Creá tu primera categoría para empezar a agrupar servicios.'
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <tr>
                    <TableHead>Nombre</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </tr>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-semibold">{c.name}</TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex items-center gap-1">
                          <IconButton
                            icon={<Pencil className="h-3.5 w-3.5" />}
                            ariaLabel={`Editar ${c.name}`}
                            onClick={() => setEditing({ id: c.id, name: c.name })}
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

        <CategoryFormModal
          open={openingCreate || editing !== null}
          initialName={editing?.name}
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
          title="Eliminar categoría"
          description="Esta acción no se puede deshacer. Los servicios asociados quedarán sin categoría."
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
 * AppShell — wrapper local con Sidebar + Topbar. No es primitiva porque
 * depende de los componentes de la app (no del design system).
 * ========================================================================= */

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas grid grid-cols-app">
      <Sidebar />
      <div className="min-w-0 flex flex-col">
        <Topbar title="Categorías" breadcrumb="Agrupación de servicios" />
        {children}
      </div>
    </div>
  );
}

/* =========================================================================
 * Form Modal — create / edit
 * ========================================================================= */

function CategoryFormModal({
  open,
  initialName,
  onClose,
  onSubmit,
  submitting,
}: {
  open: boolean;
  initialName?: string;
  onClose: () => void;
  onSubmit: (data: FormData) => Promise<void>;
  submitting: boolean;
}) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
    setError,
  } = useForm<FormData>({
    resolver: zodResolver(CreateServiceCategoryInputSchema),
    defaultValues: { name: initialName ?? '' },
  });

  // Cuando cambia initialName (modal de edición), resetear el form.
  useEffect(() => {
    if (open) reset({ name: initialName ?? '' });
  }, [open, initialName, reset]);

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()}>
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>{initialName ? 'Editar categoría' : 'Nueva categoría'}</Modal.Title>
        </Modal.Header>
        <form
          onSubmit={handleSubmit(async (data) => {
            try {
              await onSubmit(data);
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'Error al guardar';
              setError('name', { type: 'manual', message: msg });
            }
          })}
          noValidate
        >
          <Modal.Body>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="cat-name" variant="caps">
                Nombre
              </Label>
              <Input
                id="cat-name"
                placeholder="Servicios generales"
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
              {submitting
                ? 'Guardando…'
                : initialName
                  ? 'Guardar cambios'
                  : 'Crear categoría'}
            </Button>
          </Modal.Footer>
        </form>
      </Modal.Content>
    </Modal>
  );
}