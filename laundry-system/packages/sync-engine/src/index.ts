/**
 * @lavanderpro/sync-engine — Motor de sincronización offline-first.
 *
 * Push: drena la sync_queue → POST /sync/batch
 * Pull: GET /sync/changes?since=... → merge con last-write-wins
 * Network: detección online/offline con heartbeats
 *
 * Triggers:
 * - Llamar `enqueueSync()` después de cada mutación optimista
 * - El engine se sincroniza solo cuando vuelve la conexión o cada 5 min
 */
export { useNetworkStore, teardownNetworkDetection } from './network';
export { useSyncStore, initSyncEngine, teardownSyncEngine, enqueueSync } from './sync-engine';
export { resolveConflict } from './conflict';
export { API_BASE, setAccessToken, getAccessToken } from './auth';