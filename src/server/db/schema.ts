import { relations } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  unique,
  varchar,
} from "drizzle-orm/pg-core";

/** TypeORM default: class `User` → table `user` */
export const user = pgTable("user", {
  id: serial("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  role: varchar("role", { length: 16 }).notNull().default("user"),
  name: varchar("name", { length: 255 }).notNull().default(""),
  profileImageFilename: varchar("profileImageFilename", { length: 255 }),
  password: varchar("password", { length: 255 }).notNull(),
});

export const refreshToken = pgTable(
  "refresh_token",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
  },
  (t) => [index("refresh_token_userId_idx").on(t.userId)],
);

/**
 * 조직 트리(예: 현대 자동차 → 아산 공장 / 울산 공장).
 * parentId null = 최상위(대그룹).
 */
export const organization = pgTable(
  "organization",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 200 }).notNull(),
    parentId: integer("parentId").references(
      (): AnyPgColumn => organization.id,
      { onDelete: "cascade" },
    ),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("organization_parentId_idx").on(t.parentId),
    index("organization_name_idx").on(t.name),
  ],
);

/** 조직 멤버십. role: admin | member (플랫폼 user.role 과 별개) */
export const organizationMember = pgTable(
  "organization_member",
  {
    id: serial("id").primaryKey(),
    organizationId: integer("organizationId")
      .notNull()
      .references(() => organization.id, { onDelete: "cascade" }),
    userId: integer("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 16 }).notNull().default("member"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.organizationId, t.userId),
    index("organization_member_org_idx").on(t.organizationId),
    index("organization_member_user_idx").on(t.userId),
  ],
);

export const organizationRelations = relations(
  organization,
  ({ one, many }) => ({
    parent: one(organization, {
      fields: [organization.parentId],
      references: [organization.id],
      relationName: "organization_tree",
    }),
    children: many(organization, { relationName: "organization_tree" }),
    members: many(organizationMember),
  }),
);

export const organizationMemberRelations = relations(
  organizationMember,
  ({ one }) => ({
    organization: one(organization, {
      fields: [organizationMember.organizationId],
      references: [organization.id],
    }),
    user: one(user, {
      fields: [organizationMember.userId],
      references: [user.id],
    }),
  }),
);

export const post = pgTable(
  "post",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 500 }).notNull(),
    content: text("content").notNull(),
    category: varchar("category", { length: 32 }).notNull().default("general"),
    authorId: integer("authorId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("post_authorId_idx").on(t.authorId),
    // 목록 정렬(createdAt desc, id desc)이 매번 전체 정렬하지 않게
    index("post_createdAt_id_idx").on(t.createdAt, t.id),
  ],
);

export const postAttachment = pgTable(
  "post_attachment",
  {
    id: serial("id").primaryKey(),
    postId: integer("postId")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    sortOrder: integer("sortOrder").notNull(),
    kind: varchar("kind", { length: 8 }).notNull(),
    fileFilename: varchar("fileFilename", { length: 255 }).notNull(),
    posterFilename: varchar("posterFilename", { length: 255 }),
  },
  (t) => [index("post_attachment_postId_idx").on(t.postId)],
);

export const postComment = pgTable(
  "post_comment",
  {
    id: serial("id").primaryKey(),
    content: text("content").notNull(),
    postId: integer("postId")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    authorId: integer("authorId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    parentId: integer("parentId"),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("post_comment_postId_idx").on(t.postId),
    index("post_comment_authorId_idx").on(t.authorId),
    index("post_comment_parentId_idx").on(t.parentId),
  ],
);

export const postLike = pgTable(
  "post_like",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    postId: integer("postId")
      .notNull()
      .references(() => post.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.userId, t.postId),
    index("post_like_postId_idx").on(t.postId),
  ],
);

