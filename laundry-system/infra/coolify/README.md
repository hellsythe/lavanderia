# Deploy en Coolify — LavanderPro

Coolify es un PaaS self-hosted (alternativa a Vercel/Netlify). Este repo está
preparado para deployarse con el **menor footprint posible**:

| Recurso Coolify | Tipo | Imagen / Build | Parte del repo que usa |
|---|---|---|---|
| **PostgreSQL** | Coolify-managed (ya existe) | — | — (servicio gestionado) |
| **Redis** | Coolify-managed (ya existe) | — | — (servicio gestionado) |
| **API** | Docker Compose (1 container) | `apps/api/Dockerfile` | `docker-compose.coolify.yml` |
| **Web** | Static Site (**0 containers**) | `nixpacks.toml` → `apps/web/out/` | `nixpacks.toml` |

> ⚠️ **Asumimos que ya tienes PostgreSQL y Redis en Coolify.** Si no, ver
> `docker-compose.full-stack.yml` (incluye todo el stack) — alternativa menos
> eficiente pero autocontenida.

## ¿Un repo o varios?

**Un solo repo para todos los recursos.** El repo se conecta a múltiples
recursos de Coolify (api + web), cada uno usando una parte distinta:

- **API** → `docker-compose.coolify.yml` (que referencia `apps/api/Dockerfile`)
- **Web** → `nixpacks.toml` (en la raíz, instruye a Nixpacks)

```
GitHub repo (lavander-system)
   ├─ Coolify resource: lavanderpro-api    → uses apps/api/Dockerfile
   ├─ Coolify resource: lavanderpro-web    → uses nixpacks.toml
   └─ Coolify resource: postgres           → Coolify-managed (no usa el repo)
```

Coolify hace `git clone` por cada recurso. Para un repo de pocos MB es
instantáneo. Si crece, asegúrate de que `.gitignore` excluya `node_modules`,
`dist/`, `.next/`, `.turbo/`.

**Para staging / producción separados** (cuando el equipo crezca):
- Branch `develop` → recursos `-staging`
- Tag `v*.*.*` → recursos `-prod`

---

## 0. Prerrequisitos

- VPS con Coolify instalado.
- Dominio apuntando al VPS (ej: `lavander.tu-dominio.com`).
- Repo de GitHub/GitLab con este código pusheado.
- **Generar secrets ANTES de deployar:**
  ```bash
  openssl rand -hex 32   # para POSTGRES_PASSWORD
  openssl rand -hex 32   # para JWT_SECRET (otro valor distinto)
  ```

---

## 1. Recursos a crear en Coolify

Necesitas **3 recursos nuevos** (PostgreSQL y Redis ya los tienes):

### 1A. API — Docker Compose

1. **+ New Resource** → **Docker Compose**.
2. **Source:** tu repo + rama.
3. **Docker Compose Location:** `docker-compose.coolify.yml` (en la raíz).
4. **Environment Variables** (ver `.env.production.example`):
   ```
   POSTGRES_HOST=<hostname interno del Postgres de Coolify>
   POSTGRES_PORT=5432
   POSTGRES_USER=lavanderpro
   POSTGRES_PASSWORD=<tu secreto>
   POSTGRES_DB=lavanderpro
   REDIS_HOST=<hostname interno del Redis>
   REDIS_PORT=6379
   JWT_SECRET=<otro secreto>
   JWT_ACCESS_EXPIRES_IN=15m
   JWT_REFRESH_EXPIRES_IN=60d
   CORS_ORIGINS=https://lavander.tu-dominio.com
   ```
5. **Domains:** `api.tu-dominio.com` (Coolify auto-genera TLS).

> 💡 El `POSTGRES_HOST` y `REDIS_HOST` los encuentras en Coolify →
> Resources → click en el recurso de Postgres/Redis → **"Internal Hostname"**.

### 1B. Web — Static Site

1. **+ New Resource** → **Static Site**.
2. **Source:** tu repo + misma rama.
3. **Build Pack:** Nixpacks (auto-detectado).
4. **Build Command:** *(dejar vacío — Nixpacks lee `nixpacks.toml`)*.
5. **Output Directory:** `apps/web/out`.
6. **Publish Directory:** `apps/web/out` (igual).
7. **Environment Variables:**
   ```
   NEXT_PUBLIC_API_URL=https://api.tu-dominio.com/api
   ```
8. **Domains:** `lavander.tu-dominio.com`.

> 💡 Coolify NO corre contenedor nginx. Sirve los HTML/CSS/JS directamente
> con su proxy reverso (Caddy o Traefik). **0 containers extra para el frontend.**

### 1C. Conectar Web → API

El `NEXT_PUBLIC_API_URL` se hornea en el bundle JS al **build time**. Coolify
lo inyecta correctamente cuando haces `Deploy` del recurso web.

---

## 2. ¿Cómo sabe Coolify qué construir?

| Recurso | Mecanismo |
|---|---|
| API | `apps/api/Dockerfile` (multi-stage, lee `apps/api/`) |
| Web | `nixpacks.toml` en la raíz (instruye a Nixpacks para pnpm workspace) |

El `nixpacks.toml` le dice a Coolify:
- Instalar Node 22 + pnpm
- `pnpm install` de todo el workspace
- Build de `packages/shared-types` → `packages/ui` → `apps/web`
- Output: `apps/web/out/`

---

## 3. Primer deploy

