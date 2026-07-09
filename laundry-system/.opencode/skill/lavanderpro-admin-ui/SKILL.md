---
name: lavanderpro-admin-ui
description: >
  UI pattern for admin/CRUD pages in apps/web (categorías, servicios,
  clientes, etc.). Use when creating or refactoring a list+detail admin
  module in `apps/web/src/app/*/page.tsx` or any file matching
  `apps/web/src/app/**/content.tsx`. Triggers on keywords: admin page,
  CRUD, list, table, create form, edit form, delete, search, filter,
  Sidebar, Topbar, Card, EmptyState. Enforces the standard layout
  (AppShell + page header + Card with CardHeader/CardBody/Table +
  per-table SearchInput + filter pills + actions + modals) and the
  empty-state dual mode ("no data" vs "no results for query").
---

# LavanderPro — Admin UI Pattern

This skill encodes the canonical structure for **admin/CRUD pages** in
`apps/web/src/app/<entity>/page.tsx`. Every list+form module (categorías,
servicios, clientes — and any future ones) MUST follow this pattern.
Violating it produces inconsistent UX, harder reviews and slow feature
parity.

## The skeleton (mandatory)

```tsx
'use client';

import { /* AppShell primitives */ Sidebar } from '~/components/sidebar';
import { /* Topbar */ Topbar } from '~/components/topbar';
import { /* design system */ PageHeader, Spinner, ConfirmDialog, SearchInput, EmptyState }
  from '@lavanderpro/ui';
import { /* hooks */ useAuth } from '~/stores/auth-store';
import { /* offline-first hooks */ useXxx, useXxxCreate, useXxxUpdate, useXxxDelete }
  from '~/stores/<entity>-queries';

export function XxxContent() {
  const tenant = useAuth((s) => s.tenant);
  const tenantId = tenant?.id;

  const { data, isLoading } = useXxx({ tenantId });
  const items = data ?? [];
  const createMut = useXxxCreate(tenantId ?? '');
  const updateMut = useXxxUpdate(tenantId ?? '');
  const deleteMut = useXxxDelete(tenantId ?? '');

  // 1. Search state (filtro client-side, sin debounce)
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => filter(items, query), [items, query]);

  // 2. Modal state
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null);
  const [openingCreate, setOpeningCreate] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!hydrated) { /* spinner con AppShell */ }
  if (!tenantId) { /* alert con AppShell */ }

  return (
    <div className="min-h-screen bg-canvas grid grid-cols-app">
      <Sidebar />
      <div className="min-w-0 flex flex-col">
        <Topbar title="Xxx" breadcrumb="..." />
        <main id="main" className="flex-1 p-5 sm:p-6">

          {/* ─── 1. PAGE HEADER ─── */}
          <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-icon bg-accent-soft text-accent
                              flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h2 className="text-card font-bold text-fg">Título del módulo</h2>
                <p className="text-meta text-muted">Subtítulo corto, 1 línea.</p>
              </div>
            </div>
            <Button onClick={() => setOpeningCreate(true)}>
              <Plus /> Crear / Nueva…
            </Button>
          </div>

          {/* ─── 2. CARD ÚNICA ─── */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3 flex-wrap">
                <CardTitle>Listado</CardTitle>
                <FilterGroup> {/* opcional — solo si hay filtros categóricos */}
                  <FilterPill active={...} onClick={...}>Todos</FilterPill>
                  <FilterPill active={...} onClick={...}>Filtro 1</FilterPill>
                </FilterGroup>
                <SearchInput
                  value={query}
                  onChange={setQuery}
                  placeholder="Buscar xxx…"
                />
              </div>
              <CardMeta>
                {isLoading ? '…' : `${filtered.length} resultado${filtered.length === 1 ? '' : 's'}`}
              </CardMeta>
            </CardHeader>
            <CardBody className="p-0">
              {/* ─── 3. EMPTY STATE DUAL ─── */}
              {!isLoading && filtered.length === 0 ? (
                <EmptyState
                  icon={<Inbox />}
                  title={query ? `Sin resultados para «${query}»` : 'Sin datos aún'}
                  description={query
                    ? 'Probá con otro término.'
                    : 'Conectá tu primer…'}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <tr>
                      <TableHead>Col 1</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </tr>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(row => (
                      <TableRow key={row.id}>
                        <TableCell>{row.col1}</TableCell>
                        <TableCell className="text-right">
                          <IconButton
                            icon={<Pencil className="h-3.5 w-3.5" />}
                            ariaLabel={`Editar ${row.col1}`}
                            onClick={() => setEditing({ id: row.id, name: row.col1 })}
                          />
                          <IconButton
                            icon={<Trash2 className="h-3.5 w-3.5" />}
                            ariaLabel={`Eliminar ${row.col1}`}
                            onClick={() => setDeletingId(row.id)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardBody>
          </Card>

          {/* ─── 4. MODALES ─── */}
          <XxxFormModal
            open={openingCreate || editing !== null}
            initialName={editing?.name}
            onClose={() => { setOpeningCreate(false); setEditing(null); }}
            onSubmit={async (data) => {
              if (editing) await updateMut.mutateAsync({ id: editing.id, input: data });
              else await createMut.mutateAsync(data);
              setOpeningCreate(false); setEditing(null);
            }}
            submitting={createMut.isPending || updateMut.isPending}
          />

          <Modal open={deletingId !== null} onOpenChange={(o) => !o && setDeletingId(null)}>
            <Modal.Content>
              <Modal.Header>
                <Modal.Title>Eliminar xxx</Modal.Title>
                <Modal.Description>
                  Esta acción no se puede deshacer. (Efectos colaterales reales.)
                </Modal.Description>
              </Modal.Header>
              <Modal.Footer>
                <Button variant="secondary" onClick={() => setDeletingId(null)} disabled={deleteMut.isPending}>
                  Cancelar
                </Button>
                <Button onClick={...} disabled={deleteMut.isPending}>
                  {deleteMut.isPending ? 'Eliminando…' : 'Eliminar'}
                </Button>
              </Modal.Footer>
            </Modal.Content>
          </Modal>
        </main>
      </div>
    </div>
  );
}
```

