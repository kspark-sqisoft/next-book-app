import axios, { type InternalAxiosRequestConfig, isAxiosError } from "axios";

import {
  createBookAction,
  deleteBookAction,
  fetchBookAiChatAction,
  getBookAction,
  listBooksAction,
  requestBookLayoutAiAction,
  updateBookAction,
  uploadBookMediaAction,
} from "@/actions/books";
import {
  createPostAction,
  createPostCommentAction,
  deletePostAction,
  deletePostCommentAction,
  fetchPostCommentsAction,
  getPostAction,
  likePostAction,
  listPostsAction,
  unlikePostAction,
  updatePostAction,
} from "@/actions/posts";
import { appLog } from "@/lib/app-log";
import type { BookCanvasElement } from "@/lib/book-canvas";
import type { CreateBookDto, UpdateBookDto } from "@/server/services/books-types";

type RetryableRequest = InternalAxiosRequestConfig & { _retry?: boolean };

/**
 * 빌드 시 `.env.production` 등에 `VITE_API_BASE_URL=http://localhost:3000` 처럼 넣으면
 * `serve`로 프론트만 띄워도 API·쿠키 대상이 백엔드 오리진이 됩니다.
 * 비우면 상대 경로(개발: Vite 프록시 / 단일 오리진 배포)를 씁니다.
 */
function normalizeApiBase(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const t = raw.trim();
  if (!t) return "";
  return t.replace(/\/$/, "");
}

/** 단일 Next 앱: 기본 `/api` (Nest 루트 경로와 동일한 하위 경로) */
export const API_BASE_URL =
  normalizeApiBase(process.env.NEXT_PUBLIC_API_BASE_URL) || "/api";

/** 채팅 소켓 등 “API 서버 오리진” (프론트와 포트가 다를 때 `VITE_API_BASE_URL` 사용) */
export function apiOrigin(): string {
  if (
    API_BASE_URL.startsWith("http://") ||
    API_BASE_URL.startsWith("https://")
  ) {
    return API_BASE_URL;
  }
  return typeof window !== "undefined" ? window.location.origin : "";
}

/**
 * API가 내려주는 `/uploads/...` 상대 경로를, 프론트만 다른 포트에서 켠 경우 백엔드 절대 URL로 바꿉니다.
 * (그렇지 않으면 브라우저가 `localhost:5713/uploads/...`로만 요청해 이미지·업로드 결과가 깨져 보일 수 있음)
 */
export function publicAssetUrl(path: string | null | undefined): string | null {
  if (path == null) return null;
  const p = path.trim();
  if (!p) return null;
  if (p.startsWith("blob:") || p.startsWith("data:")) return p;
  if (p.startsWith("http://") || p.startsWith("https://")) return p;
  if (
    p.startsWith("/uploads/") &&
    (API_BASE_URL.startsWith("http://") || API_BASE_URL.startsWith("https://"))
  ) {
    return `${API_BASE_URL}${p}`;
  }
  return p;
}

/**
 * HTTP 클라이언트 및 게시글·인증 관련 API 래퍼.
 * 개발: Vite 프록시로 동일 오리진. 프로덕션 분리 호스팅: `VITE_API_BASE_URL` + `withCredentials`.
 */

export const ACCESS_TOKEN_KEY = "access_token";

export type AuthUser = {
  sub: number;
  email: string;
  name: string;
  /** `/uploads/avatars/...` 또는 null */
  imageUrl: string | null;
  /** 미응답·구버전 API 호환 시 생략되면 일반 사용자로 간주 */
  role?: "user" | "admin";
};

export type PostAuthor = {
  id: number;
  name: string;
  /** `/uploads/avatars/...` 또는 null */
  imageUrl: string | null;
};

/** 목록 한 번에 가져오는 글 수(무한 스크롤 페이지 크기) */
const POST_PAGE_DEFAULT = 12;

export type PostMediaItem = {
  id: number;
  kind: "image" | "video";
  url: string;
  posterUrl: string | null;
};

