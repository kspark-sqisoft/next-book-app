# 구조 리팩터링 계획 — 2026-09-03

`src` 전체 구조 점검에서 나온 항목 6개의 실행 계획이다.
결함 목록은 `code-review-2026-09-02.md`에 있고, 이 문서는 **구조**만 다룬다.

방법론은 이 저장소에 설치된 **Next.js 16.3.1 공식 문서**(`node_modules/next/dist/docs/`)를 1차 출처로 삼는다.
AGENTS.md가 명시하듯 이 버전은 관례가 달라, 일반적으로 알려진 App Router 패턴을 그대로 적용하지 않는다.

## 기준선 (2026-09-03, `1be8bc6`)

| 지표                                | 값                                  |
| ----------------------------------- | ----------------------------------- |
| `src` 파일 / 줄                     | 361 / 92,951                        |
| `page-components` 중 `"use client"` | **27 / 27**                         |
| `(site)` 아래 async 서버 컴포넌트   | **1**                               |
| `as unknown as`                     | **79**                              |
| 800줄(AGENTS.md 상한) 초과 파일     | **23**                              |
| `React.memo`                        | **0**                               |
| zustand 스토어                      | 1 (`auth-store.ts`)                 |
| tRPC 프로시저                       | 1 (`health`, 클라이언트 import 0건) |
| `server-only` import                | **0**                               |
| React `cache()` 사용                | **0**                               |
| `useQuery` 사용 파일                | 42                                  |

검증 기준선: `npm run typecheck` 통과, `vitest run` **23파일 / 107 테스트** 통과.
**각 단계는 이 두 가지를 통과시킨 상태로 커밋한다.**

---

## 채택하는 방법론 (근거: Next 16.3.1 공식 문서)

이번 리팩터링에서 새로 도입하는 규칙이다. 각 항목의 작업은 이 규칙을 따른다.

### M1. Data Access Layer(DAL) + `server-only` + DTO

`02-guides/data-security.md:56`가 권장하는 형태다. DAL은 ① 서버에서만 실행되고
② **인가 검사를 수행하며** ③ 안전한 최소 DTO를 반환한다.

이 저장소는 `server/services/*`라는 좋은 뼈대를 이미 갖고 있고 `*Public` DTO 타입도 있다.
빠진 것은 **경계의 강제**다 — `server-only` import가 **0건**이라 서비스를 클라이언트에서
import해도 아무도 막지 않는다. 서비스와 액션 파일에 `import "server-only"`를 넣는다.

같은 문서 `:603`의 감사 체크리스트를 완료 기준으로 쓴다:

> DB 패키지와 환경변수가 DAL 밖에서 import되지 않는가 / 액션 안에서 재인가하는가 /
> 인증이 아니라 **소유권**을 확인하는가 / 반환값을 클라이언트에 필요한 만큼으로 걸렀는가

### M2. 세션은 `cache()`로 감싼 서버 헬퍼 하나로

`data-security.md:69`의 패턴이다.

```ts
export const getCurrentUser = cache(async () => {
  const token = (await cookies()).get(ACCESS_TOKEN_COOKIE);
  return decodeAndValidate(token);
});
```

`cache()`는 **요청 단위 메모이즈**라 한 요청 안에서 몇 번을 불러도 검증이 한 번이다.
문서의 설명대로 "값을 컴포넌트 사이로 넘기지 않고 필요한 곳에서 다시 읽게" 만드는 것이 요점이며,
지금처럼 토큰을 인자로 전달하는 구조와 정확히 반대다. 저장소 내 `cache()` 사용은 현재 **0건**.

### M3. 액션은 "참조 + 변경분"만 받고 나머지는 서버에서 재조회

`02-guides/server-actions.md`의 지침:

