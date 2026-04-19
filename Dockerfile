# syntax=docker/dockerfile:1.7
# Pila Lang v1 — production image (multi-stage, Next.js standalone output).

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Placeholder envs so zod validation passes at build time. Real values are injected at runtime.
ENV DATABASE_URL=postgres://x:x@x:5432/x \
    REDIS_URL=redis://x:6379 \
    S3_ENDPOINT=http://x:9000 \
    S3_BUCKET=x \
    S3_ACCESS_KEY=x \
    S3_SECRET_KEY=x \
    QR_TOKEN_SECRET=placeholder_placeholder_placeholder_xxxx \
    HOST_JWT_SECRET=placeholder_placeholder_placeholder_yyyy \
    ADMIN_EMAILS=placeholder@example.com \
    NEXTAUTH_SECRET=placeholder_sixteen_chars \
    NEXTAUTH_URL=http://localhost:3000 \
    RESEND_API_KEY=re_placeholder
RUN pnpm build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nextjs -G nodejs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
# sharp ships a native binary compiled against alpine's musl; keep the runtime copy separate
# from the bundled server so Next can resolve it via serverComponentsExternalPackages.
COPY --from=builder /app/node_modules/sharp ./node_modules/sharp
COPY --from=builder /app/node_modules/@img ./node_modules/@img

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -q -O - http://localhost:3000/api/health || exit 1
CMD ["node", "server.js"]
