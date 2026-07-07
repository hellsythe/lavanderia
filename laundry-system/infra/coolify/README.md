# Deploy en Coolify — LavanderPro

Coolify es un PaaS self-hosted (alternativa a Vercel/Netlify). Este repo
está preparado para deployarse como **3 recursos separados**:

| Recurso Coolify | Tipo | Notas |
|---|---|---|
| **PostgreSQL** | Coolify-managed (ya existe) | Servicio gestionado |
| **Redis** | Coolify-managed (ya existe) | Servicio gestionado |
| **API** | Docker Compose | Solo el backend |
| **Web** | **Application** (Dockerfile) | Build + nginx, NO Static Site |

## ⚠️ Por qué NO usar Static Site

`Static Site` en Coolify es **solo para archivos ya construidos en el repo** (no
tiene buildpack). Si lo usas con Next.js, tendrías que commitear `apps/web/out/`
al repo (mala práctica: artefactos binarios en git, builds no reproducibles).

**Usa `Application`** que sí permite Dockerfile buildpack. Coolify construye
la imagen desde `apps/web/Dockerfile` y maneja el routing correctamente
(sin las labels `caddy_0.*` problemáticas que tiene Docker Compose).

## Recursos a crear en Coolify

### 1. API — Docker Compose

1. **+ New Resource → Docker Compose**
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

### 2. Web — Application (Dockerfile)

1. **+ New Resource → Application** ← NO Static Site
2. **Source:** tu repo + misma rama `main`
3. **Build Pack:** **Dockerfile**
4. **Base Directory:** *(vacío)* ← Coolify usa la raíz del repo
5. **Dockerfile Location:** `Dockerfile` ← Coolify lo encuentra automáticamente
6. **Port:** `80` (Coolify lo detecta del EXPOSE del Dockerfile)
7. **Environment Variables:**
   ```
   NEXT_PUBLIC_API_URL=https://api.<tu-dominio>.sslip.io/api
   ```
8. **Domain:** `lavander.<tu-dominio>.sslip.io`
9. **Deploy**

Coolify hace `docker build` (build context = raíz del repo), ejecuta el container
nginx, y enruta el tráfico via Traefik nativo. **0 labels `caddy_0.*` problemáticas.**

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
│  │   api.tu-dominio.sslip.io                    │   │
│  │   Container: NestJS en puerto 4000           │   │
│  └───────────────────────────────────────────────┘   │
│                                                     │
│  ┌─ lavanderpro-web (Application / Dockerfile) ─┐   │
│  │   lavander.tu-dominio.sslip.io               │   │
│  │   Container: nginx sirviendo static files    │   │
│  │   Routing: Traefik nativo de Coolify         │   │
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
- **Web**: rebuild Docker + restart nginx (1-2 min con cache de layers)

---

## ¿Problemas comunes?

| Error | Causa probable | Fix |
|---|---|---|
| `ECONNREFUSED 5432` en API logs | `POSTGRES_HOST` apunta a un hostname no accesible | Verificar "Internal Hostname" en Coolify → postgres |
| Web da 404 | Estás usando Docker Compose (no Application) | Eliminar el compose, crear como Application |
| Web no encuentra archivos | Build target mal configurado | En Coolify, verificar que el Dockerfile tiene `apps/web/Dockerfile` correcto |
| `permission denied for extension citext` | Usuario Postgres sin permisos para CREATE EXTENSION | Ejecutar manualmente via Adminer/psql |
| Web carga pero login falla | `NEXT_PUBLIC_API_URL` apunta a URL incorrecta | Verificar variable en Coolify → web → Environment Variables. Re-deploy |
| Migrations duplicadas | DB ya tenía tablas de intento anterior | Drop database y dejar que la API recree todo |

---

## Para desarrollo local

```bash
cd /Users/hellsythe/Documents/opencode/laundry-system

# Levantar todo el stack
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

Una vez deployado, los archivos en `apps/web/out/` pueden empaquetarse:

```bash
npx cap add android
npx cap add ios
npx cap add electron  # Windows
npx cap sync
```

Próximo paso: agregar Service Worker para uso offline.