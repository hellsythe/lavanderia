---
name: lavanderpro-architecture
description: >
  Architecture rules for LavanderPro monorepo. Use when creating,
  moving, or refactoring any file in `apps/` or `packages/` of the
  laundry-system project. Triggers on keywords: packages/ui, primitives,
  components, sidebar, topbar, AuthShell, Sidebar, BrandIcon, PasswordInput,
  Alert, port, repository, use case, sync engine, Dexie, IndexedDB.
  Enforces the boundary between design-system primitives (packages/ui)
  and app-specific compositions (apps/web/components), the multi-tenant
  rules, and the Clean Architecture layers per module.
---

# LavanderPro — Architecture Rules

This skill encodes hard-won rules from the LavanderPro monorepo. **Violating
them creates real bugs** (UI primitives ending up in app folders, business
logic leaking into shared packages, multi-tenant data leaking across tenants).

## The directory map

```
laundry-system/
├── apps/
│   ├── web/                          # Next.js 14 — PWA + Capacitor
│   │   └── src/
│   │       ├── app/                  # Pages and route handlers
│   │       ├── components/           # APP-SPECIFIC compositions only
│   │       ├── stores/               # Zustand stores
│   │       └── lib/                  # App-specific helpers (api-client, etc.)
│   └── api/                          # NestJS backend
│       └── src/
│           ├── auth/                 # Per-module Clean Architecture
│           │   ├── domain/           # Pure TS entity interfaces
│           │   ├── ports/            # Output-port interfaces
│           │   ├── infrastructure/   # Repositories + TypeORM entities
│           │   ├── strategies/       # Passport strategies
│           │   ├── auth.controller.ts
│           │   └── auth.service.ts
│           ├── tenants/              # ← cada entity en su módulo
│           ├── orders/               # ← cada entity en su módulo
│           ├── database/
│           │   ├── data-source.ts    # CLI TypeORM (catálogo compartido)
│           │   └── migrations/       # SQL migrations
│           └── common/               # Guards, interceptors, pipes
└── packages/
    ├── ui/                           # Design-system PRIMITIVES (generic)
    ├── shared-types/                 # Zod schemas (single source of truth)
    ├── db-client/                    # Dexie.js + repos (future)
    └── sync-engine/                  # Offline-first sync logic (future)
```

## Rule 1 — packages/ui vs apps/web/components

This is the most-violated rule. **Read it carefully.**

### ✅ packages/ui

Generic, reusable, **app-agnostic** primitives. Any other product that adopts
the LavanderPro design system would import these from `@lavanderpro/ui`.

| Live in `packages/ui` | Why |
|---|---|
| `Button` | Reusable everywhere |
| `Input` | Reusable everywhere |
| `Card` | Reusable everywhere |
| `StatusPill` | Generic status semantic |
| `KpiCard` | Generic analytics card |
| `Modal`, `FilterPill`, `Pagination` | Generic UI patterns |
| **`PasswordInput`** | Any form with a password |
| **`BrandIcon`** | LavanderPro brand asset (SVG-replica of `assets/brand-icon.svg`) |
| **`Alert`** | Generic error/success/info banner |
| `Stepper`, `Accordion`, `ServiceCard`, etc. | Any app with same flow |

### ❌ apps/web/components

**App-specific compositions** that compose primitives AND contain product
logic (routes, auth, business flows specific to LavanderPro). Other LavanderPro
products would NOT import these.

| Live in `apps/web/components` | Why |
|---|---|
| `AuthShell` | LavanderPro's auth layout — composes BrandIcon + form, but is itself a composition |
| `Sidebar` | Contains routes specific to LavanderPro (Pedidos, POS, Clientes…) |
| `Topbar` | Contains LavanderPro-specific date search + nav |

### The decision tree

```
Does this component contain any product-specific logic (a route, an action,
LavanderPro's name, business rules)?

  YES → apps/web/components/
  NO  → Does it compose 2+ primitives, but is still generic?
          YES → could be either; ask "would another LavanderPro-domain
                app reuse this verbatim?" If no → apps/web/.
          NO  → it's a primitive → packages/ui
```

## Rule 2 — Multi-tenant isolation

Every business entity MUST have a `tenantId` column, and every JWT MUST carry
`tenantId`. Backend filters ALL queries by it.

| ✅ Always | ❌ Never |
|---|---|
| `WHERE tenant_id = $1` on every query | Global queries without tenant scope |
| `tenantId` claim in access AND refresh JWT | Single-tenant auth tokens |
| `tenantId` validated in sync operations | Trust client payloads as-is |
| `TenantGuard` interceptor on protected routes | Public routes touching business data |

## Rule 3 — Clean Architecture inside each NestJS module

```
modules/<name>/
├── domain/                  # Pure TS, NO decorators, NO ORM imports
├── ports/                   # Output-port interfaces (Symbol tokens)
├── infrastructure/          # Adapters: TypeORM @Entity + repos
├── strategies/              # Passport (auth only)
├── <name>.service.ts        # Public service (use cases)
├── <name>.controller.ts     # Thin: HTTP in → service → HTTP out
└── <name>.module.ts         # Wires everything
```

