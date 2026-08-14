# Release: Next (custom server.ts) + Socket.IO + PostgreSQL (see docker-compose.yml)
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
WORKDIR /app

FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# deps 스테이지의 npm ci 시점엔 patches/ 가 없어 patch-package가 스킵됨 — 여기서 적용
RUN npx patch-package --error-on-fail
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/package.json /app/package-lock.json ./
# runner의 npm ci 시점에도 patches/ 가 있어야 서버측 node_modules에 패치가 적용됨(빌더와 동일 코드 보장)
COPY --from=builder /app/patches ./patches
RUN npm ci --omit=dev && npx patch-package --error-on-fail && npm cache clean --force

COPY --from=builder --chown=nextjs:nodejs /app/.next ./.next
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/src ./src
COPY --from=builder --chown=nextjs:nodejs /app/server.ts ./server.ts
COPY --from=builder --chown=nextjs:nodejs /app/server-env-bootstrap.ts ./server-env-bootstrap.ts
COPY --from=builder --chown=nextjs:nodejs /app/server-dev-required-manifest.ts ./server-dev-required-manifest.ts
COPY --from=builder --chown=nextjs:nodejs /app/next.config.ts ./next.config.ts
COPY --from=builder --chown=nextjs:nodejs /app/tsconfig.json ./tsconfig.json
COPY --from=builder --chown=nextjs:nodejs /app/postcss.config.mjs ./postcss.config.mjs
COPY --from=builder --chown=nextjs:nodejs /app/drizzle.config.mjs ./drizzle.config.mjs
COPY --from=builder --chown=nextjs:nodejs /app/drizzle ./drizzle

RUN mkdir -p /app/uploads && chown nextjs:nodejs /app/uploads

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV UPLOAD_ROOT=/app/uploads
# 커밋된 마이그레이션(drizzle/)만 순서대로 적용 — push(스키마 diff 자동 반영)는 파괴적 변경을
# 무검토 DROP 하거나 비-TTY 프롬프트에서 멈출 수 있어 프로덕션 기동 경로에서 제거함.
# 스키마 변경 절차: npm run db:generate → drizzle/ 커밋 → 재배포 시 여기서 적용.
CMD ["sh", "-c", "./node_modules/.bin/drizzle-kit migrate --config drizzle.config.mjs && exec ./node_modules/.bin/tsx server.ts"]