export type Post = {
  id: number;
  title: string;
  content: string;
  /** tech | life | study | chat | general */
  category: string;
  /** 순서대로 첨부 */
  media: PostMediaItem[];
  /** 목록 썸네일(첫 첨부) */
  coverThumbUrl: string | null;
  coverKind: "image" | "video" | null;
  /** 첫 첨부가 이미지일 때 (호환) */
  imageUrl: string | null;
  videoUrl: string | null;
  videoPosterUrl: string | null;
  createdAt: string;
  updatedAt: string;
  author: PostAuthor;
  likeCount: number;
  likedByMe: boolean;
};

export type PostLikeState = { likeCount: number; likedByMe: boolean };

/** 계층 댓글(무한 depth; replies가 비어 있을 수 있음) */
export type PostComment = {
  id: number;
  content: string;
  createdAt: string;
  updatedAt: string;
  author: PostAuthor;
  replies: PostComment[];
};

export function getAccessToken(): string | null {
  return sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
  if (token) sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  else sessionStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function parseApiErrorMessage(data: unknown): string {
  if (data && typeof data === "object" && "message" in data) {
    const m = (data as { message: unknown }).message;
    if (typeof m === "string") return m;
    if (Array.isArray(m))
      return m.filter((x) => typeof x === "string").join(", ");
  }
  return "요청에 실패했습니다.";
}

/** 공통 axios 인스턴스: Bearer(있을 때) + 쿠키 전송 */
export const api = axios.create({
  baseURL: API_BASE_URL || undefined,
  withCredentials: true,
});

/**
 * 리프레시는 httpOnly 쿠키만 사용(api 인스턴스·Bearer 미사용).
 * 성공 시 sessionStorage에 새 액세스 토큰을 저장합니다.
 */
export async function refreshAccessToken(): Promise<boolean> {
  const refreshUrl = `${API_BASE_URL}/auth/refresh`;
  try {
    const { data } = await axios.post<{ access_token?: string }>(
      refreshUrl,
      {},
      { withCredentials: true },
    );
    if (!data.access_token) {
      appLog("api", "refresh 실패(토큰 없음)");
      return false;
    }
    setAccessToken(data.access_token);
    appLog("api", "refresh 성공");
    return true;
  } catch {
    appLog("api", "refresh 실패(요청 오류)");
    return false;
  }
}

/** 동시에 여러 요청이 401이어도 POST /auth/refresh는 한 번만 나감 */
let refreshInFlight: Promise<boolean> | null = null;

function refreshSessionDeduped(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = refreshAccessToken().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

const PROACTIVE_REFRESH_SKEW_MS = 60_000;

function accessTokenExpiresWithin(token: string, withinMs: number): boolean {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return false;
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
    const payload = JSON.parse(atob(b64 + pad)) as { exp?: unknown };
    if (typeof payload.exp !== "number") return false;
    return payload.exp * 1000 < Date.now() + withinMs;
  } catch {
    return false;
  }
}

function requestSkipsProactiveRefresh(
  config: InternalAxiosRequestConfig,
): boolean {
  const path = String(config.url ?? "");
  return (
    path.includes("/auth/refresh") ||
    path.includes("/auth/signin") ||
    path.includes("/auth/signup")
  );
}

api.interceptors.request.use(async (config) => {
  if (!requestSkipsProactiveRefresh(config)) {
    const token = getAccessToken();
    if (token && accessTokenExpiresWithin(token, PROACTIVE_REFRESH_SKEW_MS)) {
      await refreshSessionDeduped();
    }
  }
  const token = getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (config.data instanceof FormData) {
    delete config.headers["Content-Type"];
  }
  return config;
});

export function rethrowAsApiError(e: unknown): never {
  if (isAxiosError(e)) {
    throw new Error(parseApiErrorMessage(e.response?.data));
  }
  if (e instanceof Error) throw e;
  throw new Error("요청에 실패했습니다.");
}

/**
 * 액세스 JWT 만료 시(401) 리프레시 쿠키로 새 토큰을 받은 뒤 원래 요청을 한 번 재시도합니다.
 * (로그인 직후에는 user가 있는데 sessionStorage 토큰만 만료된 경우에도 글 저장 등이 동작합니다.)
 */
api.interceptors.response.use(
  (res) => res,
  async (error: unknown) => {
    if (!isAxiosError(error) || !error.config) return Promise.reject(error);
    const status = error.response?.status;
    const original = error.config as RetryableRequest;
    if (status !== 401) return Promise.reject(error);

    const url = String(original.url ?? "");
    if (url.includes("/auth/refresh") || url.includes("/auth/signin")) {
      return Promise.reject(error);
    }
    if (original._retry) return Promise.reject(error);
    original._retry = true;

    const ok = await refreshSessionDeduped();
    if (!ok) return Promise.reject(error);

    const token = getAccessToken();
    if (token) {
      original.headers.Authorization = `Bearer ${token}`;
    }
    /* FormData 본문은 한 번 전송되면 소비되는 경우가 있어, 401 후 재시도 시 복제 */
    if (original.data instanceof FormData) {
      const next = new FormData();
      for (const [k, v] of original.data.entries()) {
        next.append(k, v);
      }
      original.data = next;
    }
    return api.request(original);
  },
);

/** 현재 Bearer로 로그인 사용자 조회; 401 등이면 null */
export async function fetchMe(): Promise<AuthUser | null> {
  try {
    const { data } = await api.get<AuthUser>("/users/me");
    return data;
  } catch {
    return null;
  }
}

/** JWT 필요; 표시 이름·프로필 이미지·역할 중 최소 한 항목 */
export async function updateMyProfile(input: {
  name?: string;
  image?: File | null;
  removeImage?: boolean;
  /** 관리자만 user로 강등 가능. 일반 사용자가 admin 지정 시 403 */
  role?: "user" | "admin";
}): Promise<AuthUser> {
  try {
    const fd = new FormData();
    if (input.name != null && input.name.trim() !== "") {
      fd.append("name", input.name.trim());
    }
    if (input.image) fd.append("image", input.image);
    if (input.removeImage) fd.append("removeImage", "1");
    if (input.role != null) fd.append("role", input.role);
    const { data } = await api.patch<AuthUser>("/users/me", fd);
    return data;
  } catch (e) {
    rethrowAsApiError(e);
  }
}

/** 관리자 전용: 다른 계정의 역할을 DB에 저장 */
export type AdminSetUserRoleResponse = {
  id: number;
  email: string;
  name: string;
  role: "user" | "admin";
};

/** 관리자 전용: 전체 사용자 목록(역할 관리) */
export type AdminUserListItem = {
  id: number;
  email: string;
  name: string;
  /** `/uploads/avatars/...` 또는 null */
  imageUrl: string | null;
  role: "user" | "admin";
};

export async function fetchAdminUsersList(): Promise<AdminUserListItem[]> {
  try {
    const { data } = await api.get<AdminUserListItem[]>("/users/admin");
    return data;
  } catch (e) {
    rethrowAsApiError(e);
  }
}

export async function adminSetUserRoleByEmail(input: {
  email: string;
  role: "user" | "admin";
}): Promise<AdminSetUserRoleResponse> {
  try {
    const { data } = await api.post<AdminSetUserRoleResponse>(
      "/users/admin/set-role",
      {
        email: input.email.trim(),
        role: input.role,
      },
    );
    return data;
  } catch (e) {
    rethrowAsApiError(e);
  }
}

export type PostsPageResponse = {
  items: Post[];
  /** 다음 요청에 `cursor`로 전달 */
  nextCursor: string | null;
  hasMore: boolean;
  /** 첫 페이지(cursor 없음)에만 포함 */
  total?: number;
};

/** 공개 글 목록 커서 페이지네이션 (무한 스크롤·더 보기) */
export async function fetchPostsPage(params?: {
  cursor?: string;
  take?: number;
  /** 제목·본문 부분 일치 */
  search?: string;
  /** tech | life | study | chat | general */
  category?: string;
}): Promise<PostsPageResponse> {
  const search = params?.search?.trim();
  const category = params?.category?.trim();
  return listPostsAction(getAccessToken(), {
    take: params?.take ?? POST_PAGE_DEFAULT,
    ...(params?.cursor ? { cursor: params.cursor } : {}),
    ...(search ? { search } : {}),
    ...(category ? { category } : {}),
  });
}

export { POST_PAGE_DEFAULT };

/** 단일 글 상세(공개) */
export async function fetchPost(id: number): Promise<Post> {
  return getPostAction(getAccessToken(), id);
}

/** 글 댓글 트리(공개) */
export async function fetchPostComments(
  postId: number,
): Promise<PostComment[]> {
  return fetchPostCommentsAction(postId);
}

/** JWT 필요; 새 댓글·대댓글(parentId) */
export async function createPostComment(
  postId: number,
  input: { content: string; parentId?: number },
): Promise<PostComment> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  return createPostCommentAction(token, postId, input);
}