> 클라이언트는 _어떤_ 항목인지는 알려줄 수 있어도 그 행의 내용이나 소유권을 제공해선 안 된다.
> 참조(보통 id)와 변경분만 보내고 나머지는 세션으로 신뢰할 수 있는 출처에서 다시 읽어라.
> zod 검증은 **모양**만 볼 뿐, 잘 만들어진 객체도 남의 행을 가리킬 수 있다.

또한 **"렌더 시점 게이팅은 보안 경계가 아니다"** — 폼을 인증된 페이지에서만 렌더해도
POST는 UI를 거치지 않고 들어온다. 액션마다 재인가가 필요하며, 이것이 M1의 DAL로 모이는 이유다.

### M4. 읽기를 서버 액션으로 하지 않는다

`server-actions.md`의 "Sequential dispatch on the client":

> Next.js는 **클라이언트당 서버 액션을 한 번에 하나씩** 디스패치한다.
> 세 개를 연속 호출하면 두 번째는 첫 번째를, 세 번째는 두 번째를 기다린다.
> `Promise.all`로 병렬화할 수 없다. 병렬이 필요하면 서버 컴포넌트에서 병렬로 가져오거나
> **비변경 요청은 라우트 핸들러**를 써라.

이 저장소는 조회를 서버 액션으로 한다(`listCretaPlaylistsAction`, `getCretaDeviceAction` …).
한 화면이 목록·상세·썸네일을 각각 부르면 **직렬화**된다. 지금 체감되는 초기 로딩 지연의
설명 가능한 원인이고, 5번이 성능 항목인 이유다.

### M5. RSC 전환은 "재작성"이 아니라 "프리페치 + 하이드레이션"으로

`02-guides/single-page-applications.md:408`(SPAs with TanStack Query)이 이 저장소에 그대로 맞는다.
42개 파일이 `useQuery`를 쓰는데, **그 컴포넌트를 고치지 않고** 서버에서 같은 쿼리 키로
`prefetchQuery`(await 하지 않음) → `<HydrationBoundary state={dehydrate(qc)}>`로 감싸면
초기 데이터가 HTML에 실려 온다.

```tsx
function ProjectData({ id }) {
  const queryClient = getQueryClient();
  queryClient.prefetchQuery({
    queryKey: ["project", id],
    queryFn: () => getProject(id),
  }); // await 안 함
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProjectView id={id} />
    </HydrationBoundary>
  );
}
```

**전면 재작성 대비 위험이 훨씬 낮다.** 기존 클라이언트 컴포넌트는 그대로 두고 라우트만 바꾼다.
`src/lib/query-keys.ts`(90줄, 42곳 사용)가 이미 키를 한곳에 모아 두어 서버·클라이언트 키 불일치
위험도 낮다 — 문서가 경고하는 "키가 어긋나면 아무 경고 없이 시드가 무시된다"를 이미 예방하는 구조다.

### M6. `getQueryClient()` — 요청 단위 분리 (5번의 선행 조건)

`single-page-applications.md:414`: QueryClient는 **서버에서 요청마다 새로,
브라우저에서는 싱글턴**이어야 한다.

현재 `src/lib/query-client.ts:6`은 **모듈 최상위 싱글턴**이다.
지금은 서버에서 이 캐시에 쓰는 코드가 없어 사고가 나지 않지만,
**5번에서 서버 프리페치를 넣는 순간 요청 간에 캐시가 공유되어 교차 사용자 데이터 유출이 된다.**
5번 착수 전에 반드시 `getQueryClient()`로 바꾼다.

### M7. `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 설정 (별건, 즉시)

`server-actions.md`의 배포 항목: 서버 액션 참조는 빌드 시 암호화되며,
**자체 호스팅·다중 인스턴스에서는 인스턴스 간 공유되는 고정 키가 필요하다.**
이 저장소는 커스텀 서버(`server.ts`, socket.io)로 자체 호스팅하는데
이 환경변수가 **어디에도 설정되어 있지 않다.** 인스턴스를 늘리거나 재배포하면
"Failed to find Server Action" 오류로 진행 중인 변경이 실패할 수 있다.
`JWT_ACCESS_SECRET`과 같은 방식으로 `server/env.ts`에서 필수 처리한다.

