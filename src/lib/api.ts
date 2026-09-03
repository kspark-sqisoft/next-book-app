// 브라우저용 HTTP 클라이언트: axios + 서버 액션 브리지, 401 시 refresh·재시도
// 상단: 베이스 URL·인터셉터 / 이하: posts·books·users·댓글·좋아요 등 편의 함수
import axios, { type InternalAxiosRequestConfig, isAxiosError } from "axios";

import {
  addBookMediaLibraryItemAction,
  listBookMediaLibraryAction,
  removeBookMediaLibraryItemAction,
  setBookMediaShareAction,
  setBookMediaShareAllAction,
} from "@/actions/book-media";
import {
  createBookAction,
  deleteBookAction,
  fetchBookAiChatAction,
  getBookAction,
  listBookAuditAction,
  listBooksAction,
  listBookShareUsersAction,
  listRecentBookAuditAction,
  requestBookLayoutAiAction,
  setBookShareAction,
  setBookShareAllAction,
  setBookStatusAction,
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
import {
  getBookVideoRenderJobAction,
  startBookVideoConcatAction,
  startBookVideoRenderAction,
} from "@/actions/video-render";
import type { BookCanvasElement } from "@/features/book/book-canvas";
import { appLog } from "@/lib/app-log";
import type { BookListCoverPreviewPublic } from "@/server/services/books.service";
import type {
  BookListItemPublic,
  BookPublic,
} from "@/server/services/books.service";
import type {
  CreateBookDto,
  UpdateBookDto,
} from "@/server/services/books-types";
import type { CommentPublic } from "@/server/services/comments.service";
import type {
  PostAuthorPublic,
  PostPublic,
} from "@/server/services/posts.service";
// 서버 렌더 타입 — import type 이라 런타임(playwright 등)은 클라이언트 번들에 포함되지 않음
import type { RenderJobView } from "@/server/video/render-jobs";
import type {
  TwickRenderInput,
  TwickRenderSettings,
} from "@/server/video/twick-render";

type RetryableRequest = InternalAxiosRequestConfig & { _retry?: boolean };

// NEXT_PUBLIC_API_BASE_URL 이 절대 URL 이면 별도 오리진 API, 비우면 상대 /api
function normalizeApiBase(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const t = raw.trim();
  if (!t) return "";
  return t.replace(/\/$/, "");
}

// 기본값 `/api` — App Router Route Handlers
export const API_BASE_URL =
  normalizeApiBase(process.env.NEXT_PUBLIC_API_BASE_URL) || "/api";

// WebSocket 등 **오리진**(scheme+host+port)만 필요할 때. `http://host:3000/api` 처럼 path가 있으면 strip.
export function apiOrigin(): string {
  if (
    API_BASE_URL.startsWith("http://") ||
    API_BASE_URL.startsWith("https://")
  ) {
    try {
      return new URL(API_BASE_URL).origin;
    } catch {
      return API_BASE_URL.replace(/\/$/, "");
    }
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

export type PostAuthor = PostAuthorPublic;

/** 목록 한 번에 가져오는 글 수(무한 스크롤 페이지 크기) */
const POST_PAGE_DEFAULT = 12;

export type PostMediaItem = {
  id: number;
  kind: "image" | "video";
  url: string;
  posterUrl: string | null;
};

export type Post = PostPublic;

export type PostLikeState = { likeCount: number; likedByMe: boolean };

/** 계층 댓글(무한 depth; replies가 비어 있을 수 있음) */
export type PostComment = CommentPublic;

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
  timeout: 30_000,
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
      { withCredentials: true, timeout: 30_000 },
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

export type OrgListItem = {
  id: number;
  name: string;
  parentId: number | null;
  memberCount: number;
};

export type OrgMemberItem = {
  userId: number;
  email: string;
  name: string;
  imageUrl: string | null;
  role: "admin" | "member";
};

export type OrgCapabilities = {
  isSuperOrgAdmin: boolean;
  adminOrganizationIds: number[];
  memberOrganizationIds: number[];
};

export async function fetchOrgCapabilities(): Promise<OrgCapabilities> {
  try {
    const { data } = await api.get<OrgCapabilities>("/orgs", {
      params: { capabilities: "1" },
    });
    return data;
  } catch (e) {
    rethrowAsApiError(e);
  }
}

export async function fetchOrganizations(): Promise<OrgListItem[]> {
  try {
    const { data } = await api.get<{ items: OrgListItem[] }>("/orgs");
    return data.items;
  } catch (e) {
    rethrowAsApiError(e);
  }
}

export async function createOrganization(input: {
  name: string;
  parentId?: number | null;
}): Promise<OrgListItem> {
  try {
    const { data } = await api.post<OrgListItem>("/orgs", {
      name: input.name,
      parentId: input.parentId ?? null,
    });
    return data;
  } catch (e) {
    rethrowAsApiError(e);
  }
}

export async function renameOrganization(
  id: number,
  name: string,
): Promise<OrgListItem> {
  try {
    const { data } = await api.patch<OrgListItem>(`/orgs/${id}`, { name });
    return data;
  } catch (e) {
    rethrowAsApiError(e);
  }
}

export async function deleteOrganization(id: number): Promise<void> {
  try {
    await api.delete(`/orgs/${id}`);
  } catch (e) {
    rethrowAsApiError(e);
  }
}

export async function fetchOrgMembers(orgId: number): Promise<OrgMemberItem[]> {
  try {
    const { data } = await api.get<{ items: OrgMemberItem[] }>(
      `/orgs/${orgId}/members`,
    );
    return data.items;
  } catch (e) {
    rethrowAsApiError(e);
  }
}

export async function addOrgMember(
  orgId: number,
  input: { email: string; role?: "admin" | "member" },
): Promise<OrgMemberItem> {
  try {
    const { data } = await api.post<OrgMemberItem>(`/orgs/${orgId}/members`, {
      email: input.email.trim(),
      role: input.role ?? "member",
    });
    return data;
  } catch (e) {
    rethrowAsApiError(e);
  }
}

export async function setOrgMemberRole(
  orgId: number,
  userId: number,
  role: "admin" | "member",
): Promise<OrgMemberItem> {
  try {
    const { data } = await api.patch<OrgMemberItem>(
      `/orgs/${orgId}/members/${userId}`,
      { role },
    );
    return data;
  } catch (e) {
    rethrowAsApiError(e);
  }
}

export async function removeOrgMember(
  orgId: number,
  userId: number,
): Promise<void> {
  try {
    await api.delete(`/orgs/${orgId}/members/${userId}`);
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
  return runAction(() =>
    listPostsAction({
      take: params?.take ?? POST_PAGE_DEFAULT,
      ...(params?.cursor ? { cursor: params.cursor } : {}),
      ...(search ? { search } : {}),
      ...(category ? { category } : {}),
    }),
  );
}

export { POST_PAGE_DEFAULT };

/** 단일 글 상세(공개) */
export async function fetchPost(id: number): Promise<Post> {
  return runAction(() => getPostAction(id));
}

/** 글 댓글 트리(공개) */
export async function fetchPostComments(
  postId: number,
): Promise<PostComment[]> {
  return runAction(() => fetchPostCommentsAction(postId));
}

/** JWT 필요; 새 댓글·대댓글(parentId) */
export async function createPostComment(
  postId: number,
  input: { content: string; parentId?: number },
): Promise<PostComment> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  return runAction(() => createPostCommentAction(postId, input));
}

/** JWT·작성자만 */
export async function deletePostComment(
  postId: number,
  commentId: number,
): Promise<void> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  await runAction(() => deletePostCommentAction(postId, commentId));
}

/** JWT 필요; 응답으로 최종 좋아요 수·내 좋아요 여부 */
export async function likePost(id: number): Promise<PostLikeState> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  return runAction(() => likePostAction(id));
}

/** JWT 필요 */
export async function unlikePost(id: number): Promise<PostLikeState> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  return runAction(() => unlikePostAction(id));
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
  return runAction(() => createPostAction(fd));
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
  return runAction(() => updatePostAction(id, fd));
}

