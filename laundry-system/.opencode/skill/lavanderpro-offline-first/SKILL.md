---
name: lavanderpro-offline-first
description: >
  Offline-first architecture rules for LavanderPro. Use when creating,
  modifying, or refactoring any data access, API call, form, or sync-related
  code in apps/web, packages/db-client, or packages/sync-engine. Triggers on
  keywords: offline, sync, Dexie, IndexedDB, optimistic, pending, queue,
  online, offline, network, conflict, mutation, cached, service worker,
  PWA, lazy load, queue. Enforces the principle: the app must work
  PERFECTLY without internet connection.
---

# LavanderPro — Offline-First Architecture

The defining principle of this product: **the app must work perfectly without
internet connection**. Every cashier, every page, every action must function
offline. The server is the source of truth for eventual consistency, but
the user experience never blocks on network.

This is non-negotiable. Every change to data access code must preserve and
strengthen this property.

## The hard rules

### Rule 1 — apps/web NEVER touches Dexie or IndexedDB directly

All client-side data persistence flows through these packages:

```
UI (apps/web) ──► @lavanderpro/db-client (Repos)
                      │
                      ├──► @lavanderpro/sync-engine (when online)
                      │
                      └──► Backend (when online)
```

- ✅ `import { orderRepo } from '@lavanderpro/db-client'`
- ❌ `import Dexie from 'dexie'` (apps/web must never import Dexie directly)
- ❌ `import { db } from '@lavanderpro/db-client'` (only repos, not the raw db)

If you find yourself wanting to use `db.orders.put(...)` in a component, you
are bypassing the architecture. Add a method to the repo instead.

### Rule 2 — All mutations are optimistic (apply locally first)

When the user creates/updates/deletes an entity, the change must:

1. **Apply to the local repo IMMEDIATELY** (Dexie write) — UI updates without waiting
2. **Enqueue to sync_queue** with the operation metadata
3. **Trigger sync** if online (fire-and-forget; don't await)
4. **Return immediately** to the UI

```ts
// ✅ Correct: optimistic + async sync
async function createOrder(input: CreateOrderInput) {
  const order = await orderRepo.create({ ...input, status: 'received' });
  await syncQueue.push({ entity: 'order', op: 'create', entityId: order.id, payload: order });
  syncEngine.requestSync(); // fire-and-forget
  return order;
}

// ❌ Wrong: blocks UI on network
async function createOrder(input: CreateOrderInput) {
  const res = await fetch('/api/orders', { method: 'POST', body: JSON.stringify(input) });
  if (!navigator.onLine) throw new Error('Offline');
  return res.json();
}
```

### Rule 3 — Reads prefer API, fall back to cache, never block

Pattern for any read query:

```ts
async function getOrders() {
  if (navigator.onLine) {
    try {
      const orders = await apiClient.get('/orders');
      await orderRepo.bulkPut(orders);  // update cache
      return orders;
    } catch (e) {
      // network error → fall back to cache
    }
  }
  return orderRepo.getAll();  // ALWAYS returns something
}
```

The UI must NEVER show a "loading forever" spinner because the network is
down. Show cached data immediately with a "Sin conexión — datos locales"
indicator.

### Rule 4 — Sync is last-write-wins, with structured conflict handling

When server and local both modified the same record, the one with the most
recent `updatedAt` wins. Tie-breaker: server wins (safer default).

```ts
// packages/sync-engine/src/conflict.ts
export function resolveConflict(local: Order, remote: Order): Order {
  if (remote.updatedAt > local.updatedAt) return remote;
  if (remote.updatedAt < local.updatedAt) return local;
  return remote; // server wins ties
}
```

For MVP, silent LWW. For future: surface conflicts to user with a "Resolve"
modal for cases where LWW is wrong (e.g., two cashiers mark same order
"delivered" simultaneously — last one wins, no warning).

### Rule 5 — Every entity has `updatedAt`, and sync uses it for ordering

Domain entities in `@lavanderpro/shared-types` MUST include:
- `updatedAt: number` (Unix ms timestamp)
- `id: string` (UUID v7 — sortable, time-ordered)
- `tenantId: string` (always — multi-tenant isolation)

UUID v7 preferred over v4 because v7 is time-sortable, which makes
`sync_queue` ordering and conflict resolution simpler. v7 has the timestamp
in the first 48 bits.

### Rule 6 — Auth tokens cached in secure storage, password NEVER cached

- Access token: in-memory + sessionStorage (NOT localStorage to reduce XSS surface)
- Refresh token: **NEVER** in localStorage in production. Use Capacitor's SecureStorage
  (Keychain/Keystore/DPAPI) on native, HTTP-only cookie on web.
- Password: NEVER. User re-authenticates when token expires.

For the web MVP: use `localStorage` for both tokens (acceptable risk for
internal B2B tool), with TODO to migrate to SecureStorage in mobile builds.

### Rule 7 — The sync engine never throws; it queues and retries

Sync is best-effort, background. The UI must never break because sync failed.

```ts
// ✅ Correct: swallow and log
async function pushPendingChanges() {
  try {
    await apiClient.post('/sync/batch', { operations });
    await syncQueue.markSynced(operations.map(o => o.uuid));
  } catch (e) {
    // network down, server error, etc.
    // operations stay in queue, will be retried later
    console.warn('Sync push failed, will retry:', e);
  }
}

// ❌ Wrong: throws to UI
async function pushPendingChanges() {
  const res = await fetch('/sync/batch', { ... });
  if (!res.ok) throw new Error('Sync failed');  // breaks caller
}
```

### Rule 8 — UI must always show sync state

Every page that does mutations shows a small status indicator:
- 🟢 Sincronizado (last sync 2 min ago)
- 🟡 Sincronizando... (X cambios pendientes)
- 🔴 Sin conexión (X cambios en cola)
- ⚪️ Nunca debe aparecer "Sin sincronizar" sin explicar

This builds user trust. They know the app is reliable.

## Package structure

```
packages/
├── db-client/
│   ├── src/
│   │   ├── schema.ts           # Dexie schema
│   │   ├── db.ts               # Dexie instance
│   │   ├── repos/
│   │   │   ├── orders.repo.ts
│   │   │   ├── customers.repo.ts
│   │   │   ├── services.repo.ts
│   │   │   ├── users.repo.ts       # current user, tenant
│   │   │   └── sync-queue.repo.ts  # pending operations
│   │   └── index.ts
│   └── package.json
└── sync-engine/
    ├── src/
    │   ├── sync-engine.ts      # Main orchestrator
    │   ├── push.ts             # drain queue → POST /sync/batch
    │   ├── pull.ts             # GET /sync/changes?since=...
    │   ├── conflict.ts         # LWW resolver
    │   ├── network.ts          # online/offline detection
    │   ├── status.ts           # sync status observable (Zustand)
    │   └── index.ts
    └── package.json
```

## Test checklist for offline-first

Before merging ANY PR that touches data access:

- [ ] App works with WiFi disabled from the moment it opens
- [ ] Create an order offline → it appears in UI immediately → sync_queue has it
- [ ] Re-enable WiFi → sync happens within 5s → order appears on another device
- [ ] Update an order offline → conflict simulated (server has newer version) → LWW applies
- [ ] Refresh page offline → cached orders still appear
- [ ] Force a 500 from server during sync → operations stay in queue, no UI error
- [ ] Auth token expires while offline → user re-authenticates when back online

## Anti-patterns to reject in PR review

- ❌ `fetch('/api/...')` directly in a component (must go through api-client)
- ❌ `db.table.put(...)` anywhere outside `packages/db-client/`
- ❌ `if (navigator.onLine) ... else throw new Error('Offline')` (must fall back to cache)
- ❌ Sync errors that propagate to UI (sync is best-effort)
- ❌ Storing tokens in plain localStorage without encryption (TODO acceptable for web)
- ❌ Caching data without `tenantId` filter (multi-tenant leak)
- ❌ Auth that requires server roundtrip on every page load

## Decision tree: should this be cached?

```
Is it user-specific data? (orders, customers, services)
├─ YES → cache, sync, optimistic mutations
└─ NO  → is it static reference data? (catalog, tax rates)
        ├─ YES → cache with long TTL, refresh on version bump
        └─ NO  → don't cache (live data only)
```

## Multi-tenant safety in cache

Every cached entity MUST have a `tenantId` field. Sync operations ALWAYS
filter by current `tenantId`. NEVER sync data from tenant A while user is
logged in as tenant B.

```ts
// ✅ Correct: filter by tenant
async function getOrders() {
  return orderRepo.where({ tenantId: currentUser.tenantId });
}

// ❌ Wrong: leak across tenants
async function getOrders() {
  return orderRepo.getAll();
}
```

When user logs out: clear ALL local DB. When user logs in: fetch fresh from server.