## Reglas duras (10)

1. **AppShell siempre**: `grid grid-cols-app` con `Sidebar` + `Topbar`.
   NO uses `<main className="min-h-screen">` desnudo. (Tip: extraer
   un componente `AppShell` local en cada page si querés DRY.)

2. **PageHeader primitiva** (`@lavanderpro/ui`): el header de página
   usa SIEMPRE el componente `<PageHeader icon title subtitle action />`.
   NO construir el header inline con divs + ícono teal. Garantiza
   consistencia entre módulos.

3. **Una sola Card**: el módulo va en una `Card` envolvente, no en
   varias cards fragmentadas. `CardBody className="p-0"` para que la
   tabla ocupe todo el ancho.

4. **SearchInput SIEMPRE presente** (cuando aplique — clientes,
   categorías, servicios; no en KPIs). Filtrado client-side sobre
   lo que ya está en cache (offline-first). Sin debounce. Placeholder
   con el sustantivo del módulo: "Buscar categoría…", "Buscar
   cliente…".

5. **FilterGroup opcional** para filtros categóricos (estados, tipos).
   Si no hay filtros categóricos, omitir. NO abuses de FilterPills.

6. **CardMeta con count** alineado a la derecha: `N resultado(s)` o
   `N xxx`. Plural-aware ("1 resultado" / "2 resultados").

7. **Empty state dual**:
   - Sin data: "Sin categorías" + "Creá tu primera categoría…"
   - Con búsqueda sin matches: "Sin resultados para «xxx»" +
     "Probá con otro término."
   Mismo `<EmptyState>` component, distinto contenido.

