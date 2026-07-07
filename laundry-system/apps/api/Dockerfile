# syntax=docker/dockerfile:1.7
# ---------- Stage 1: deps (build-time, todas las deps) ----------
# Este stage se usa también como `target: deps` en docker-compose dev,
# donde solo necesitamos el node_modules completo (con devDependencies).
FROM node:22-alpine AS deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /repo

RUN corepack enable && corepack prepare pnpm@11.10.0 --activate

# Workspace metadata
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* tsconfig.base.json ./

# Copiar SOLO los package.json primero (mejor layer cache)
COPY apps/api/package.json ./apps/api/
COPY apps/api/tsconfig.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/shared-types/tsconfig.json ./packages/shared-types/

# Instalar todo el workspace (incluye api y shared-types)
RUN pnpm install --frozen-lockfile --config.dangerouslyAllowAllBuilds=true

# Source completo (necesario para `pnpm dev` en compose dev).
# El layer se invalida solo si cambia el código.
COPY apps/api ./apps/api
COPY packages/shared-types ./packages/shared-types

# ---------- Stage 1b: build (compila shared-types + api) ----------
FROM deps AS build

# Build: shared-types primero (api lo importa)
RUN cd packages/shared-types && pnpm run build

# Build api
RUN cd apps/api && pnpm run build

# ---------- Stage 2: prod-deps ----------
FROM node:22-alpine AS prod-deps
RUN apk add --no-cache libc6-compat openssl
WORKDIR /repo
RUN corepack enable && corepack prepare pnpm@11.10.0 --activate

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared-types/package.json ./packages/shared-types/

# Instalar workspace completo — pnpm crea symlinks en apps/*/node_modules/@org/*
RUN pnpm install --frozen-lockfile --prod --config.dangerouslyAllowAllBuilds=true

# ---------- Stage 3: runtime ----------
FROM node:22-alpine AS runtime
RUN apk add --no-cache openssl curl dumb-init

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0

WORKDIR /repo

# Copiar workspace node_modules (raíz + node_modules locales de cada package)
# pnpm pone los symlinks a workspace packages en apps/<pkg>/node_modules/@org/*
COPY --from=prod-deps /repo/node_modules ./node_modules
COPY --from=prod-deps /repo/apps/api/node_modules ./apps/api/node_modules
COPY --from=prod-deps /repo/packages/shared-types/node_modules ./packages/shared-types/node_modules

# Copiar artefactos compilados
COPY --from=build /repo/apps/api/dist ./apps/api/dist
COPY --from=build /repo/packages/shared-types/dist ./packages/shared-types/dist

# Metadata para resolver imports en runtime
COPY --from=build /repo/apps/api/package.json ./apps/api/package.json
COPY --from=build /repo/packages/shared-types/package.json ./packages/shared-types/package.json
COPY --from=build /repo/apps/api/tsconfig.json ./apps/api/tsconfig.json
COPY --from=build /repo/tsconfig.base.json ./tsconfig.base.json
COPY --from=build /repo/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=build /repo/package.json ./package.json

# Usuario no-root
RUN addgroup -g 1001 nodejs && adduser -u 1001 -G nodejs -D nestjs \
 && chown -R nestjs:nodejs /repo
USER nestjs

WORKDIR /repo/apps/api

EXPOSE 4000

# Signal handling correcto en Alpine
ENTRYPOINT ["dumb-init", "--"]

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:4000/api/health || exit 1

CMD ["node", "dist/main.js"]