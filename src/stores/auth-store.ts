import { isAxiosError } from "axios";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { useShallow } from "zustand/react/shallow";

import {
  api,
  type AuthUser,
  fetchMe,
  getAccessToken,
  parseApiErrorMessage,
  refreshAccessToken,
  setAccessToken,
} from "@/lib/api";
import { appLog } from "@/lib/app-log";
import { queryClient } from "@/lib/query-client";
import { userKeys } from "@/lib/query-keys";

export type SignUpInput = { email: string; password: string; name: string };

/**
 * Zustand에 보관하는 인증 상태 전체 모양.
 * - 컴포넌트에서는 보통 `useAuth()`만 쓰고, `hydrate`는 `main.tsx`에서 `getState()`로만 호출합니다.
 */
type AuthState = {
  /** 로그인된 사용자 프로필(null이면 비로그인). `hydrate`·`signIn`이 채우고 `signOut`이 비움 */
  user: AuthUser | null;
  /**
   * `hydrate()`가 한 번이라도 끝났는지.
   * false인 동안은 “아직 세션 복구 중”이므로 로그인/보호 라우트에서 스피너를 보여 주는 식으로 씁니다.
   */
  isReady: boolean;
  /** 앱 부트 시 1회: 토큰·쿠키 기준으로 `user` 복구 (컴포넌트는 `useAuth`에 없음 → 직접 구독하지 않음) */
  hydrate: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  signOut: () => Promise<void>;
  /** GET /users/me 로 `user` 갱신(프로필 이미지 변경 후 등) */
  refreshUser: () => Promise<void>;
  /** PATCH /users/me 응답 등 서버가 준 프로필로 즉시 동기화(추가 GET 없음) */
  applyServerUser: (me: AuthUser) => void;
};

/**
 * 브라우저에서 webpack HMR·중복 클라이언트 청크로 이 모듈이 두 번 평가되면 `create()` 가 두 번 돌아가
 * 서로 다른 스토어가 된다. `Providers` 는 `getState().hydrate()` 로 한쪽만 갱신하고 `useAuth()` 는 다른 쪽을
 * 구독하면 `isReady` 가 끝없이 false → 로그인·목록 등이 전부 스피너만 보일 수 있다.
 */
