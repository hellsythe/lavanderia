/**
 * AuthSessionRepo — persistencia de la sesión encriptada con PIN.
 *
 * PATRÓN:
 *   1. User hace login online → tokens + user + tenant
 *   2. setupPin(pin) → encripta accessToken, genera salt + verifier, guarda aquí
 *   3. unlockWithPin(pin) → desencripta, devuelve accessToken
 *
 * Tabla: authSession (1 row, id='current')
 *
 * Limpiar con clearAll() en logout.
 */
import { getDb, type AuthSessionSnapshot, type UserSnapshot, type TenantSnapshot } from '../schema';

const db = () => getDb();

export const authSessionRepo = {
  async get(): Promise<AuthSessionSnapshot | null> {
    return (await db().authSession.get('current')) ?? null;
  },

  async save(snap: AuthSessionSnapshot): Promise<void> {
    await db().authSession.put(snap);
  },

  async hasPin(): Promise<boolean> {
    const snap = await this.get();
    return !!snap?.pinVerifier;
  },

  /** Borrar todo (logout). NO debe usarse para unlock — ese es temporal. */
  async clear(): Promise<void> {
    await db().authSession.clear();
  },

  async isLocked(): Promise<boolean> {
    return (await this.get()) != null;
  },
};

/**
 * Failed attempts counter — para rate limiting.
 * Si supera MAX_FAILED_ATTEMPTS, wipe local y forzar online.
 */
const MAX_FAILED_ATTEMPTS = 5;
const FAILED_ATTEMPTS_WINDOW_MS = 60_000; // 1 min

interface FailedAttempt {
  timestamp: number;
}

export const failedAttemptsRepo = {
  async record(): Promise<{ count: number; shouldWipe: boolean }> {
    const key = 'pin-failures';
    const raw = await getDb().meta.get(key);
    const existing: FailedAttempt[] = Array.isArray(raw?.value) ? (raw.value as FailedAttempt[]) : [];
    const now = Date.now();
    const recent = existing.filter(
      (a) => now - a.timestamp < FAILED_ATTEMPTS_WINDOW_MS,
    );
    recent.push({ timestamp: now });
    await getDb().meta.put({ key, value: recent });
    return {
      count: recent.length,
      shouldWipe: recent.length >= MAX_FAILED_ATTEMPTS,
    };
  },

  async clear(): Promise<void> {
    await getDb().meta.delete('pin-failures');
  },

  async getCount(): Promise<number> {
    const key = 'pin-failures';
    const raw = await getDb().meta.get(key);
    const list: FailedAttempt[] = Array.isArray(raw?.value) ? (raw.value as FailedAttempt[]) : [];
    const now = Date.now();
    return list.filter((a) => now - a.timestamp < FAILED_ATTEMPTS_WINDOW_MS).length;
  },
};
