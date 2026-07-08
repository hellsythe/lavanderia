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

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

/**
 * Shape de la respuesta del backend.
 * La API anida los tokens en `tokens` (ver AuthResult en apps/api).
 */
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

// Cache en memoria para evitar queries async en cada request.
let _cachedSession: { access: string; refresh: string } | null = null;

/**
 * Devuelve el access token actualmente válido. El access token se desbloquea
 * vía unlockWithPin (auth-gate) o fresh login y se cachea en memoria.
 * Devuelve null si no hay sesión desbloqueada.
 */
export function getAccessToken(): string | null {
  return _cachedSession?.access ?? null;
}

export function getRefreshToken(): string | null {
  return _cachedSession?.refresh ?? null;
}

/**
 * Guarda los tokens en cache de memoria. Llamar después de fresh login
 * o después de unlockWithPin exitoso.
 */
export function setCachedTokens(access: string, refresh: string): void {
  _cachedSession = { access, refresh };
}

export function clearCachedTokens(): void {
  _cachedSession = null;
}

/**
 * Marca la sesión como "desbloqueada en memoria". NO persiste los tokens
 * (eso lo hace el setupPin con encriptación).
 */
export function persistSession(data: AuthResponse): void {
  setCachedTokens(data.tokens.accessToken, data.tokens.refreshToken);
}

/**
 * Borra todo: cache de memoria + sesión encriptada + cache local.
 * Llamar en logout para evitar que un atacante con acceso al device vea
 * los datos del user anterior.
 */
export async function clearSession(): Promise<void> {
  clearCachedTokens();
  await authSessionRepo.clear();
  await failedAttemptsRepo.clear();
  await userRepo.clear();
}

export function getStoredUser(): AuthResponse['user'] | null {
  return null;
}

export async function getStoredUserAsync(): Promise<AuthResponse['user'] | null> {
  if (typeof window === 'undefined') return null;
  const snap = await authSessionRepo.get();
  return snap?.user ?? null;
}

export function getStoredTenant(): AuthResponse['tenant'] | null {
  return null;
}

export async function getStoredTenantAsync(): Promise<AuthResponse['tenant'] | null> {
  if (typeof window === 'undefined') return null;
  const snap = await authSessionRepo.get();
  return snap?.tenant ?? null;
}

export interface ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string[]>;
}

function makeError(
  status: number,
  message: string,
  fieldErrors?: Record<string, string[]>,
): ApiError {
  const err = new Error(message) as ApiError;
  err.status = status;
  err.fieldErrors = fieldErrors;
  return err;
}

async function parseError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => ({}))) as {
    message?: string | string[];
    errors?: Record<string, string[]>;
  };
  const message = Array.isArray(body.message)
    ? body.message.join(', ')
    : body.message ?? 'Error';
  return makeError(res.status, message, body.errors);
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  json?: unknown;
  skipAuth?: boolean;
}

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;
  const refresh = getRefreshToken();
  if (!refresh) return null;
  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as AuthResponse;
    setCachedTokens(data.tokens.accessToken, data.tokens.refreshToken);
    return data.tokens.accessToken;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const { json, skipAuth, headers, ...rest } = opts;
  const buildHeaders = (token: string | null): HeadersInit => {
    const h: Record<string, string> = {
      ...(headers as Record<string, string>),
    };
    if (json !== undefined) h['Content-Type'] = 'application/json';
    if (!skipAuth && token) h['Authorization'] = `Bearer ${token}`;
    return h;
  };

  const body = json !== undefined ? JSON.stringify(json) : undefined;

  // Primer intento
  const token = getAccessToken();
  let res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: buildHeaders(token),
    body,
  });

  // Auto-refresh en 401 (excepto si es /auth/*).
  // Importante: si no hay tokens guardados, NO intentamos refresh.
  if (res.status === 401 && !skipAuth && !path.startsWith('/auth/')) {
    const hasRefresh = !!getRefreshToken();
    if (hasRefresh) {
      refreshing ??= refreshAccessToken().finally(() => {
        refreshing = null;
      });
      const newToken = await refreshing;
      if (newToken) {
        res = await fetch(`${API_BASE}${path}`, {
          ...rest,
          headers: buildHeaders(newToken),
          body,
        });
      } else {
        await clearSession();
        if (
          typeof window !== 'undefined' &&
          !window.location.pathname.startsWith('/login')
        ) {
          window.location.href = '/login';
        }
      }
    }
    // Si no hay refresh token, dejamos que el 401 propague.
  }

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
  CreateOrderInput,
  Order,
  OrderStatus,
  LoginInput,
  RegisterInput,
} from '@lavanderpro/shared-types';