# syntax=docker/dockerfile:1

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat tzdata
ENV TZ=Asia/Tashkent
WORKDIR /app

# 1. Install dependencies
FROM base AS deps
COPY package.json package-lock.json* .npmrc* ./
# npm yuklamalari keshi deploylar orasida saqlanadi (lock fayl o'zgarganda ham tez)
RUN --mount=type=cache,id=printgoo-npm,target=/root/.npm \
    npm ci --legacy-peer-deps --prefer-offline --no-audit --no-fund

# 2. Build the Next.js application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG NEXT_PUBLIC_APP_URL=https://erp.printg.uz
ARG NEXT_PUBLIC_S3_ENDPOINT=https://s3.printg.uz
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_S3_ENDPOINT=$NEXT_PUBLIC_S3_ENDPOINT
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
# Next.js build keshi (.next/cache) deploylar orasida saqlanadi: kichik o'zgarishda faqat o'zgargan qism qayta yig'iladi
RUN --mount=type=cache,id=printgoo-next-cache,target=/app/.next/cache \
    npm run build

# 3. Production Next.js Runner (Standalone)
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Fayl yuklash (avatarlar, maketlar, logolar, kesh) papkalarini yaratish va to'liq yozish huquqini ta'minlash
RUN mkdir -p /app/public/uploads/avatars \
             /app/public/uploads/clients/logos \
             /app/public/artwork \
             /app/public/cache/telegram/avatars && \
    chown -R nextjs:nodejs /app/public

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]

# 4. Background Worker Runner (BullMQ + Auto DB Migration on Startup)
FROM base AS worker
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["sh", "-c", "npx tsx db/migrate.ts && npx tsx workers/index.ts"]