---

## 우선순위 결정 근거

초안은 `tRPC 삭제 → 브리지 제거 → 토큰 인자 제거` 순이었으나 **2번과 3번을 교체했다.**

1. 브리지 계층(`lib/*-api.ts`)이 존재하는 이유의 대부분이 `getAccessToken()` 주입이다.
   토큰 인자를 먼저 없애면 브리지는 껍데기가 되어 기계적으로 삭제된다.
   반대 순서면 호출부를 두 번 고쳐야 한다.
2. 액세스 토큰이 `sessionStorage`(`lib/api.ts:174`)에 있는 것이 **5번의 근본 차단 요인**이다.
   서버 컴포넌트도, M5의 서버 프리페치도 `sessionStorage`를 읽을 수 없다.
   토큰 이전은 3번과 5번을 동시에 여는 열쇠다.

정렬 원칙은 **"뒤 작업의 범위를 줄이는 것부터"** — 값이 큰 순서가 아니라 의존의 역순이다.

```
0 M7 액션 암호화 키 ──────────────────────── (독립, 즉시, 운영 위험)
1 tRPC 삭제 ─────────────────────────────── (독립, 표면 축소)
2 토큰 → 쿠키 + DAL 세션 ──┬──────────────┬─> 6 대형 컴포넌트 분해
   (M1·M2·M3 도입)         │              │   (독립, 가장 크므로 마지막)
                           ├─> 3 브리지 제거 ─> 4 lib 해체
                           │
                           └─> 5 프리페치+하이드레이션 (M5, 선행: M6)
```

4번(`lib` 해체)이 3번 뒤인 이유: 곧 삭제될 브리지 파일 6개를 미리 옮기면 헛일이다.

---

## 1. 유령 tRPC 계층 삭제

**문제** — `server/trpc/routers/_app.ts`는 `health` 프로시저 하나뿐이고
`@trpc/client`·`@trpc/react-query` import는 0건이다. `trpc.ts:11`에 "인증 미들웨어는
추후 확장 지점"이라는 주석이 있어, **인가를 모을 자리가 비어 있다는 착각**을 유지시킨다.
실제 인가는 서버 액션 13개 파일에 흩어져 있고 P0였던 크레타 인가 부재(`54f8488`)가 그 결과다.
그 자리는 tRPC가 아니라 M1의 DAL이 맡는다.

**범위** — `src/server/trpc/`(3파일), `src/app/api/trpc/[trpc]/route.ts`,
`__tests__/trpc-health.test.ts`, `package.json`의 `@trpc/*`·`superjson`(타 사용처 확인 후).

**검증** — typecheck + `vitest run`. `grep -rn "trpc" src` 0건.

**위험** — 낮음. 트래픽이 흐르지 않는 코드다.

---

## 2. 액세스 토큰을 httpOnly 쿠키로 + DAL 세션 도입

**문제** — 액세스 JWT가 `sessionStorage`에 있어 서버가 읽을 수 없다. 그래서
서버 액션마다 `accessToken`을 **첫 인자로 받고**(`actions/creta.ts:34` 등)
함수마다 `requireUserFromToken()`을 다시 호출한다. M3가 지적하는 형태 그대로이며,
가드를 한 번 빠뜨리면 그대로 인가 구멍이다(`54f8488`이 그 사례).

**설계**

- 리프레시 쿠키(`server/http/cookies.ts`)와 같은 방식으로 액세스 쿠키 추가:
  `httpOnly` + `sameSite: "lax"` + `secure`(prod) + `maxAge = JWT_ACCESS_EXPIRES_IN`(15m).
  발급 지점은 기존과 동일: `/api/auth/signin`, `/api/auth/refresh`. 로그아웃에서 만료.
