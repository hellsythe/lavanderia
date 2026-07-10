'use client';

import {
  Accordion,
  Alert,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  FilterGroup,
  FilterPill,
  IconButton,
  Input,
  Label,
  Modal,
  SearchInput,
  ServiceCard,
  Spinner,
  Textarea,
} from '@lavanderpro/ui';
import { CreateCustomerInputSchema, CreateOrderInputSchema } from '@lavanderpro/shared-types';
import type { CustomerSnapshot, ServiceSnapshot } from '@lavanderpro/db-client';
import {
  Inbox,
  Plus,
  Search as SearchIcon,
  ShoppingCart,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Sidebar } from '~/components/sidebar';
import { Topbar } from '~/components/topbar';
import { useAuth } from '~/stores/auth-store';
import { useCategories } from '~/stores/categories-queries';
import {
  useCreateCustomer,
  useCustomers,
} from '~/stores/customers-queries';
import { useServices } from '~/stores/services-queries';
import { useCreateOrder } from '~/stores/orders-queries';

type ViewMode = 'populares' | 'categorias';

interface CartItem {
  service: ServiceSnapshot;
  quantity: number;
}

const UNIT_LABEL: Record<'kg' | 'piece', string> = {
  kg: 'kg',
  piece: 'pz',
};

type NewCustomerForm = {
  name: string;
  phone?: string;
  email?: string;
};

/**
 * PosContent — Punto de Venta.
 *
 * Layout 2-col (CSS grid):
 *  - Left (services picker, 2fr): FilterGroup Populares/Categorías + SearchInput
 *    + body (grid de ServiceCard o Accordion de categorías).
 *  - Right (cart, 1fr): customer picker + line items + total + Crear pedido.
 *
 * Offline-first: Crear pedido aplica local (Dexie) + enqueue sync. Si online,
 * intenta el API directo. Si falla, la queue sube después.
 *
 * Customer puede ser opcional (CreateOrderInput permite customerId ausente).
 * Para MVP dejamos el customer picker simple con un modal de "Nuevo cliente".
 */