function createAuthStore() {
  return create<AuthState>()(
    devtools(
      immer((set) => ({
        user: null,
        /** `hydrate()`가 끝나기 전에는 보호 라우트·로그인 폼이 스피너를 보여 줍니다. */
        isReady: false,

        /**
         * hydrate = “물을 채우듯” 메모리(Zustand)에 로그인 상태를 맞춰 넣는 작업입니다.
         *
         * 왜 필요한가?
         * - 새로고침(F5)하면 React·Zustand state는 비어 있지만, 브라우저에는 이전에 남은
         *   sessionStorage(액세스 JWT)와 httpOnly 쿠키(리프레시 JWT)가 남아 있을 수 있습니다.
         * - 그걸 읽어서 “지금 로그인한 사람이 누구인지”를 다시 확인한 뒤 `user`에 넣습니다.
         *
         * 순서(요약):
         * 1) 액세스 토큰이 있으면 → GET /users/me 로 프로필 시도
         * 2) 실패(만료 등)면 → 쿠키만 보내 POST /auth/refresh 로 새 액세스 토큰 발급 후 다시 /users/me
         * 3) 액세스 토큰이 원래 없어도 → 리프레시 쿠키만으로 2)와 같이 시도 (예: 직전 탭에서만 로그인한 경우)
         * 4) 끝까지 사용자를 못 받으면 → 로컬 액세스 토큰 제거(깨진 값 정리)
         * 5) `isReady = true` 로 바꿔서 앱이 “판단 끝났다”고 알림 → 스피너 대신 실제 화면(로그인/보호 라우트) 표시
         */
        hydrate: async () => {
          appLog("auth", "hydrate 시작");
          let user: AuthUser | null = null;
          try {
            const tryMe = () => fetchMe();

            if (getAccessToken()) {
              user = await tryMe();
              if (!user) {
                const refreshed = await refreshAccessToken();
                if (refreshed) user = await tryMe();
              }
            } else {
              const refreshed = await refreshAccessToken();
              if (refreshed) user = await tryMe();
            }

            if (!user) {
              setAccessToken(null);
            }
          } catch (e) {
            console.error("[auth/hydrate]", e);
            setAccessToken(null);
            user = null;
          }

          set(
            (state) => {
              state.user = user;
              state.isReady = true;
            },
            false,
            "auth/hydrate",
          );
          if (user) queryClient.setQueryData(userKeys.me(), user);
          else void queryClient.removeQueries({ queryKey: userKeys.all });
          appLog("auth", "hydrate 결과", { loggedIn: Boolean(user) });
        },

        /** 이메일/비밀번호 로그인 → 액세스 토큰 저장 → 프로필 로드 후 user 설정 */
        signIn: async (email, password) => {
          appLog("auth", "signIn 시도", { email });
          try {
            const { data } = await api.post<{ access_token?: string }>(
              "/auth/signin",
              {
                email,
                password,
              },
            );
            const token = data.access_token;
            if (!token) throw new Error("액세스 토큰을 받지 못했습니다.");
            setAccessToken(token);
            // 같은 탭에서 계정이 바뀌는 경로 — 이전 사용자의 북·디바이스·광고 캐시가 남아 있으면
            // staleTime 동안 리페치 없이 그대로 렌더된다(쿼리 키에 뷰어 차원이 없음).
            queryClient.clear();
            const me = await fetchMe();
            if (!me) throw new Error("사용자 정보를 불러오지 못했습니다.");
            set(
              (state) => {
                state.user = me;
              },
              false,
              "auth/signIn",
            );
            queryClient.setQueryData(userKeys.me(), me);
            appLog("auth", "signIn 성공", { sub: me.sub });
          } catch (e) {
            appLog("auth", "signIn 실패", e instanceof Error ? e.message : e);
            if (isAxiosError(e)) {
              throw new Error(parseApiErrorMessage(e.response?.data));
            }
            throw e;
          }
        },

        /** 회원가입 API만 호출; 로그인은 별도 화면에서 진행 */
        signUp: async (input) => {
          appLog("auth", "signUp 시도", { email: input.email });
          try {
            await api.post("/auth/signup", {
              email: input.email,
              password: input.password,
              name: input.name,
            });
            appLog("auth", "signUp 성공");
          } catch (e) {
            appLog("auth", "signUp 실패", e instanceof Error ? e.message : e);
            if (isAxiosError(e)) {
              throw new Error(parseApiErrorMessage(e.response?.data));
            }
            throw e;
          }
        },

        /** 서버 로그아웃(쿠키 무효화) 후 로컬 토큰·user 제거 */
        signOut: async () => {
          appLog("auth", "signOut");
          try {
            await api.post("/auth/logout");
          } catch {
            /* 쿠키/토큰은 클라이언트에서 정리 */
          }
          setAccessToken(null);
          set(
            (state) => {
              state.user = null;
            },
            false,
            "auth/signOut",
          );
          // userKeys만 지우면 북(초안 포함)·디바이스·광고 캐시가 모듈 싱글턴에 남아
          // 다음 로그인 사용자에게 그대로 노출된다. 로그아웃은 리로드를 동반하지 않는다.
          queryClient.clear();
        },

        refreshUser: async () => {
          const me = await fetchMe();
          if (!me) {
            setAccessToken(null);
            // 세션이 끊긴 것으로 판정된 경로 — signOut과 같은 기준으로 캐시를 통째로 비운다.
            queryClient.clear();
            set(
              (state) => {
                state.user = null;
              },
              false,
              "auth/refreshUser",
            );
            return;
          }
          set(
            (state) => {
              state.user = me;
            },
            false,
            "auth/refreshUser",
          );
        },

        applyServerUser: (me) => {
          set(
            (state) => {
              state.user = me;
            },
            false,
            "auth/applyServerUser",
          );
        },
      })),
      {
        name: "auth-store",
        enabled: process.env.NODE_ENV === "development",
      },
    ),
  );
}

const globalForAuth = globalThis as unknown as {
  __NEXT_BOOK_APP_AUTH_STORE__?: ReturnType<typeof createAuthStore>;
};

export const useAuthStore =
  (typeof window !== "undefined" &&
    globalForAuth.__NEXT_BOOK_APP_AUTH_STORE__) ||
  (() => {
    const store = createAuthStore();
    if (typeof window !== "undefined") {
      globalForAuth.__NEXT_BOOK_APP_AUTH_STORE__ = store;
    }
    return store;
  })();

/**
 * 인증 상태를 쓰기 위한 React 훅입니다. (내부적으로 Zustand `useAuthStore`를 구독합니다.)
 *
 * 반환값
 * - `user` — 로그인 중이면 `{ sub, email, name, imageUrl }`, 아니면 `null`
 * - `isReady` — `hydrate` 완료 여부. false면 세션 판별 전이라 로그인/보호 화면에서 대기 UI 권장
 * - `signIn` / `signUp` / `signOut` — API와 연동되는 액션(비동기). 실패 시 throw → 폼에서 catch
 *
 * `hydrate`가 없는 이유
 * - 부팅 시 한 번만 필요하고, `main.tsx`에서 `useAuthStore.getState().hydrate()`로 호출합니다.
 * - 훅에 넣으면 “한 번도 안 쓰는 필드”를 매 컴포넌트가 들고 다니게 됩니다.
 *
 * `useShallow`를 쓰는 이유
 * - selector가 매번 `{ user, isReady, … }` 새 객체를 만들면, 참조가 바뀌어 리렌더가 과해질 수 있습니다.
 * - 얕은 비교로 “안 바뀐 필드”면 리렌더를 건너뜁니다. (액션 함수 참조는 스토어에서 안정적)
 */
export function useAuth() {
  return useAuthStore(
    useShallow((s) => ({
      user: s.user,
      isReady: s.isReady,
      signIn: s.signIn,
      signUp: s.signUp,
      signOut: s.signOut,
      refreshUser: s.refreshUser,
      applyServerUser: s.applyServerUser,
    })),
  );
}
