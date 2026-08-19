import { relations } from "drizzle-orm";
import {
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

export const bookRelations = relations(book, ({ one, many }) => ({
  author: one(user, { fields: [book.authorId], references: [user.id] }),
  pages: many(bookPage),
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
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

export const cretaPlaylistRelations = relations(cretaPlaylist, ({ many }) => ({
  items: many(cretaPlaylistItem),
}));

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
