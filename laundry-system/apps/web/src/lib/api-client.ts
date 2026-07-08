import type {
  LoginInput,
  RegisterInput,
  Order,
  OrderStatus,
  CreateOrderInput,
  User,
  TenantPlan,
} from '@lavanderpro/shared-types';

/**
 * Respuesta cruda del backend — los tokens vienen al mismo nivel que user/tenant.
 * Refleja exactamente lo que devuelve AuthService en el API.
 */
/**
 * Shape real de la respuesta del backend.
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
    plan: TenantPlan;
  };
}

/**
 * API Client — fetch wrapper con:
 * - baseURL desde env
 * - auto-refresh cuando access_token expira (401)
 * - parseo de errores estructurados (Zod errors del backend)
 *
 * Para MVP usamos localStorage. Cuando llegue Capacitor moveremos
 * el refresh token a SecureStorage (Keychain/Keystore/DPAPI).
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';
const STORAGE_KEYS = {
  access: 'lp.access',
  refresh: 'lp.refresh',
  user: 'lp.user',
  tenant: 'lp.tenant',
} as const;

export interface ApiError extends Error {
  status: number;
  fieldErrors?: Record<string, string[]>;
}

function makeError(status: number, message: string, fieldErrors?: Record<string, string[]>): ApiError {
  const err = new Error(message) as ApiError;
  err.status = status;
  err.fieldErrors = fieldErrors;
  return err;
}

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.access);
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(STORAGE_KEYS.refresh);
}

export function persistSession(data: AuthResponse): void {
  localStorage.setItem(STORAGE_KEYS.access, data.tokens.accessToken);
  localStorage.setItem(STORAGE_KEYS.refresh, data.tokens.refreshToken);
  localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(data.user));
  localStorage.setItem(STORAGE_KEYS.tenant, JSON.stringify(data.tenant));
}

export function clearSession(): void {
  localStorage.removeItem(STORAGE_KEYS.access);
  localStorage.removeItem(STORAGE_KEYS.refresh);
  localStorage.removeItem(STORAGE_KEYS.user);
  localStorage.removeItem(STORAGE_KEYS.tenant);
}

export function getStoredUser(): AuthResponse['user'] | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEYS.user);
  return raw ? (JSON.parse(raw) as AuthResponse['user']) : null;
}

export function getStoredTenant(): AuthResponse['tenant'] | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(STORAGE_KEYS.tenant);
  return raw ? (JSON.parse(raw) as AuthResponse['tenant']) : null;
}

async function parseError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => ({}))) as {
    message?: string | string[];
    errors?: Record<string, string[]>;
  };
  const message = Array.isArray(body.message) ? body.message.join(', ') : body.message ?? 'Error';
  return makeError(res.status, message, body.errors);
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  json?: unknown;
  skipAuth?: boolean;
}

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
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
    localStorage.setItem(STORAGE_KEYS.access, data.tokens.accessToken);
    localStorage.setItem(STORAGE_KEYS.refresh, data.tokens.refreshToken);
    return data.tokens.accessToken;
  } catch {
    return null;
  }
}

export async function apiRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
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
  let token = getAccessToken();
  let res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers: buildHeaders(token),
    body,
  });

  // Auto-refresh en 401 (excepto si es /auth/*).
  // Importante: si no hay tokens guardados, NO intentamos refresh
  // (sería un loop infinito). Simplemente fallamos para que la UI redirija
  // a /login naturalmente.
  if (res.status === 401 && !skipAuth && !path.startsWith('/auth/')) {
    const hasStoredRefresh = typeof window !== 'undefined'
      && !!localStorage.getItem(STORAGE_KEYS.refresh);

    if (hasStoredRefresh) {
      refreshing ??= refreshAccessToken().finally(() => {
        refreshing = null;
      });
      const newToken = await refreshing;
      if (newToken) {
        token = newToken;
        res = await fetch(`${API_BASE}${path}`, {
          ...rest,
          headers: buildHeaders(token),
        });
      } else {
        clearSession();
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
          window.location.href = '/login';
        }
      }
    }
    // Si no hay refresh token, dejamos que el 401 propague.
    // La UI lo maneja mostrando error o redirigiendo.
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