export function PosContent() {
  const tenant = useAuth((s) => s.tenant);
  const tenantId = tenant?.id;

  // === State ===
  const [view, setView] = useState<ViewMode>('populares');
  const [serviceQuery, setServiceQuery] = useState('');
  const [cart, setCart] = useState<Map<string, CartItem>>(new Map());
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerSnapshot | null>(null);
  const [customerPickerQuery, setCustomerPickerQuery] = useState('');
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [orderNotes, setOrderNotes] = useState('');

  // === Data ===
  const { data: servicesData = [], isLoading: isLoadingServices } = useServices({
    tenantId,
    onlyActive: true,
  });
  const { data: categoriesData = [] } = useCategories({ tenantId });
  const { data: customersData = [], isLoading: isLoadingCustomers } = useCustomers({
    tenantId,
  });
  const createOrderMut = useCreateOrder(tenantId ?? '');
  const createCustomerMut = useCreateCustomer(tenantId ?? '');

  // === Services filtered by view + search ===
  const filteredServices = useMemo(() => {
    const q = serviceQuery.trim().toLowerCase();
    if (!q) return servicesData;
    return servicesData.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description ?? '').toLowerCase().includes(q),
    );
  }, [servicesData, serviceQuery]);

  // Servicios agrupados por categoría (para el tab "Categorías").
  // Cada bucket: { categoryId, categoryName | "Sin categoría", services[] }
  const servicesByCategory = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; services: ServiceSnapshot[] }>();
    // Inicializar grupos en el orden de categories.
    for (const cat of categoriesData) {
      groups.set(cat.id, { id: cat.id, name: cat.name, services: [] });
    }
    // Bucket para "Sin categoría" (servicios con categoryId null).
    groups.set('__none__', { id: '__none__', name: 'Sin categoría', services: [] });
    for (const s of filteredServices) {
      const key = s.categoryId ?? '__none__';
      const group = groups.get(key);
      if (group) group.services.push(s);
    }
    return Array.from(groups.values()).filter((g) => g.services.length > 0);
  }, [filteredServices, categoriesData]);

  // === Cart helpers ===
  /**
   * Setea la cantidad de un servicio en el cart. Si el cart NO tiene
   * ese servicio y quantity > 0, lo agrega. Si quantity === 0, lo quita
   * (o no hace nada si no estaba). Si lo tiene, actualiza la cantidad
   * respetando `minQuantity` (no se puede bajar del mínimo).
   */
  const updateQuantity = (serviceId: string, quantity: number) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(serviceId);
      const safeQty = Math.max(0, Math.floor(quantity));

      // Caso 1: quitar (qty === 0).
      if (safeQty === 0) {
        if (existing) next.delete(serviceId);
        return next;
      }

      // Caso 2: agregar nuevo (no estaba en el cart).
      if (!existing) {
        // Buscar el service en servicesData para conocer su minQuantity.
        const service = servicesData.find((s) => s.id === serviceId);
        const minQty = service?.minQuantity ?? 1;
        // Si safeQty está por debajo del min, lo subimos al min.
        const finalQty = Math.max(safeQty, minQty);
        if (!service) return prev; // no encontrado, nada que hacer
        next.set(serviceId, { service, quantity: finalQty });
        return next;
      }

      // Caso 3: actualizar existente.
      const minQty = existing.service.minQuantity ?? 1;
      const finalQty = Math.max(safeQty, minQty);
      next.set(serviceId, { ...existing, quantity: finalQty });
      return next;
    });
  };

  const removeFromCart = (serviceId: string) => {
    setCart((prev) => {
      const next = new Map(prev);
      next.delete(serviceId);
      return next;
    });
  };

  // Toggle: si está en el cart lo quita, si no lo agrega con minQuantity.
  const toggleCart = (service: ServiceSnapshot) => {
    const inCart = cart.has(service.id);
    updateQuantity(service.id, inCart ? 0 : (service.minQuantity ?? 1));
  };

  // === Cart total ===
  const cartItems = Array.from(cart.values());
  const cartTotal = cartItems.reduce(
    (sum, it) => sum + it.service.unitPrice * it.quantity,
    0,
  );
  const canSubmit = cartItems.length > 0 && !createOrderMut.isPending;

  // === Customer filtered by search ===
  const filteredCustomers = useMemo(() => {
    const q = customerPickerQuery.trim().toLowerCase();
    if (!q) return customersData;
    return customersData.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q),
    );
  }, [customersData, customerPickerQuery]);

  // === Submit handler ===
  const handleSubmit = async () => {
    if (!canSubmit) return;
    const items = cartItems.map((it) => ({
      serviceId: it.service.id,
      quantity: it.quantity,
    }));
    const input: import('@lavanderpro/shared-types').CreateOrderInput = {
      items,
      isNewCustomer: false,
      notes: orderNotes.trim() || undefined,
    };
    if (selectedCustomer) {
      input.customerId = selectedCustomer.id;
      input.customerName = selectedCustomer.name;
      input.customerPhone = selectedCustomer.phone;
    }
    try {
      await createOrderMut.mutateAsync(input);
      // Reset solo en éxito.
      setCart(new Map());
      setSelectedCustomer(null);
      setOrderNotes('');
    } catch {
      // El error ya lo muestra el mutation; no limpiamos el cart para
      // que el usuario pueda reintentar.
    }
  };

  // === Render ===
  return (
    <AppShell>
      <main id="main" className="flex-1 p-5 sm:p-6">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5 h-full">
          {/* ─── LEFT: Service picker (2/3) ─── */}
          <div className="xl:col-span-2 flex flex-col gap-5">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3 flex-wrap">
                  <CardTitle>Servicios</CardTitle>
                  <FilterGroup>
                    <FilterPill
                      active={view === 'populares'}
                      onClick={() => setView('populares')}
                    >
                      Populares
                    </FilterPill>
                    <FilterPill
                      active={view === 'categorias'}
                      onClick={() => setView('categorias')}
                    >
                      Categorías
                    </FilterPill>
                  </FilterGroup>
                  <SearchInput
                    value={serviceQuery}
                    onChange={(e) => setServiceQuery(e.target.value)}
                    onClear={serviceQuery ? () => setServiceQuery('') : undefined}
                    placeholder="Buscar servicio…"
                  />
                </div>
              </CardHeader>
              <CardBody>
                {isLoadingServices ? (
                  <div className="flex justify-center py-12">
                    <Spinner size="lg" />
                  </div>
                ) : view === 'populares' ? (
                  <PopularesGrid
                    services={filteredServices}
                    cart={cart}
                    onQuantityChange={updateQuantity}
                  />
                ) : (
                  <CategoriasAccordion
                    groups={servicesByCategory}
                    cart={cart}
                    onQuantityChange={updateQuantity}
                  />
                )}
              </CardBody>
            </Card>
          </div>

          {/* ─── RIGHT: Cart (1/3) ─── */}
          <div className="flex flex-col gap-5">
            <CustomerPickerCard
              customers={filteredCustomers}
              isLoading={isLoadingCustomers}
              query={customerPickerQuery}
              onQueryChange={setCustomerPickerQuery}
              selected={selectedCustomer}
              onSelect={setSelectedCustomer}
              onNewClick={() => setNewCustomerOpen(true)}
            />
            <CartCard
              items={cartItems}
              total={cartTotal}
              notes={orderNotes}
              onNotesChange={setOrderNotes}
              onQuantityChange={updateQuantity}
              onRemove={removeFromCart}
              canSubmit={canSubmit}
              isSubmitting={createOrderMut.isPending}
              error={createOrderMut.error}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      </main>

      <NewCustomerModal
        open={newCustomerOpen}
        onClose={() => setNewCustomerOpen(false)}
        onSubmit={async (input) => {
          const created = await createCustomerMut.mutateAsync(input);
          setSelectedCustomer(created);
          setNewCustomerOpen(false);
          setCustomerPickerQuery('');
        }}
        submitting={createCustomerMut.isPending}
        error={createCustomerMut.error}
      />
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
        <Topbar title="POS" breadcrumb="Levantar pedido" />
        {children}
      </div>
    </div>
  );
}