/** JWT·작성자만 */
export async function deletePostComment(
  postId: number,
  commentId: number,
): Promise<void> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  await deletePostCommentAction(token, postId, commentId);
}

/** JWT 필요; 응답으로 최종 좋아요 수·내 좋아요 여부 */
export async function likePost(id: number): Promise<PostLikeState> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  return likePostAction(token, id);
}

/** JWT 필요 */
export async function unlikePost(id: number): Promise<PostLikeState> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  return unlikePostAction(token, id);
}

/** JWT 필요; 첨부 순서 = attachmentFiles 순서, posterFiles = 동영상 개수와 동일 */
export async function createPost(input: {
  title: string;
  content: string;
  category?: string;
  attachmentFiles: File[];
  posterFiles: File[];
}): Promise<Post> {
  const fd = new FormData();
  fd.append("title", input.title);
  fd.append("content", input.content);
  if (input.category?.trim()) {
    fd.append("category", input.category.trim());
  }
  for (const f of input.attachmentFiles) {
    fd.append("attachments", f);
  }
  for (const f of input.posterFiles) {
    fd.append("posters", f);
  }
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  return createPostAction(token, fd);
}

/** JWT·작성자만; mediaPlan 없으면 첨부 유지 */
export async function updatePost(
  id: number,
  input: {
    title: string;
    content: string;
    category?: string;
    clearAllMedia?: boolean;
    mediaPlan?: Array<{ t: "e"; id: number } | { t: "n"; i: number }>;
    newFiles?: File[];
    newPosters?: File[];
  },
): Promise<Post> {
  const fd = new FormData();
  fd.append("title", input.title);
  fd.append("content", input.content);
  if (input.category?.trim()) {
    fd.append("category", input.category.trim());
  }
  if (input.clearAllMedia) fd.append("removeMedia", "1");
  if (input.mediaPlan != null) {
    fd.append("mediaPlan", JSON.stringify({ items: input.mediaPlan }));
  }
  for (const f of input.newFiles ?? []) {
    fd.append("newFiles", f);
  }
  for (const f of input.newPosters ?? []) {
    fd.append("newPosters", f);
  }
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  return updatePostAction(token, id, fd);
}

