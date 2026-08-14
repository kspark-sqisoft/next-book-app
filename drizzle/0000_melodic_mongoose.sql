CREATE TABLE "book" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(200) NOT NULL,
	"slideWidth" integer DEFAULT 960 NOT NULL,
	"slideHeight" integer DEFAULT 540 NOT NULL,
	"presentationLoop" boolean DEFAULT true NOT NULL,
	"authorId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_ai_chat_message" (
	"id" serial PRIMARY KEY NOT NULL,
	"bookId" integer NOT NULL,
	"role" varchar(16) NOT NULL,
	"body" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_page" (
	"id" serial PRIMARY KEY NOT NULL,
	"bookId" integer NOT NULL,
	"sortOrder" integer NOT NULL,
	"slideName" varchar(120) DEFAULT '' NOT NULL,
	"elementsJson" text DEFAULT '[]' NOT NULL,
	"backgroundColor" varchar(64) DEFAULT '#ffffff' NOT NULL,
	"presentationTimingElementId" varchar(80),
	"presentationTransition" varchar(24) DEFAULT 'none' NOT NULL,
	"presentationTransitionMs" integer DEFAULT 450 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_message" (
	"id" serial PRIMARY KEY NOT NULL,
	"roomId" varchar(64) NOT NULL,
	"authorId" integer NOT NULL,
	"authorName" varchar(80) NOT NULL,
	"authorImageUrl" varchar(512),
	"body" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_room" (
	"id" serial PRIMARY KEY NOT NULL,
	"roomId" varchar(64) NOT NULL,
	"ownerId" integer NOT NULL,
	"ownerName" varchar(80) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chat_room_roomId_unique" UNIQUE("roomId")
);
--> statement-breakpoint
CREATE TABLE "post" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(500) NOT NULL,
	"content" text NOT NULL,
	"category" varchar(32) DEFAULT 'general' NOT NULL,
	"authorId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_attachment" (
	"id" serial PRIMARY KEY NOT NULL,
	"postId" integer NOT NULL,
	"sortOrder" integer NOT NULL,
	"kind" varchar(8) NOT NULL,
	"fileFilename" varchar(255) NOT NULL,
	"posterFilename" varchar(255)
);
--> statement-breakpoint
CREATE TABLE "post_comment" (
	"id" serial PRIMARY KEY NOT NULL,
	"content" text NOT NULL,
	"postId" integer NOT NULL,
	"authorId" integer NOT NULL,
	"parentId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "post_like" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"postId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "post_like_userId_postId_unique" UNIQUE("userId","postId")
);
--> statement-breakpoint
CREATE TABLE "refresh_token" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"tokenHash" varchar(64) NOT NULL,
	"expiresAt" timestamp NOT NULL,
	CONSTRAINT "refresh_token_tokenHash_unique" UNIQUE("tokenHash")
);
--> statement-breakpoint
CREATE TABLE "study_cats" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"age" integer DEFAULT 1 NOT NULL,
	"breed" varchar(255) DEFAULT 'mixed' NOT NULL,
	"ownerId" integer,
	"imageFilename" varchar(255),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(255) NOT NULL,
	"role" varchar(16) DEFAULT 'user' NOT NULL,
	"name" varchar(255) DEFAULT '' NOT NULL,
	"profileImageFilename" varchar(255),
	"password" varchar(255) NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "chat_message_roomId_createdAt_idx" ON "chat_message" USING btree ("roomId","createdAt");--> statement-breakpoint
CREATE INDEX "refresh_token_userId_idx" ON "refresh_token" USING btree ("userId");