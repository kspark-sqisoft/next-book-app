# 코드 리뷰 — 2026-08-14

> 영역별 리뷰(보안 / 백엔드 / 프론트엔드 / 인프라·테스트) 종합 결과.
> 실측 지표: TS/TSX 238파일 · 약 55,948줄 · `tsc --noEmit` 오류 0 · 유닛 테스트 52개(15파일) · e2e 12블록(4파일)

## 총평

**학습 프로젝트 기준 상위권.** SQL 인젝션 표면 0, 소유권 검사(IDOR) 누락 경로 0, 리프레시 토큰
설계(해시 저장 + 트랜잭션 로테이션 + httpOnly 쿠키)는 프로덕션 수준. 다만 현재 상태로 프로덕션
배포는 불가 — 결함이 **① 시크릿/설정, ② 트랜잭션 부재, ③ 테스트 부재, ④ 프로세스 생명주기**
4개 축에 집중되어 있으며, 집중 시 2~4주 거리.

---

## P0 — 이대로 배포하면 사고 (즉시)

### 1. JWT 시크릿이 공개된 플레이스홀더 (CRITICAL)

- `.env`에 `change-me-access`가 실값, `src/server/env.ts:39-42` 하드코딩 폴백,
  `docker-compose.yml:31-32` 동일 기본값, `.env.example`에도 커밋됨.
- 이 문자열로 누구나 `role: "admin"` 토큰 위조 → 전 계정/데이터 장악.
- 조치: 랜덤 48바이트 교체 + 프로덕션 fail-fast + compose 기본값 제거 + refresh_token 테이블 비우기.
  `.env`의 외부 API 키 4종(OpenAI/Pexels/OpenWeather/NewsAPI)도 로테이션 권장.

### 2. 북 저장 = 전체 삭제 후 재삽입, 트랜잭션 없음 (CRITICAL)

- `books.service.ts:1846-1863` — DELETE 후 페이지별 개별 INSERT. 루프 중간 실패 시 **덱 영구 소실**.
- `posts.service.ts:626-686` — 검증 **전에** 기존 첨부 파일·행 삭제 → 400 응답인데 데이터는 이미 파괴.
- `db.transaction`은 저장소 전체에서 auth 1곳뿐. 검증 선행 + 트랜잭션 + 다중행 INSERT로 전환.
- 연관: **스키마에 FK 0개**, 인덱스 3개뿐(`schema.ts`). cascade 도입 시 수동 다단 삭제 로직 축소됨.

### 3. 기동마다 `drizzle-kit push` (CRITICAL)

- `Dockerfile:46` — push는 스키마 diff 자동 적용 도구. 파괴적 변경을 사람 검토 없이 DROP 처리 가능,
  비-TTY에서 확인 프롬프트에 걸리면 기동 정지. `drizzle/` 마이그레이션 파일은 생성된 적 없음(이력·롤백 0).
- 조치: `drizzle-kit generate`로 마이그레이션 커밋 → 기동은 `migrate`(또는 별도 job)로 전환.

### 4. 업로드 OOM DoS + 프로세스 생명주기 부재 (CRITICAL/HIGH)

- `write-file.ts:26`, `save-post-files.ts:52` — 크기 검사 **전에** `arrayBuffer()`로 전체 버퍼링.
  `next.config.ts` `bodySizeLimit: "1gb"`와 결합 → 로그인 사용자 1명이 OOM으로 서버 다운 가능.
- `server.ts` — `unhandledRejection`/`uncaughtException`/SIGTERM 핸들러 0건, compose `restart` 정책·healthcheck 없음.
  `attach-chat-namespace.ts:82`에 catch 없는 floating promise 실재 → DB 순단 1회로 프로세스 사망 가능.

### 5. patch-package가 runner 스테이지에 미적용 (HIGH)

- `Dockerfile:24-25` — runner의 `npm ci --omit=dev` 시점에 `patches/`가 없어 postinstall이 조용히 통과.
  서버측 node_modules는 미패치(클라이언트 번들만 패치됨). `patches/` 복사 + `--error-on-fail` 필요.

---

## 흥미로운 발견 — "린트 오류 264개"의 정체

- 실측: **264건 전부 `.cursor/`(ECC 툴링)의 의도적 CommonJS 스크립트.** `src/` 앱 코드는 오류·경고 **0건**.
- 이 때문에 **CI가 format:check(1단계)에서 상시 실패** → typecheck·테스트가 한 번도 실행 안 됨.
- 조치: `eslint.config.mjs` globalIgnores에 `.cursor/**` 한 줄 → 264→0, `.prettierignore`에 `.cursor` → 미포맷 455→30.
  이후 `npm run format`으로 잔여 30개 해소. **비용 대비 효과 최대.**

