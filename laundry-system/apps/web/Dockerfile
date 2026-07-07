# syntax=docker/dockerfile:1.7
# ---------- Stage 1: deps (build-time, todas las deps) ----------
# Usado también como `target: deps` en docker-compose dev
# (necesitamos devDependencies para `pnpm dev`).
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

# Install TODO el workspace — pnpm crea symlinks en apps/*/node_modules/@org/*
RUN pnpm install --frozen-lockfile --config.dangerouslyAllowAllBuilds=true

# Source
COPY packages/ui ./packages/ui
COPY packages/shared-types ./packages/shared-types
COPY apps/web ./apps/web

# ---------- Stage 1b: build ----------
FROM deps AS build

# Build en orden: shared-types → ui → web
RUN cd packages/shared-types && pnpm run build
RUN cd packages/ui && pnpm run build

ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN cd apps/web && pnpm run build

# Verificar que el output se generó correctamente.
# Si esto falla, el deploy falla rápido con un mensaje claro.
# Next.js output:export genera archivos .html planos (no subdirectorios).
RUN ls -la /repo/apps/web/out/ && \
    test -f /repo/apps/web/out/index.html && \
    test -f /repo/apps/web/out/login.html && \
    test -f /repo/apps/web/out/pedidos.html && \
    echo "✅ Build OK — static files generated"

# ---------- Stage 2: runtime (nginx) ----------
FROM nginx:1.27-alpine AS runtime

LABEL org.opencontainers.image.title="LavanderPro Web"
LABEL org.opencontainers.image.description="Frontend estático (Next.js export) servido por nginx"

# Copiar config de nginx
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf

# Copiar build estático de Next.js
COPY --from=build /repo/apps/web/out /usr/share/nginx/html

# Verificar que el output se copió (fail-fast si el build stage falló)
RUN ls /usr/share/nginx/html/ && \
    test -f /usr/share/nginx/html/index.html && \
    echo "✅ Runtime OK — static files in place"

# Healthcheck
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://localhost:80/ || exit 1

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]