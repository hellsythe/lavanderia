# LavanderPro — Sistema SaaS Multi-tenant Offline-first

Plataforma de gestión para lavanderías comerciales e industriales.

## Arquitectura

- **Frontend:** Next.js 14 (App Router) + Capacitor (Android, iOS, Windows)
- **Backend:** NestJS + TypeORM + PostgreSQL
- **Offline-first:** IndexedDB (Dexie.js) + sync engine + operation log
- **Design system:** tokens extraídos de LavanderPro (ver `../design-system/DESIGN.md`)

## Estructura del monorepo

```
laundry-system/
├── apps/
│   ├── web/             # Next.js (PWA + Capacitor)
│   └── api/             # NestJS backend
└── packages/
    ├── ui/              # Componentes React + tokens design system
    └── shared-types/    # Zod schemas + tipos compartidos
```

## Stack

- **Package manager:** pnpm 11
- **Build orchestration:** Turborepo
- **Linter/Formatter:** Biome
- **TypeScript:** 5.7 con strict mode

## Comandos

```bash
# Instalar dependencias
pnpm install

# Levantar todo en dev
pnpm dev

# Build de producción
pnpm build

# Lint + format
pnpm lint
pnpm format

# Typecheck
pnpm typecheck
```

## Estado actual

- [x] Monorepo inicializado
- [x] Configuración raíz (turbo, biome, tsconfig base)
- [ ] packages/ui con tokens LavanderPro
- [ ] packages/shared-types con Zod schemas
- [ ] apps/web (Next.js) con shadcn + tokens
- [ ] apps/api (NestJS) con TypeORM
- [ ] Componentes UI base (Button, Input, Card, Modal, etc.)
- [ ] Pantallas: Login, Dashboard, POS, Servicios, Onboarding, etc.