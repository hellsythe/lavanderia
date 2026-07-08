/**
 * Schema de IndexedDB (Dexie) para offline-first.
 *
 * Una sola base de datos `lavanderpro` con tablas:
 *   - users       (1 row: current user + tenant)
 *   - orders      (cached orders, filtrados por tenantId en cada query)
 *   - orderItems  (cached items)
 *   - customers   (cached customers)
 *   - services    (cached service catalog)
 *   - syncQueue   (operaciones pendientes de sincronizar)
 *   - meta        (key-value: lastSync, etc.)
 *
 * Multi-tenant: SIEMPRE filtrar por tenantId en queries.
 * Logout: clearAll() borra TODO.
 */
import Dexie, { type Table } from 'dexie';
import type { Order, OrderItem, Service } from '@lavanderpro/shared-types';

/**
 * Snapshot local del usuario actual. Solo 1 row (id='current').
 * Cachea datos críticos para offline-first (nombre, tenantId, role).
 * NUNCA cachea password ni token.
 */
export interface UserSnapshot {
  id: 'current';
  email: string;
  name: string;
  role: string;
  tenantId: string;
  tenantName: string;
  tenantPlan: string;
}

/**
 * Snapshot local del tenant. Solo 1 row (id=tenantId).
 */
export interface TenantSnapshot {
  id: string;
  name: string;
  plan: string;
}

/**
 * Customer cached. Indexado por tenantId para queries rápidas.
 * customerId es el id del backend.
 */
export interface CustomerSnapshot {
  id: string;          // = customerId del backend
  tenantId: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  updatedAt: number;
}

/**
 * Service cached (catálogo).
 */
export interface ServiceSnapshot {
  id: string;
  tenantId: string;
  name: string;
  categoryId?: string;
  unit: 'kg' | 'piece';
  unitPrice: number;
  updatedAt: number;
}

/**
 * Order cached (denormalizamos items dentro para simplificar queries offline).
 */
export interface OrderSnapshot {
  id: string;
  tenantId: string;
  code: string;
  customerId: string;
  customerName: string;
  status: Order['status'];
  total: number;
  paid: number;
  balance: number;
  notes?: string;
  items: OrderItem[];
  estimatedDeliveryAt?: number;
  deliveredAt?: number;
  createdAt: number;
  updatedAt: number;
}

/**
 * Sync queue — operaciones pendientes de subir al server.
 * uuid es UUID v7 generado en cliente (ordenable por tiempo).
 * dirty = 1 si la row no se ha subido al server, 0 si ya se sincronizó.
 * Usar índice 'pending' para drain eficiente.
 */
export interface SyncQueueEntry {
  uuid: string;          // UUID v7 client-generated
  entity: 'order' | 'customer' | 'service';
  entityId: string;
  op: 'create' | 'update' | 'delete';
  payload: unknown;      // datos a enviar al server
  timestamp: number;
  attempts: number;
  lastError?: string;
  dirty: 0 | 1;          // 1 = pendiente, 0 = ya sincronizado (historial)
}

/**
 * Meta — key-value store para datos globales del cliente.
 * Keys conocidas: 'lastSync' (timestamp ms), 'lastUserId', etc.
 */
export interface MetaEntry {
  key: string;
  value: unknown;
}

/**
 * Database class — extiende Dexie con nuestras tablas.
 * apps/web NUNCA debe importar esta clase directamente.
 * Solo los repos en src/repos/ deben usarla.
 */
export class LavanderProDB extends Dexie {
  users!: Table<UserSnapshot, string>;
  tenants!: Table<TenantSnapshot, string>;
  orders!: Table<OrderSnapshot, string>;
  customers!: Table<CustomerSnapshot, string>;
  services!: Table<ServiceSnapshot, string>;
  syncQueue!: Table<SyncQueueEntry, string>;
  meta!: Table<MetaEntry, string>;

  constructor() {
    super('lavanderpro');
    this.version(1).stores({
      // Primary key + índices secundarios
      users: 'id',
      tenants: 'id',
      // 'tenantId' y 'status' son índices secundarios para queries filtradas
      orders: 'id, tenantId, status, customerId, updatedAt',
      customers: 'id, tenantId, name, updatedAt',
      services: 'id, tenantId, categoryId, name, updatedAt',
      // 'dirty' para drain rápido de pending. 'entity' para filtros.
      syncQueue: 'uuid, entity, dirty, timestamp, [entity+entityId]',
      // 'key' es la primary key
      meta: 'key',
    });
  }
}

/**
 * Singleton de la DB. apps/web NO debe importar esto directamente.
 * Solo accesible vía repos.
 */
let _db: LavanderProDB | null = null;

export function getDb(): LavanderProDB {
  if (!_db) {
    _db = new LavanderProDB();
  }
  return _db;
}