/** JWT·작성자만 */
export async function deletePost(id: number): Promise<void> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  await deletePostAction(token, id);
}

// --- Weather (OpenWeatherMap, 서울 — API 키는 백엔드) ---

export type SeoulWeatherPayload = {
  locationLabel: string;
  tempC: number;
  feelsLikeC: number;
  description: string;
  icon: string;
  humidity: number;
  windMps: number;
  pm25: number | null;
  pm10: number | null;
  aqiLevel: number | null;
  aqiLabel: string | null;
  updatedAt: string;
};

/** `q` 비우면 서울. 예: `Seoul,KR`, `Busan,KR` */
export async function fetchWeatherCurrent(
  q?: string | null,
): Promise<SeoulWeatherPayload> {
  try {
    const trimmed = q?.trim();
    const { data } = await api.get<SeoulWeatherPayload>("/weather/current", {
      params: trimmed ? { q: trimmed } : {},
    });
    return data;
  } catch (e) {
    rethrowAsApiError(e);
  }
}

export async function fetchSeoulWeather(): Promise<SeoulWeatherPayload> {
  return fetchWeatherCurrent(null);
}

// --- News (NewsAPI.org, 키는 백엔드 NEWSAPI_KEY) — https://newsapi.org/docs/endpoints/top-headlines

export type NewsArticlePayload = {
  title: string;
  url: string;
  source: string;
  publishedAt: string;
};

export type NewsHeadlinesPayload = {
  articles: NewsArticlePayload[];
  fetchedAt: string;
};