8. **Acciones inline en última columna** con `IconButton` 34px:
   `Pencil` (editar) y `Trash2` (eliminar). `ariaLabel` específico:
   "Editar Lavado", NO "Editar". Mobile: 44px automático vía
   `size="mobile"` si hace falta.

9. **ConfirmDialog primitiva** (`@lavanderpro/ui`): la confirmación
   de delete usa SIEMPRE `<ConfirmDialog>` (NO `<Modal>` armado a mano).
   `confirmTone="danger"` + `description` con consecuencias reales
   ("Los servicios asociados quedarán sin categoría.").

10. **Spinner primitiva** (`@lavanderpro/ui`): usar SIEMPRE
    `<Spinner size="xl" />` para hidratación de página completa.
    `<Spinner size="sm" tone="inverse" />` dentro de botones
    primary durante submit. NUNCA el patrón inline con borders
    manuales.

11. **Voz & tone es-MX directo**:
    - "Crear categoría" (no "Crear una nueva categoría")
    - "Esta acción no se puede deshacer." (no "Lamentablemente…")
    - "Probá con otro término." (no "Intente nuevamente")
    - "Sin resultados para «xxx»" (con comillas tipográficas « »)
    - Sin emojis ornamentales, sin exclamaciones.

## Por qué (rationale)

- **Consistencia**: el usuario aprende el patrón una vez. Cambiar de
  módulo es cero carga cognitiva.
- **Offline-first**: el search opera sobre el cache Dexie. Sin
  round-trip al server. Filtros instantáneos sin debounce.
- **Escaneo rápido**: el header de página + CardHeader (título +
  filtros + search) + CardMeta (count) es toda la "chrome" que el
  usuario necesita. El resto es la tabla en sí.
- **Densidad media-alta**: el design system es para "operational
  command centre". Espaciado es justo, no lujoso.

## Hooks offline-first esperados

Para cada módulo nuevo:
1. `packages/db-client/src/repos/<entity>.repo.ts` — CRUD local con
   `createLocal` (UUID v7), `updateLocal`, `softDeleteLocal`, `list`,
   `findById`, `findByName`, `put`, `bulkPut`, `clear`.
2. `apps/web/src/stores/<entity>-queries.ts` — `useXxx` (cache-first +
  API refresh), `useXxxCreate/Update/Delete` (apply local + enqueue
  sync + best-effort API).
3. `packages/sync-engine/src/sync-engine.ts` — agregar `entity` al
  pull e initialSync.

## Ejemplos canónicos

- `apps/web/src/app/categorias/categorias-content.tsx` — el más simple
  (categoría = solo `name`).
- `apps/web/src/app/page.tsx` → `ActiveOrdersCard` — el más complejo
  (filter pills + status + clickable rows).

## Anti-patterns (rechazar en review)

- ❌ Sin AppShell (Sin `Sidebar` + `Topbar`).
- ❌ Page header inline con divs (usar `<PageHeader>`).
- ❌ Confirm delete con `<Modal>` armado a mano (usar `<ConfirmDialog>`).
- ❌ Spinner inline `<span className="inline-block h-X w-X border-2...">` (usar `<Spinner>`).
- ❌ Múltiples Cards fragmentadas (debería ser una sola).
- ❌ Sin search input.
- ❌ Botones "Editar" / "Eliminar" como texto en vez de IconButton.
- ❌ Empty state genérico ("No hay datos") en vez del dual mode.
- ❌ Acciones en un menú kebab ⋮ (ineficiente vs. IconButton inline).
- ❌ Modales full-page en vez de `Modal.Content` centrado.
- ❌ Confirmación de delete sin copy de consecuencias.
- ❌ Tabla con scroll horizontal infinito (usar paginación o
  columnas fijas).
- ❌ Botón "Submit" sin label (siempre "Crear xxx" o "Guardar cambios").