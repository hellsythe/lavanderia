# Deploy en Coolify — LavanderPro

Coolify es un PaaS self-hosted (alternativa a Vercel/Netlify). Este repo está
preparado para deployarse como **un único recurso Docker Compose** que incluye
PostgreSQL, Redis, la API y el frontend.

---

## 0. Prerrequisitos

- VPS con Coolify instalado (Hetzner, DigitalOcean, Contabo, lo que sea).
- Dominio apuntando al VPS (ej: `lavander.tu-dominio.com`).
- Repo de GitHub/GitLab con este código pusheado.
- **Generate secrets ANTES de deployar:**
  ```bash
  openssl rand -hex 32   # para POSTGRES_PASSWORD
  openssl rand -hex 32   # para JWT_SECRET (otro valor distinto)
  ```

---

## 1. Crear recurso Docker Compose en Coolify

1. Login en Coolify → **+ New Resource** → **Docker Compose**.
2. **Source:** tu repo de GitHub + rama (`main` o la que uses).
3. **Docker Compose Location:** `docker-compose.coolify.yml` (en la raíz).
4. Coolify detecta los servicios y los `build:` que tiene.

---

## 2. Variables de entorno

En la pestaña **Environment Variables** del recurso, define:

| Variable | Ejemplo | Notas |
|---|---|---|
| `POSTGRES_DB` | `lavanderpro` | — |
| `POSTGRES_USER` | `lavanderpro` | — |
| `POSTGRES_PASSWORD` | `<32 bytes random>` | ⚠️ NO commitear |
| `JWT_SECRET` | `<32 bytes random>` | ⚠️ Distinto del DB password |
| `JWT_ACCESS_EXPIRES_IN` | `15m` | — |
| `JWT_REFRESH_EXPIRES_IN` | `60d` | — |
| `NEXT_PUBLIC_API_URL` | `https://api.lavander.tu-dominio.com/api` | URL público de la API |
| `CORS_ORIGINS` | `https://lavander.tu-dominio.com` | Dominio del frontend |

> ⚠️ `NEXT_PUBLIC_API_URL` se inyecta al **build** del frontend (Dockerfile lo pasa
> como `ARG`). Cambiar esto requiere reconstruir la imagen del web.

---

## 3. Dominios + TLS

Coolify auto-genera certificados Let's Encrypt. En la sección **Domains**:

| Servicio | Dominio público | Notas |
|---|---|---|
| `web` | `lavander.tu-dominio.com` | Frontend principal |
| `api` | `api.lavander.tu-dominio.com` | API REST |

Coolify crea un reverse proxy (Traefik) que enruta cada dominio al container correcto.

---

## 4. Primer deploy

1. Click **Deploy**.
2. Coolify hace `git pull`, construye las imágenes (API + web), levanta los 4 servicios.
3. Esperar a que `postgres` y `redis` pasen los healthchecks (~30s).
4. La API ejecuta las migrations automáticamente al arrancar (`migrationsRun: true`).
5. Verificar:
   ```bash
   curl https://api.lavander.tu-dominio.com/api/health
   # → {"status":"ok","timestamp":...}
   curl https://lavander.tu-dominio.com/login
   # → HTML del login
   ```

---

## 5. Crear el primer usuario admin

El seed del initial migration crea un tenant demo (`LavanderPro Demo`) con un
usuario admin solo en **desarrollo local**. En producción NO se ejecuta ese
seed (es local-only).

Para producción, regístrate desde la UI o via API:

```bash
curl -X POST https://api.lavander.tu-dominio.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "tenantName": "Mi Lavandería",
    "name": "Tu Nombre",
    "email": "tu@email.com",
    "password": "contraseña-fuerte-123"
  }'
```

Eso crea el tenant + admin user + devuelve tokens para auto-login.

---

## 6. Backups

PostgreSQL es persistente en el volumen `lavanderpro-postgres-data`.

### Backup manual desde Coolify
- Coolify UI → Database → Backup → "Create Backup".

### Backup automático recomendado
Configurar un cron job en el VPS que haga `pg_dump` diario:
```bash
0 3 * * * docker exec lavanderpro-postgres pg_dump -U lavanderpro lavanderpro \
  | gzip > /backups/lavanderpro-$(date +\%Y\%m\%d).sql.gz
```

---

## 7. Logs y debugging

```bash
# Logs de un servicio específico
docker logs -f lavanderpro-api
docker logs -f lavanderpro-web
docker logs -f lavanderpro-postgres

# Shell dentro de un container
docker exec -it lavanderpro-api sh
docker exec -it lavanderpro-postgres psql -U lavanderpro
```

---

## 8. Actualizar a nueva versión

Coolify detecta pushes a la rama configurada y redeploy automáticamente. O manual:
1. Coolify → Resource → **Redeploy**.
2. Si hay cambios en `migrations/`, la API las aplica al arrancar.

---

## 9. Estructura de red

```
Internet
   │ TLS (Let's Encrypt via Traefik)
   ▼
┌──────────────────────────────────┐
│ Traefik (reverse proxy)          │
│ lavander.tu-dominio.com → web    │
│ api.lavander.tu-dominio.com → api│
└──────────────────────────────────┘
   │
   ▼ red interna (lavanderpro-net)
┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│   web        │  │   api        │  │  postgres    │  │  redis       │
│  (nginx)     │──▶  (NestJS)    │──▶  (16-alpine)│  │  (7-alpine)  │
│  Next.js     │  │  Puerto 4000 │  │  Puerto 5432 │  │  Puerto 6379 │
│  static exp. │  │              │  │  Volumen:    │  │  Volumen:    │
└──────────────┘  └──────────────┘  │  pgdata      │  │  data        │
                                     └──────────────┘  └──────────────┘
```

---

## 10. ¿Problemas comunes?

| Error | Causa probable | Fix |
|---|---|---|
| `ECONNREFUSED 5432` en API logs | API arrancó antes que Postgres pasara healthcheck | Esperar 30s o ajustar `depends_on: service_healthy` |
| `CORS error` en consola del browser | `CORS_ORIGINS` no incluye el dominio del frontend | Agregar dominio exacto con `https://` |
| `401` después de login | `JWT_SECRET` cambió entre builds | Usar mismo secret o forzar re-login |
| Build falla: `Cannot find module` | Faltan deps en algún `package.json` | `pnpm install` local para regenerar lockfile |
| Migrations no corren | `synchronize: false` + migrations no se compilaron al dist | Verificar que `apps/api/Dockerfile` copia `dist/database/migrations/` |