/* =========================================================================
 * Vista "Populares" — grid de ServiceCards.
 * ========================================================================= */

function PopularesGrid({
  services,
  cart,
  onQuantityChange,
}: {
  services: ServiceSnapshot[];
  cart: Map<string, CartItem>;
  onQuantityChange: (serviceId: string, quantity: number) => void;
}) {
  if (services.length === 0) {
    return (
      <EmptyState
        icon={<Inbox />}
        title="Sin servicios"
        description="No hay servicios activos para mostrar. Cargá tu catálogo primero."
      />
    );
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {services.map((s) => {
        const inCart = cart.get(s.id);
        return (
          <ServiceCard
            key={s.id}
            id={s.id}
            name={s.name}
            description={s.description ?? undefined}
            unit={s.unit}
            unitPrice={s.unitPrice}
            quantity={inCart?.quantity ?? 0}
            minQuantity={s.minQuantity ?? 1}
            onQuantityChange={(q) => onQuantityChange(s.id, q)}
          />
        );
      })}
    </div>
  );
}

/* =========================================================================
 * Vista "Categorías" — Accordion de categorías.
 * ========================================================================= */

function CategoriasAccordion({
  groups,
  cart,
  onQuantityChange,
}: {
  groups: { id: string; name: string; services: ServiceSnapshot[] }[];
  cart: Map<string, CartItem>;
  onQuantityChange: (serviceId: string, quantity: number) => void;
}) {
  if (groups.length === 0) {
    return (
      <EmptyState
        icon={<Inbox />}
        title="Sin servicios"
        description="No hay servicios activos en ninguna categoría."
      />
    );
  }
  return (
    <Accordion
      items={groups.map((g) => ({
        id: g.id,
        title: g.name,
        meta: `${g.services.length} servicio${g.services.length === 1 ? '' : 's'}`,
        defaultOpen: true,
        children: (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {g.services.map((s) => {
              const inCart = cart.get(s.id);
              return (
                <ServiceCard
                  key={s.id}
                  id={s.id}
                  name={s.name}
                  description={s.description ?? undefined}
                  unit={s.unit}
                  unitPrice={s.unitPrice}
                  quantity={inCart?.quantity ?? 0}
                  minQuantity={s.minQuantity ?? 1}
                  onQuantityChange={(q) => onQuantityChange(s.id, q)}
                />
              );
            })}
          </div>
        ),
      }))}
    />
  );
}

/* =========================================================================
 * CustomerPickerCard — search + seleccionar cliente (o crear nuevo).
 * ========================================================================= */

