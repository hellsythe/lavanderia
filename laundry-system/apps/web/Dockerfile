# syntax=docker/dockerfile:1.7
# apps/web/Dockerfile
#
# Dos targets de runtime según cómo se deploye:
#   - target: runtime  → nginx container (para Docker Compose local/dev)
#   - target: static   → solo archivos estáticos en /public (para Coolify Static Site)
#
# Para Coolify Static Site:
#   - Build Pack: Dockerfile
#   - Docker File Location: apps/web/Dockerfile
#   - Build target: static (configurable en Coolify o via target en CLI)
#   - Publish Directory: /public
#   - Coolify sirve estos archivos con su propio servidor (sin nginx, sin Caddy)

# ---------- Stage 1: deps (build-time, todas las deps) ----------
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@11.10.0 --activate

# Workspace metadata — DEBE estar antes de `pnpm install` para que los filtros
# reconozcan los packages.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* tsconfig.base.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/ui/package.json ./packages/ui/
COPY packages/shared-types/package.json ./packages/shared-types/

# Install todo el workspace — pnpm crea symlinks en apps/*/node_modules/@org/*
RUN pnpm install --frozen-lockfile --config.dangerouslyAllowAllBuilds=true

# Source
COPY packages/ui ./packages/ui
COPY packages/shared-types ./packages/shared-types
COPY apps/web ./apps/web

# ---------- Stage 2: build ----------
FROM deps AS build

# Build en orden: shared-types → ui → web
RUN cd packages/shared-types && pnpm run build
RUN cd packages/ui && pnpm run build

# NEXT_PUBLIC_API_URL se inyecta al build. Si está vacía, el build usa string vacío.
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN cd apps/web && pnpm run build

# Verificar output antes de pasar al stage final
RUN ls -la /repo/apps/web/out/ && \
    test -f /repo/apps/web/out/index.html && \
    test -f /repo/apps/web/out/login.html && \
    test -f /repo/apps/web/out/pedidos.html && \
    test -f /repo/apps/web/out/registro.html && \
    echo "✅ Build OK — static files generated for routes: /, /login, /pedidos, /registro"

# ---------- Stage 3a: static (para Coolify Static Site) ----------
# Solo los archivos estáticos en /public. Coolify los extrae y los sirve.
FROM alpine:3.20 AS static
RUN apk add --no-cache curl
COPY --from=build /repo/apps/web/out /public
RUN ls /public/ | head -10
# Coolify Static Site extrae /public y lo sirve con su servidor.

# ---------- Stage 3b: runtime (nginx, para Docker Compose local) ----------
FROM nginx:1.27-alpine AS runtime

LABEL org.opencontainers.image.title="LavanderPro Web"
LABEL org.opencontainers.image.description="Frontend estático (Next.js export) servido por nginx"

# Copiar config de nginx
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copiar build estático de Next.js
COPY --from=build /repo/apps/web/out /usr/share/nginx/html

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:80/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]