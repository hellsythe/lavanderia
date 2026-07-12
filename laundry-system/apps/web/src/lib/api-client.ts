/**
 * API Client — fetch wrapper con:
 *  - baseURL desde env
 *  - auto-refresh cuando access_token expira (401)
 *  - parseo de errores estructurados (Zod errors del backend)
 *
 * Storage de tokens: en memoria (después de unlock con PIN).
 * Sesión encriptada en IndexedDB vía @lavanderpro/db-client/authSessionRepo.
 * NO usamos localStorage para nada sensible (XSS surface).
 */

import { authSessionRepo, failedAttemptsRepo, userRepo } from '@lavanderpro/db-client';
import {
  fetchWithAuth as sharedFetch,
  setCachedTokens as sharedSetTokens,
  clearCachedTokens as sharedClearTokens,
  getAccessToken as sharedGetToken,
  API_BASE,
} from '@lavanderpro/sync-engine';

export interface AuthResponse {
  tokens: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
  user: {
    id: string;
    tenantId: string;
    email: string;
    name: string;
    role: string;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
    plan: string;
  };
}

/** Shape de /auth/refresh: tokens NO anidados. */
interface RefreshResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// Re-exports — single source of truth en @lavanderpro/sync-engine/auth
export {
  setCachedTokens,
  clearCachedTokens,
  getAccessToken,
  getRefreshToken,
} from '@lavanderpro/sync-engine';

export async function clearSession(): Promise<void> {
  const { clearCachedTokens: clear } = await import('@lavanderpro/sync-engine');
  clear();
  await authSessionRepo.clear();
  await failedAttemptsRepo.clear();
  await userRepo.clear();
}

export function getStoredUser(): AuthResponse['user'] | null { return null; }
export async function getStoredUserAsync(): Promise<AuthResponse['user'] | null> {
  if (typeof window === 'undefined') return null;
  const snap = await authSessionRepo.get();
  return snap?.user ?? null;
}
export function getStoredTenant(): AuthResponse['tenant'] | null { return null; }
export async function getStoredTenantAsync(): Promise<AuthResponse['tenant'] | null> {
  if (typeof window === 'undefined') return null;
  const snap = await authSessionRepo.get();
  return snap?.tenant ?? null;
}

export interface ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string[]>;
}

async function parseError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => ({}))) as {
    message?: string | string[];
    errors?: Record<string, string[]>;
  };
  const msg = Array.isArray(body.message)
    ? body.message.join(', ')
    : body.message ?? 'Error';
  const err = new Error(msg) as ApiError;
  err.status = res.status;
  err.fieldErrors = body.errors;
  return err;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  json?: unknown;
  skipAuth?: boolean;
}

export async function apiRequest<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const { json, skipAuth, headers, ...rest } = opts;
  const body = json !== undefined ? JSON.stringify(json) : undefined;

  const res = await sharedFetch(path, {
    ...rest,
    skipAuth,
    headers: { ...(headers as Record<string, string>) },
    body,
  });

  if (!res.ok) throw await parseError(res);
  return (await res.json()) as T;
}

// Auth-specific helpers
export const authApi = {
  login: (input: LoginInput) =>
    apiRequest<AuthResponse>('/auth/login', { method: 'POST', json: input, skipAuth: true }),
  register: (input: RegisterInput) =>
    apiRequest<AuthResponse>('/auth/register', { method: 'POST', json: input, skipAuth: true }),
  me: () => apiRequest<{ ok: boolean }>('/auth/me'),
};

// Orders-specific helpers
export interface ListOrdersParams {
  status?: OrderStatus[];
  customerId?: string;
  limit?: number;
  offset?: number;
}

export interface ListOrdersResponse {
  items: Order[];
  total: number;
}

export type OrderCounts = Record<OrderStatus, number>;

