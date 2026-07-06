# syntax=docker/dockerfile:1

FROM node:22-alpine AS base

# ---- deps: install dependencies only (cached separately from source) ----
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: compile the Next.js app ----
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Build-time env vars only need to satisfy zod validation (src/lib/env.ts);
# they are not the values used at runtime (those come from docker-compose /
# the deployment environment via the "runner" stage below).
ENV MONGODB_URI="mongodb://localhost:27017/seasharp-build"
ENV NEXTAUTH_SECRET="build-time-placeholder-build-time-placeholder"
ENV NEXTAUTH_URL="http://localhost:3000"
RUN npm run build

# ---- runner: minimal production image ----
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