**REGLA DURA:** Las TypeORM `@Entity()` viven **dentro de cada módulo** en
`infrastructure/`. NO existe `database/entities/` compartido.

```
✅ auth/infrastructure/user.orm-entity.ts
✅ orders/infrastructure/order.orm-entity.ts
✅ tenants/infrastructure/tenant.orm-entity.ts

❌ database/entities/user.orm-entity.ts
❌ shared/entities/order.orm-entity.ts
```

Si dos módulos necesitan el mismo "tipo" (ej. Tenant), el módulo dueño lo
expone vía su `Service` (no vía repositorio compartido). Ej: Auth necesita
Tenant → inyecta `TenantsService`, NO `TenantRepositoryPort`.

| ✅ | ❌ |
|---|---|
| TypeORM @Entity en `<module>/infrastructure/` con `domain/` siendo TS puro | `@Entity` mezclado con lógica de dominio |
| `UserRepositoryPort` interface en `ports/`, implementada en `infrastructure/typeorm-user.repository.ts` | Usar `Repository<User>` directamente en services |
| Mapper `*OrmEntity` ↔ Domain en `infrastructure/` | Misma entidad para ORM y dominio |
| Para datos compartidos entre módulos, el módulo dueño expone un `Service` | Cada módulo accede a `database/entities/` compartido |
| `database/` solo contiene `data-source.ts` (CLI migraciones) + `migrations/` (SQL) | `database/entities/` con entidades TypeORM |

## Rule 4 — Cross-platform types (Zod in shared-types)

Domain shapes **MUST** be defined as Zod schemas in `packages/shared-types`
and reused by:
- Backend (`@Body(new ZodValidationPipe(LoginInputSchema))`)
- Frontend (`useForm({ resolver: zodResolver(LoginInputSchema) })`)
- Sync engine (parsing incoming records)
- Any future consumers (mobile app, scripts)

This gives **one source of truth** validated end-to-end.

## Rule 5 — Offline-first (future, once packages/db-client exists)

| Layer | What lives there | What does NOT |
|---|---|---|
| `packages/db-client` | Dexie schema, repos, sync_queue table | API calls, business logic |
| `packages/sync-engine` | Push/pull, last-write-wins resolver, conflict notifications | UI, IndexedDB queries directly |
| `apps/web` | Calls `syncEngine.push()` etc. — never touches Dexie directly | Direct IDB transactions |

## Common mistakes — DO NOT

### ❌ Building a UI primitive in apps/web
```bash
# WRONG
apps/web/src/components/dropdown.tsx    # it's generic, should be in packages/ui

# RIGHT
packages/ui/src/components/dropdown.tsx
```

### ❌ Importing lucide-react from @lavanderpro/ui in apps/web for app icons
```ts
// WRONG — apps/web can use lucide directly (it's listed as a web dep)
import { Truck, Cog } from '@lavanderpro/ui'

// RIGHT
import { Truck, Cog } from 'lucide-react'
```

Lucide lives in **both** packages/ui (for primitives that use icons) AND in
apps/web (for app-specific UI). Don't re-export icons from the design-system
package.

### ❌ Using camelCase column names in SQL
```ts
// WRONG — TypeORM default
@Column()
tenantId: string  // → column "tenantId" in Postgres
```

```ts
// RIGHT — combined with SnakeNamingStrategy in app.module.ts
@Column()
tenantId: string  // → column "tenant_id" in Postgres (via naming strategy)
```

Or use `@Column({ name: 'tenant_id' })` explicitly.

### ❌ Logging-in an in-memory repository as a real impl
Use in-memory only for true unit tests of the service. In production, only
TypeORM (or real DB) implementations go in `infrastructure/`. Mixing in
production leads to silent data loss on restart.

### ❌ Storing refresh tokens in cookies when app will use Capacitor
For Capacitor / web / Windows native, keep tokens in `localStorage` first
(MVP), with TODO to migrate to `@capacitor/secure-storage` (Keychain/Keystore/DPAPI).
Don't reach for cookies yet — they're cross-tab but awkward in mobile WebViews.

## Component index maintenance

When you add a new component to `packages/ui/src/components/<name>.tsx`,
you MUST also add `export * from './components/<name>';` to
`packages/ui/src/index.ts`. Otherwise consumers can't import it.

When you add an icon used by an app-specific page, import directly from
`lucide-react` in the page, not via `@lavanderpro/ui`.

## Self-test before committing

Ask yourself these questions about any new file in `apps/` or `packages/`:

1. Which directory did you put it in? Why?
2. Does it import from the wrong layer? (check Rule 1 if UI, Rule 3 if backend)
3. If it touches tenant data, did you add `tenantId` everywhere?
4. If it added a shared type, did you also validate it server-side AND client-side?
5. If you added a UI primitive to packages/ui, did you add it to `index.ts`?

## When in doubt

- **Primitives go to packages/ui.**
- **App-specific compositions go to apps/web/components.**
- Ask the user with the question tool before placing it permanently.