export async function fetchNewsHeadlines(params?: {
  country?: string;
  category?: string;
  pageSize?: number;
}): Promise<NewsHeadlinesPayload> {
  try {
    const { data } = await api.get<NewsHeadlinesPayload>("/news/headlines", {
      params: {
        ...(params?.country ? { country: params.country } : {}),
        ...(params?.category ? { category: params.category } : {}),
        pageSize: params?.pageSize ?? 5,
      },
    });
    return data;
  } catch (e) {
    rethrowAsApiError(e);
  }
}

// --- Cats (학습용; UI는 `src/actions/cats.ts` 서버 액션) ---

export type Cat = {
  id: number;
  name: string;
  age: number;
  breed: string;
  /** `/uploads/cat-images/...` 또는 null */
  imageUrl: string | null;
  /** 등록자; 레거시 데이터는 null */
  ownerId: number | null;
  createdAt: string;
  updatedAt: string;
};

// --- Books (슬라이드 / Konva) ---

export type { BookCanvasElement } from "@/lib/book-canvas";

export type BookPageDto = {
  id: number;
  sortOrder: number;
  /** 표시용 슬라이드 이름(빈 문자열이면 UI에서 "슬라이드 n") */
  name: string;
  /** 슬라이드 배경색(CSS) */
  backgroundColor?: string;
  elements: BookCanvasElement[];
  /** 미리보기: 이 페이지 체류 시간을 정하는 기준 위젯 id(없으면 기본 초) */
  presentationTimingElementId?: string | null;
  /** 슬라이드쇼: 이 슬라이드로 전환될 때 효과(none·fade·…) */
  presentationTransition?: string;
  /** 전환 지속(ms) */
  presentationTransitionMs?: number;
};

/** 북 목록 카드 — 첫 슬라이드 썸네일 합성용 */
export type BookListCoverPreview = {
  slideWidth: number;
  slideHeight: number;
  backgroundColor: string;
  elements: BookCanvasElement[];
};

export type BookListItem = {
  id: number;
  title: string;
  createdAt: string;
  updatedAt: string;
  author: PostAuthor;
  pageCount: number;
  coverPreview: BookListCoverPreview | null;
};

export type BookDetail = {
  id: number;
  title: string;
  /** 모든 슬라이드 공통 캔버스 크기(px) */
  slideWidth: number;
  slideHeight: number;
  /** 미리보기: 마지막 슬라이드 후 처음으로 돌아갈지(기본 true) */
  presentationLoop?: boolean;
  createdAt: string;
  updatedAt: string;
  author: PostAuthor;
  pages: BookPageDto[];
};

export type BookPageInput = {
  sortOrder: number;
  name?: string;
  backgroundColor?: string;
  elements: BookCanvasElement[];
  presentationTimingElementId?: string | null;
  presentationTransition?: string;
  presentationTransitionMs?: number;
};

const BOOK_PAGE_DEFAULT = 12;

export type BooksPageResponse = {
  items: BookListItem[];
  total: number;
};

export async function fetchBooksPage(params?: {
  skip?: number;
  take?: number;
  search?: string;
}): Promise<BooksPageResponse> {
  const search = params?.search?.trim();
  return listBooksAction({
    skip: params?.skip ?? 0,
    take: params?.take ?? BOOK_PAGE_DEFAULT,
    ...(search ? { search } : {}),
  });
}

export { BOOK_PAGE_DEFAULT };

export async function fetchBook(id: number): Promise<BookDetail> {
  return getBookAction(id);
}

export async function createBook(input: {
  title: string;
  pages?: BookPageInput[];
  slideWidth?: number;
  slideHeight?: number;
  presentationLoop?: boolean;
}): Promise<BookDetail> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  return createBookAction(token, input as CreateBookDto);
}

export type BookLayoutAiAddWidgetDto = {
  type: "add_widget";
  widget: "weather" | "digitalClock" | "news" | "text" | "image" | "video";
  anchor: string;
  slideNumber?: number;
  cityQuery?: string;
  text?: string;
  fontSize?: number;
  imageSearchQuery?: string;
  imageUrl?: string;
  videoSearchQuery?: string;
  videoUrl?: string;
  src?: string;
  posterSrc?: string | null;
  imageWidth?: number;
  imageHeight?: number;
  videoWidth?: number;
  videoHeight?: number;
};

