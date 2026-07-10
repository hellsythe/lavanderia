/**
 * @lavanderpro/db-client — Cliente de IndexedDB (Dexie) para offline-first.
 *
 * REGLA DE ORO: apps/web NUNCA debe importar Dexie directamente.
 * Toda interacción con la DB local va a través de los repos exportados aquí.
 */
export { getDb } from './schema';
export type {
  UserSnapshot,
  TenantSnapshot,
  CustomerSnapshot,
  ServiceSnapshot,
  CategorySnapshot,
  OrderSnapshot,
  SyncQueueEntry,
  MetaEntry,
  LavanderProDB,
} from './schema';

export { orderRepo } from './repos/orders.repo';
export { customerRepo } from './repos/customers.repo';
export { userRepo, metaRepo } from './repos/user.repo';
export { syncQueueRepo } from './repos/sync-queue.repo';
export { authSessionRepo, failedAttemptsRepo } from './repos/auth.repo';
export { categoryRepo } from './repos/categories.repo';
export { serviceRepo } from './repos/services.repo';
export { lwwMerge } from './lib/merge';