- **`getBearerPayload`는 건드리지 않는다.** REST 라우트는 Bearer 전용으로 유지하고,
  쿠키는 서버 액션·RSC 경로에서만 읽는다. 쿠키를 REST 인증에 쓰면 CSRF 표면이 생기지만,
  서버 액션은 Next가 `Origin`/`Host`를 대조하는 CSRF 검사를 내장한다(`server-actions.md` Security).
- **M2 적용**: `server/auth/session.ts`에 `cache()`로 감싼 `getCurrentUser()` /
  `requireUser()` / `requireAdmin()`을 만든다. 인자 없음.
- **M1 적용**: `server/services/*`와 `actions/*`에 `import "server-only"` 추가.
- 기존 Bearer 경로가 그대로 동작하므로 **단계적 이전이 가능하다**(공존 → 액션부터 전환).

**작업 순서** — 쿠키 헬퍼 → `session.ts` → 액션 13개 파일에서 `accessToken` 파라미터 제거
→ 호출부(브리지) 정리. **도메인 단위로 쪼개 커밋한다.**

**검증** — typecheck + `vitest run` + **`playwright test`**(로그인·권한 경로 변경이므로 필수).
`__tests__/creta-action-auth.test.ts`를 시그니처 변경에 맞춰 갱신한다.
완료 기준은 `data-security.md:603` 감사 체크리스트.

**위험** — **높음.** 인증 경로 전체가 대상이다.

---

## 3. 브리지 계층(`lib/*-api.ts`) 제거

**문제** — 페이지 → `lib/creta-api.ts` → `actions/creta.ts` → `services`의 4단 경로에서
브리지가 하는 일은 토큰 주입과 `as unknown as` 캐스팅뿐이다. 그 캐스팅이 **79건**이라
서버 반환 타입과 클라이언트 타입이 어긋나도 컴파일러가 잡지 못한다.
2번이 끝나면 토큰 주입이라는 존재 이유가 사라진다.

**범위** — `creta-api.ts`(624), `creta-ads-api.ts`(386), `creta-walls-api.ts`(116),
`creta-reports-api.ts`(110), `creta-alerts-api.ts`(84), `creta-comments-api.ts`(70).
타입·라벨 등 순수 정의는 살려 `features/<domain>/types.ts`로 옮긴다(4번과 연결).

**M4 병행** — 옮기는 김에 **조회 액션을 라우트 핸들러로 되돌릴지 판단한다.**
서버 액션 조회는 클라이언트당 직렬화되므로, 한 화면에서 여러 건을 부르는
`DeviceDetailPage`·`DashboardPage`가 우선 후보다. 5번에서 서버 프리페치로 덮이는 화면은 제외.

**검증** — typecheck + `vitest run`. `as unknown as`가 79에서 **20 이하**로 줄어야 한다.

**위험** — 중간. 캐스팅이 사라지며 **숨어 있던 타입 불일치가 드러난다** — 그게 목적이다.

---

## 4. `src/lib` 해체

**문제** — 62파일 15,417줄에 성격이 넷 섞여 있다. `src/hooks/`를 만들어 두고
훅 대부분은 `lib`에 있다(규칙이 정해졌다가 지켜지지 않은 상태).

| 성격             | 예                                                        | 목적지               |
| ---------------- | --------------------------------------------------------- | -------------------- |
| 순수 도메인 로직 | `book-slide-templates.ts`(4,115), `book-canvas.ts`(2,336) | `src/features/book/` |
| React 훅         | `use-book-widget-clipboard.ts` 등 6개                     | `src/hooks/`         |
| HTTP 클라이언트  | `api.ts`(1,268)                                           | `src/lib/` 유지      |
| 액션 브리지      | `creta-*-api.ts`                                          | 3번에서 삭제         |

**검증** — typecheck + `vitest run`. 동작 변경 0이어야 한다(순수 이동 + import 경로).

**위험** — 낮음. 다만 diff가 크므로 **다른 작업과 섞지 않고 단독 커밋**한다.