---

## P1 — 1주 내

### 보안

- 서버측 비밀번호/이메일 검증 부재 (`auth.service.ts:25-37`) — 빈 비밀번호 가입 가능. zod 검증 + 이메일 소문자 정규화
  (부트스트랩 관리자 `LOWER()` 매칭과 불일치 → 조건부 권한 상승 여지, `users.service.ts:222-232`).
- 레이트 리밋 전무 — signin 브루트포스, 외부 API 프록시(`/api/news`, `/api/weather`) 무인증 쿼터 소진.
- 보안 헤더 전무 — CSP / X-Frame-Options / nosniff / HSTS. `next.config.ts` `headers()`로 추가.
- Socket.IO `origin: true` + `credentials: true`, 기본 네임스페이스 무인증. `corsOrigin()`(`env.ts:55`)은 **호출처 0건 데드코드**.
- `npm audit`: prod 경로 HIGH 25건 — `next@16.3.1+`, `axios>=1.18`, `sanitize-html`, socket.io 계열 업그레이드.
- 북 `richHtml` 서버 살균 없음 (`books.service.ts:611`) — 현재는 클라이언트 DOMPurify 단일 방어. SSR 경로 추가 시 저장형 XSS화.
- 웹뷰 iframe `allow-scripts allow-same-origin` 동시 부여 (`BookWebviewWidgetOverlay.tsx:98`) — same-origin 제거 + URL https/사설망 차단.
- 인가 전 디스크 쓰기 (`actions/posts.ts:206-219`) — 소유권 검사를 파일 저장 앞으로 (books 쪽은 올바른 순서).

### 백엔드

- 서버 액션 에러가 HTTP status를 잃음 (`session-token.ts:44-50` rethrowActionError) — 401/403/404 구분 불가.
- 업로드 에러 분기 데드코드 (`actions/cats.ts:146` 등 4곳) — `String(err) === "MIME_NOT_ALLOWED"`는 항상 false
  (실제 값은 `"Error: MIME_NOT_ALLOWED"`).
- 외부 API 8곳 전부 타임아웃 없음 — AI 턴 1회가 최악 Pexels ~240회 순차 호출 (`book-ai.service.ts:1142` 루프).
- 관리자 목록이 전체 사용자 + password 해시 SELECT (`users.service.ts:141`), 마지막 관리자 강등 TOCTOU (`:121-137`).
- 채팅: 이벤트마다 방 전체 스캔+전역 브로드캐스트, 메시지마다 프로필 조회 N+1 (`attach-chat-namespace.ts:60,218`).
- 게시글 검색 `LIKE '%term%'`가 200,000자 content 전문 스캔 + `createdAt` 인덱스 없음.
- 북 삭제가 디스크 미디어 미정리(`books.service.ts:1868` — posts/users/cats는 정리함), 고아 파일 sweeper 부재.

### 프론트엔드 (실버그)

- **DetailPage ↔ EditorPage 약 1,400줄 중복** (Editor의 88%) — 이미 divergence 버그 3건:
  (A) Editor만 타이밍 ID 무검증 대입(`BookEditorPage.tsx:612`), (B) Detail만 요소 교체 시 초기화 누락(`:752`),
  (C) Editor만 `videoDurationSecById` 누락. → `BookWorkspace` 통합 권장.
- Undo: 그룹 드래그 = 요소 수만큼 엔트리, 화살표 홀드 시 `MAX_HISTORY=80` 밀려 이력 소멸
  (`BookSlideCanvas.tsx:1100,1308`). 배치 API + nudge coalesce 필요. 자동 정규화 effect가 유령 undo 생성(`BookDetailPage.tsx:338-372`).
- **에러 바운더리 0개** — `error.tsx`/`global-error.tsx` 없음. 캔버스 예외 1건 = 백지 + 미저장 작업 소실.
- 동시성 제어·미저장 경고 없음 — 탭 2개 편집 시 last-write-wins 조용한 덮어쓰기.

---

## P2 — 구조 개선 (1개월)

- **위젯 레지스트리 패턴**: 위젯 추가 = 실측 **31개 지점/13개 파일**, 이 중 6곳은 누락 시 조용히 실패
  (저장 시 `type:"text"` 강제 변환 = 데이터 손실 `book-canvas.ts:1330`, 로드 시 무언 폐기 `:1869`).
  `Record<타입, BookWidgetDef>` satisfies로 단일 출처화 → 컴파일러가 누락 검출. 오버레이 8개의 props 계약이
  이미 일관되어 이행 비용 낮음. 임시 안전장치: fallthrough 6곳에 `assertNever`.
