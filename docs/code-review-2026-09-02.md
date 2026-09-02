# 코드 리뷰 — 2026-09-02

> 영역별 리뷰(보안 / 서버·데이터 / 프론트엔드 / 테스트·인프라) 종합.
> 실측: `src` TS/TSX 361파일 · 92,455줄(직전 238파일 · 55,948줄) · `tsc --noEmit` 오류 0 ·
> `eslint` 오류 0/경고 5 · 유닛 22파일 103케이스 · e2e 11스펙 20케이스 · 직전 리뷰 이후 커밋 131개.
> 직전 리뷰: [code-review-2026-08-14.md](./code-review-2026-08-14.md)

## 조치 현황 (2026-09-02 후속)

리뷰 직후 같은 날 P0 **2~7번을 수정**했다. 1번(JWT 시크릿)은 배포 환경 시크릿 교체가
함께 필요해 별도로 남겨 두었다 — **아직 열려 있는 최우선 항목이다.**

| 항목                  | 상태       | 요점                                                                                                                       |
| --------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1. JWT 시크릿         | **미해결** | 코드 폴백·compose 기본값·로컬 `.env` 모두 그대로                                                                           |
| 2. `creta` 인가       | 해결       | 무인증 조회 29개 → 8개(재생 4·커뮤니티 4). 광고는 `advertiser.ownerId`, 비디오월은 `ownerId` 강제. 전역 조작은 관리자 전용 |
| 3. 로그아웃 캐시      | 해결       | `signOut`·`signIn`·세션 만료 경로에서 `queryClient.clear()`                                                                |
| 4. 768px 편집 소실    | 해결       | 언마운트 대신 `readOnly` 전달 — 상태 유지한 채 패널·캔버스·헤더 잠금                                                       |
| 5. 공유 파일 삭제     | 해결       | `filterUnreferencedUploadPaths`로 다른 북·라이브러리 참조를 확인 후에만 unlink                                             |
| 6. 삭제 트랜잭션 경계 | 해결       | 댓글·좋아요 정리를 페이지·북 삭제와 한 트랜잭션에 합침(`DbOrTx`)                                                           |
| 7. 테스트·CI 기동     | 해결       | 아래 정정 참고                                                                                                             |

**7번 보충 — 원인이 둘이었다.** 원문의 진단(로컬 `node_modules`가 Windows 설치본)은 맞다.
다만 `npm ci`로 복구하려 하자 두 번째 문제가 드러났다: `package.json`의 `overrides`
(`fabric` → `canvas`)가 `package-lock.json`에 반영돼 있지 않다. 락파일 마지막 갱신
(`ec11490`, 8/20)이 `overrides` 추가(`659de83`, 8/14)보다 뒤인데도 그렇다.

**이 비동기화는 npm 버전에 따라 갈린다** — 컨테이너에서 직접 확인했다.

| npm     | 환경                                | 커밋된 락파일로 `npm ci`                      |
| ------- | ----------------------------------- | --------------------------------------------- |
| 10.9.8  | CI(setup-node 22) · Docker(node:22) | **통과**                                      |
| 11.19.0 | 이 개발 머신(Node 24, nvm)          | 실패 — `Missing: canvas@3.2.3 from lock file` |

즉 **CI는 `npm ci`에서 막히지 않았다.** 그래도 CI는 붉은 상태였을 가능성이 높다 —
`format:check`가 1단계인데 **`server.ts` 한 파일이 커밋된 상태에서 포맷이 어긋나 있었다**
(들여쓰기 차이, `git show HEAD:server.ts | prettier --check`로 확인). 직전 리뷰가 지적한
"CI가 format:check에서 상시 실패"와 같은 양상이 한 파일 규모로 재발한 것이다.

한때 "포맷 위반 8개 파일"로 봤던 나머지 7개는 **작업 트리가 CRLF였을 뿐**이고 커밋된 블롭은
이미 깨끗하다(`core.autocrlf=input` + `.gitattributes` 미커밋 → Windows 체크아웃 흔적).
리눅스 체크아웃인 CI에서는 문제가 되지 않으므로 되돌렸다. **여기서도 `.gitattributes` 커밋이 답이다.**

조치: 락파일을 `npm install`로 재동기화(npm 11에서도 `npm ci` 통과)하고 `server.ts` 포맷을 고쳤다.

회귀 방지로 `__tests__/creta-action-auth.test.ts`를 추가했다 — 인증을 호출하지 않는 크레타 액션은
공개 사유와 함께 허용 목록에 등록해야만 통과한다(인증을 빼면 실패하는지 확인함).

검증: `format:check`·`lint`(0 오류)·`typecheck`(0)·`test:unit`(23파일 107케이스)·`build` 모두 통과.

---

## 총평

**직전 리뷰의 인프라·데이터 무결성 지적은 대부분 해소됐다.** FK 0→54개, 인덱스 3→46개,
마이그레이션 파일 24개 커밋(기동 경로에서 `drizzle-kit push` 제거), CI 파이프라인 신설,
프로세스 생명주기 핸들러 추가, 외부 API 타임아웃 전면 적용, 오픈 리다이렉트·업로드 OOM·
patch-package 미적용·에러 바운더리 부재 모두 수정. `as any` 0건 · `@ts-ignore` 0건.

**그러나 같은 기간에 코드가 65% 증가했고, 새로 들어온 `creta`(사이니지·광고) 도메인이
기존 `books`/`posts`의 인가 규율을 물려받지 못했다.** 직전 리뷰가 "IDOR 누락 경로 0"이라
평가했던 자리에 지금은 무인증 조회 29개와 "로그인만 하면 통과"하는 변경 19개가 있다.
그리고 **가장 심각했던 P0(JWT 시크릿)은 3개월간 그대로다.**

배포 차단 사유는 ① 시크릿 폴백, ② `creta` 인가, ③ 사용자 작업 소실 2건 — 네 축 중 셋은
한 줄~수십 줄 규모의 수정이다.

---

## P0 — 이대로 배포하면 사고

### 1. JWT 시크릿이 공개된 플레이스홀더 (CRITICAL) — **직전 리뷰 미수정**

