/**
 * Auth helpers compartidos entre api-client y sync-engine.
 *
 * El sync-engine necesita la JWT para hablar con el backend y la URL
 * absoluta del API. Como ambos viven en apps/web y se inicializan
 * con la misma sesión, exponemos lectura de token + base URL aquí.
 *
 * `api-client.ts` es quien escribe el token (tras login/unlock).
 * `sync-engine.ts` es quien lo lee (en cada request).
 *
 * Leemos SIEMPRE de sessionStorage (sin cache de memoria) para evitar
 * stale state en dev con HMR, donde el módulo puede re-evaluarse y el
 * cache de memoria queda desincronizado con sessionStorage.
 *
 * La API base se resuelve desde `process.env.NEXT_PUBLIC_API_URL`
 * (Next.js la inlinea en el bundle del browser al build) con fallback
 * al default de dev.
 */

const STORAGE_KEY = 'lp.session';

function readAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { access?: string; refresh?: string };
    return typeof parsed.access === 'string' ? parsed.access : null;
  } catch {
    return null;
  }
}

/**
 * API base absoluta con prefijo `/api` (debe coincidir con api-client.ts).
 *
 * Default dev: `http://localhost:4000/api`.
 * En prod: el Dockerfile pasa `NEXT_PUBLIC_API_URL=https://api.<dominio>/api`
 * que Next.js inlinea al construir el bundle.
 *
 * El sync-engine llama con paths SIN prefijo `/api` (ej: `/sync/changes`).
 * Final URL = `${API_BASE}${path}` → ej: `http://localhost:4000/api/sync/changes`.
 */
export const API_BASE: string =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_API_URL) ||
  'http://localhost:4000/api';

/**
 * Lee SIEMPRE de sessionStorage (sin cache). Garantiza freshness tras
 * HMR y tras setAccessToken en otro módulo — el sessionStorage es la
 * única source of truth.
 */
export function getAccessToken(): string | null {
  return readAccessToken();
}

/**
 * @deprecated — se mantiene por compatibilidad. El cache de memoria
 * se eliminó; leer de sessionStorage siempre. Las llamadas a esta
 * función son no-op en términos de lectura pero se preservan para
 * evitar errores de import.
 */
export function setAccessToken(_token: string | null): void {
  // no-op
}