- 파일 크기: `BookSlideCanvas.tsx` 4,051줄, `BookDetailPage.tsx` 2,991줄(useState 30·useCallback 69·props 42개 전달),
  `BookInspectorPanel.tsx` 2,829줄(본체 단일 함수 1,413줄), `validateElements` 960줄(입력 변조 + 클라이언트와 진실 2원화).
- `React.memo` 0개 → useCallback 69개 무의미. 순서: 에디터 zustand 스토어 → props 그룹화 → memo.
- 미디어 라이브러리 localStorage → 서버 이관 (기기 간 미공유, 탭 경합, 쿼터 실패 무통보, 80개 절삭).
- Docker 이미지: 클라이언트 전용 deps ~240MB 재설치(@twick 149M, three 38M, pdfjs 34M...), `tsx`로 TS 원본
  런타임 실행 + `src/` 원본 포함 → `server.ts` 빌드 타임 컴파일 또는 standalone.
- patch-package 취약성: 미니파이 번들 대상 + 전이 의존성(@twick/visualizer는 package.json에 없음) + 실패 무언
  → `--error-on-fail` + 버전 핀 + 상류 이슈/앱 레벨 우회 검토.
- 미사용 deps 제거: `date-fns`, `random-words`, `@pmndrs/assets`, `@emnapi/*` (참조 0건), `shadcn`은 devDeps로.
- Node 버전 3원화(CI 20 / Docker 22 / 로컬 24) → `engines` + `.nvmrc`. pre-commit(lint-staged) 도입.
- e2e 강화: 현재 로그인/CRUD/업로드 0건, 503도 통과(`features-api.spec.ts:15,22`). storageState 로그인 셋업 +
  "북 생성→편집→삭제" 시나리오 1개부터.
- 테스트 우선순위: ① `auth.service.ts` 리프레시 로테이션(106-142) ② books 경로 정규화 3종 + `assertBookOwner`
  ③ `validateElements` 경계값. 서버 서비스 13파일 5,840줄 현재 커버리지 **0%**.
- compose: DB 비밀번호 하드코딩(`reactauth`) + 5432 호스트 노출 제거, 백업(pg_dump 크론) 없음.
- 기타: 오픈 리다이렉트 `/\` 우회(`LoginPage.tsx:61`), 리프레시 토큰 재사용 감지 없음, `jwtVerify` alg 미지정,
  보안 감사 로그 부재, `normalizeBookElements`(book-canvas.ts:1869, 445줄) 호출처 0건 — 데드코드 여부 확인.

---

## 잘 되어 있는 부분 (유지할 것)

1. **소유권 검사 통일** — `auth-policy.ts` 단일화, books/posts/comments/cats 전 뮤테이션에 적용, 누락 경로 미발견.
2. **SQL 인젝션 표면 0** — raw SQL 0건, 전부 Drizzle 바인딩, LIKE `ESCAPE '!'` 처리.
3. **리프레시 토큰 설계 교과서적** — SHA-256 해시만 저장, 트랜잭션 로테이션, httpOnly+lax+secure 쿠키.
4. **LLM 출력 전량 재검증** (`normalizeLayoutResult`) — 닫힌 switch, https 강제, selection 일치 검증. 신뢰 경계 정확.
5. **업로드 서빙 경로 탈출 3중 방어 + Range 스트리밍** (`uploads/[...path]/route.ts`).
6. **글 본문 XSS 이중 방어** — 서버 sanitize-html + 클라이언트 DOMPurify.
7. **drag liveFrame 설계** — 드래그 중 문서 미변경, 커밋은 dragEnd 1회 (이 패턴을 nudge에도 적용하면 undo 문제 해결).
8. **클라이언트 세션 관리** (`api.ts`) — refresh 단일 비행, 선제 갱신, FormData 복제 재시도.
9. **가짜 테스트 0건** — 있는 테스트 전부 실제 모듈 import, skip/only 0건.
10. **"왜"를 설명하는 한글 주석** — 과거 장애를 기록해 재발 방지 (auth-store HMR, konva 중복, Windows HMR 등).

---

## 로드맵

| 기간  | 항목                                                                                                                                                                      |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1시간 | JWT 시크릿 교체+fail-fast · `.cursor` 린트/포맷 제외(CI 부활) · runner 패치 수정 · compose restart+healthcheck                                                            |
| 1주   | 북 저장 트랜잭션 · drizzle 마이그레이션 전환 · 업로드 크기 선검사+bodySizeLimit 축소 · 레이트 리밋 · npm audit · divergence 버그 3건 · 에러 바운더리 · server.ts 생명주기 |
| 1개월 | FK/인덱스 · auth/books 서비스 테스트 · 위젯 레지스트리 · BookWorkspace 통합(-1,400줄) · 보안 헤더/CSP · 미디어 라이브러리 서버 이관 · 이미지 다이어트                     |