export const ordersApi = {
  list: (params: ListOrdersParams = {}) => {
    const search = new URLSearchParams();
    if (params.status?.length) search.set('status', params.status.join(','));
    if (params.customerId) search.set('customerId', params.customerId);
    if (params.limit !== undefined) search.set('limit', String(params.limit));
    if (params.offset !== undefined) search.set('offset', String(params.offset));
    const qs = search.toString();
    return apiRequest<ListOrdersResponse>(`/orders${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => apiRequest<Order>(`/orders/${id}`),
  create: (input: CreateOrderInput) =>
    apiRequest<Order>('/orders', { method: 'POST', json: input }),
  changeStatus: (id: string, status: OrderStatus) =>
    apiRequest<Order>(`/orders/${id}/status`, {
      method: 'PATCH',
      json: { status },
    }),
  counts: () => apiRequest<OrderCounts>('/orders/counts'),
};

// Necesitamos los types aquí también
import type {
  CreateCustomerInput,
  CreateOrderInput,
  CreateServiceCategoryInput,
  CreateServiceInput,
  Customer,
  OnboardingStepInput,
  Order,
  OrderStatus,
  LoginInput,
  RegisterInput,
  Service,
  ServiceCategory,
  Tenant,
  UpdateCustomerInput,
  UpdateServiceCategoryInput,
  UpdateServiceInput,
} from '@lavanderpro/shared-types';

// Tenants-specific helpers
export const tenantsApi = {
  /**
   * PATCH /tenants/:id/onboarding — aplica un paso del onboarding.
   * Server-side validation con Zod; devuelve el tenant actualizado.
   */
  updateOnboarding: (id: string, input: OnboardingStepInput) =>
    apiRequest<Tenant>(`/tenants/${id}/onboarding`, {
      method: 'PATCH',
      json: input,
    }),

  /**
   * PUT /tenants/:id — actualiza datos de la empresa desde configuración.
   */
  update: (id: string, input: import('@lavanderpro/shared-types').UpdateTenantInput) =>
    apiRequest<Tenant>(`/tenants/${id}`, {
      method: 'PUT',
      json: input,
    }),

  /**
   * POST /tenants/:id/logo/presign — genera URL prefirmada para subir el logo.
   */
  presignLogoUpload: (
    id: string,
    input: import('@lavanderpro/shared-types').PresignLogoUploadRequest,
  ) =>
    apiRequest<import('@lavanderpro/shared-types').PresignLogoUploadResponse>(
      `/tenants/${id}/logo/presign`,
      { method: 'POST', json: input },
    ),
};

// Service Catalog helpers
// Los servicios se exponen bajo /services/* en el backend (están acoplados
// al módulo services porque services.categoryId referencia service_categories).
export interface ListServicesParams {
  categoryId?: string;
  onlyActive?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListServicesResponse {
  items: Service[];
  total: number;
}

export const servicesApi = {
  list: (params: ListServicesParams = {}) => {
    const search = new URLSearchParams();
    if (params.categoryId) search.set('categoryId', params.categoryId);
    if (params.onlyActive !== undefined) search.set('onlyActive', String(params.onlyActive));
    if (params.search) search.set('search', params.search);
    if (params.limit !== undefined) search.set('limit', String(params.limit));
    if (params.offset !== undefined) search.set('offset', String(params.offset));
    const qs = search.toString();
    return apiRequest<ListServicesResponse>(`/services${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => apiRequest<Service>(`/services/${id}`),
  create: (input: CreateServiceInput) =>
    apiRequest<Service>('/services', { method: 'POST', json: input }),
  update: (id: string, input: UpdateServiceInput) =>
    apiRequest<Service>(`/services/${id}`, { method: 'PATCH', json: input }),
  remove: (id: string) => apiRequest<void>(`/services/${id}`, { method: 'DELETE' }),
};

// Customers helpers
export interface ListCustomersParams {
  search?: string;
  limit?: number;
  offset?: number;
}

export interface ListCustomersResponse {
  items: Customer[];
  total: number;
}

export const customersApi = {
  list: (params: ListCustomersParams = {}) => {
    const search = new URLSearchParams();
    if (params.search) search.set('search', params.search);
    if (params.limit !== undefined) search.set('limit', String(params.limit));
    if (params.offset !== undefined) search.set('offset', String(params.offset));
    const qs = search.toString();
    return apiRequest<ListCustomersResponse>(`/customers${qs ? `?${qs}` : ''}`);
  },
  get: (id: string) => apiRequest<Customer>(`/customers/${id}`),
  create: (input: CreateCustomerInput) =>
    apiRequest<Customer>('/customers', { method: 'POST', json: input }),
  update: (id: string, input: UpdateCustomerInput) =>
    apiRequest<Customer>(`/customers/${id}`, { method: 'PATCH', json: input }),
  remove: (id: string) =>
    apiRequest<void>(`/customers/${id}`, { method: 'DELETE' }),
};

// Service Categories helpers
// Las categorías se exponen bajo /services/categories/* en el backend
// (están acopladas al módulo services porque services.categoryId las referencia).
export const categoriesApi = {
  list: (params: { limit?: number; offset?: number } = {}) => {
    const search = new URLSearchParams();
    if (params.limit !== undefined) search.set('limit', String(params.limit));
    if (params.offset !== undefined) search.set('offset', String(params.offset));
    const qs = search.toString();
    return apiRequest<{ items: ServiceCategory[]; total: number }>(
      `/services/categories/all${qs ? `?${qs}` : ''}`,
    );
  },
  create: (input: CreateServiceCategoryInput) =>
    apiRequest<ServiceCategory>('/services/categories', {
      method: 'POST',
      json: input,
    }),
  update: (id: string, input: UpdateServiceCategoryInput) =>
    apiRequest<ServiceCategory>(`/services/categories/${id}`, {
      method: 'PATCH',
      json: input,
    }),
  remove: (id: string) =>
    apiRequest<void>(`/services/categories/${id}`, {
      method: 'DELETE',
    }),
};

// Payments helpers
// Best-effort: si el backend no tiene payments implementado todavía, la
// creación local funciona igual (offline-first). El push al server puede
// fallar silenciosamente y la op queda en sync_queue para reintento.
import type { CreatePaymentInput, Payment } from '@lavanderpro/shared-types';

export const paymentsApi = {
  create: (input: CreatePaymentInput) =>
    apiRequest<Payment>('/payments', { method: 'POST', json: input }),
  listByOrder: (orderId: string) =>
    apiRequest<Payment[]>(`/payments?orderId=${orderId}`),
};

// Branches helpers
import type { Branch, CreateBranchInput, UpdateBranchInput } from '@lavanderpro/shared-types';

export const branchesApi = {
  list: () => apiRequest<Branch[]>('/branches'),
  get: (id: string) => apiRequest<Branch>(`/branches/${id}`),
  create: (input: CreateBranchInput) =>
    apiRequest<Branch>('/branches', { method: 'POST', json: input }),
  update: (id: string, input: UpdateBranchInput) =>
    apiRequest<Branch>(`/branches/${id}`, { method: 'PATCH', json: input }),
  remove: (id: string) => apiRequest<void>(`/branches/${id}`, { method: 'DELETE' }),
};