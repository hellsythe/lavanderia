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
import type { Order, OrderItem, Payment, Service } from '@lavanderpro/shared-types';

/**
 * User — snapshot local del usuario actual. Solo 1 row (id='current').
 * Cachea datos críticos para offline-first (nombre, tenantId, role).
 * NUNCA cachea password ni token.
 */
export interface UserSnapshot {
  id: string; // en la row real, 'current' — pero el tipo permite string para ergonomía
  email: string;
  name: string;
  role: string;
  tenantId: string;
  tenantName: string;
  tenantPlan: string;
  /** Slug del tenant — agregado para que hydrate pueda reconstruir el `tenant` completo. */
  tenantSlug?: string;
}

/**
 * AuthSession — sesión local con tokens encriptados.
 *
 * Flujo:
 *  1. login online → tokens + user + tenant
 *  2. setupPin(pin) → encripta accessToken con PBKDF2(pin) + AES-GCM
 *  3. tokens se guardan aquí (IndexedDB, encriptado)
 *  4. unlockWithPin(pin) → desencripta y devuelve tokens
 *  5. La sesión se considera "locked" hasta que el user ingrese PIN
 */
export interface AuthSessionSnapshot {
  id: 'current';
  encryptedAccessToken: string; // AES-GCM ciphertext (base64)
  iv: string;                     // initialization vector (base64)
  refreshToken: string;          // sin encriptar (es "session unlock" — se re-pedir online)
  user: UserSnapshot;
  tenant: TenantSnapshot;
  // PIN config
  pinSalt: string;                // PBKDF2 salt (base64)
  pinIterations: number;          // ~100k
  pinVerifier: string;            // hash del PIN para validar sin descifrar (base64)
  biometricEnabled: boolean;      // si el user habilitó WebAuthn
  // Lifecycle
  createdAt: number;              // timestamp ms
  lastOnlineReauthAt: number;     // forzar re-auth online cada N días
}

/**
 * TenantSnapshot — snapshot local del tenant. Solo 1 row (id=tenantId).
 */
export interface TenantSnapshot {
  id: string;
  name: string;
  slug: string;
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
  /** RFC (Registro Federal de Contribuyentes, México). Opcional. */
  rfc?: string;
  /** Razón social — opcional, útil para facturación. */
  legalName?: string;
  deletedAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * Service cached (catálogo).
 */
export interface ServiceSnapshot {
  id: string;
  tenantId: string;
  name: string;
  description?: string | null;
  categoryId?: string | null;
  unit: 'kg' | 'piece';
  unitPrice: number;
  minQuantity: number;
  active: boolean;
  deletedAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * ServiceCategory cached.
 * Sincronizada via /sync/changes (offline-first).
 * Soft-deleted vía `deletedAt` (tombstone preservado para LWW).
 */
export interface CategorySnapshot {
  id: string;
  tenantId: string;
  name: string;
  deletedAt?: number | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * Branch cached (sucursal multi-sucursal).
 */
export interface BranchSnapshot {
  id: string;
  tenantId: string;
  name: string;
  address?: string;
  phone?: string;
  isMain: boolean;
  active: boolean;
  createdAt: number;
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
  branchId?: string;
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
 * Payment cached (pagos aplicados a un pedido).
 * Persistir localmente permite cobrar un pedido y sincronizarlo después.
 */
export interface PaymentSnapshot {
  id: string;
  tenantId: string;
  orderId: string;
  method: Payment['method'];
  amount: number;
  reference?: string;
  createdAt: number;
  updatedAt: number;
}

/**
 * PendingUpload — archivos pendientes de subir a MinIO/S3.
 * El blob queda en IndexedDB hasta que el usuario esté online y el
 * sync engine lo drene: presign → PUT → PATCH tenant.logoUrl.
 */
export interface PendingUpload {
  id: string;
  tenantId: string;
  entity: 'tenant_logo';
  entityId: string;
  blob: Blob;
  contentType: string;
  filename: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
  dirty: 0 | 1;
}

/**
 * Sync queue — operaciones pendientes de subir al server.
 * uuid es UUID v7 generado en cliente (ordenable por tiempo).
 * dirty = 1 si la row no se ha subido al server, 0 si ya se sincronizó.
 * Usar índice 'pending' para drain eficiente.
 */
export interface SyncQueueEntry {
  uuid: string;          // UUID v7 client-generated
  entity: 'order' | 'customer' | 'service' | 'service_category' | 'payment' | 'tenant' | 'pending_upload' | 'branch';
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
 * Keys conocidas: 'lastSync' (timestamp ms), 'lastUserId', 'pin-failures', etc.
 * `value` es unknown; castear en el consumer.
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
  categories!: Table<CategorySnapshot, string>;
  payments!: Table<PaymentSnapshot, string>;
  pendingUploads!: Table<PendingUpload, string>;
  branches!: Table<BranchSnapshot, string>;
  syncQueue!: Table<SyncQueueEntry, string>;
  meta!: Table<MetaEntry, string>;
  authSession!: Table<AuthSessionSnapshot, string>;

  constructor() {
    super('lavanderpro');
    this.version(6)
      .stores({
        // Primary key + índices secundarios
        users: 'id',
        tenants: 'id',
        // 'tenantId' y 'status' son índices secundarios para queries filtradas
        orders: 'id, tenantId, status, customerId, updatedAt',
        customers: 'id, tenantId, name, updatedAt',
        services: 'id, tenantId, categoryId, name, updatedAt',
        // v3: tabla categories para sync offline-first de categorías
        categories: 'id, tenantId, name, updatedAt',
        // v4: tabla payments para sync offline-first de pagos
        payments: 'id, tenantId, orderId, method, updatedAt',
        // v5: tabla pending_uploads para subir logos offline
        pendingUploads: 'id, tenantId, entity, dirty',
        // v6: tabla branches para multi-sucursal
        branches: 'id, tenantId, isMain, active, updatedAt',
        // 'dirty' para drain rápido de pending. 'entity' para filtros.
        syncQueue: 'uuid, entity, dirty, timestamp, [entity+entityId]',
        // 'key' es la primary key
        meta: 'key',
        // Sesión de auth (tokens encriptados con PIN). 1 row 'current'.
        authSession: 'id',
      })
      .upgrade(async (tx) => {
        // v1 → v2: solo se crea la nueva tabla authSession, no se migran datos.
        // v2 → v3: solo se crea la tabla categories, no se migran datos.
        // v3 → v4: solo se crea la tabla payments, no se migran datos.
        // v4 → v5: solo se crea la tabla pendingUploads, no se migran datos.
        // v5 → v6: solo se crea la tabla branches, no se migran datos.
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
