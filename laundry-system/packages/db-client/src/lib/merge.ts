/**
 * lwwMerge — Last-Write-Wins merge entre cache local (Dexie) y respuesta
 * del server.
 *
 * Por cada id presente en `local` o `server`, gana el que tenga el
 * `updatedAt` más alto (con tie → server). Esto preserva ediciones
 * offline (con `updatedAt` local > server) hasta que la sync las suba
 * y el server las confirme.
 *
 * Si el server tiene un id que el local NO tiene (caso normal: fue
 * creado en otro dispositivo), entra via server. Si el local tiene un
 * id que el server NO tiene (caso offline-pending), se preserva.
 *
 * Decisión: NO borrar rows que el server no devolvió — esos son los
 * offline-pendientes. La sync_queue los sube después; cuando el server
 * confirma, una query posterior los trae y se actualiza el updatedAt
 * local (el server siempre "gana" en ese round si su updatedAt >=).
 */
export function lwwMerge<T extends { id: string; updatedAt: number }>(
  local: T[],
  server: T[],
): T[] {
  const map = new Map<string, T>();
  // Insertar locales primero.
  for (const l of local) map.set(l.id, l);
  // Server pisa si es más nuevo O igual.
  for (const s of server) {
    const existing = map.get(s.id);
    if (!existing || s.updatedAt >= existing.updatedAt) {
      map.set(s.id, s);
    }
  }
  return Array.from(map.values());
}