- `src/server/env.ts:50-53` — `process.env.JWT_ACCESS_SECRET ?? "dev-access-secret-change-me"`.
  프로덕션 fail-fast 없음(전체 grep 확인).
- `docker-compose.yml:46-47` — `${JWT_ACCESS_SECRET:-change-me-access}`. 호스트 `.env` 없이
  `docker compose up` 하면 공개된 키로 기동.
- 로컬 `.env`의 실제 값도 여전히 플레이스홀더(길이 17/18자).
- `src/server/auth/jwt.ts:13-14`가 모듈 로드 시점에 이 값을 굽는다 → 누구나
  `{sub, role:"admin"}` 토큰을 위조해 `requireAdmin`·모든 서버 액션·채팅 소켓 통과.
- 조치: `NODE_ENV === "production"` 이고 미설정이면 throw. `DB_PASSWORD`,
  `SUPER_ORG_ADMIN_EMAILS`도 같은 처리. compose는 `${JWT_ACCESS_SECRET:?...}`로 기동 실패 유도.
  **이미 배포된 환경이 있다면 시크릿 교체 + `refresh_token` 테이블 비우기가 선행.**

### 2. `creta` 도메인 인가 부재 (CRITICAL)

같은 저장소 안에서 `books`는 `assertBookOwner`/`canEditBook`으로 제대로 막혀 있고
(`books.service.ts:2487, 2839`), `creta` 플레이리스트·스케줄도 `assertCanManage`/`assertCanEdit`가
있다(`creta.service.ts:701`). 그 규율이 나머지에는 적용되지 않았다.

- **조회 29개가 무인증** — `listCretaDevicesAction`, `listCretaPlaylistsAction`,
  `cretaAdCampaignReportAction`, `listCretaAdAuditAction`, `cretaAdDeviceReportAction` 등
  (`src/actions/creta*.ts`). 서버 액션은 액션 ID만 알면 호출 가능한 POST 엔드포인트다.
  `CretaService.listDevices()`(`:1723`)는 필터 없이 전 행을 반환 — 화면 이름·**설치 위치**·
  해상도·전원 예약이 비로그인에 노출된다. `listPlaylists()`(`:546`)도 `visibility`/공유를
  질의에서 전혀 걸지 않는다(응답에 담아 클라이언트가 판단).
- **변경 19개가 "로그인만 확인"** — `await requireUserFromToken(accessToken);` 뒤 신원을 버린다.
  디바이스 전체(`actions/creta.ts:400-547`), 비디오월 수정·삭제(`creta-walls.ts:62-94`,
  서비스에 `actor` 인자 0건), 긴급 알림 해제(`creta-alerts.ts:47`).
  `assignCretaSourceByTag`는 한 번의 호출로 태그가 붙은 **모든** 화면의 송출을 바꾼다.
- **광고 서비스 1,385줄에 인가 검사 1개** — `creta-ads.service.ts:787`(관리자 전용 소재 심사)뿐.
  `cretaAdvertiser.ownerId`(`schema.ts:760`)를 저장만 하고 아무 데서도 읽지 않는다.
  `updateAdvertiser`는 `actor` 인자조차 받지 않는다. → 가입한 아무나 `id=1..N`을 돌며
  전 광고주·캠페인·소재를 삭제하고 `updateSetting({houseSrc})`로 전 화면 하우스 광고를 바꾼다.
- **`creta_device`에 `ownerId` 컬럼 자체가 없다**(`schema.ts:552`) — 멀티테넌시가 스키마
  수준에서 성립하지 않는다.
- 조치: 액션에서 `const user = await requireUserFromToken(...)`로 받아 서비스에 `actor`를 넘기고,
  `assertCanManage`와 같은 형태의 `assertAdOwner`(캠페인→광고주 `ownerId` 해석)·
  디바이스 소유권 컬럼을 추가. 조회 액션은 `getUserFromTokenOptional` + 뷰어 스코프 질의로.

### 3. 로그아웃이 쿼리 캐시를 비우지 않음 — 교차 사용자 노출 (CRITICAL)

- `src/stores/auth-store.ts:181` — `queryClient.removeQueries({ queryKey: userKeys.all })`.
  `userKeys`만 지운다. 북(초안 포함)·디바이스·광고·커뮤니티 캐시는 모듈 싱글턴
  (`lib/query-client.ts:6`)에 그대로 남고, `queryClient.clear()`는 `src` 어디에도 없다.
- 로그아웃은 리로드 없는 `signOut()` 호출(`AppLayout.tsx:344`)이다. 같은 탭에서 A가 로그아웃하고
  B가 로그인하면 `staleTime: 30_000` 동안 B가 리페치 없이 A의 캐시를 렌더한다 —
  `bookKeys.detail(id)`에는 뷰어 차원이 없다. 키오스크·공용 PC가 기본인 사이니지 제품에서 특히 위험.
- 조치: `signOut`과 `signIn` 진입부 양쪽에서 `queryClient.clear()`.
  (게시글·좋아요에는 이미 뷰어별 키가 있으므로 설계가 없는 게 아니라 빠뜨린 자리다.)

### 4. 창 너비가 768px를 넘나들면 미저장 편집이 소실 (CRITICAL) — **신규 회귀**

- `src/page-components/BookDetailPage.tsx:3586` — `if (canEdit && !isMobile) return <BookDetailOwnerView …>`
- `src/hooks/use-mobile.ts:11-19`의 `useIsMobile()`은 마운트 시 스냅샷이 아니라 살아 있는
  `matchMedia` 리스너다. 768px를 가로지르면 `BookDetailOwnerView`가 **언마운트**되고
  컴포넌트 로컬 상태 전부(`useBookDocumentHistory`의 `pages`, `past`/`future` 되돌리기 스택,
  `selectedIds`, 제목, 슬라이드 크기)가 사라진다. 다시 넓혀도 `serverBook`에서 새로 마운트된다.