/** JWT·작성자만 */
export async function deletePost(id: number): Promise<void> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  await runAction(() => deletePostAction(id));
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

// 서버 액션 직렬화 결과와 동일한 클라이언트용 고양이 DTO
export type Cat = {
  id: number; // DB PK
  name: string; // 표시 이름
  age: number; // 0~40
  breed: string; // 품종(빈 값은 서버에서 mixed)
  imageUrl: string | null; // `/uploads/cat-images/...` 또는 null
  ownerId: number | null; // 등록자 user id; 레거시 행은 null
  createdAt: string; // ISO 8601 (서버에서 toISOString)
  updatedAt: string; // ISO 8601
};

// --- Books (슬라이드 / Konva) ---

export type { BookCanvasElement } from "@/features/book/book-canvas";

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
  /** false면 미리보기(슬라이드쇼) 재생 목록에서 제외(기본 true) */
  presentationVisible?: boolean;
};

/** 북 목록 카드 — 첫 슬라이드 썸네일 합성용 */
// 서버 DTO를 단일 출처로 삼는다(타입 전용 import 라 런타임에는 지워진다)
export type BookListCoverPreview = BookListCoverPreviewPublic;

export type BookListItem = BookListItemPublic;

/** 승인 워크플로: draft(작성 중) → review(검토 중) → published(게시됨) */
export type BookStatus = "draft" | "review" | "published";

