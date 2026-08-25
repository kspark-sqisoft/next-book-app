-- creta_* 베이스라인 — 0002 시점의 creta 테이블 5종을 생성한다.
--
-- 배경: 이 테이블들은 과거 `db:push`로만 반영되어 마이그레이션 이력이 없었고(0002 주석 참고),
-- 그 결과 push를 거치지 않은 DB(신규 볼륨·CI·도커 프로덕션)에서는 테이블이 아예 만들어지지 않아
-- 0003의 `ALTER TABLE "creta_device"`가 `relation does not exist`로 실패했다.
-- 마이그레이션 체인만으로 스키마를 완성할 수 있도록 0002와 0003 사이에 끼워 넣는다.
--
-- push로 이미 테이블이 있는 DB에서도 안전하도록 전부 멱등(IF NOT EXISTS / 중복 제약 무시)으로 작성.
CREATE TABLE IF NOT EXISTS "creta_playlist" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"description" varchar(300) DEFAULT '' NOT NULL,
	"loop" boolean DEFAULT true NOT NULL,
	"visibility" varchar(20) DEFAULT '전체 공개' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "creta_schedule" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"defaultSourceType" varchar(16) DEFAULT 'none' NOT NULL,
	"defaultBookId" integer,
	"defaultPlaylistId" integer,
	"autoApply" boolean DEFAULT true NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "creta_device" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"location" varchar(120) DEFAULT '' NOT NULL,
	"platform" varchar(40) DEFAULT 'Windows' NOT NULL,
	"resolution" varchar(20) DEFAULT '1920×1080' NOT NULL,
	"orientation" varchar(8) DEFAULT '가로' NOT NULL,
	"online" boolean DEFAULT true NOT NULL,
	"sourceType" varchar(16) DEFAULT 'none' NOT NULL,
	"sourceBookId" integer,
	"sourcePlaylistId" integer,
	"sourceScheduleId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "creta_playlist_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"playlistId" integer NOT NULL,
	"bookId" integer NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "creta_schedule_slot" (
	"id" serial PRIMARY KEY NOT NULL,
	"scheduleId" integer NOT NULL,
	"startMin" integer NOT NULL,
	"endMin" integer NOT NULL,
	"sourceType" varchar(16) NOT NULL,
	"bookId" integer,
	"playlistId" integer,
	"repeat" varchar(16) DEFAULT 'once' NOT NULL,
	"repeatStart" varchar(10),
	"repeatEnd" varchar(10)
);
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "creta_schedule" ADD CONSTRAINT "creta_schedule_defaultBookId_book_id_fk" FOREIGN KEY ("defaultBookId") REFERENCES "public"."book"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "creta_schedule" ADD CONSTRAINT "creta_schedule_defaultPlaylistId_creta_playlist_id_fk" FOREIGN KEY ("defaultPlaylistId") REFERENCES "public"."creta_playlist"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "creta_device" ADD CONSTRAINT "creta_device_sourceBookId_book_id_fk" FOREIGN KEY ("sourceBookId") REFERENCES "public"."book"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "creta_device" ADD CONSTRAINT "creta_device_sourcePlaylistId_creta_playlist_id_fk" FOREIGN KEY ("sourcePlaylistId") REFERENCES "public"."creta_playlist"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "creta_device" ADD CONSTRAINT "creta_device_sourceScheduleId_creta_schedule_id_fk" FOREIGN KEY ("sourceScheduleId") REFERENCES "public"."creta_schedule"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "creta_playlist_item" ADD CONSTRAINT "creta_playlist_item_playlistId_creta_playlist_id_fk" FOREIGN KEY ("playlistId") REFERENCES "public"."creta_playlist"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "creta_playlist_item" ADD CONSTRAINT "creta_playlist_item_bookId_book_id_fk" FOREIGN KEY ("bookId") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "creta_schedule_slot" ADD CONSTRAINT "creta_schedule_slot_scheduleId_creta_schedule_id_fk" FOREIGN KEY ("scheduleId") REFERENCES "public"."creta_schedule"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "creta_schedule_slot" ADD CONSTRAINT "creta_schedule_slot_bookId_book_id_fk" FOREIGN KEY ("bookId") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
	ALTER TABLE "creta_schedule_slot" ADD CONSTRAINT "creta_schedule_slot_playlistId_creta_playlist_id_fk" FOREIGN KEY ("playlistId") REFERENCES "public"."creta_playlist"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "creta_playlist_item_playlistId_position_idx" ON "creta_playlist_item" USING btree ("playlistId","position");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "creta_schedule_slot_scheduleId_startMin_idx" ON "creta_schedule_slot" USING btree ("scheduleId","startMin");