- `beforeunload` 가드(`:770-777`)는 탭 종료용이라 React 언마운트에는 걸리지 않는다. 경고 없음, 복구 없음.
- 재현: 편집기에서 위젯 몇 개를 옮기고 저장하지 않은 채 DevTools를 우측에 도킹하거나
  창을 좁은 분할로 스냅 → 게스트 뷰로 교체 → 되돌려도 작업 소실.
- 커밋 `5957c6b`·`f7e0ce1`에서 들어온 신규 코드다. 조치: 언마운트 대신 `readOnly`/`panelsLocked`
  플래그를 내려보낸다 — `BookWorkspaceShell`은 이미 `panelsLocked`를 받는다(`:3593`).

### 5. 북 삭제가 다른 북이 쓰는 업로드 파일을 지움 (CRITICAL)

- `src/server/services/books.service.ts:2825-2828` — 페이지에서 수집한 `/uploads/...` 경로를
  전부 `tryUnlink` 한다.
- 그런데 미디어 라이브러리는 파일 공유를 **의도적으로** 지원한다:
  `book-media.service.ts:130-150`이 `ne(bookId, …) AND sharedToAll`로 다른 북 항목을 끌어오고,
  `:151` 주석이 "같은 파일이 여러 북에 있으면 src 기준 한 번만"이라고 명시한다.
  같은 서비스의 `remove()`(`:233`)는 파일을 지우지 않는다(`:204` 주석: "파일은 디스크에 남음").
- A가 올려 공유한 이미지를 B가 자기 북에 배치 → A가 자기 북을 삭제 → B의 북이 영구히 깨진다.
- 조치: unlink 전에 다른 `bookPage.elementsJson`·`bookMediaItem.src/posterSrc` 참조 여부 확인,
  또는 여기서 디스크 정리를 빼고 참조 카운트 기반 수거기로 이관.

### 6. 북 삭제 시 댓글·좋아요가 트랜잭션 밖에서 먼저 지워짐 (CRITICAL)

- `books.service.ts:2816-2822` — `CretaCommentsService().removeAllForTarget` →
  `CretaLikesService().removeAllForTarget` → 그 **다음에** `db.transaction`으로 페이지·북 삭제.
- `cretaComment`/`cretaLike`는 `book`에 FK가 없어(`targetId`가 평범한 정수) 이 두 호출이 유일한 정리다.
- 트랜잭션이 실패하면(교착·타임아웃·풀 단절) 북은 멀쩡히 살아 있는데 커뮤니티 댓글·좋아요만
  이미 커밋되어 사라진 상태가 된다. 복구 불가.
- 조치: 두 서비스에 `tx` 옵션 인자를 추가해 네 삭제를 한 트랜잭션에 넣는다.

### 7. 로컬 유닛 테스트가 기동조차 안 됨

- `npm run test:unit` → exit 1, `Cannot find module '@rolldown/binding-wasm32-wasi'`.
  `node_modules`가 Windows에서 설치되어 `@rolldown/binding-win32-x64-msvc`만 있고
  linux 바인딩이 없다(`@next/swc`, `@tailwindcss/oxide`, `lightningcss`도 동일).
- Vitest 4는 rolldown으로 번들하므로 **파일 수집 전에 죽는다 → 로컬 테스트 피드백이 0이었다.**
  pre-commit 훅은 `lint-staged`(prettier·eslint)만 돌린다. CI는 ubuntu에서 `npm ci` 하므로 영향 없음.
- 조치: `rm -rf node_modules && npm ci`. 근본 대책은 미추적 상태인 `.gitattributes`
  (`* text=auto eol=lf`) 커밋.

---

## P1 — 1~2주 내

### 인가 · 인증

