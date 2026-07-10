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
import { CreateCustomerInputSchema } from '@lavanderpro/shared-types';
import type { PaymentMethod } from '@lavanderpro/shared-types';
import type { CustomerSnapshot, ServiceSnapshot } from '@lavanderpro/db-client';
import {
  Banknote,
  CreditCard,
  Inbox,
  Plus,
  Receipt,
  Search as SearchIcon,
  ShoppingCart,
  Sparkles,
  Trash2,
  UserPlus,
  Wallet,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { useCreatePayment } from '~/stores/payments-queries';

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
 * Línea de cobro que el cajero puede apilar (pago mixto). El POS arranca
 * con UNA línea pre-llenada cuando abre el modal de checkout; permite
 * agregar más si necesita dividir el cobro.
 *
 * Para EFECTIVO existen DOS montos:
 *  - `amount`   = anticipo / a cuenta del pedido (lo que se imputa)
 *  - `received` = efectivo que el cliente entrega físicamente
 *  Cambio = received - amount (si received > amount)
 *
 * El cliente puede decir "dejo 5 de anticipo y pago con un billete de 10":
 * anticipo = 5, recibido = 10, cambio = 5. Pendiente del pedido = 5.
 *
 * Para TARJETA / TARJETA DE PUNTOS solo `amount` aplica (no hay cambio).
 */
interface PaymentDraft {
  /** id local (crypto.randomUUID). Único por línea de cobro. */
  id: string;
  method: PaymentMethod;
  /**
   * `amount` es la cantidad imputada / cobrada por esta línea.
   *  - Efectivo: anticipo (a cuenta del pedido).
   *  - Tarjeta/puntos: monto cobrado.
   * Si es `''` (string vacío), significa "aún no definido".
   */
  amount: number | '';
  /**
   * Solo efectivo: efectivo que el cliente entrega físicamente.
   * Si `amount` es 100 y `received` es 100 → pago exacto.
   * Si `amount` es 100 y `received` es 150 → cambio = 50.
   * Si `amount` es 5  y `received` es 10  → anticipo 5, cambio 5,
   * pendiente del pedido = total - 5.
   */
  received?: number | '';
  reference?: string;
}

const PAYMENT_METHODS: Array<{
  value: PaymentMethod;
  label: string;
  shortLabel: string;
  hint?: string;
  Icon: typeof Banknote;
}> = [
  { value: 'cash', label: 'Efectivo', shortLabel: 'Efectivo', Icon: Banknote },
  {
    value: 'card',
    label: 'Tarjeta',
    shortLabel: 'Tarjeta',
    hint: 'Débito o crédito',
    Icon: CreditCard,
  },
  {
    value: 'points',
    label: 'Tarjeta de puntos',
    shortLabel: 'Puntos',
    hint: 'Recompensas del cliente',
    Icon: Sparkles,
  },
];

/** Etiquetas visualizables del método (consistente con `PAYMENT_METHODS`). */
const PAYMENT_LABELS: Record<PaymentMethod, string> = PAYMENT_METHODS.reduce(
  (acc, m) => {
    acc[m.value] = m.label;
    return acc;
  },
  {} as Record<PaymentMethod, string>,
);

/**
 * PosContent — Punto de Venta.
 *
 * Layout 2-col (CSS grid):
 *  - Left (services picker, 2fr): FilterGroup Populares/Categorías + SearchInput
 *    + body (grid de ServiceCard o Accordion de categorías).
 *  - Right (cart, 1fr): customer picker + line items + total + Proceder al pago.
 *
 * Flujo de checkout:
 *  - "Proceder al pago" abre CheckoutModal con 3 métodos (Efectivo /
 *    Tarjeta / Tarjeta de puntos).
 *  - En efectivo: input del monto entregado por el cliente, cálculo del
 *    cambio, se puede cobrar parcial como anticipo.
 *  - Tarjeta y Tarjeta de puntos: el monto es siempre el saldo pendiente
 *    (editable para cobre parcial).
 *  - Permite múltiples líneas de pago (cobro mixto). Al confirmar se
 *    crea el pedido + los pagos asociados en una sola operación
 *    offline-first.
 *
 * Customer puede ser opcional. Para MVP dejamos el customer picker
 * simple con un modal de "Nuevo cliente".
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
  const [checkoutOpen, setCheckoutOpen] = useState(false);

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
  const createPaymentMut = useCreatePayment(tenantId ?? '');
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
  const servicesByCategory = useMemo(() => {
    const groups = new Map<string, { id: string; name: string; services: ServiceSnapshot[] }>();
    for (const cat of categoriesData) {
      groups.set(cat.id, { id: cat.id, name: cat.name, services: [] });
    }
    groups.set('__none__', { id: '__none__', name: 'Sin categoría', services: [] });
    for (const s of filteredServices) {
      const key = s.categoryId ?? '__none__';
      const group = groups.get(key);
      if (group) group.services.push(s);
    }
    return Array.from(groups.values()).filter((g) => g.services.length > 0);
  }, [filteredServices, categoriesData]);

  // === Cart helpers ===
  const updateQuantity = (serviceId: string, quantity: number) => {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(serviceId);
      const safeQty = Math.max(0, Math.floor(quantity));

      if (safeQty === 0) {
        if (existing) next.delete(serviceId);
        return next;
      }

      if (!existing) {
        const service = servicesData.find((s) => s.id === serviceId);
        const minQty = service?.minQuantity ?? 1;
        const finalQty = Math.max(safeQty, minQty);
        if (!service) return prev;
        next.set(serviceId, { service, quantity: finalQty });
        return next;
      }

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
  /**
   * Para cobrar en POS hace falta identificar al cliente: el pedido se
   * persiste con `customerId` + `customerName` denormalizados, y la
   * recolección del saldo pendiente también queda ligada a ese cliente.
   * Por eso el botón "Proceder al pago" se habilita solo si hay un
   * cliente seleccionado.
   */
  const canCheckout = cartItems.length > 0 && selectedCustomer !== null;

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

  /**
   * Al confirmar el checkout, crea el pedido + N pagos en una sola
   * operación. Si crear el pedido falla, el modal queda abierto con el
   * error para que el cajero pueda reintentar.
   *
   * Si crear el pedido tiene éxito pero el/los pagos fallan, igualmente
   * limpiamos el carrito (el pedido quedó hecho en local) y enqueueamos
   * los pagos — la UI de pagos es secundaria y se reconcilia luego.
   */
  const handleConfirmCheckout = async (payments: PaymentDraft[]) => {
    // Botón "Proceder al pago" solo se habilita con cliente
    // seleccionado; este assert es defensivo.
    if (!selectedCustomer) return;

    const validPayments = payments.filter(
      (p) => typeof p.amount === 'number' && p.amount > 0,
    );

    const items = cartItems.map((it) => ({
      serviceId: it.service.id,
      serviceName: it.service.name,
      unit: it.service.unit,
      unitPrice: it.service.unitPrice,
      quantity: it.quantity,
    }));

    const orderInput: Parameters<typeof createOrderMut.mutateAsync>[0] = {
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      customerPhone: selectedCustomer.phone,
      isNewCustomer: false,
      notes: orderNotes.trim() || undefined,
      items,
    };

    try {
      const created = await createOrderMut.mutateAsync(orderInput);

      // Cobros: se crean en paralelo para no bloquear. Si alguno falla,
      // la UI ya muestra el pedido; los pagos parciales quedan
      // en sync_queue y se suben al reconectar.
      const results = await Promise.allSettled(
        validPayments.map((p) =>
          createPaymentMut.mutateAsync({
            orderId: created.id,
            method: p.method,
            amount: p.amount as number,
            reference: p.reference,
          }),
        ),
      );

      const failed = results.filter((r) => r.status === 'rejected');
      if (failed.length > 0) {
        // eslint-disable-next-line no-console
        console.warn(
          `[pos] ${failed.length} pago(s) fallaron online; quedaron en sync_queue.`,
          failed,
        );
      }

      // Reset state en éxito (incluso si algún pago falló online — están
      // encolados y se aplican cuando vuelva la conexión).
      setCart(new Map());
      setSelectedCustomer(null);
      setOrderNotes('');
      setCheckoutOpen(false);
    } catch (e) {
      // El error ya lo muestra el mutation; dejamos el modal abierto
      // para que el cajero pueda reintentar o ajustar.
      // eslint-disable-next-line no-console
      console.error('[pos] checkout failed:', e);
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
              canCheckout={canCheckout}
              isCheckoutSubmitting={createOrderMut.isPending}
              error={createOrderMut.error}
              onCheckoutClick={() => setCheckoutOpen(true)}
            />
          </div>
        </div>
      </main>

      <CheckoutModal
        open={checkoutOpen}
        onClose={() => setCheckoutOpen(false)}
        total={cartTotal}
        submitting={createOrderMut.isPending}
        error={createOrderMut.error}
        onConfirm={handleConfirmCheckout}
      />

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
 * CartCard — line items + total + Proceder al pago.
 * ========================================================================= */

function CartCard({
  items,
  total,
  notes,
  onNotesChange,
  onQuantityChange,
  onRemove,
  canCheckout,
  isCheckoutSubmitting,
  error,
  onCheckoutClick,
}: {
  items: CartItem[];
  total: number;
  notes: string;
  onNotesChange: (v: string) => void;
  onQuantityChange: (serviceId: string, quantity: number) => void;
  onRemove: (serviceId: string) => void;
  canCheckout: boolean;
  isCheckoutSubmitting: boolean;
  error: unknown;
  onCheckoutClick: () => void;
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

            <div className="px-4 pb-4 flex flex-col gap-1.5">
              <Button
                type="button"
                size="lg"
                className="w-full"
                disabled={!canCheckout || isCheckoutSubmitting}
                onClick={onCheckoutClick}
              >
                <Wallet className="h-4 w-4" />
                Proceder al pago
              </Button>
              {!canCheckout && items.length > 0 && (
                <p className="text-meta text-muted text-center">
                  Seleccioná un cliente antes de cobrar.
                </p>
              )}
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
 * CheckoutModal — selección de método de pago + cobro (pago mixto).
 * ========================================================================= */

/** Esquema: array de líneas de pago. */
const PaymentDraftSchema = z.object({
  id: z.string(),
  method: z.enum(['cash', 'card', 'transfer', 'points', 'other']),
  amount: z.union([z.number().nonnegative(), z.literal('')]),
  received: z
    .union([z.number().nonnegative(), z.literal('')])
    .optional(),
  reference: z.string().max(80).optional(),
});

/** Form schema: no usamos RHF para el array dinámico (es más simple con useState). */

interface CheckoutFormState {
  payments: PaymentDraft[];
}

function createInitialPayment(): PaymentDraft {
  return {
    id: crypto.randomUUID(),
    method: 'cash',
    amount: '',
    received: '',
    reference: '',
  };
}

function CheckoutModal({
  open,
  onClose,
  total,
  submitting,
  error,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  total: number;
  submitting: boolean;
  error: unknown;
  onConfirm: (payments: PaymentDraft[]) => Promise<void>;
}) {
  const [form, setForm] = useState<CheckoutFormState>({
    payments: [createInitialPayment()],
  });
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Reset al abrir/cerrar.
  useEffect(() => {
    if (open) {
      setForm({ payments: [createInitialPayment()] });
      setSubmitError(null);
    }
  }, [open]);

  const sumCollected = form.payments.reduce((acc, p) => {
    return acc + (typeof p.amount === 'number' ? p.amount : 0);
  }, 0);
  const remaining = Math.max(0, total - sumCollected);

  function updateLine(id: string, patch: Partial<PaymentDraft>) {
    setForm((prev) => ({
      payments: prev.payments.map((p) =>
        p.id === id ? { ...p, ...patch } : p,
      ),
    }));
  }

  function addLine() {
    setForm((prev) => ({
      payments: [...prev.payments, createInitialPayment()],
    }));
  }

  function removeLine(id: string) {
    setForm((prev) => ({
      payments: prev.payments.length > 1
        ? prev.payments.filter((p) => p.id !== id)
        : prev.payments, // nunca dejar el array vacío
    }));
  }

  const validLines = form.payments.filter(
    (p) => typeof p.amount === 'number' && p.amount > 0,
  );
  // Si no hay ninguna línea válida y el total es 0, dejamos confirmar
  // igual (pedido sin cobro — quedará como pendiente).
  const canConfirm =
    !submitting &&
    (validLines.length > 0 || total === 0);

  async function handleConfirm() {
    setSubmitError(null);
    try {
      await onConfirm(form.payments);
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Error al cobrar');
    }
  }

  return (
    <Modal open={open} onOpenChange={(o) => !o && onClose()}>
      <Modal.Content className="max-w-2xl">
        <Modal.Header>
          <Modal.Title>
            <span className="inline-flex items-center gap-2">
              <Receipt className="h-5 w-5 text-accent" />
              Proceder al pago
            </span>
          </Modal.Title>
          <Modal.Description>
            Elegí el método de cobro y registrá el monto. Si es efectivo,
            escribí cuánto te entregó el cliente — calculamos el cambio.
          </Modal.Description>
        </Modal.Header>

        <Modal.Body>
          <div className="flex flex-col gap-4">
            {form.payments.map((line, idx) => (
              <PaymentLineEditor
                key={line.id}
                line={line}
                index={idx}
                total={total}
                lineAmount={
                  typeof line.amount === 'number' ? line.amount : 0
                }
                lineReceived={
                  line.method === 'cash' &&
                  typeof line.received === 'number'
                    ? line.received
                    : 0
                }
                otherLinesTotal={
                  sumCollected -
                  (typeof line.amount === 'number' ? line.amount : 0)
                }
                canRemove={form.payments.length > 1}
                onChange={(patch) => updateLine(line.id, patch)}
                onRemove={() => removeLine(line.id)}
              />
            ))}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={addLine}
                disabled={form.payments.length >= 4}
              >
                <Plus className="h-3.5 w-3.5" />
                Dividir cobro (pago mixto)
              </Button>
              {form.payments.length >= 4 && (
                <span className="text-meta text-muted">
                  Máximo 4 líneas por pedido.
                </span>
              )}
            </div>

            <CheckoutSummary
              total={total}
              collected={sumCollected}
              remaining={remaining}
            />

            {error instanceof Error && (
              <Alert variant="error">{error.message}</Alert>
            )}
            {submitError && <Alert variant="error">{submitError}</Alert>}
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
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            {submitting ? (
              <>
                <Spinner size="sm" tone="inverse" />
                Procesando…
              </>
            ) : validLines.length === 0 ? (
              <>
                <Plus className="h-4 w-4" />
                Crear pedido pendiente
              </>
            ) : (
              <>
                <Receipt className="h-4 w-4" />
                Confirmar y cobrar
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal.Content>
    </Modal>
  );
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function PaymentLineEditor({
  line,
  index,
  total,
  lineAmount,
  lineReceived,
  otherLinesTotal,
  canRemove,
  onChange,
  onRemove,
}: {
  line: PaymentDraft;
  index: number;
  total: number;
  /**
   * Monto numérico imputable por ESTA línea (0 si vacío).
   * Efectivo: anticipo. Tarjeta/puntos: monto cobrado.
   */
  lineAmount: number;
  /**
   * Solo efectivo: monto físico entregado por el cliente (0 si vacío).
   */
  lineReceived: number;
  /** Suma de las OTRAS líneas (no esta). */
  otherLinesTotal: number;
  canRemove: boolean;
  onChange: (patch: Partial<PaymentDraft>) => void;
  onRemove: () => void;
}) {
  const isCash = line.method === 'cash';

  /**
   * Cálculos para EFECTIVO:
   * - Imputado por esta línea (cap a lo pendiente): min(lineAmount, pendiente de esta línea)
   * - Cambio de esta línea (si es cash): max(0, recibido - monto_imputado)
   * - Pendiente tras imputar todas las líneas
   *
   * Caso del usuario: total=10, anticipo=5, recibido=10:
   *   pendiente_antes_de_esta = max(0, 10 - otherLinesTotal)
   *   Pendiente esta línea = max(0, pendiente_antes - lineAmount) = 5
   *   Cambio esta línea = max(0, 10 - min(5, 5)) = 5  ✓
   */
  const pendingBeforeThisLine = Math.max(0, total - otherLinesTotal);
  const imputedByThisLine = Math.min(lineAmount, pendingBeforeThisLine);
  const lineChange = isCash
    ? Math.max(0, lineReceived - imputedByThisLine)
    : 0;
  const pendingAfter = Math.max(0, total - otherLinesTotal - imputedByThisLine);

  // Validación: no se puede imputar más que lo recibido en efectivo.
  const cashOverimputed =
    isCash &&
    lineReceived > 0 &&
    lineAmount > 0 &&
    lineAmount > lineReceived;

  const inputLabel = isCash ? 'A cuenta del pedido' : 'Monto a cobrar';
  const inputPlaceholder = isCash
    ? 'Cuánto imputás a este pedido'
    : '¿Cuánto cobrás con este método?';

  return (
    <div className="flex flex-col gap-3 p-3 border border-border rounded-md bg-surface-2/40">
      <div className="flex items-center justify-between gap-2">
        <Label variant="caps" className="!mb-0">
          Línea {index + 1}
        </Label>
        {canRemove && (
          <IconButton
            icon={<Trash2 className="h-3.5 w-3.5" />}
            ariaLabel="Quitar línea de cobro"
            onClick={onRemove}
          />
        )}
      </div>

      {/* Total destacado — siempre visible al cajero */}
      <div className="flex items-center justify-between px-3 py-2 bg-canvas border border-border rounded-sm">
        <span className="text-label uppercase text-muted">Total del pedido</span>
        <span className="text-title-sm font-bold num text-fg">
          ${total.toLocaleString('es-MX')}
        </span>
      </div>

      {/* Método */}
      <div className="grid grid-cols-3 gap-2">
        {PAYMENT_METHODS.map((m) => {
          const active = line.method === m.value;
          const Icon = m.Icon;
          return (
            <button
              key={m.value}
              type="button"
              onClick={() =>
                onChange({
                  method: m.value,
                  // Al cambiar a no-cash, limpiamos `received` para no
                  // arrastrar el campo del efectivo.
                  ...(m.value !== 'cash' ? { received: '' } : {}),
                })
              }
              aria-pressed={active}
              className={
                'flex flex-col items-start gap-1 p-2.5 rounded-md border ' +
                'transition-colors duration-ui text-left ' +
                (active
                  ? 'border-accent bg-accent-soft'
                  : 'border-border bg-surface hover:bg-canvas')
              }
            >
              <span className="inline-flex items-center gap-1.5">
                <Icon
                  className={
                    'h-4 w-4 ' + (active ? 'text-accent' : 'text-muted')
                  }
                />
                <span
                  className={
                    'text-[13px] font-semibold ' +
                    (active ? 'text-accent' : 'text-fg')
                  }
                >
                  {m.shortLabel}
                </span>
              </span>
              {m.hint && (
                <span className="text-[11px] text-muted leading-tight">
                  {m.hint}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Anticipo / Monto a cobrar */}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`pay-amount-${line.id}`} variant="caps">
          {inputLabel}
        </Label>
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-[13px] font-semibold pointer-events-none">
            $
          </span>
          <Input
            id={`pay-amount-${line.id}`}
            type="number"
            inputMode="decimal"
            step="0.01"
            min={0}
            placeholder={inputPlaceholder}
            className="pl-6 num text-[15px] h-10"
            value={line.amount === '' ? '' : line.amount}
            onChange={(e) => {
              const raw = e.target.value;
              if (raw === '') {
                onChange({ amount: '' });
                return;
              }
              const v = Number(raw);
              if (Number.isFinite(v) && v >= 0) {
                onChange({ amount: round2(v) });
              }
            }}
          />
        </div>
        <p className="text-meta text-muted">{inputPlaceholder}</p>
      </div>

      {/* Solo efectivo: segundo input "Efectivo recibido" */}
      {isCash && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`pay-received-${line.id}`} variant="caps">
            Efectivo recibido del cliente
          </Label>
          <div className="relative">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-[13px] font-semibold pointer-events-none">
              $
            </span>
            <Input
              id={`pay-received-${line.id}`}
              type="number"
              inputMode="decimal"
              step="0.01"
              min={0}
              placeholder="¿Con cuánto te paga?"
              className="pl-6 num text-[15px] h-10"
              value={
                line.received === undefined || line.received === ''
                  ? ''
                  : line.received
              }
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === '') {
                  onChange({ received: '' });
                  return;
                }
                const v = Number(raw);
                if (Number.isFinite(v) && v >= 0) {
                  onChange({ received: round2(v) });
                }
              }}
            />
          </div>
          <p className="text-meta text-muted">
            Ingresá el billete o la suma que te entrega el cliente.
          </p>
        </div>
      )}

      {/* Feedback en vivo según método */}
      {isCash ? (
        <CashFeedback
          total={total}
          imputed={imputedByThisLine}
          received={lineReceived}
          change={lineChange}
          pending={pendingAfter}
          overimputed={cashOverimputed}
          otherLines={otherLinesTotal}
        />
      ) : lineAmount > 0 ? (
        <NonCashFeedback amount={lineAmount} pending={pendingAfter} />
      ) : null}

      {/* Referencia (opcional, útil para tarjeta / puntos) */}
      {(line.method === 'card' || line.method === 'points' || line.method === 'transfer') && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`pay-ref-${line.id}`} variant="caps">
            Referencia <span className="text-muted normal-case">(opcional)</span>
          </Label>
          <Input
            id={`pay-ref-${line.id}`}
            placeholder={
              line.method === 'card'
                ? 'Últimos 4 dígitos / voucher'
                : line.method === 'points'
                ? 'Nº tarjeta de puntos'
                : 'Referencia'
            }
            value={line.reference ?? ''}
            onChange={(e) => onChange({ reference: e.target.value })}
            className="num"
          />
        </div>
      )}
    </div>
  );
}

/**
 * CashFeedback — desglose en vivo del cobro en EFECTIVO.
 *
 * Modelo: el cajero ingresa DOS montos independientes:
 *  - `imputed`  = anticipo / a cuenta (lo que se imputa a este pedido)
 *  - `received` = efectivo físico entregado por el cliente
 *
 * Cambio de esta línea = max(0, received - imputed)
 *
 * Casos (total = 10):
 *   anticipo=10, recibido=10 → "Pago exacto"
 *   anticipo=10, recibido=15 → "Cambio a devolver: $5"
 *   anticipo=5,  recibido=10 → "Anticipo $5 · pendiente $5" + "Cambio $5"
 *   anticipo=10, recibido=5  → error: no se puede imputar más de lo recibido
 */
function CashFeedback({
  total,
  imputed,
  received,
  change,
  pending,
  overimputed,
  otherLines,
}: {
  total: number;
  imputed: number;
  received: number;
  change: number;
  pending: number;
  overimputed: boolean;
  otherLines: number;
}) {
  // Estado inicial: ningún input lleno. Mostrar ayuda contextual.
  if (imputed <= 0 && received <= 0) {
    return (
      <p className="text-meta text-muted">
        Ej: si el cliente deja $5 de anticipo y te paga con un billete de
        $10, escribís <strong className="num">5</strong> en &ldquo;A cuenta&rdquo; y{' '}
        <strong className="num">10</strong> en &ldquo;Efectivo recibido&rdquo; — el
        cambio se calcula solo.
      </p>
    );
  }

  // Error: el cajero imputó más de lo que el cliente dio.
  if (overimputed) {
    return (
      <div className="rounded-sm border border-danger/40 bg-danger/10 px-2.5 py-2 text-meta">
        <span className="font-semibold text-danger">No se puede.</span>{' '}
        <span className="text-fg">
          Estás imputando más de lo que el cliente entrega en este método.
          Ajustá el monto a cuenta del pedido.
        </span>
      </div>
    );
  }

  const partial = pending > 0;
  const isExact = received > 0 && change === 0 && imputed <= received;

  return (
    <div className="rounded-sm bg-accent-soft border border-accent/30 px-2.5 py-2 text-meta flex flex-col gap-1">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="text-muted">Recibido:</span>{' '}
        <span className="font-semibold num text-fg">
          ${received.toLocaleString('es-MX')}
        </span>
        <span className="text-muted">a cuenta del pedido:</span>{' '}
        <span className="font-semibold num text-fg">
          ${imputed.toLocaleString('es-MX')}
        </span>
      </div>

      {change > 0 && (
        <div>
          <span className="text-muted">Cambio a devolver:</span>{' '}
          <span className="font-bold num text-accent">
            ${change.toLocaleString('es-MX')}
          </span>
        </div>
      )}

      {partial && (
        <div>
          <span className="text-muted">Pendiente del pedido:</span>{' '}
          <span className="font-semibold num text-danger">
            ${pending.toLocaleString('es-MX')}
          </span>
          {otherLines > 0 && (
            <span className="text-muted">
              {' '}
              (ya imputaste ${otherLines.toLocaleString('es-MX')} en otras
              líneas)
            </span>
          )}
        </div>
      )}

      {isExact && !partial && (
        <div className="font-semibold text-accent">Pago exacto.</div>
      )}

      {!partial && change > 0 && (
        <div className="font-semibold text-accent">
          Pedido cobrado completo — devolver cambio al cliente.
        </div>
      )}
    </div>
  );
}

/**
 * NonCashFeedback — para tarjeta / tarjeta de puntos. Sin cambio.
 */
function NonCashFeedback({
  amount,
  pending,
}: {
  amount: number;
  pending: number;
}) {
  if (pending > 0) {
    return (
      <div className="rounded-sm bg-accent-soft border border-accent/30 px-2.5 py-2 text-meta">
        <span className="text-muted">Cobrado con este método:</span>{' '}
        <span className="font-semibold num text-fg">
          ${amount.toLocaleString('es-MX')}
        </span>
        <span className="text-muted"> · pendiente:</span>{' '}
        <span className="font-semibold num text-danger">
          ${pending.toLocaleString('es-MX')}
        </span>
      </div>
    );
  }
  return (
    <div className="rounded-sm bg-accent-soft border border-accent/30 px-2.5 py-2 text-meta">
      <span className="font-semibold text-accent">Cobrado.</span>{' '}
      <span className="text-muted">Total cubierto.</span>
    </div>
  );
}

function CheckoutSummary({
  total,
  collected,
  remaining,
}: {
  total: number;
  collected: number;
  remaining: number;
}) {
  return (
    <div className="rounded-md border border-border bg-surface p-3">
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-meta uppercase text-muted">Total</div>
          <div className="text-title font-bold num text-fg">
            ${total.toLocaleString('es-MX')}
          </div>
        </div>
        <div>
          <div className="text-meta uppercase text-muted">Cobrado</div>
          <div className="text-title font-bold num text-fg">
            ${collected.toLocaleString('es-MX')}
          </div>
        </div>
        <div>
          <div className="text-meta uppercase text-muted">Pendiente</div>
          <div
            className={
              'text-title font-bold num ' +
              (remaining > 0 ? 'text-danger' : 'text-accent')
            }
          >
            ${remaining.toLocaleString('es-MX')}
          </div>
        </div>
      </div>
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

// Validación runtime mínima al confirmar (sanity check — la UI ya
// filtra con `validLines`). Exportado por si se reutiliza en tests.
export function parseCheckoutForm(payments: PaymentDraft[]): PaymentDraft[] {
  const parsed: PaymentDraft[] = [];
  for (const p of payments) {
    const r = PaymentDraftSchema.safeParse(p);
    if (r.success) parsed.push(r.data);
  }
  return parsed;
}