export const BOOK_STATUS_LABEL: Record<BookStatus, string> = {
  draft: "작성 중",
  review: "검토 중",
  published: "게시됨",
};

export type BookDetail = BookPublic;

/** 북 공유 대상으로 고를 수 있는 회원 */
export type BookShareUser = {
  id: number;
  name: string;
  email: string;
  imageUrl: string | null;
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
  /** true면 게시된 북만(커뮤니티 갤러리) */
  publishedOnly?: boolean;
}): Promise<BooksPageResponse> {
  const search = params?.search?.trim();
  return runAction(() =>
    listBooksAction({
      skip: params?.skip ?? 0,
      take: params?.take ?? BOOK_PAGE_DEFAULT,
      ...(search ? { search } : {}),
      ...(params?.publishedOnly ? { publishedOnly: true } : {}),
    }),
  );
}

export { BOOK_PAGE_DEFAULT };

export async function fetchBook(id: number): Promise<BookDetail> {
  return runAction(() => getBookAction(id));
}

/**
 * 재배포 후 열린 탭이 이전 빌드의 서버 액션 id를 호출하면 Next가
 * "Server Action ... was not found" / React #441 같은 낯선 오류를 던진다 —
 * 사용자가 조치할 수 있는 안내(새로고침)로 바꾼다.
 */
export function humanizeServerActionError(e: unknown): Error {
  const msg = e instanceof Error ? e.message : String(e);
  if (
    /Server Action .* was not found|Failed to find Server Action/i.test(msg)
  ) {
    return new Error(
      "앱이 새 버전으로 배포되었습니다. 페이지를 새로고침한 뒤 다시 시도해 주세요.",
    );
  }
  // 프로덕션에서 서버 액션이 던진 오류는 상세가 가려진 채 React #441로 도착한다 —
  // 배포 불일치가 아니라 서버 쪽 오류일 수 있으므로 "새 버전 배포"로 단정하지 않는다
  if (/Minified React error #441/i.test(msg)) {
    return new Error(
      "요청 처리에 실패했습니다. 잠시 후 다시 시도하고, 계속되면 페이지를 새로고침해 주세요.",
    );
  }
  return e instanceof Error ? e : new Error(msg);
}

/** 모든 서버 액션 호출 공통 래퍼 — 위 오류 변환을 한 곳에서 적용 */
async function runAction<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (e) {
    throw humanizeServerActionError(e);
  }
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
  return runAction(() => createBookAction(input as CreateBookDto));
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
  const lines = await runAction(() => fetchBookAiChatAction(bookId));
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
  return runAction(() => requestBookLayoutAiAction(body));
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
  return runAction(() => updateBookAction(id, input as UpdateBookDto));
}

/** 공유 대상 회원 목록(로그인 필요) */
export async function fetchBookShareUsers(): Promise<BookShareUser[]> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  return runAction(() => listBookShareUsersAction());
}

/** 북 공유 추가/해제 — 갱신된 북(sharedUserIds 포함) 반환 */
export async function setBookShare(
  bookId: number,
  userId: number,
  shared: boolean,
): Promise<BookDetail> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  return runAction(() => setBookShareAction(bookId, userId, shared));
}

/** 승인 워크플로 상태 전환 — 갱신된 북 반환 */
export async function setBookStatus(
  bookId: number,
  status: BookStatus,
): Promise<BookDetail> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  return runAction(() => setBookStatusAction(bookId, status));
}

// --- 북 감사 로그(누가 언제 무엇을) ---

export type BookAuditLog = {
  id: number;
  bookId: number;
  bookTitle: string;
  action: "create" | "update" | "delete" | "share" | "status";
  detail: string;
  actorId: number | null;
  actorName: string;
  createdAt: string;
};