| 위치                                                 | 내용                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/actions/books.ts:60`                            | `getBookAction`이 토큰을 **받지도 않고**, `findOne`(`books.service.ts:2360`)에 가시성 검사가 없다. `draft`/`review` 상태의 비공개 북 전문이 비로그인에 열린다. `listBooksAction`도 `publishedOnly` 미지정 시 전체를 나열. (작성자 필드는 `id/name/avatar`만 노출 — 이메일 유출은 없음) |
| `src/server/http/rate-limit.ts:37-44`                | `clientIpFromRequest`가 `X-Forwarded-For` 첫 항목을 무조건 신뢰. 헤더는 공격자 제어이고 compose는 3000을 직접 노출(프록시 없음) → 요청마다 랜덤 XFF로 signin 브루트포스 무제한 + bcrypt CPU 소모. 조치: `TRUST_PROXY` 게이트 + 이메일 기준 2차 리밋                                    |
| `src/server/env.ts:30-35`                            | `SUPER_ORG_ADMIN_EMAILS` 기본값이 개인 Gmail 주소 하드코딩. 가입 시 이메일 인증이 없으므로, 이 변수를 설정하지 않은 배포에서는 그 주소로 가입한 사람이 조직 트리 생성·조직 관리자 지정 권한을 갖는다. 클라이언트(`lib/authz.ts:20`)에도 같은 문자열이 박혀 있어 번들에서 발견 가능     |
| `src/app/api/books/[id]/media-upload/route.ts:20-38` | access 쿠키 실패 시 **refresh 토큰**으로 폴백 인증. 서명만 확인하고 `refresh_token` 테이블을 보지 않으므로, 로그아웃·로테이션으로 폐기된 토큰이 7일 내내 업로드 권한을 유지하고 낡은 `role` 클레임도 그대로 통한다                                                                     |
| 서버 액션 전역                                       | `assertRateLimit` 호출처가 REST 라우트 5곳뿐, **서버 액션에는 0건.** OpenAI 호출(`book-ai.service.ts`), 헤드리스 렌더, 150MB 업로드, 무인증 `logCretaAdPlayAction` 모두 무제한                                                                                                         |
| `books.service.ts:2508`                              | `listShareableUsers`가 전 사용자 이름+**이메일**을 반환. 가입만 하면 전체 사용자 디렉터리 열람 가능 → 피싱·크리덴셜 스터핑 표적 목록                                                                                                                                                   |

### 데이터 정합성 · 가용성

| 위치                                         | 내용                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `creta-play-log.service.ts:313-320`          | advisory lock을 쥔 트랜잭션 안에서 `resolveContents`가 `this.db()`로 **두 번째 커넥션**을 잡는다(풀 `max: 10`). 동시 리포트 10건이면 전원이 반납 불가능한 11번째를 기다리는 하드 데드락. 조치: `tx`를 인자로 전달                                                                                                                                                                                                                                                             |
| `comments.service.ts:178`                    | `parentId = parent.id` — 대댓글의 대댓글이 계속 중첩된다. 자매 서비스 `creta-comments.service.ts:173`은 `parent.parentId ?? parent.id`로 2단 고정. `sortTree`(`:66-69`)가 재귀라 깊은 체인 하나면 해당 글 댓글 조회가 영구 500(`RangeError`). `findMany`에 `.limit()`도 없음                                                                                                                                                                                                  |
| `drizzle/0001_flat_ken_ellis.sql:24`         | `CREATE UNIQUE INDEX … ON "user" (LOWER("email"))`가 손으로 작성돼 `schema.ts`·`drizzle/meta` 어디에도 없다. ① `db:push`(`package.json:22`, `docker-compose.dev.yml:33`)가 스키마에 없는 인덱스를 **드롭**한다 → 대소문자만 다른 중복 계정 가능, `users.service.ts:82`의 `findFirst`는 `orderBy`가 없어 인증 대상 행이 비결정적. ② 인덱스 식은 `LOWER(email)`인데 질의는 `LOWER(TRIM(email))`(`:83, :199`) → 표현식 인덱스 불일치로 **모든 signin/signup이 `user` 순차 스캔** |
| `books.service.ts:2669-2741`, `:2419-2464`   | 낙관적 잠금 없음. `update()`는 페이지 전체를 삭제 후 재삽입하므로 자동저장과 수동저장이 경합하면 나중 쓰기가 상대의 덱 전체를 조용히 버린다. `setStatus`도 무조건 UPDATE라 두 관리자가 같은 `review`를 각각 승인·반려해도 둘 다 통과하고 감사 로그 둘 다 "review에서 전이"라고 기록                                                                                                                                                                                           |
| `posts.service.ts:797-807`                   | 파일 unlink를 **먼저** 하고 DB 삭제 4개를 트랜잭션 없이 실행. unlink 하나가 던지면 DB는 손도 안 댄 채 미디어만 영구 파괴. 같은 파일의 `updatePost:751`은 순서를 올바르게(트랜잭션 커밋 후 정리) 지키고 있어 자기 규칙과 모순                                                                                                                                                                                                                                                  |
| `creta-ads.service.ts:637-655`               | `updateCampaign`의 타게팅 재작성이 update→delete→insert 3개 커밋. insert가 실패하면 타깃 0행 = "전 화면"으로 해석되어(`:863`, `:1300`) 로비 2대 한정 캠페인이 전 화면에 송출된다. `createCampaign:541`도 동형                                                                                                                                                                                                                                                                 |
| `twick-render.ts:31-56`, `render-jobs.ts:88` | ① 브라우저가 크래시해도 `browserPromise`는 죽은 인스턴스를 계속 반환(`disconnected` 미처리) → 재시작 전까지 모든 렌더 실패. ② `server.ts` 종료 경로에 `browser.close()` 없음 → SIGTERM 시 Chromium 고아. ③ 렌더 잡이 fire-and-forget에 큐·상한 없음. ④ `capturePosterFromMp4`(`:166`)가 MP4 전체를 base64로 만들어 프레임 1장을 뽑는다(`@ffmpeg-installer/ffmpeg`가 이미 의존성에 있음)                                                                                       |
| `creta-device-uptime.service.ts:105-153`     | `since`는 롤링 `rangeDays × 24h`(달력일 `rangeDays+1`개에 걸침)인데 버킷 키는 `rangeDays`개만 시딩. 범위를 벗어난 샘플이 `onlineTotal`·`total`에는 들어가고 막대에서는 버려져 **막대 합계와 헤드라인 가동률이 항상 불일치**. `localDateKey`(`:85`)는 서버 로컬 시각이라 UTC 컨테이너에서 하루 경계가 09:00 KST(`creta.service.ts:307`의 의도적 `kstNow()`와 모순). 원시 행 전량을 `.limit()` 없이 Node로 끌어옴                                                               |
| `session-token.ts:44-51`                     | `rethrowActionError`가 `HttpError`의 status를 버리고 `new Error(message)`로 던진다. `api.ts`는 401 refresh·재시도 인터셉터를 정성껏 만들어 뒀지만(`:264-322`) 서버 액션 경로는 이를 우회하고 `humanizeServerActionError`에 401 분기가 없다 → 편집기를 15분 넘게 열어두고 저장하면 자동 갱신 없이 실패, 같은 탭의 REST 호출은 조용히 복구되는 비대칭                                                                                                                           |

### 프론트엔드 실버그

| 위치                                                                     | 내용                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `BookInspectorPanel.tsx:2648`, `:2668`                                   | 티커 속도(20–400)·글자 크기(10–200) 입력이 **키보드로 입력 불가**. 완전 제어 입력인데 범위를 벗어난 중간 타이핑마다 `undefined`를 써서 `value`가 `""`가 된다 → `150`을 넣으려면 먼저 `1`을 쳐야 하는데 `1 < 20`이라 지워진다. 스피너 화살표만 동작. 같은 파일이 `BookNumericIntField`를 이미 18번 쓰고 있고, 깨진 4개가 정확히 그걸 안 쓴 raw `type="number"`다(같은 원인으로 텍스트 애니메이션 0.2–0.9초도 입력 불가) |
| `BookDetailPage.tsx:646`, `BookEditorPage.tsx:380`                       | Ctrl+A가 `activePage.elements` 전체를 선택 — `locked`/`visible`을 거르지 않아 이어지는 Delete가 잠긴 위젯까지 지운다                                                                                                                                                                                                                                                                                                   |
| `DeviceDetailPage.tsx:168`, `BookAdSlotWidgetOverlay.tsx:99`             | 재생 기록 중복 방지 키가 `${creativeId}:${rotationIndex}`인데 `cretaAdRotationIndex`는 소재가 1개면 항상 0을 반환 → **단일 소재 루프는 세션 내내 노출 1건만 기록**. 주석은 "같은 epoch 중복 방지"라고 하지만 키에 epoch(`floor(now/spotSec)`)가 없다. CPM 정산이 과소 계상                                                                                                                                             |
| `AdsPage.tsx:149-151`                                                    | `cretaKeys.adActiveCreatives()`가 `[..., "ad-active-creatives", null]`이라는 **완성 키**를 만든다. 무효화가 fleet 전역(null) 질의에만 걸리고 디바이스 스코프(`DeviceDetailPage:126`, `BookPresentationPage:297`, `BookAdSlotWidgetOverlay:64`)는 전부 누락 → 캠페인을 고쳐도 화면이 갱신되지 않는다. 조치: 접두 키 `[...cretaKeys.all, "ad-active-creatives"]`로 무효화                                                |
| `query-keys.ts:18` vs `CretaSidebar.tsx:158`, `CommunityPage.tsx:62`     | `bookKeys.list(search)`가 사용자 검색어를 넣는 자리에 두 호출처가 `"sidebar-count"`·`"community"` 리터럴을 손으로 붙여 페이로드 형태가 충돌한다. `/community`를 연 뒤 북 목록에서 **`community`를 검색하면** `BookListPage.tsx:141`이 평범한 `BooksPageResponse`에 `.pages.flatMap()`을 호출해 `Cannot read properties of undefined` 크래시                                                                            |
| `BookVideoEditorDialog.tsx:501-520`, `BookMediaLibraryPanel.tsx:444-481` | 1초 재귀 `setTimeout` 폴링에 타이머 id·언마운트 가드가 없다. 서버 내보내기를 시작하고 다른 화면으로 이동하면 폴링이 영원히 돌고, 완료 시 무관한 페이지에 토스트가 뜨며 사라진 다이얼로그를 위해 미디어 캐시를 쓴다. 후자는 `mountedRef`가 6개 중 3개만 방어해 **한 함수 안에서 일관성이 깨져 있다**                                                                                                                    |
| `BookEditorPage.tsx:1224, 1420`, `BookDetailPage.tsx:1997, 2119, 1560`   | immer 레시피 안에서 대입한 지역 변수를 직후에 읽는다. React가 이 업데이터를 동기 실행하는 것은 eager-state 우회 경로일 때뿐이고, 파이버에 대기 레인이 있으면 건너뛴다. AI에게 "3번 슬라이드에 텍스트 추가"를 시키면 위젯은 3번에 들어가지만 캔버스가 이동하지 않고 선택 id가 페이지 밖이라 정리되어, 사용자에게는 "아무 일도 안 일어남"으로 보인다                                                                     |
| `BookSlideCanvas.tsx:1548-1581`                                          | Transformer effect에 `inlineTextEdit` 의존성 누락 → 텍스트 위젯을 더블클릭 후 Escape 하면 선택은 유지되는데 리사이즈·회전 프레임이 사라진다                                                                                                                                                                                                                                                                            |
| `AdMediaThumb.tsx:9, 38, 99`                                             | 모듈 스코프 `thumbCache`가 축출되지 않고 `createObjectURL` 결과를 한 번도 `revoke`하지 않는다. `/ads`를 오래 탐색하면 blob 메모리가 탭 수명 내내 증가하고, 캡처 타임아웃 경로가 `<video>`를 정리하지 않아 4K 다운로드가 백그라운드에 남는다. 같은 저장소의 `book-slide-thumbnail-cache.ts`가 축출 시 revoke 하는 LRU를 이미 구현하고 있다                                                                              |
| `AdMediaThumb.tsx:52, 70, 88`, `book-slide-snapshot.ts:166`              | 커밋 `d63330b`이 `video-poster.ts:82,127`에서 고친 **검은 포스터 경합이 두 경로에 그대로 남아 있다** — `preload="metadata"` + `onseeked` 직후 `drawImage`, 700ms 폴백이 `readyState`가 아니라 `videoWidth`만 확인. 그 커밋의 `waitForDrawableFrame`/`nextPresentedFrame`을 재사용하면 된다                                                                                                                             |
| `AdsPage.tsx:146-153`                                                    | `invalidate()`가 `adInventory()`(`:164`, `staleTime: 60_000`)와 `adReport(30)`(`:106`)을 빠뜨린다 → 캠페인의 대상 화면을 바꾸거나 일시정지·삭제해도 화면 인벤토리의 "캠페인 N개"와 노출수·정산 요약 카드가 페이지 수명 내내 변경 전 숫자를 유지                                                                                                                                                                        |
| `DeviceDetailPage.tsx:310-315`                                           | 재시작 토스트용 `setTimeout(…, 4000)`만 id 저장·정리가 없다(같은 파일 `:159`의 광고 인터벌은 올바름) → 4초 안에 목록으로 나가면 무관한 페이지에 "재부팅 완료"가 뜬다                                                                                                                                                                                                                                                   |
| `BookSlideCanvas.tsx:875`                                                | `publicAssetUrl("")`가 `null`을 반환해 `src`가 `""`가 된다(바로 옆 `poster`는 `                                                                                                                                                                                                                                                                                                                                        |     | undefined`로 방어). 파일 없는 비디오 위젯을 놓으면 브라우저가 `src=""`를 문서 URL로 해석해 `preload="auto"`로 **페이지 자신을 내려받는다** |
| `BookInspectorPanel.tsx:3012`, `:760-802`                                | 지도 주소 입력이 안정적인 `key`를 가진 비제어 입력이라 Ctrl+Z 후 상태와 어긋나고, `geocodeAndApplyMap`에 abort·staleness 가드가 없어 연속 검색 시 오래된 좌표가 덮어쓴다                                                                                                                                                                                                                                               |

### 인프라 · 의존성

- **FK 컬럼 인덱스 누락** — Postgres는 FK를 자동 인덱싱하지 않는다. `DELETE FROM book` 한 번에
  `creta_playlist_item.bookId`, `creta_schedule_slot.bookId`, `creta_video_wall_member.bookId`,
  `creta_video_wall.bookId`, `creta_schedule.defaultBookId`, `creta_device.sourceBookId` 6개가 전체 스캔.
  기존 복합 인덱스는 `playlistId`/`scheduleId`가 선두라 도움이 안 된다. 대시보드의 "나에게 공유됨"
  질의(`creta.service.ts:1459`)가 훑는 `cretaPlaylist.ownerId`·`cretaSchedule.ownerId`는 인덱스가 아예 없다
  (`book_share`는 양방향 인덱스가 제대로 있음 — `schema.ts:371`).
- **prod 의존성 고위험 11건** — `npm audit --omit=dev`: 23건(high 11). 실질적인 것은 비디오 편집기로
  브라우저에 실려 나가는 **fabric**(SVG export 저장형 XSS, `Gradient` colorStops 이스케이프 결함)이며,
  `@twick/renderer`를 통해 **vite**(`server.fs.deny` 우회, DOM clobbering XSS)·**extract-zip**(심볼릭 링크
  경로 탈출)도 딸려 온다. `package.json`의 `overrides`는 `fabric`의 `canvas`만 고정하고 `fabric` 자체는 안 잡는다.
- **CSP 없음** — `next.config.ts:30-49`가 `X-Frame-Options`/`nosniff`/`Referrer-Policy`/`Permissions-Policy`는
  넣고 CSP만 의도적으로 뺐다(주석에 명시). `dangerouslySetInnerHTML` 7곳이 있고 XSS 방어가 살균기 단일
  계층이라, CSP가 "살균기 우회 = 계정 탈취"를 "콘솔 에러"로 낮춰 주는 층이다. report-only부터 도입 권장.
- **DB 기본 비밀번호 + 5432 호스트 노출** — `env.ts:14-16`의 `reactauth`/`reactauth`가 compose 실값이고
  `docker-compose.yml`이 `ports: ["5432:5432"]`로 호스트에 연다. 앱을 거치지 않고 bcrypt 해시·이메일·
  refresh 토큰 해시 전체 접근 가능.
- **Socket.IO `origin: true` 기본** — `corsOrigin()`(`env.ts:66`)이 `FRONTEND_ORIGIN` 미설정 시 모든 오리진
  반사 + `credentials: true`. 채팅 네임스페이스가 쿠키가 아니라 `handshake.auth.token`으로 인증해 실피해는
  제한적이지만, 프로덕션 기본값으로 남을 값은 아니다.

---

## P2 — 구조 (1개월)

### 유령 tRPC 계층과 4단 데이터 경로

`src/server/trpc/routers/_app.ts`는 11줄이고 `health` 프로시저 하나뿐이다. `trpc.ts:11`은
`publicProcedure`만 정의하고 "인증 미들웨어는 추후 확장 지점"이라는 주석을 남겼다.
`@trpc/client`·`@trpc/react-query`는 **import 0건**. 즉 인가·검증을 한곳에서 강제할 자리가
비어 있고, 실제 트래픽은 서버 액션 12파일에서 **함수마다 가드를 다시 구현**하며 흐른다 —
P0-2가 발생한 경로가 정확히 이것이다.

동시에 클라이언트 경로는 4계층이다: 페이지 → `lib/creta-*-api.ts`(브리지) → `actions/*.ts` → `services/*.ts`.
브리지는 `requireToken()` 주입과 `as unknown as` 캐스팅 외에 하는 일이 거의 없고, 그 캐스팅이
**저장소 전체 77곳**(`creta-api.ts` 29, `creta-ads-api.ts` 11, `actions/books.ts` 8…)에 있다.
`as any`·`@ts-ignore`는 0건인데 그보다 위험한 이중 캐스팅으로 서버 반환 타입과 클라이언트 타입의
divergence를 컴파일러가 못 잡는 상태다. 브리지를 걷어내고 액션 반환 타입을 그대로 쓰면 캐스팅 대부분이 사라진다.

### 파일 크기 · 렌더 성능

- 800줄(AGENTS.md 상한) 초과 **23개 파일**. 최대 `BookSlideCanvas.tsx` 4,433줄,
  `book-slide-templates.ts` 4,115줄, `BookInspectorPanel.tsx` 3,723줄, `BookDetailPage.tsx` 3,622줄
  — 이 중 `BookDetailOwnerView` 한 컴포넌트가 혼자 3,019줄(`:279-3298`)이다.
  런타임 결함은 아니지만, 위 P0-4·폴링 누락·`src=""`가 규율 있는 코드 안에서 발견되지 않고
  남아 있던 이유다. 갈라놓을 자리는 이미 있다 — `BookSlideCanvas`의 `:451-593`(순수 변환 로직)과
  히트/미디어 셰이프 3덩어리(`:2645-3358`, `:3359-3942`, `:3942-4433`),
  `BookInspectorPanel`의 `:641-740`(순수)과 `:1346-1843`(미디어 플레이리스트),
  `BookDetailPage`의 드롭 핸들러 4개와 `:3299-3478`.
- 직전 리뷰가 권고한 `BookWorkspace` 통합은 `BookWorkspaceShell.tsx`(254줄)로 **셸만** 부분 추출됐고,
  두 페이지는 오히려 커졌다(Detail 2,991→3,622). 동명 훅·핸들러 21개가 여전히 양쪽에 있다.
- `React.memo` **여전히 0개**, 에디터용 zustand 스토어 없음(`src/stores`에 `auth-store.ts` 하나).
  권고 순서는 직전과 동일: 에디터 스토어 → props 그룹화 → memo.

### 테스트 · 계측

- **커버리지 계측이 존재하지 않는다.** `vitest.config.mts`는 18줄로 `coverage` 블록도,
  `@vitest/coverage-v8` 의존성도 없다. AGENTS.md는 "80%+ 필수"라고 적고 있으나 아무것도 측정하지 않는다.
- **통합 테스트 0개** — 라우트 핸들러·서버 액션·DB를 거치는 테스트가 하나도 없다.
  `auth.service.ts`(206줄, 리프레시 로테이션 유예 창 포함) 0건, `lib/authz.ts`(6개 함수) 0건,
  `rate-limit.ts` 0건, `book-slide-templates.ts`(4,115줄) 0건.
- **가장 먼저 쓸 테스트**: `duplicateBookEditorPage`(`book-canvas.ts:1953`). 요소 타입별로
  `...(el.x !== undefined ? { x: el.x } : {})`를 손으로 나열한 ~170줄 복사기라, 위젯 속성이 추가될 때마다
  여기에 안 넣으면 **복제 시 조용히 사라진다** — 에러도, 타입 실패도, 린트 경고도 없다.
  타입별로 모든 옵션 속성을 채워 복제 후 `id` 제외 deep equal 하나면 끝난다.
- **e2e가 sleep으로 flakiness를 덮고 있다.** signup이 IP당 5회/분(`api/auth/signup/route.ts:12`)인데
  모든 스펙이 여기로 계정을 만든다 → `e2e/helpers/auth.ts:20`이 최대 10회 재시도하며
  `12초 + 시도×2초`를 잔다(최악 ~200초). 그래서 스펙마다 `test.setTimeout`이 120~240초로 박혀 있다.
  `E2E_*` 플래그로 `assertRateLimit`을 무력화하면 재시도 루프와 8개의 타임아웃 오버라이드가 모두 사라진다.
- `playwright.config.ts`에 `fullyParallel`·`workers`·`forbidOnly`·`reporter` 없음. `trace`가
  `on-first-retry`인데 로컬 `retries`는 0이라 **정작 필요한 순간에 trace가 남지 않는다.**
  프로젝트가 `Desktop Chrome` 하나뿐이라 최근 2개 커밋이 넣은 768px 모바일 동작(P0-4의 진원)은
  **어떤 뷰포트로도 e2e 커버리지가 없다.**
- `tsconfig.json`은 `strict: true`지만 `noUncheckedIndexedAccess`·`exactOptionalPropertyTypes`·
  `noFallthroughCasesInSwitch`가 없다. 특히 `exactOptionalPropertyTypes`는 위 `duplicateBookEditorPage`가
  통째로 기대고 있는 관용구와 직결된다. `target`이 `ES2017`인데 `engines`는 Node 22.
- 린트가 게이트가 아니다 — 경고 5건(`no-img-element` 4, `react-hooks/exhaustive-deps` 1
  `AdsPage.tsx:393`)이 exit 0으로 통과하고 CI에 `--max-warnings=0`이 없다.
  타입 인지 린팅이 꺼져 있어 이 정도로 비동기가 많은 코드베이스에 `no-floating-promises`가 안 돈다.

### 저장소 위생

- 루트에 **미추적 PNG 104개 + JPG 1개, 합계 33MB**. `.gitignore`에 걸리지 않아 `git add -A` 한 번에 영구 커밋된다.
- `package-lock.json.bak`(691KB)이 **추적되고 있다**.
- `.gitattributes`(내용 `* text=auto eol=lf`)가 미추적 — P0-7의 근본 원인에 대한 처방인데 커밋이 안 됐다.
- 확인 결과 정상 무시 중: `test-results/`, `playwright-report/`, `uploads/`(디스크 927MB), `.omc/`, `tsconfig.tsbuildinfo`.
- 미사용 의존성: `@trpc/client`, `@trpc/react-query`(참조 0), `@emnapi/core`·`@emnapi/runtime`(참조 0).
  직전 리뷰가 지적한 `date-fns`·`random-words`·`@pmndrs/assets`는 제거 완료.

### 기타 확인된 결함

- `creta-ads.service.ts:1101` — `updateSetting`의 `row!.id`. `cretaAdSetting`은 유니크 제약 없는 싱글턴이고
  `getSetting()`이 먼저 불리지 않은 빈 테이블에서는 `undefined`라 500(TypeError).
- `BookVideoEditorDialog.tsx:397` — `document.cookie = "twick_upload_at=…; path=/api/books; SameSite=Lax"`.
  `Secure`·`Max-Age` 없음. 30초마다 갱신되며 다이얼로그가 열려 있는 동안 평문 HTTP로 나갈 수 있다.
- `write-file.ts:36` — 저장 확장자를 검증된 MIME이 아니라 클라이언트 파일명(`extname(file.name)`)에서 딴다.
  현재는 `contentTypeForPath`가 미지의 확장자를 `application/octet-stream`으로 내리고 `nosniff`가 붙어
  **악용 불가**지만, 서빙 라우트가 유일한 방어선이 되는 구조라 MIME→확장자 매핑으로 바꾸는 게 안전하다.
- `attach-chat-namespace.ts:175-190` — `socket.join`이 `chatRoom` upsert보다 먼저라 경합 시 사용자가
  이력 없는 방에 남는다. 핸드셰이크 JWT를 재검증하지 않아 소켓이 토큰 만료보다 오래 산다.
- 감사 로그 쓰기의 빈 `catch {}` (`book-audit.service.ts:76`, `creta-ads.service.ts:278`) — 승인·삭제 이력이
  아무 신호 없이 사라질 수 있다.
- `books.service.ts:805-817` — `parseElementsJson`이 **읽기 시점에** 쓰기용 검증기를 돌리고 400을 던진다.
  지금 규칙에 맞지 않는 과거 페이지가 하나 있으면 그 북은 영구히 열 수 없다.
- `concat-videos.ts:46` — `full.startsWith(base)`가 경계 검사가 아니라 접두 검사(`/app/uploads-x/…` 통과).
  현재 입력이 `/uploads/`로 제한되어 도달 불가이나 한 줄로 고칠 수 있다.
  (`src/app/uploads/[...path]/route.ts:76-84`의 경로 방어는 세그먼트에서 `..`·`/`를 먼저 막아 **정상**이다.)

---

## 확인 사항

- `creta-device-uptime.service.ts`·`creta-play-log.service.ts`는 `simulateBackfill`·`mulberry32`로
  **시뮬레이션 데이터**를 생성한다. 가동률 대시보드가 데모 전용이면 위 P1 항목의 심각도가 내려간다.
  반대로 실제 단말 텔레메트리로 제시되고 있다면, 그건 여기 나열한 어떤 버그보다 큰 제품 이슈다.
- `logCretaAdPlayAction`이 무인증인 것은 주석상 의도(단말이 로그인 없이 기록)다. 다만 `maxPerHour`가
  `listActiveCreatives`에서만 검사되고 `logPlay`(`:992`)에서는 재검사되지 않으며, 레이트 리밋·중복 제거도
  없다 → 노출 과다 집계와 무제한 행 삽입이 가능하다. `campaignReport:1371`이 CPM을 이 로그로 청구하므로
  정산과 연결되는지 확인이 필요하다.

---

## 잘 되어 있는 것

- 직전 리뷰 P0 5건 중 4건 해소: 마이그레이션 전환(24개 커밋, 기동은 `migrate`), 업로드 크기 선검사,
  프로세스 생명주기(SIGTERM 정리·강제 종료 타이머), patch-package `--error-on-fail` 2단 적용.
- 스키마가 실질적으로 성숙했다 — FK 54개, 인덱스 46개. 로그 테이블(`chat_message`, `book_audit_log`,
  `creta_ad_play_log`)이 이력 보존을 위해 FK를 **의도적으로** 빼고 작성자명을 비정규화한 것은
  주석까지 달린 올바른 설계다(`schema.ts:277, 333, 819`).
- SQL 인젝션 표면 0(전부 Drizzle 파라미터화, `sql.raw` 미사용), ffmpeg는 argv 배열로 spawn,
  외부 API 호스트는 전부 하드코딩(SSRF 없음), 외부 호출 8곳 전부 `AbortSignal.timeout` 적용.
- 북 `richHtml`이 저장 시점에 서버에서도 살균된다(`books.service.ts:2210`) — 직전 리뷰 지적 반영.
  웹뷰 위젯 iframe도 `allow-same-origin` 없이 샌드박스됨.
- `assertUnhandledBookElement`(`book-canvas.ts:1909`) 도입으로, 위젯 타입 누락 시 조용히 `text`로
  강등되던 데이터 손실이 컴파일 타임 검출 + 런타임 원본 보존으로 바뀌었다.
- 불변성 규율이 실제로 지켜진다 — `book-canvas.ts`의 모든 재정렬 헬퍼가 splice 전에 복사하고
  변화가 없으면 원본 참조를 반환한다. `use-book-document-history.ts:34`의 identity bailout이
  성립하는 근거가 이것이다. `book-slide-thumbnail-cache.ts`는 제대로 된 bounded LRU.
- `creta-play-log.service.ts:113-159`는 `count()`/`sum()`/`groupBy`로 SQL에서 집계하고 `.limit(50)`으로
  묶는다 — 가동률 서비스가 따라야 할 형태가 같은 저장소 안에 이미 있다.
- 에러 타이핑이 일관된다(서비스 전반 `HttpError`, 떠도는 `throw new Error` 없음).
  `posts.service.ts`는 keyset 페이지네이션과 SQLSTATE 23503 처리가 올바르다.

---

## 권고 작업 순서

1. **시크릿** — `env.ts` fail-fast, compose 기본값 제거, 배포본이 있다면 키 교체 + `refresh_token` 비우기. (P0-1)
2. **환경 복구** — `rm -rf node_modules && npm ci`, `.gitattributes` 커밋, 103개 테스트가 실제로 통과하는지 확인. (P0-7)
3. **작업 소실 2건** — `queryClient.clear()` 한 줄, 언마운트 대신 `panelsLocked` 전달. (P0-3, P0-4)
4. **`creta` 인가** — 액션에서 `actor`를 서비스로 전달 + `assertAdOwner`/디바이스 소유권. 조회는 뷰어 스코프. (P0-2)
5. **데이터 손실** — 북 삭제의 공유 파일 unlink·트랜잭션 밖 정리, `posts.remove` 순서. (P0-5, P0-6)
6. XFF 신뢰 게이트 · 슈퍼 관리자 기본값 제거 · 미인증 북 조회 · refresh 토큰 업로드 인증. (P1 인가)
7. 풀 데드락 · 댓글 깊이 · 이메일 인덱스 정합. (P1 가용성)
8. 테스트 4종(`duplicateBookEditorPage` · `authz.ts` · `assertRateLimit` · `AuthService`) + 커버리지 계측 도입.
9. 구조: 브리지 계층 제거(캐스팅 77곳) · 에디터 스토어 · 파일 분할.

---

## 확신도가 낮아 목록에 넣지 않은 것

추가 조사가 필요한 항목 — 결함일 수 있으나 근거가 충분치 않다.

- `api.ts:322` — `fetchMe`가 모든 오류(네트워크 단절 포함)를 "로그아웃"으로 붕괴시킨다.
- `BookPresentationPage.tsx:418` — 프레젠테이션 루프가 가중 광고 로테이션을 우회하는 것으로 보인다.
- `use-book-document-history.ts:37` — 되돌리기 이력에 문서 깊은 복사본 160개가 상주.
- `BookSlideCanvas.tsx:402` — pointerup에서 `releasePointerCapture` 무방비 호출.
- `BookVideoEditorDialog.tsx:308` — `a.click()`과 같은 턴에 blob URL을 revoke.

---

### 검증 수준에 대하여

P0 7건과 P1 대부분은 해당 파일을 직접 읽어 재현 경로까지 확인했다. 프론트엔드의
폴링 정리 누락, `setState` 업데이터, Transformer 의존성, MEDIUM 다수는 리뷰 결과를 옮긴 것으로
독립 재확인을 거치지 않았다(Transformer 항목은 리뷰어 스스로도 확신도 MEDIUM으로 표시).
반대로 검토 과정에서 **기각한** 지적도 있다 — `moveCreative`의 위치 재부여는 인덱스 기반이지만
실제로는 올바르게 교환되고, `uploads/[...path]` 경로 방어는 세그먼트에서 `..`·`/`를 먼저 막아
탈출이 성립하지 않는다. `getBookAction`의 작성자 노출도 `mapAuthor`(`books.service.ts:687`)가
`id/name/imageUrl`만 내보내므로 이메일 유출은 없다.
