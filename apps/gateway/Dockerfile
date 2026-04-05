# ============================================================
# Stage 1: Build
# ============================================================
FROM node:22-alpine AS builder

WORKDIR /app

# Instalar pnpm
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Copiar manifiestos del monorepo
COPY package.json pnpm-workspace.yaml tsconfig.base.json ./
COPY apps/gateway/package.json ./apps/gateway/
COPY packages/core/package.json ./packages/core/
COPY packages/database/package.json ./packages/database/
COPY packages/ai/package.json ./packages/ai/

# Instalar dependencias
RUN pnpm install --frozen-lockfile

# Copiar código fuente
COPY packages/core/src ./packages/core/src
COPY packages/core/tsconfig.json ./packages/core/
COPY packages/database/src ./packages/database/src
COPY packages/database/tsconfig.json ./packages/database/
COPY packages/ai/src ./packages/ai/src
COPY packages/ai/tsconfig.json ./packages/ai/
COPY apps/gateway/src ./apps/gateway/src
COPY apps/gateway/tsconfig.json ./apps/gateway/
COPY apps/gateway/nest-cli.json ./apps/gateway/

# Build en orden de dependencias
RUN pnpm --filter @koliman/core build
RUN pnpm --filter @koliman/database build
RUN pnpm --filter @koliman/ai build
RUN pnpm --filter @koliman/gateway build

# ============================================================
# Stage 2: Production
# ============================================================
FROM node:22-alpine AS production

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Solo los archivos necesarios para producción
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/apps/gateway/package.json ./apps/gateway/
COPY --from=builder /app/packages/core/package.json ./packages/core/
COPY --from=builder /app/packages/database/package.json ./packages/database/
COPY --from=builder /app/packages/ai/package.json ./packages/ai/

# Instalar solo dependencias de producción
RUN pnpm install --frozen-lockfile --prod

# Copiar builds compilados
COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/database/dist ./packages/database/dist
COPY --from=builder /app/packages/ai/dist ./packages/ai/dist
COPY --from=builder /app/apps/gateway/dist ./apps/gateway/dist

WORKDIR /app/apps/gateway

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "dist/main.js"]
