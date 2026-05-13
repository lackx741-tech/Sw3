# apps/dashboard/Dockerfile
# Multi-stage build for the SW3 Next.js dashboard.
# Build context must be the repo root:
#   docker build -f apps/dashboard/Dockerfile -t sw3/dashboard .

# ── Stage 1: base ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN npm install -g pnpm@9.4.0

# ── Stage 2: install workspace dependencies ───────────────────────────────────
FROM base AS deps
WORKDIR /app

# Copy workspace manifests so pnpm can resolve the full workspace
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/dashboard/package.json        ./apps/dashboard/
COPY packages/config/package.json       ./packages/config/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/ui/package.json           ./packages/ui/
COPY packages/sdk/package.json          ./packages/sdk/

RUN pnpm install --frozen-lockfile

# ── Stage 3: build ────────────────────────────────────────────────────────────
FROM deps AS builder
WORKDIR /app

# Copy source
COPY apps/dashboard   ./apps/dashboard
COPY packages/config  ./packages/config
COPY packages/shared-types ./packages/shared-types
COPY packages/ui      ./packages/ui
COPY packages/sdk     ./packages/sdk
COPY tsconfig.base.json turbo.json ./

# Build only the dashboard and its workspace dependencies
RUN pnpm --filter @sw3/dashboard... build

# ── Stage 4: runtime ──────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

# Create non-root user
RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Copy the production artefacts
COPY --from=builder --chown=nextjs:nodejs /app/apps/dashboard/.next  ./apps/dashboard/.next
COPY --from=builder --chown=nextjs:nodejs /app/apps/dashboard/public ./apps/dashboard/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/dashboard/package.json ./apps/dashboard/package.json
COPY --from=builder --chown=nextjs:nodejs /app/node_modules           ./node_modules
COPY --from=builder --chown=nextjs:nodejs /app/package.json           ./package.json

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

WORKDIR /app/apps/dashboard
CMD ["pnpm", "start"]
