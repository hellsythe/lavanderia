/**
 * UserRepo — usuario actual y tenant.
 *
 * Solo 1 row en `users` (id='current'). Borrar al logout.
 */
import type { TenantPlan } from '@lavanderpro/shared-types';
import { getDb, type UserSnapshot } from '../schema';

const db = () => getDb();

export const userRepo = {
  async getCurrent(): Promise<UserSnapshot | null> {
    return (await db().users.get('current')) ?? null;
  },

  async setCurrent(snap: Omit<UserSnapshot, 'id'>): Promise<void> {
    await db().users.put({ id: 'current', ...snap });
  },

  async clear(): Promise<void> {
    await db().users.clear();
    await db().tenants.clear();
    await db().orders.clear();
    await db().customers.clear();
    await db().services.clear();
    await db().syncQueue.clear();
    await db().meta.clear();
  },
};

/**
 * MetaRepo — key-value para datos globales.
 * 'lastSync' (ms timestamp) es la clave principal.
 */
export const metaRepo = {
  async get<T = unknown>(key: string): Promise<T | null> {
    const row = await getDb().meta.get(key);
    return (row?.value as T) ?? null;
  },

  async set(key: string, value: unknown): Promise<void> {
    await getDb().meta.put({ key, value });
  },

  async getLastSync(): Promise<number> {
    return (await this.get<number>('lastSync')) ?? 0;
  },

  async setLastSync(ts: number): Promise<void> {
    await this.set('lastSync', ts);
  },
};

export type { TenantPlan };
