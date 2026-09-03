# Release: Next (custom server.ts) + Socket.IO + PostgreSQL (see docker-compose.yml)
# 비디오 서버 렌더(헤드리스 Chromium/Playwright)를 위해 Debian(bookworm) 베이스 사용 —
# Playwright Chromium은 alpine 비공식이라 glibc 기반 Debian에서 안정적으로 동작한다.
FROM node:22-bookworm-slim AS base
WORKDIR /app
# 서버 렌더는 Debian 시스템 chromium(openh264 포함)을 쓴다 — Playwright 번들 chromium은 다운로드하지 않는다.
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

FROM base AS deps
# 네이티브 모듈(bcrypt 등)이 prebuild 없을 때 대비한 최소 빌드 툴체인
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# 서버 액션 클로저 암호화 키 — 빌드 산출물에 박히므로 `next build` 시점에 있어야 한다.
# 없으면 next.config.ts 가 프로덕션 빌드를 세운다(server-actions-encryption-key.ts).
# 런타임에도 같은 값을 줘야 한다 — compose 가 빌드 인자와 환경변수 양쪽에 같은 값을 넣는다.
ARG NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
ENV NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=${NEXT_SERVER_ACTIONS_ENCRYPTION_KEY}
# `next build` 의 "Collecting page data" 는 라우트 모듈을 **평가**한다. `src/server/env.ts` 는
# 모듈 최상위에서 JWT 키를 읽고 프로덕션이면 없을 때 던지므로(1be8bc6 에서 폴백 제거), 값이
# 없으면 빌드가 그 자리에서 멈춘다. 실제 시크릿은 런타임에만 필요하니 여기서는 형식만 맞춘
# 자리 채우기를 준다 — 빌더 스테이지는 runner 로 이어지지 않아 이미지에 남지 않는다.
# (산출물에 박히지 않는 것은 아래 grep 검증으로 확인한다: `.next` 에 이 문자열이 없어야 한다.)
ENV JWT_ACCESS_SECRET=build-only-placeholder-not-used-at-runtime-access
ENV JWT_REFRESH_SECRET=build-only-placeholder-not-used-at-runtime-refresh
# deps 스테이지의 npm ci 시점엔 patches/ 가 없어 patch-package가 스킵됨 — 여기서 적용
RUN npx patch-package --error-on-fail
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# 서버 비디오 렌더: Debian 시스템 chromium(openh264 포함) 사용 — H.264 WebCodecs 인코딩 가능.
# Playwright 번들 chromium은 openh264가 없어 H.264 인코드가 "closed codec"으로 실패한다.
ENV CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/package.json /app/package-lock.json ./
# runner의 npm ci 시점에도 patches/ 가 있어야 서버측 node_modules에 패치가 적용됨(빌더와 동일 코드 보장)
COPY --from=builder /app/patches ./patches
RUN npm ci --omit=dev && npx patch-package --error-on-fail && npm cache clean --force

# Chromium(+openh264) 설치 — 헤드리스 서버 렌더의 H.264 인코딩 지원. apt가 런타임 의존성도 함께 설치.
RUN apt-get update \
  && apt-get install -y --no-install-recommends chromium \
  && rm -rf /var/lib/apt/lists/*

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