1. Deploy del recurso API → construye → arranca en puerto 4000.
2. **Verificar DB:** la API ejecuta migrations al arrancar (`migrationsRun: true`).
   Esto crea las extensiones (`citext`, `uuid-ossp`, `pgcrypto`) y todas las
   tablas. **Si las extensiones no se pueden crear** (permisos insuficientes en
   Coolify's Postgres), ejecutar manualmente vía psql o Adminer:
   ```sql
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS "pgcrypto";
   CREATE EXTENSION IF NOT EXISTS "citext";
   ```
3. Deploy del recurso Web → ejecuta Nixpacks → sirve `apps/web/out/`.
4. Verificar:
   ```bash
   curl https://api.tu-dominio.com/api/health
   # → {"status":"ok","timestamp":...}
   curl https://lavander.tu-dominio.com/login
   # → HTML del login
   ```

---

## 4. Crear el primer admin

```bash
curl -X POST https://api.tu-dominio.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "tenantName": "Mi Lavandería",
    "name": "Tu Nombre",
    "email": "tu@email.com",
    "password": "contraseña-fuerte-123"
  }'
```

---

## 5. Backups de PostgreSQL

Coolify UI → Database → "Create Backup". O cron job en el VPS:
```bash
0 3 * * * docker exec <coolify-postgres-container> \
  pg_dump -U lavanderpro lavanderpro \
  | gzip > /backups/lavanderpro-$(date +\%Y\%m\%d).sql.gz
```

---

## 6. Estructura final en Coolify

```
┌─────────────────────────────────────────────────────┐
│                  Coolify VPS                       │
│                                                     │
│  ┌─ postgres (Coolify-managed) ─────────────────┐   │
│  │   Hostname: postgres                         │   │
│  │   Volumen persistente                        │   │
│  └───────────────────────────────────────────────┘   │
│                                                     │
│  ┌─ redis (Coolify-managed) ───────────────────┐   │
│  │   Hostname: redis                            │   │
│  └───────────────────────────────────────────────┘   │
│                                                     │
│  ┌─ api (Docker Compose) ──────────────────────┐   │
│  │   Container: lavanderpro-api                │   │
│  │   Puerto interno: 4000                       │   │
│  │   Conecta a: postgres, redis                 │   │
│  │   Dominio: api.tu-dominio.com                │   │
│  └───────────────────────────────────────────────┘   │
│                                                     │
│  ┌─ web (Static Site) ─ NO CONTAINER ──────────┐   │
│  │   Output: apps/web/out/                      │   │
│  │   Servido por Caddy de Coolify               │   │
│  │   Dominio: lavander.tu-dominio.com           │   │
│  └───────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
   │
   ▼ TLS automático (Let's Encrypt)
Internet
```

---

## 7. Actualizar a nueva versión

```bash
git commit -am "feat: nueva feature"
git push origin main
```

Coolify detecta el push y pregunta si redesplegar. Click **Deploy**.

- **API**: rebuild de la imagen Docker + restart del container.
- **Web**: re-ejecuta `nixpacks.toml` (install + build) + reemplaza archivos servidos.

> ⚠️ Si cambias `apps/web/`, el web redeploy tarda ~2min (pnpm install + build).
> Si cambias solo backend, solo API redeploy es necesario.

---

## 8. ¿Problemas comunes?

| Error | Causa probable | Fix |
|---|---|---|
| `ECONNREFUSED 5432` en API logs | `POSTGRES_HOST` apunta a un hostname no accesible | Verificar "Internal Hostname" en Coolify → postgres |
| `permission denied for extension citext` | El usuario DB no tiene permisos para `CREATE EXTENSION` | Pedir a Coolify que habilite las extensiones, o usar un usuario con superuser |
| Web carga pero login falla | `NEXT_PUBLIC_API_URL` apunta a URL incorrecta o incluye `/api` doble | Verificar que la variable en el build sea `https://api.x.com/api` (no `https://api.x.com`) |
| `CORS error` en consola | `CORS_ORIGINS` no incluye el dominio del frontend | Agregar dominio exacto con `https://` |
| Web 404 al navegar a `/pedidos` | Coolify static site necesita config de SPA fallback | Verificar que nginx.conf del build redirige a index.html (ya está configurado en `apps/web/nginx.conf` — pero Coolify no usa nuestro nginx, usa el suyo) |
| Migrations duplicadas | DB ya tenía tablas del intento anterior | Drop database y dejar que las migrations se ejecuten de cero |

---

## 9. Alternativa: docker-compose.full-stack.yml

Si prefieres que la API traiga su propio Postgres + Redis (todo en un solo
recurso Docker Compose), usa el archivo `docker-compose.full-stack.yml`
en lugar de `docker-compose.coolify.yml`. Útil para:
- Deploys 100% aislados (Coolify's services no compartidos)
- Tests E2E reproducibles
- Entornos de staging efímeros

Trade-off: pierdes las DBs como recursos reutilizables entre proyectos en Coolify.

---

## 10. Para Capacitor (mobile + Windows nativo)

El frontend es un **static export**. Para empaquetarlo como app nativa:

```bash
# Una vez construido, el output en apps/web/out/ puede ser empaquetado:
npx cap add android
npx cap add ios
npx cap add electron  # para Windows
npx cap sync

# O usar Tauri para builds más ligeras (~10 MB vs 150 MB de Electron)
```

Los archivos en `apps/web/out/` se sincronizan con `android/app/src/main/assets/public/`,
`ios/App/App/public/` y la carpeta de Electron.

El sistema offline-first (Dexie + sync engine) viene después — agregaremos un
`Service Worker` y configuraremos Capacitor para usar el bundle local cuando
no haya red.