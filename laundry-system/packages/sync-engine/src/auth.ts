/**
 * Auth helpers compartidos entre api-client y sync-engine.
 *
 * El sync-engine necesita la JWT para hablar con el backend y la URL
 * absoluta del API. Como ambos viven en apps/web y se inicializan
 * con la misma sesión, exponemos lectura de token + base URL aquí.
 *
 * Ahora incluye `fetchWithAuth` que unifica la lógica de auto-refresh
 * en 401 tanto para las llamadas del sync engine como para el api-client.
 * Un solo lugar para toda la lógica de fetch + auth.
 */

/**
 * API base absoluta con prefijo `/api`.
 * Default dev: `http://localhost:4000/api`.
 * En prod: el Dockerfile pasa `NEXT_PUBLIC_API_URL=https://api.<dominio>/api`
 */
export const API_BASE: string =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) ||
  'http://localhost:4000/api';

const STORAGE_KEY = 'lp.session';

interface Stored {
  access?: string;
  refresh?: string;
}

function readStorage(): Stored | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Stored;
  } catch {
    return null;
  }
}

function writeStorage(data: Stored | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (data) {
      window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } else {
      window.sessionStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // sessionStorage puede tirar en modo privado — ignorar.
  }
}

/**
 * Lee el access token de sessionStorage (sin cache).
 */
export function getAccessToken(): string | null {
  const s = readStorage();
  return s?.access ?? null;
}

/**
 * Lee el refresh token de sessionStorage.
 */
export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  const s = readStorage();
  return s?.refresh ?? null;
}

/**
 * Guarda tokens en sessionStorage. Usado desde api-client tras login/unlock/refresh.
 */
export function setCachedTokens(access: string, refresh: string): void {
  writeStorage({ access, refresh });
}

/**
 * Limpia los tokens de sessionStorage. Usado en logout o sesión expirada.
 */
export function clearCachedTokens(): void {
  if (typeof window === 'undefined') return;
  writeStorage(null);
}

/**
 * @deprecated — se mantiene por compatibilidad con el api-client que
 * sigue llamando setAccessToken. El cache de memoria se eliminó en v2;
 * todos los reads van contra sessionStorage.
 */
export function setAccessToken(_token: string | null): void {
  // no-op
}

// ────────────── auto-refresh en 401 ──────────────

let refreshing: Promise<string | null> | null = null;

async function doRefresh(): Promise<string | null> {
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
    const data = (await res.json()) as {
      accessToken: string;
      refreshToken: string;
      expiresIn?: number;
    };
    if (!data.accessToken || !data.refreshToken) return null;
    setCachedTokens(data.accessToken, data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

/**
 * fetchWithAuth — fetch wrapper con auto-refresh de JWT en 401.
 *
 * Ambos el sync-engine y el api-client del web usan este mismo helper
 * para que el refresh sea single-source-of-truth. Si la respuesta es
 * 401 (y no es una ruta de auth), intenta refrescar y reintenta.
 */
export async function fetchWithAuth(
  path: string,
  init?: RequestInit & { skipAuth?: boolean },
): Promise<Response> {
  const { skipAuth, headers: extraHeaders, ...rest } = init ?? {};

  const url = path.startsWith('http') ? path : `${API_BASE}${path}`;
  const token = getAccessToken();

  const buildHeaders = (t: string | null): HeadersInit => ({
    'Content-Type': 'application/json',
    ...(t && !skipAuth ? { Authorization: `Bearer ${t}` } : {}),
    ...(extraHeaders as Record<string, string>),
  });

  // Si no hay access token y no es skipAuth, no tiene sentido pegar
  if (!skipAuth && !token) {
    throw new Error('No access token available');
  }

  let res = await fetch(url, {
    ...rest,
    headers: buildHeaders(token),
  });

  // Auto-refresh en 401
  if (
    res.status === 401 &&
    !skipAuth &&
    !path.startsWith('/auth/')
  ) {
    refreshing ??= doRefresh().finally(() => {
      refreshing = null;
    });
    const newToken = await refreshing;
    if (newToken) {
      res = await fetch(url, {
        ...rest,
        headers: buildHeaders(newToken),
      });
    }
  }

  return res;
}

/**
 * Helper legacy — igual que fetchWithAuth pero devuelve T parseado y
 * lanza en error. Mantenido para compatibilidad con el sync-engine que
 * usa `apiRequest<T>(path, init) → Promise<T>` directo.
 */
export async function fetchWithAuthJson<T>(
  path: string,
  init?: RequestInit & { skipAuth?: boolean },
): Promise<T> {
  const res = await fetchWithAuth(path, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(
      `API call failed: ${res.status} ${text.slice(0, 200)}`,
    );
  }
  return (await res.json()) as T;
}
