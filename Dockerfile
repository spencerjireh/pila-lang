# syntax=docker/dockerfile:1.7
# Pila Lang — production image for apps/web (Next.js standalone, monorepo).

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/web/package.json ./apps/web/
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/config/node_modules ./packages/config/node_modules
COPY --from=deps /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
# Placeholder envs so validator (@pila/shared/config/env) passes at build time.
# Real values are injected at runtime.
ENV DATABASE_URL=postgres://x:x@x:5432/x \
    REDIS_URL=redis://x:6379 \
    S3_ENDPOINT=http://x:9000 \
    S3_BUCKET=x \
    S3_ACCESS_KEY=x \
    S3_SECRET_KEY=x \
    QR_TOKEN_SECRET=placeholder_placeholder_placeholder_xxxx \
    HOST_JWT_SECRET=placeholder_placeholder_placeholder_yyyy \
    GUEST_JWT_SECRET=placeholder_placeholder_placeholder_zzzz \
    ADMIN_EMAILS=placeholder@example.com \
    NEXTAUTH_SECRET=placeholder_sixteen_chars \
    NEXTAUTH_URL=http://localhost:3000 \
    APP_BASE_URL=http://localhost:3000 \
    RESEND_API_KEY=re_placeholder
RUN pnpm --filter @pila/web build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

# Next standalone writes a self-contained tree rooted at the monorepo
# (standalone/{apps/web/server.js, node_modules/, packages/, ...}).
# We copy the whole standalone dir to /app and set WORKDIR to apps/web.
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
# sharp ships native binaries; Next's standalone tracer may miss them, so re-copy.
COPY --from=builder /app/node_modules/sharp ./node_modules/sharp
COPY --from=builder /app/node_modules/@img ./node_modules/@img

USER nextjs
WORKDIR /app/apps/web
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
# /api/health moved to apps/api after the Express split. apps/web is now
# UI-only; probe a static route instead.
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -q -O - http://localhost:3000/ || exit 1
CMD ["node", "server.js"]
