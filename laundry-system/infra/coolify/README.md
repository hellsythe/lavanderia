# Deploy en Coolify — LavanderPro

Coolify es un PaaS self-hosted (alternativa a Vercel/Netlify). Este repo
está preparado para deployarse como **2 recursos separados** para evitar
los issues de auto-routing de Coolify con Caddy/Traefik:

| Recurso Coolify | Tipo | Notas |
|---|---|---|
| **PostgreSQL** | Coolify-managed (ya existe) | Servicio gestionado |
| **Redis** | Coolify-managed (ya existe) | Servicio gestionado |
| **API** | Docker Compose | Solo el backend |
| **Web** | Static Site (Dockerfile) | Solo el frontend, 0 containers |

## ¿Por qué split?

Cuando Coolify gestiona un Docker Compose con varios servicios, **inyecta
labels `caddy_0.*` con `try_files` automático** que asume que los archivos
estáticos están en el filesystem del proxy de Caddy. Esto rompe el routing
para containers nginx que sirven SPAs (como Next.js static export).

Solución: separar web en Static Site (Coolify sirve los archivos directamente
con su propio servidor, sin labels problemáticas).

---

## Recursos a crear en Coolify

### 1. API — Docker Compose

1. **+ New Resource** → **Docker Compose**
2. **Source:** tu repo de GitHub + rama `main`
3. **Docker Compose Location:** `docker-compose.coolify.yml`
4. **Environment Variables:**
   ```
   POSTGRES_HOST=<hostname interno del Postgres en Coolify>
   POSTGRES_PORT=5432
   POSTGRES_USER=lavanderpro
   POSTGRES_PASSWORD=<secret>
   POSTGRES_DB=lavanderpro
   REDIS_HOST=<hostname interno del Redis en Coolify>
   REDIS_PORT=6379
   JWT_SECRET=<secret distinto>
   CORS_ORIGINS=https://<tu-frontend>.sslip.io
   ```
5. **Domain:** `api.<tu-dominio>.sslip.io`
6. **Deploy**

### 2. Web — Static Site

1. **+ New Resource** → **Static Site**
2. **Source:** tu repo + misma rama `main`
3. **Build Pack:** **Dockerfile** (no Nixpacks — no soporta pnpm monorepos)
4. **Docker File Location:** `apps/web/Dockerfile`
5. **Docker Build Target:** `static`
6. **Publish Directory:** `/public`
7. **Environment Variables:**
   ```
   NEXT_PUBLIC_API_URL=https://api.<tu-dominio>.sslip.io/api
   ```
8. **Domain:** `lavander.<tu-dominio>.sslip.io`
9. **Deploy**

Coolify hace `docker build --target static`, extrae `/public` y lo sirve
con su propio servidor.

---

## 0. Prerrequisitos

- VPS con Coolify instalado.
- Dominio apuntando al VPS (ej: `lavander.tu-dominio.sslip.io`).
- Repo de GitHub/GitLab con este código pusheado.
- **Generar secrets:**
  ```bash
  openssl rand -hex 32   # POSTGRES_PASSWORD
  openssl rand -hex 32   # JWT_SECRET (distinto del anterior)
  ```

---

## Verificación post-deploy

```bash
# API
curl https://api.<tu-dominio>.sslip.io/api/health
# → {"status":"ok","timestamp":...}

# Login
curl -X POST https://api.<tu-dominio>.sslip.io/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"carlos@lavanderpro.mx","password":"password123"}'

# Web (abrir en browser)
open https://lavander.<tu-dominio>.sslip.io/login
```

## Credenciales iniciales

```
Email:    carlos@lavanderpro.mx
Password: password123
```

Este usuario lo crea automáticamente la migración `InitialSchema` cuando la API
arranca contra una DB vacía. Para producción real, registrar un nuevo admin
desde la UI o vía `/api/auth/register`.

---

## Estructura final en Coolify

```
┌─────────────────────────────────────────────────────┐
│                  Coolify VPS                       │
│                                                     │
│  ┌─ postgres (Coolify-managed) ─────────────────┐   │
│  │   Hostname: postgres                         │   │
│  └───────────────────────────────────────────────┘   │
│                                                     │
│  ┌─ redis (Coolify-managed) ───────────────────┐   │
│  │   Hostname: redis                            │   │
│  └───────────────────────────────────────────────┘   │
│                                                     │
│  ┌─ lavanderpro-api (Docker Compose) ───────────┐   │
│  │   api.tu-dominio.sslip.io → container api    │   │
│  │   Container: NestJS en puerto 4000           │   │
│  └───────────────────────────────────────────────┘   │
│                                                     │
│  ┌─ lavanderpro-web (Static Site) ─ NO CONTAINER ┐  │
│  │   lavander.tu-dominio.sslip.io → /public      │   │
│  │   Servido por Coolify directamente            │   │
│  └───────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
   │
   ▼ TLS automático (Let's Encrypt)
Internet
```

---

## Actualizar a nueva versión

```bash
git commit -am "feat: nueva feature"
git push origin main
```

Coolify detecta el push y pregunta si redesplegar:
- **API**: rebuild Docker + restart (1-2 min)
- **Web**: rebuild Docker + reemplaza `/public` (1-2 min, primera vez con cache de layers)

---

## ¿Problemas comunes?

| Error | Causa probable | Fix |
|---|---|---|
| `ECONNREFUSED 5432` en API logs | `POSTGRES_HOST` apunta a un hostname no accesible | Verificar "Internal Hostname" en Coolify → postgres |
| Web 404 | Build del Static Site falló | Ver "Show Debug Logs" en Coolify, revisar que `target: static` esté aplicado |
| `permission denied for extension citext` | Usuario Postgres no tiene permisos para `CREATE EXTENSION` | Ejecutar `CREATE EXTENSION IF NOT EXISTS citext` manualmente vía Adminer/psql |
| Web carga pero login falla | `NEXT_PUBLIC_API_URL` apunta a URL incorrecta | Verificar variable en Coolify → Resource → web → Environment Variables. Re-deploy |
| Migrations duplicadas | DB ya tenía tablas de intento anterior | Drop database y dejar que la API recree todo |

---

## Para desarrollo local

```bash
cd /Users/hellsythe/Documents/opencode/laundry-system

# Levantar todo el stack (Postgres + Redis + API + Web con nginx)
docker compose -f docker-compose.yml up -d

# Ver
open http://localhost:3000/login

# Detener
docker compose -f docker-compose.yml down

# Resetear DB (BORRA TODO)
docker compose -f docker-compose.yml down -v
docker volume rm lavanderpro_pgdata lavanderpro_redisdata
docker compose -f docker-compose.yml up -d
```

---

## Para Capacitor (mobile + Windows nativo)

Una vez deployado el Static Site, los archivos en `apps/web/out/` pueden
empaquetarse como app nativa:

```bash
npx cap add android
npx cap add ios
npx cap add electron  # Windows
npx cap sync
```

Los archivos se sincronizan con `android/app/src/main/assets/public/`,
`ios/App/App/public/`, etc. El bundle es **offline-first ready** —
próximo paso: agregar Service Worker para uso sin internet.