---

## 5. 서버 프리페치 + 하이드레이션 (M5)

**문제** — `page-components` 27개가 전부 `"use client"`다. Next 16.3.1 문서
(`01-getting-started/05-server-and-client-components.md:11`)는 여전히
"layouts and pages are Server Components **by default**"로 시작한다.
초기 렌더가 비고, 번들이 커지고, M4의 직렬 디스패치와 겹쳐 데이터 워터폴이 생긴다.

**선행 조건 (M6)** — `lib/query-client.ts`의 모듈 싱글턴을 `getQueryClient()`로 교체.
**이걸 안 하고 서버 프리페치를 넣으면 요청 간 캐시 공유로 교차 사용자 유출이 된다.**
이 한 가지는 5번의 다른 무엇보다 먼저 한다.

**방법** — M5. 클라이언트 컴포넌트는 **그대로 두고** 라우트 `page.tsx`에서
같은 쿼리 키로 `prefetchQuery`(await 하지 않음) 후 `<HydrationBoundary>`로 감싼다.
쿼리 함수는 서버·클라이언트 양쪽에서 동작해야 하므로 2번의 쿠키 세션이 전제다.

**대상(읽기 위주부터)** — `CommunityPage`(297), `BookListPage`, `PlaylistListPage`,
`ScheduleListPage`, `WallListPage`, `DeviceListPage`, `PlayReportPage`.

**비대상** — 북 에디터·캔버스·프레젠테이션. 상호작용이 본질이므로 클라이언트로 둔다.
(문서도 SPA 형태를 정당한 선택으로 인정한다 — 전면 전환이 목표가 아니다.)

**검증** — typecheck + `vitest run` + `playwright test` + 화면 실물 확인.
**측정**: 전환 화면의 초기 HTML에 목록 데이터가 실려 오는지(view-source)로 확인한다.

**위험** — 중간. 화면 단위로 하나씩, 화면마다 커밋한다.

---

## 6. 대형 컴포넌트 분해 + 에디터 스토어

**문제** — 800줄 초과 23개. `BookDetailPage.tsx`(3,662)는 최상위 함수가 5개뿐인데
그중 `BookDetailOwnerView`가 `:279-3330`, 즉 **3,000줄짜리 단일 컴포넌트**다.
4,400줄 캔버스 에디터의 상태가 전부 props로 흐르고 `React.memo`는 0건이다.

**순서** — ① 에디터 zustand 스토어 도입(props drilling 제거) → ② props 그룹화 →
③ `React.memo` 적용. 컴포넌트를 먼저 쪼개면 props 개수만 늘어난다.

`code-review-2026-09-02.md`가 분해 지점을 이미 특정해 두었다(`BookSlideCanvas`의 `:451-593`,
히트/미디어 셰이프 3덩어리 등). 그 좌표를 재사용한다.

**선행** — **분해 전에 `duplicateBookEditorPage`(`book-canvas.ts:1953`) 테스트를 먼저 쓴다.**
위젯 속성을 손으로 나열하는 170줄 복사기라 누락 시 조용히 데이터가 사라지고,
리팩터링 중 깨져도 알 수 없다.

**검증** — typecheck + `vitest run` + `playwright test`.

**위험** — 중간. 기능 변경 없이 진행하고, 커버가 없는 영역이라 e2e에 의존한다.

---

## 진행

- [ ] 0. `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` 필수화 (M7)
- [ ] 1. tRPC 삭제
- [ ] 2. 토큰 → httpOnly 쿠키 + DAL 세션 (M1·M2·M3)
- [ ] 3. 브리지 계층 제거 (+ M4 조회 경로 판단)
- [ ] 4. `lib` 해체
- [ ] 5. 서버 프리페치 + 하이드레이션 (선행: M6)
- [ ] 6. 대형 컴포넌트 분해 + 에디터 스토어

각 항목 완료 시 이 체크리스트와 기준선 표를 갱신한다.