export const book = pgTable(
  "book",
  {
    id: serial("id").primaryKey(),
    title: varchar("title", { length: 200 }).notNull(),
    slideWidth: integer("slideWidth").notNull().default(960),
    slideHeight: integer("slideHeight").notNull().default(540),
    presentationLoop: boolean("presentationLoop").notNull().default(true),
    authorId: integer("authorId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // true면 모든 로그인 사용자가 공유받은 것처럼 편집 가능
    sharedToAll: boolean("sharedToAll").notNull().default(false),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("book_authorId_idx").on(t.authorId),
    index("book_updatedAt_idx").on(t.updatedAt),
  ],
);

export const bookPage = pgTable(
  "book_page",
  {
    id: serial("id").primaryKey(),
    bookId: integer("bookId")
      .notNull()
      .references(() => book.id, { onDelete: "cascade" }),
    sortOrder: integer("sortOrder").notNull(),
    slideName: varchar("slideName", { length: 120 }).notNull().default(""),
    elementsJson: text("elementsJson").notNull().default("[]"),
    backgroundColor: varchar("backgroundColor", { length: 64 })
      .notNull()
      .default("#ffffff"),
    presentationTimingElementId: varchar("presentationTimingElementId", {
      length: 80,
    }),
    presentationTransition: varchar("presentationTransition", { length: 24 })
      .notNull()
      .default("none"),
    presentationTransitionMs: integer("presentationTransitionMs")
      .notNull()
      .default(450),
    /** false면 미리보기(슬라이드쇼) 재생 목록에서 제외(편집 화면에는 흐리게 표시) */
    presentationVisible: boolean("presentationVisible").notNull().default(true),
  },
  (t) => [index("book_page_bookId_sortOrder_idx").on(t.bookId, t.sortOrder)],
);

export const bookAiChatMessage = pgTable(
  "book_ai_chat_message",
  {
    id: serial("id").primaryKey(),
    bookId: integer("bookId")
      .notNull()
      .references(() => book.id, { onDelete: "cascade" }),
    role: varchar("role", { length: 16 }).notNull(),
    body: text("body").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("book_ai_chat_message_bookId_createdAt_idx").on(
      t.bookId,
      t.createdAt,
    ),
  ],
);

// 학습용 Cats CRUD 테이블(`CatsService`가 사용)
export const studyCats = pgTable(
  "study_cats",
  {
    id: serial("id").primaryKey(), // 자동 증가 PK
    name: varchar("name", { length: 255 }).notNull(), // 고양이 이름
    age: integer("age").notNull().default(1), // 생략 시 1
    breed: varchar("breed", { length: 255 }).notNull().default("mixed"), // 품종
    // user.id FK; 옛 데이터는 null 가능 — 소유자 삭제 시 고양이는 무소유로 남김
    ownerId: integer("ownerId").references(() => user.id, {
      onDelete: "set null",
    }),
    imageFilename: varchar("imageFilename", { length: 255 }), // 디스크 파일명만 저장
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("study_cats_ownerId_idx").on(t.ownerId)],
);

// 채팅은 작성자 정보를 비정규화해 저장하는 로그성 테이블 — 사용자 삭제 시에도 기록 보존을 위해 FK 미부여
export const chatMessage = pgTable(
  "chat_message",
  {
    id: serial("id").primaryKey(),
    roomId: varchar("roomId", { length: 64 }).notNull(),
    authorId: integer("authorId").notNull(),
    authorName: varchar("authorName", { length: 80 }).notNull(),
    authorImageUrl: varchar("authorImageUrl", { length: 512 }),
    body: text("body").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [index("chat_message_roomId_createdAt_idx").on(t.roomId, t.createdAt)],
);

export const chatRoom = pgTable("chat_room", {
  id: serial("id").primaryKey(),
  roomId: varchar("roomId", { length: 64 }).notNull().unique(),
  ownerId: integer("ownerId").notNull(),
  ownerName: varchar("ownerName", { length: 80 }).notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
});

export const userRelations = relations(user, ({ many }) => ({
  posts: many(post),
  books: many(book),
}));

export const postRelations = relations(post, ({ one, many }) => ({
  author: one(user, { fields: [post.authorId], references: [user.id] }),
  attachments: many(postAttachment),
  likes: many(postLike),
  comments: many(postComment),
}));

export const postAttachmentRelations = relations(postAttachment, ({ one }) => ({
  post: one(post, { fields: [postAttachment.postId], references: [post.id] }),
}));

export const postCommentRelations = relations(postComment, ({ one, many }) => ({
  post: one(post, { fields: [postComment.postId], references: [post.id] }),
  author: one(user, { fields: [postComment.authorId], references: [user.id] }),
  parent: one(postComment, {
    fields: [postComment.parentId],
    references: [postComment.id],
    relationName: "thread",
  }),
  replies: many(postComment, { relationName: "thread" }),
}));

export const postLikeRelations = relations(postLike, ({ one }) => ({
  user: one(user, { fields: [postLike.userId], references: [user.id] }),
  post: one(post, { fields: [postLike.postId], references: [post.id] }),
}));

/** 북 공유 — 공유받은 사용자는 작성자처럼 편집(저장·업로드)할 수 있다. 삭제는 작성자·관리자만 */
export const bookShare = pgTable(
  "book_share",
  {
    id: serial("id").primaryKey(),
    bookId: integer("bookId")
      .notNull()
      .references(() => book.id, { onDelete: "cascade" }),
    userId: integer("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.bookId, t.userId),
    index("book_share_bookId_idx").on(t.bookId),
    index("book_share_userId_idx").on(t.userId),
  ],
);

/**
 * 북 미디어 라이브러리 — 업로드 파일 목록(서버 보관, 브라우저 localStorage 대체).
 * src는 업로드 URL(`/uploads/...`); 파일 자체는 디스크에 있고 행 삭제 시 목록에서만 빠진다.
 */
export const bookMediaItem = pgTable(
  "book_media_item",
  {
    id: serial("id").primaryKey(),
    bookId: integer("bookId")
      .notNull()
      .references(() => book.id, { onDelete: "cascade" }),
    ownerId: integer("ownerId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    kind: varchar("kind", { length: 8 }).notNull(), // image | video
    src: varchar("src", { length: 512 }).notNull(),
    posterSrc: varchar("posterSrc", { length: 512 }),
    // true면 모든 로그인 사용자의 라이브러리 "공유받은 파일"에 노출
    sharedToAll: boolean("sharedToAll").notNull().default(false),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("book_media_item_bookId_idx").on(t.bookId),
    index("book_media_item_ownerId_idx").on(t.ownerId),
  ],
);

/** 미디어 파일 개별 공유 — 공유받은 사용자의 라이브러리에 노출 */
export const bookMediaShare = pgTable(
  "book_media_share",
  {
    id: serial("id").primaryKey(),
    mediaId: integer("mediaId")
      .notNull()
      .references(() => bookMediaItem.id, { onDelete: "cascade" }),
    userId: integer("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.mediaId, t.userId),
    index("book_media_share_userId_idx").on(t.userId),
  ],
);

export const bookMediaItemRelations = relations(bookMediaItem, ({ one }) => ({
  book: one(book, { fields: [bookMediaItem.bookId], references: [book.id] }),
  owner: one(user, { fields: [bookMediaItem.ownerId], references: [user.id] }),
}));

export const bookMediaShareRelations = relations(bookMediaShare, ({ one }) => ({
  media: one(bookMediaItem, {
    fields: [bookMediaShare.mediaId],
    references: [bookMediaItem.id],
  }),
  user: one(user, { fields: [bookMediaShare.userId], references: [user.id] }),
}));

export const bookRelations = relations(book, ({ one, many }) => ({
  author: one(user, { fields: [book.authorId], references: [user.id] }),
  pages: many(bookPage),
  shares: many(bookShare),
}));

export const bookShareRelations = relations(bookShare, ({ one }) => ({
  book: one(book, { fields: [bookShare.bookId], references: [book.id] }),
  user: one(user, { fields: [bookShare.userId], references: [user.id] }),
}));

export const bookPageRelations = relations(bookPage, ({ one }) => ({
  book: one(book, { fields: [bookPage.bookId], references: [book.id] }),
}));

// studyCats.ownerId → user 행(선택 관계)
export const studyCatsRelations = relations(studyCats, ({ one }) => ({
  owner: one(user, { fields: [studyCats.ownerId], references: [user.id] }),
}));

// ── 크레타 사이니지: 플레이리스트·스케줄·디바이스 ────────────────────────────

// 여러 크레타북을 순서대로 묶어 재생하는 단위
export const cretaPlaylist = pgTable("creta_playlist", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  description: varchar("description", { length: 300 }).notNull().default(""),
  loop: boolean("loop").notNull().default(true),
  visibility: varchar("visibility", { length: 20 })
    .notNull()
    .default("전체 공개"),
  // 소유자. null = 공용(소유자 도입 이전 데이터 — 로그인 사용자 누구나 편집)
  ownerId: integer("ownerId").references(() => user.id, {
    onDelete: "set null",
  }),
  // true면 모든 로그인 사용자가 공유받은 것처럼 편집 가능
  sharedToAll: boolean("sharedToAll").notNull().default(false),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

// 플레이리스트에 담긴 북(순서 = position 오름차순). 북 삭제 시 항목도 제거
export const cretaPlaylistItem = pgTable(
  "creta_playlist_item",
  {
    id: serial("id").primaryKey(),
    playlistId: integer("playlistId")
      .notNull()
      .references(() => cretaPlaylist.id, { onDelete: "cascade" }),
    bookId: integer("bookId")
      .notNull()
      .references(() => book.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
  },
  (t) => [
    index("creta_playlist_item_playlistId_position_idx").on(
      t.playlistId,
      t.position,
    ),
  ],
);

// 날짜·시간대별 재생 편성표. 기본 재생(빈 시간 대체 콘텐츠)은 북/플레이리스트 참조
export const cretaSchedule = pgTable("creta_schedule", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  defaultSourceType: varchar("defaultSourceType", { length: 16 })
    .notNull()
    .default("none"), // none | book | playlist
  defaultBookId: integer("defaultBookId").references(() => book.id, {
    onDelete: "set null",
  }),
  defaultPlaylistId: integer("defaultPlaylistId").references(
    () => cretaPlaylist.id,
    { onDelete: "set null" },
  ),
  autoApply: boolean("autoApply").notNull().default(true),
  // 소유자. null = 공용(소유자 도입 이전 데이터 — 로그인 사용자 누구나 편집)
  ownerId: integer("ownerId").references(() => user.id, {
    onDelete: "set null",
  }),
  // true면 모든 로그인 사용자가 공유받은 것처럼 편집 가능
  sharedToAll: boolean("sharedToAll").notNull().default(false),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

// 스케줄의 지정 시간대(0~1440분). 참조 콘텐츠 삭제 시 시간대도 제거
export const cretaScheduleSlot = pgTable(
  "creta_schedule_slot",
  {
    id: serial("id").primaryKey(),
    scheduleId: integer("scheduleId")
      .notNull()
      .references(() => cretaSchedule.id, { onDelete: "cascade" }),
    startMin: integer("startMin").notNull(),
    endMin: integer("endMin").notNull(),
    sourceType: varchar("sourceType", { length: 16 }).notNull(), // book | playlist
    bookId: integer("bookId").references(() => book.id, {
      onDelete: "cascade",
    }),
    playlistId: integer("playlistId").references(() => cretaPlaylist.id, {
      onDelete: "cascade",
    }),
    repeat: varchar("repeat", { length: 16 }).notNull().default("once"), // once|daily|weekday|weekend|range
    repeatStart: varchar("repeatStart", { length: 10 }), // 기간 지정 시작일(YYYY-MM-DD)
    repeatEnd: varchar("repeatEnd", { length: 10 }), // 기간 지정 종료일
  },
  (t) => [
    index("creta_schedule_slot_scheduleId_startMin_idx").on(
      t.scheduleId,
      t.startMin,
    ),
  ],
);

// 사이니지 디바이스(시뮬레이션 대상). 재생 소스는 북/플레이리스트/스케줄 중 하나
export const cretaDevice = pgTable("creta_device", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  location: varchar("location", { length: 120 }).notNull().default(""),
  platform: varchar("platform", { length: 40 }).notNull().default("Windows"),
  resolution: varchar("resolution", { length: 20 })
    .notNull()
    .default("1920×1080"),
  orientation: varchar("orientation", { length: 8 }).notNull().default("가로"),
  online: boolean("online").notNull().default(true),
  sourceType: varchar("sourceType", { length: 16 }).notNull().default("none"), // none|book|playlist|schedule
  sourceBookId: integer("sourceBookId").references(() => book.id, {
    onDelete: "set null",
  }),
  sourcePlaylistId: integer("sourcePlaylistId").references(
    () => cretaPlaylist.id,
    { onDelete: "set null" },
  ),
  sourceScheduleId: integer("sourceScheduleId").references(
    () => cretaSchedule.id,
    { onDelete: "set null" },
  ),
  // 전원 예약 "HH:MM"(매일). null = 예약 없음
  powerOnTime: varchar("powerOnTime", { length: 5 }),
  powerOffTime: varchar("powerOffTime", { length: 5 }),
  // 전원 예약 제외 — 요일(0=일…6=토) CSV "0,6", 특정일(YYYY-MM-DD) CSV. null/빈 문자열 = 제외 없음
  powerExcludeDays: text("powerExcludeDays"),
  powerExcludeDates: text("powerExcludeDates"),
  // 단말 상태(시뮬레이션): ok | error — online과 별개로 "비정상 단말" 표시
  health: varchar("health", { length: 12 }).notNull().default("ok"),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

/**
 * 긴급 알림 — 대상 디바이스의 현재 재생을 덮어쓰는 공지.
 * 한 번에 하나만 활성(active=true)이고, 새 알림 발송 시 기존 활성 알림은 종료된다.
 * 해제해도 행은 이력으로 남는다(endedAt 기록).
 */
export const cretaAlert = pgTable("creta_alert", {
  id: serial("id").primaryKey(),
  message: varchar("message", { length: 300 }).notNull(),
  level: varchar("level", { length: 12 }).notNull().default("긴급"), // 긴급|주의|안내
  // true면 모든 디바이스 대상(creta_alert_device 무시)
  allDevices: boolean("allDevices").notNull().default(true),
  active: boolean("active").notNull().default(true),
  createdBy: integer("createdBy").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  endedAt: timestamp("endedAt", { mode: "date" }),
});

/** 긴급 알림 대상 디바이스(allDevices=false일 때만 사용) */
export const cretaAlertDevice = pgTable(
  "creta_alert_device",
  {
    id: serial("id").primaryKey(),
    alertId: integer("alertId")
      .notNull()
      .references(() => cretaAlert.id, { onDelete: "cascade" }),
    deviceId: integer("deviceId")
      .notNull()
      .references(() => cretaDevice.id, { onDelete: "cascade" }),
  },
  (t) => [
    unique().on(t.alertId, t.deviceId),
    index("creta_alert_device_alertId_idx").on(t.alertId),
  ],
);

/** 디바이스 태그 — 한 디바이스가 여러 태그(층·매장·방향 등)에 속하며, 태그 단위 일괄 배포에 쓴다 */
export const cretaDeviceTag = pgTable(
  "creta_device_tag",
  {
    id: serial("id").primaryKey(),
    deviceId: integer("deviceId")
      .notNull()
      .references(() => cretaDevice.id, { onDelete: "cascade" }),
    tag: varchar("tag", { length: 40 }).notNull(),
  },
  (t) => [
    unique().on(t.deviceId, t.tag),
    index("creta_device_tag_tag_idx").on(t.tag),
  ],
);

/**
 * 재생 이력(Proof-of-Play, 시뮬레이션) — 실제 플레이어가 없어, 디바이스가
 * 온라인 + 소스 지정 상태였던 구간을 리포트 조회 시점에 지연 적재(backfill)한다.
 * 콘텐츠가 삭제돼도 리포트가 유지되도록 제목을 비정규화해 저장한다.
 */
export const cretaPlayLog = pgTable(
  "creta_play_log",
  {
    id: serial("id").primaryKey(),
    deviceId: integer("deviceId")
      .notNull()
      .references(() => cretaDevice.id, { onDelete: "cascade" }),
    contentKind: varchar("contentKind", { length: 16 }).notNull(), // book|playlist|schedule
    contentId: integer("contentId"),
    contentTitle: varchar("contentTitle", { length: 200 }).notNull(),
    startedAt: timestamp("startedAt", { mode: "date" }).notNull(),
    durationSec: integer("durationSec").notNull(),
  },
  (t) => [
    index("creta_play_log_deviceId_startedAt_idx").on(t.deviceId, t.startedAt),
    index("creta_play_log_startedAt_idx").on(t.startedAt),
  ],
);

/** 플레이리스트 공유 — 공유받은 사용자는 소유자처럼 편집 가능(삭제·공유 관리는 소유자·관리자) */
export const cretaPlaylistShare = pgTable(
  "creta_playlist_share",
  {
    id: serial("id").primaryKey(),
    playlistId: integer("playlistId")
      .notNull()
      .references(() => cretaPlaylist.id, { onDelete: "cascade" }),
    userId: integer("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.playlistId, t.userId),
    index("creta_playlist_share_playlistId_idx").on(t.playlistId),
  ],
);

/** 스케줄 공유 — 위와 동일 규칙 */
export const cretaScheduleShare = pgTable(
  "creta_schedule_share",
  {
    id: serial("id").primaryKey(),
    scheduleId: integer("scheduleId")
      .notNull()
      .references(() => cretaSchedule.id, { onDelete: "cascade" }),
    userId: integer("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.scheduleId, t.userId),
    index("creta_schedule_share_scheduleId_idx").on(t.scheduleId),
  ],
);

export const cretaPlaylistRelations = relations(cretaPlaylist, ({ many }) => ({
  items: many(cretaPlaylistItem),
  shares: many(cretaPlaylistShare),
}));

export const cretaPlaylistShareRelations = relations(
  cretaPlaylistShare,
  ({ one }) => ({
    playlist: one(cretaPlaylist, {
      fields: [cretaPlaylistShare.playlistId],
      references: [cretaPlaylist.id],
    }),
    user: one(user, {
      fields: [cretaPlaylistShare.userId],
      references: [user.id],
    }),
  }),
);

export const cretaScheduleShareRelations = relations(
  cretaScheduleShare,
  ({ one }) => ({
    schedule: one(cretaSchedule, {
      fields: [cretaScheduleShare.scheduleId],
      references: [cretaSchedule.id],
    }),
    user: one(user, {
      fields: [cretaScheduleShare.userId],
      references: [user.id],
    }),
  }),
);

/**
 * 커뮤니티 댓글(북·플레이리스트 대상, 2단: 루트 + 답글). 대상 삭제 시 서비스에서 정리,
 * 부모 댓글 삭제 시 답글은 cascade.
 */
export const cretaComment = pgTable(
  "creta_comment",
  {
    id: serial("id").primaryKey(),
    targetKind: varchar("targetKind", { length: 16 }).notNull(), // book | playlist
    targetId: integer("targetId").notNull(),
    parentId: integer("parentId").references(
      (): AnyPgColumn => cretaComment.id,
      {
        onDelete: "cascade",
      },
    ),
    userId: integer("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    content: varchar("content", { length: 2000 }).notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    index("creta_comment_target_idx").on(t.targetKind, t.targetId),
    index("creta_comment_parentId_idx").on(t.parentId),
  ],
);

export const cretaCommentRelations = relations(cretaComment, ({ one }) => ({
  user: one(user, { fields: [cretaComment.userId], references: [user.id] }),
}));

/** 커뮤니티 좋아요(북·플레이리스트 대상). 사용자당 대상 하나에 1회 */
export const cretaLike = pgTable(
  "creta_like",
  {
    id: serial("id").primaryKey(),
    targetKind: varchar("targetKind", { length: 16 }).notNull(), // book | playlist
    targetId: integer("targetId").notNull(),
    userId: integer("userId")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [
    unique().on(t.targetKind, t.targetId, t.userId),
    index("creta_like_target_idx").on(t.targetKind, t.targetId),
  ],
);

export const cretaPlaylistItemRelations = relations(
  cretaPlaylistItem,
  ({ one }) => ({
    playlist: one(cretaPlaylist, {
      fields: [cretaPlaylistItem.playlistId],
      references: [cretaPlaylist.id],
    }),
    book: one(book, {
      fields: [cretaPlaylistItem.bookId],
      references: [book.id],
    }),
  }),
);

export const cretaScheduleRelations = relations(cretaSchedule, ({ many }) => ({
  slots: many(cretaScheduleSlot),
}));

export const cretaScheduleSlotRelations = relations(
  cretaScheduleSlot,
  ({ one }) => ({
    schedule: one(cretaSchedule, {
      fields: [cretaScheduleSlot.scheduleId],
      references: [cretaSchedule.id],
    }),
  }),
);
