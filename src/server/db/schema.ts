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
    userId: integer("userId").notNull(),
    tokenHash: varchar("tokenHash", { length: 64 }).notNull().unique(),
    expiresAt: timestamp("expiresAt", { mode: "date" }).notNull(),
  },
  (t) => [index("refresh_token_userId_idx").on(t.userId)],
);

export const post = pgTable("post", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 500 }).notNull(),
  content: text("content").notNull(),
  category: varchar("category", { length: 32 }).notNull().default("general"),
  authorId: integer("authorId").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

export const postAttachment = pgTable("post_attachment", {
  id: serial("id").primaryKey(),
  postId: integer("postId").notNull(),
  sortOrder: integer("sortOrder").notNull(),
  kind: varchar("kind", { length: 8 }).notNull(),
  fileFilename: varchar("fileFilename", { length: 255 }).notNull(),
  posterFilename: varchar("posterFilename", { length: 255 }),
});

export const postComment = pgTable("post_comment", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  postId: integer("postId").notNull(),
  authorId: integer("authorId").notNull(),
  parentId: integer("parentId"),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

export const postLike = pgTable(
  "post_like",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId").notNull(),
    postId: integer("postId").notNull(),
    createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  },
  (t) => [unique().on(t.userId, t.postId)],
);

export const book = pgTable("book", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  slideWidth: integer("slideWidth").notNull().default(960),
  slideHeight: integer("slideHeight").notNull().default(540),
  presentationLoop: boolean("presentationLoop").notNull().default(true),
  authorId: integer("authorId").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

export const bookPage = pgTable("book_page", {
  id: serial("id").primaryKey(),
  bookId: integer("bookId").notNull(),
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
});

export const bookAiChatMessage = pgTable("book_ai_chat_message", {
  id: serial("id").primaryKey(),
  bookId: integer("bookId").notNull(),
  role: varchar("role", { length: 16 }).notNull(),
  body: text("body").notNull(),
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
});

// 학습용 Cats CRUD 테이블(`CatsService`가 사용)
export const studyCats = pgTable("study_cats", {
  id: serial("id").primaryKey(), // 자동 증가 PK
  name: varchar("name", { length: 255 }).notNull(), // 고양이 이름
  age: integer("age").notNull().default(1), // 생략 시 1
  breed: varchar("breed", { length: 255 }).notNull().default("mixed"), // 품종
  ownerId: integer("ownerId"), // user.id FK; 옛 데이터는 null 가능
  imageFilename: varchar("imageFilename", { length: 255 }), // 디스크 파일명만 저장
  createdAt: timestamp("createdAt", { mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date" }).notNull().defaultNow(),
});

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
