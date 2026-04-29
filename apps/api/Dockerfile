# syntax=docker/dockerfile:1.7
# Pila Lang — production image for apps/api (Express 5 + ESM, tsx runtime).
#
# Why tsx in prod (not tsc + node dist): packages/shared and packages/db
# export TS source via wildcard exports without `.js` extensions. NodeNext
# resolution would require rewriting every relative import in those packages.
# tsx (esbuild under the hood) handles this transparently and starts in
# ~150ms — fine for a long-running service.

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/config/package.json ./packages/config/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

FROM base AS runner
ENV NODE_ENV=production
RUN addgroup -g 1001 -S nodejs && adduser -u 1001 -S nodeapp -G nodejs

# Copy resolved node_modules tree from deps + the TS source for both
# apps/api and the workspace packages it imports at runtime.
COPY --from=deps --chown=nodeapp:nodejs /app/node_modules ./node_modules
COPY --from=deps --chown=nodeapp:nodejs /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps --chown=nodeapp:nodejs /app/packages/db/node_modules ./packages/db/node_modules
COPY --from=deps --chown=nodeapp:nodejs /app/packages/shared/node_modules ./packages/shared/node_modules

COPY --chown=nodeapp:nodejs apps/api ./apps/api
COPY --chown=nodeapp:nodejs packages/db ./packages/db
COPY --chown=nodeapp:nodejs packages/shared ./packages/shared
COPY --chown=nodeapp:nodejs packages/config ./packages/config
COPY --chown=nodeapp:nodejs package.json pnpm-workspace.yaml ./

USER nodeapp
WORKDIR /app/apps/api
EXPOSE 3001
ENV PORT=3001 HOSTNAME=0.0.0.0
HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -q -O - http://localhost:3001/api/v1/health || exit 1
CMD ["node", "--import", "tsx", "src/server.ts"]
