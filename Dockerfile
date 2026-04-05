# Stage 1: Builder — install deps and build all packages
FROM node:22-alpine AS builder

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY packages/core/package.json packages/core/
COPY packages/database/package.json packages/database/
COPY packages/ai/package.json packages/ai/
COPY packages/skills/package.json packages/skills/
COPY apps/gateway/package.json apps/gateway/
COPY apps/worker/package.json apps/worker/

RUN pnpm install --frozen-lockfile

COPY tsconfig.base.json ./
COPY packages/ packages/
COPY apps/ apps/

RUN pnpm build

# Stage 2: Gateway
FROM node:22-alpine AS gateway

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages/core/package.json packages/core/
COPY --from=builder /app/packages/database/package.json packages/database/
COPY --from=builder /app/packages/ai/package.json packages/ai/
COPY --from=builder /app/packages/skills/package.json packages/skills/
COPY --from=builder /app/apps/gateway/package.json apps/gateway/
COPY --from=builder /app/apps/worker/package.json apps/worker/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/core/dist packages/core/dist
COPY --from=builder /app/packages/database/dist packages/database/dist
COPY --from=builder /app/packages/ai/dist packages/ai/dist
COPY --from=builder /app/packages/skills/dist packages/skills/dist
COPY --from=builder /app/apps/gateway/dist apps/gateway/dist

EXPOSE 3000

CMD ["node", "apps/gateway/dist/main.js"]

# Stage 3: Worker
FROM node:22-alpine AS worker

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

WORKDIR /app

COPY --from=builder /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages/core/package.json packages/core/
COPY --from=builder /app/packages/database/package.json packages/database/
COPY --from=builder /app/packages/ai/package.json packages/ai/
COPY --from=builder /app/packages/skills/package.json packages/skills/
COPY --from=builder /app/apps/gateway/package.json apps/gateway/
COPY --from=builder /app/apps/worker/package.json apps/worker/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/core/dist packages/core/dist
COPY --from=builder /app/packages/database/dist packages/database/dist
COPY --from=builder /app/packages/ai/dist packages/ai/dist
COPY --from=builder /app/packages/skills/dist packages/skills/dist
COPY --from=builder /app/apps/worker/dist apps/worker/dist

CMD ["node", "apps/worker/dist/main.js"]