export type BookLayoutAiReplaceWidgetMediaDto = {
  type: "replace_widget_media";
  elementId: string;
  widget: "image" | "video";
  imageSearchQuery?: string;
  imageUrl?: string;
  videoSearchQuery?: string;
  videoUrl?: string;
  src?: string;
  posterSrc?: string | null;
  imageWidth?: number;
  imageHeight?: number;
  videoWidth?: number;
  videoHeight?: number;
};

export type BookLayoutAiSetBackgroundDto = {
  type: "set_page_background";
  backgroundColor: string;
};

export type BookLayoutAiSetPageTitleDto = {
  type: "set_page_title";
  title: string;
  /** 왼쪽 목록 기준 1번째 = 1 */
  slideNumber?: number;
};

export type BookLayoutAiSetBookTitleDto = {
  type: "set_book_title";
  title: string;
};

export type BookLayoutAiAddPageDto = {
  type: "add_page";
  count?: number;
};

export type BookLayoutAiUndoDto = { type: "undo" };
export type BookLayoutAiRedoDto = { type: "redo" };
export type BookLayoutAiRemoveCurrentPageDto = { type: "remove_current_page" };

export type BookLayoutAiSetSlideDimensionsDto = {
  type: "set_slide_dimensions";
  slideWidth?: number;
  slideHeight?: number;
};

export type BookLayoutAiActionDto =
  | BookLayoutAiAddWidgetDto
  | BookLayoutAiReplaceWidgetMediaDto
  | BookLayoutAiSetBackgroundDto
  | BookLayoutAiSetPageTitleDto
  | BookLayoutAiSetBookTitleDto
  | BookLayoutAiAddPageDto
  | BookLayoutAiUndoDto
  | BookLayoutAiRedoDto
  | BookLayoutAiRemoveCurrentPageDto
  | BookLayoutAiSetSlideDimensionsDto;

export type BookLayoutAiResponse = {
  reply: string;
  actions: BookLayoutAiActionDto[];
};

export type BookAiChatLineDto = {
  id: number;
  role: "user" | "assistant";
  text: string;
  createdAt: string;
};

/** 저장된 북 편집기에서 AI 패널을 다시 열 때 이전 대화(작성자만). */
export async function fetchBookAiChat(
  bookId: number,
): Promise<BookAiChatLineDto[]> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  const lines = await fetchBookAiChatAction(token, bookId);
  return Array.isArray(lines) ? lines : [];
}

/** 로그인 필요. 서버에서 OpenAI로 북 편집용 자연어 → 액션 JSON을 해석합니다. */
export async function requestBookLayoutAi(body: {
  message: string;
  slideWidth: number;
  slideHeight: number;
  pageCount: number;
  activeSlideIndex: number;
  /** 단일 이미지·비디오 선택 시 — 채팅으로 «바꿔줘» 등 시 교체 액션으로 연결 */
  selection?: { elementId: string; kind: "image" | "video" };
  /** 저장된 북 id — 넣으면 성공한 한 턴을 DB에 남김(작성자만). OpenAI 토큰은 증가하지 않음. */
  bookId?: number;
}): Promise<BookLayoutAiResponse> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  return requestBookLayoutAiAction(token, body);
}

export async function updateBook(
  id: number,
  input: {
    title?: string;
    pages?: BookPageInput[];
    slideWidth?: number;
    slideHeight?: number;
    presentationLoop?: boolean;
  },
): Promise<BookDetail> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  return updateBookAction(token, id, input as UpdateBookDto);
}

export async function deleteBook(id: number): Promise<void> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  await deleteBookAction(token, id);
}

export type BookUploadResult = {
  kind: "image" | "video";
  url: string;
  posterUrl: string | null;
};

export async function uploadBookMedia(
  bookId: number,
  file: File,
  poster?: File | null,
): Promise<BookUploadResult> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  const fd = new FormData();
  fd.append("file", file);
  if (poster) fd.append("poster", poster);
  return uploadBookMediaAction(token, bookId, fd);
}