export const BOOK_AUDIT_ACTION_LABEL: Record<BookAuditLog["action"], string> = {
  create: "생성",
  update: "저장",
  delete: "삭제",
  share: "공유",
  status: "상태",
};

/** 한 북의 이력(로그인 필요, 최신순) */
export async function fetchBookAudit(bookId: number): Promise<BookAuditLog[]> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  return runAction(() => listBookAuditAction(bookId)) as unknown as Promise<
    BookAuditLog[]
  >;
}

/** 전체 최근 활동(대시보드, 로그인 필요) */
export async function fetchRecentBookAudit(): Promise<BookAuditLog[]> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  return runAction(() => listRecentBookAuditAction()) as unknown as Promise<
    BookAuditLog[]
  >;
}

/** 북 모든 사용자 공유 켜기/끄기 — 작성자·관리자만 */
export async function setBookShareAll(
  bookId: number,
  shared: boolean,
): Promise<BookDetail> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  return runAction(() => setBookShareAllAction(bookId, shared));
}

// --- 북 미디어 라이브러리(서버 보관 목록 + 파일별 공유) ---

export type BookMediaLibraryItemDto = {
  id: number;
  kind: "image" | "video";
  src: string;
  posterSrc: string | null;
  ownerId: number;
  ownerName: string;
  sharedToAll: boolean;
  sharedUserIds: number[];
};

export type BookMediaLibraryDto = {
  /** 이 북의 라이브러리 항목(최신순) */
  items: BookMediaLibraryItemDto[];
  /** 다른 사용자가 나에게(또는 전체에) 공유한 파일 */
  sharedItems: BookMediaLibraryItemDto[];
};

export async function fetchBookMediaLibrary(
  bookId: number,
): Promise<BookMediaLibraryDto> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  return runAction(() => listBookMediaLibraryAction(bookId));
}

/** 업로드 결과를 서버 라이브러리에 기록 — 갱신된 목록 반환 */
export async function addBookMediaLibraryItem(
  bookId: number,
  input: { kind: "image" | "video"; src: string; posterSrc?: string | null },
): Promise<BookMediaLibraryDto> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  return runAction(() => addBookMediaLibraryItemAction(bookId, input));
}

/** 라이브러리 목록에서 제거 — 업로드한 사용자·관리자만 */
export async function removeBookMediaLibraryItem(
  mediaId: number,
): Promise<void> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  await runAction(() => removeBookMediaLibraryItemAction(mediaId));
}

/** 미디어 파일 특정 회원 공유 추가/해제 */
export async function setBookMediaShare(
  mediaId: number,
  userId: number,
  shared: boolean,
): Promise<void> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  await runAction(() => setBookMediaShareAction(mediaId, userId, shared));
}

/** 미디어 파일 모든 사용자 공유 켜기/끄기 */
export async function setBookMediaShareAll(
  mediaId: number,
  shared: boolean,
): Promise<void> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  await runAction(() => setBookMediaShareAllAction(mediaId, shared));
}

export async function deleteBook(id: number): Promise<void> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  await runAction(() => deleteBookAction(id));
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
  return runAction(() => uploadBookMediaAction(bookId, fd));
}

// --- 서버측 비디오 렌더(헤드리스 Chromium) ---

/** 렌더 잡 시작 → jobId. 실제 렌더는 서버에서 진행되고 클라는 진행률을 폴링한다. */
export async function startBookVideoRender(
  bookId: number,
  input: TwickRenderInput,
  settings: TwickRenderSettings,
): Promise<{ jobId: string }> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  return runAction(() => startBookVideoRenderAction(bookId, input, settings));
}

/** 업로드된 비디오들을 순서대로 이어붙이는 잡 시작 — 진행 조회는 getBookVideoRenderJob 공용 */
export async function startBookVideoConcat(
  bookId: number,
  urls: string[],
): Promise<{ jobId: string }> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  return runAction(() => startBookVideoConcatAction(bookId, urls));
}

/** 렌더 잡 상태·진행률·결과 조회 */
export async function getBookVideoRenderJob(
  jobId: string,
): Promise<RenderJobView> {
  const token = getAccessToken();
  if (!token) throw new Error("로그인이 필요합니다.");
  return runAction(() => getBookVideoRenderJobAction(jobId));
}