function CustomerPickerCard({
  customers,
  isLoading,
  query,
  onQueryChange,
  selected,
  onSelect,
  onNewClick,
}: {
  customers: CustomerSnapshot[];
  isLoading: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  selected: CustomerSnapshot | null;
  onSelect: (c: CustomerSnapshot | null) => void;
  onNewClick: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3 flex-wrap">
          <CardTitle>Cliente</CardTitle>
          <SearchInput
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            onClear={query ? () => onQueryChange('') : undefined}
            placeholder="Buscar cliente…"
          />
          <Button type="button" variant="secondary" size="sm" onClick={onNewClick}>
            <UserPlus className="h-3.5 w-3.5" />
            Nuevo
          </Button>
        </div>
      </CardHeader>
      <CardBody className="p-0">
        {selected ? (
          <SelectedCustomerRow
            customer={selected}
            onClear={() => onSelect(null)}
          />
        ) : isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner size="md" />
          </div>
        ) : customers.length === 0 ? (
          <EmptyState
            icon={<Inbox />}
            title={query ? 'Sin resultados' : 'Sin clientes'}
            description={
              query
                ? 'Probá con otro término.'
                : 'Podés crear el pedido sin cliente o registrar uno nuevo.'
            }
          />
        ) : (
          <ul className="flex flex-col">
            {customers.slice(0, 5).map((c) => (
              <li
                key={c.id}
                className="flex items-center gap-3 px-4 py-2.5 border-b border-border last:border-b-0 hover:bg-surface-2 transition-colors cursor-pointer"
                onClick={() => onSelect(c)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(c);
                  }
                }}
              >
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-fg">{c.name}</div>
                  <div className="text-meta text-muted line-clamp-1">
                    {[c.phone, c.email].filter(Boolean).join(' · ') || 'Sin contacto'}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function SelectedCustomerRow({
  customer,
  onClear,
}: {
  customer: CustomerSnapshot;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 bg-accent-soft">
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-fg">{customer.name}</div>
        <div className="text-meta text-muted line-clamp-1">
          {[customer.phone, customer.email].filter(Boolean).join(' · ') || 'Sin contacto'}
        </div>
      </div>
      <IconButton
        icon={<X className="h-3.5 w-3.5" />}
        ariaLabel="Quitar cliente"
        onClick={onClear}
      />
    </div>
  );
}

/* =========================================================================
 * CartCard — line items + total + Crear pedido.
 * ========================================================================= */

function CartCard({
  items,
  total,
  notes,
  onNotesChange,
  onQuantityChange,
  onRemove,
  canSubmit,
  isSubmitting,
  error,
  onSubmit,
}: {
  items: CartItem[];
  total: number;
  notes: string;
  onNotesChange: (v: string) => void;
  onQuantityChange: (serviceId: string, quantity: number) => void;
  onRemove: (serviceId: string) => void;
  canSubmit: boolean;
  isSubmitting: boolean;
  error: unknown;
  onSubmit: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3 flex-wrap">
          <CardTitle>Pedido</CardTitle>
          <ShoppingCart className="h-4 w-4 text-muted" />
        </div>
      </CardHeader>
      <CardBody className="p-0">
        {items.length === 0 ? (
          <EmptyState
            icon={<Inbox />}
            title="Carrito vacío"
            description="Tocá un servicio del catálogo para agregarlo."
          />
        ) : (
          <>
            <ul className="flex flex-col">
              {items.map((it) => (
                <CartLineItem
                  key={it.service.id}
                  item={it}
                  onQuantityChange={onQuantityChange}
                  onRemove={onRemove}
                />
              ))}
            </ul>

            <div className="p-4 border-t border-border">
              <Label htmlFor="pos-notes" variant="caps">
                Notas <span className="text-muted normal-case font-normal">(opcional)</span>
              </Label>
              <Textarea
                id="pos-notes"
                placeholder="Mancha en camisa blanca — proceso delicado."
                value={notes}
                onChange={(e) => onNotesChange(e.target.value)}
                className="mt-1.5"
              />
            </div>

            <div className="px-4 py-3 border-t border-border flex items-center justify-between">
              <span className="text-label uppercase text-muted">Total</span>
              <span className="text-display-kpi num text-fg">
                ${total.toLocaleString('es-MX')}
              </span>
            </div>

            {error instanceof Error && (
              <div className="px-4 pb-3">
                <Alert variant="error">{error.message}</Alert>
              </div>
            )}

            <div className="px-4 pb-4">
              <Button
                type="button"
                size="lg"
                className="w-full"
                disabled={!canSubmit}
                onClick={onSubmit}
              >
                {isSubmitting ? (
                  <>
                    <Spinner size="sm" tone="inverse" />
                    Creando pedido…
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Crear pedido
                  </>
                )}
              </Button>
            </div>
          </>
        )}
      </CardBody>
    </Card>
  );
}

function CartLineItem({
  item,
  onQuantityChange,
  onRemove,
}: {
  item: CartItem;
  onQuantityChange: (serviceId: string, quantity: number) => void;
  onRemove: (serviceId: string) => void;
}) {
  const { service, quantity } = item;
  const unitLabel = UNIT_LABEL[service.unit];
  return (
    <li className="flex items-start gap-3 px-4 py-3 border-b border-border last:border-b-0">
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-fg line-clamp-1">{service.name}</div>
        <div className="text-meta text-muted num">
          ${service.unitPrice.toLocaleString('es-MX')} / {unitLabel}
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <QuantityStepper
          value={quantity}
          min={service.minQuantity ?? 1}
          unit={unitLabel}
          onChange={(q) => onQuantityChange(service.id, q)}
        />
        <div className="flex items-center gap-2">
          <span className="text-meta text-muted num">
            = ${(service.unitPrice * quantity).toLocaleString('es-MX')}
          </span>
          <IconButton
            icon={<Trash2 className="h-3.5 w-3.5" />}
            ariaLabel={`Quitar ${service.name}`}
            onClick={() => onRemove(service.id)}
          />
        </div>
      </div>
    </li>
  );
}

function QuantityStepper({
  value,
  min,
  unit,
  onChange,
}: {
  value: number;
  min: number;
  unit: string;
  onChange: (q: number) => void;
}) {
  return (
    <div className="inline-flex items-center bg-surface border border-border rounded-sm overflow-hidden">
      <button
        type="button"
        aria-label="Disminuir"
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="h-7 w-7 inline-flex items-center justify-center text-muted hover:bg-canvas hover:text-fg disabled:opacity-40"
      >
        −
      </button>
      <input
        type="number"
        value={value}
        min={min}
        onChange={(e) => {
          const v = Number(e.target.value);
          if (Number.isFinite(v) && v >= 0) onChange(v);
        }}
        className="w-12 h-7 text-center text-[13px] font-semibold num bg-transparent border-x border-border focus:outline-none focus:bg-accent-soft"
      />
      <button
        type="button"
        aria-label="Aumentar"
        onClick={() => onChange(value + 1)}
        className="h-7 w-7 inline-flex items-center justify-center text-muted hover:bg-canvas hover:text-fg"
      >
        +
      </button>
      <span className="px-1.5 text-meta text-muted">{unit}</span>
    </div>
  );
}

/* =========================================================================
 * NewCustomerModal — inline creation of customer from POS.
 * ========================================================================= */

function NewCustomerModal({
  open,
  onClose,
  onSubmit,
  submitting,
  error,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (input: import('@lavanderpro/shared-types').CreateCustomerInput) => Promise<void>;
  submitting: boolean;
  error: unknown;
}) {
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors },
  } = useForm<NewCustomerForm>({
    resolver: zodResolver(
      CreateCustomerInputSchema.transform((v) => v),
    ),
    defaultValues: { name: '', phone: '', email: '' },
  });

  useEffect(() => {
    if (open) reset({ name: '', phone: '', email: '' });
  }, [open, reset]);

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()}>
      <Modal.Content>
        <Modal.Header>
          <Modal.Title>Nuevo cliente</Modal.Title>
          <Modal.Description>
            Indicá al menos un teléfono o un correo.
          </Modal.Description>
        </Modal.Header>
        <form
          onSubmit={handleSubmit(async (data) => {
            try {
              await onSubmit({
                name: data.name,
                phone: data.phone || undefined,
                email: data.email || undefined,
              });
            } catch (e) {
              const msg = e instanceof Error ? e.message : 'Error al guardar';
              setError('name', { type: 'manual', message: msg });
            }
          })}
          noValidate
        >
          <Modal.Body>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="ncust-name" variant="caps">
                  Nombre
                </Label>
                <Input
                  id="ncust-name"
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
                  <Label htmlFor="ncust-phone" variant="caps">
                    Teléfono
                  </Label>
                  <Input
                    id="ncust-phone"
                    type="tel"
                    placeholder="55 1234 5678"
                    autoComplete="off"
                    {...register('phone')}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="ncust-email" variant="caps">
                    Correo
                  </Label>
                  <Input
                    id="ncust-email"
                    type="email"
                    placeholder="contacto@hotel.com"
                    autoComplete="off"
                    {...register('email')}
                  />
                </div>
              </div>
            </div>
          </Modal.Body>
          {error instanceof Error && (
            <div className="px-6 pb-2">
              <Alert variant="error">{error.message}</Alert>
            </div>
          )}
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