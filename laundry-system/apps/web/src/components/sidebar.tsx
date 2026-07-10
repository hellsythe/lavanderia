import Link from 'next/link';
import {
  Bell,
  Box,
  ChartBar,
  CircleUser,
  ClipboardList,
  Cog,
  CreditCard,
  Home,
  ListChecks,
  LogOut,
  Package,
  Plus,
  Truck,
  Users,
} from 'lucide-react';
import type { ReactNode } from 'react';

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number;
}

const PRIMARY: NavItem[] = [
  { href: '/', label: 'Panel Principal', icon: <Home className="h-4 w-4" /> },
  { href: '/pos', label: 'Levantar pedido', icon: <Plus className="h-4 w-4" /> },
  { href: '/pedidos', label: 'Pedidos', icon: <ClipboardList className="h-4 w-4" />, badge: 12 },
  { href: '/clientes', label: 'Clientes', icon: <Users className="h-4 w-4" /> },
  { href: '/servicios', label: 'Servicios', icon: <ListChecks className="h-4 w-4" /> },
  { href: '/categorias', label: 'Categorías', icon: <Box className="h-4 w-4" /> },
];

const REPORTES: NavItem[] = [
  { href: '/reportes/ingresos', label: 'Ingresos', icon: <ChartBar className="h-4 w-4" /> },
  { href: '/reportes/caja', label: 'Cierre de caja', icon: <CreditCard className="h-4 w-4" /> },
  { href: '/reportes/delivery', label: 'Delivery', icon: <Truck className="h-4 w-4" /> },
];

const CONFIG: NavItem[] = [
  { href: '/inventario', label: 'Inventario', icon: <Package className="h-4 w-4" /> },
  { href: '/configuracion', label: 'Configuración', icon: <Cog className="h-4 w-4" /> },
];

export function Sidebar() {
  return (
    <aside className="sticky top-0 h-screen w-sidebar-w shrink-0 bg-surface border-r border-border z-30 overflow-y-auto">
      <div className="px-4 py-3.5 border-b border-border">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-icon bg-accent text-accent-fg flex items-center justify-center font-bold text-[12px]">
            L
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-brand font-bold text-fg">LavanderPro</span>
            <span className="text-label uppercase text-muted">Industrial</span>
          </div>
        </Link>
      </div>

      <nav className="px-3 py-3 flex flex-col gap-5">
        <NavSection items={PRIMARY} />
        <NavSection label="Reportes" items={REPORTES} />
        <NavSection label="Configuración" items={CONFIG} />
      </nav>

      <div className="mt-auto px-3 py-3 border-t border-border sticky bottom-0 bg-surface">
        <div className="flex items-center gap-2 px-2 py-2 rounded-sm hover:bg-canvas cursor-pointer">
          <div className="h-7 w-7 rounded-full bg-accent-soft text-accent flex items-center justify-center font-bold text-[12px]">
            <CircleUser className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[13px] font-semibold text-fg truncate">Carlos Méndez</div>
            <div className="text-meta text-muted truncate">carlos@lavanderia.mx</div>
          </div>
          <button
            type="button"
            aria-label="Cerrar sesión"
            className="h-7 w-7 inline-flex items-center justify-center text-muted hover:text-fg rounded-icon transition-colors duration-ui"
          >
            <LogOut className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function NavSection({ label, items }: { label?: string; items: NavItem[] }) {
  return (
    <div className="flex flex-col gap-0.5">
      {label && (
        <div className="label-caps px-2 mb-2">{label}</div>
      )}
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className="flex items-center gap-2.5 px-2 py-2 rounded-icon text-nav text-fg hover:bg-canvas transition-colors duration-ui"
        >
          <span className="text-muted">{item.icon}</span>
          <span className="flex-1 truncate font-medium">{item.label}</span>
          {item.badge && (
            <span className="bg-warning text-white rounded-pill px-1.5 py-px text-[10px] font-bold num">
              {item.badge}
            </span>
          )}
        </Link>
      ))}
    </div>
  );
}

export { Bell };