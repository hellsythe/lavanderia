/**
 * Conflict resolution — last-write-wins (LWW) para MVP.
 *
 * El server es la source of truth final. Si hay conflicto (mismo registro
 * modificado en local y en server entre dos syncs), gana el que tenga
 * `updatedAt` más reciente. En empate gana el server (decisión segura).
 */
import type { Branch, Order, Customer, Payment, Service } from '@lavanderpro/shared-types';

type Syncable = Branch | Order | Customer | Payment | Service;

export function resolveConflict<T extends Syncable>(local: T, remote: T): T {
  if (remote.updatedAt > local.updatedAt) return remote;
  if (remote.updatedAt < local.updatedAt) return local;
  // Tie: server wins.
  return remote;
}
