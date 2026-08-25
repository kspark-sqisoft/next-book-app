CREATE TABLE "creta_video_wall" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"mode" varchar(12) DEFAULT 'tile' NOT NULL,
	"rows" integer DEFAULT 1 NOT NULL,
	"cols" integer DEFAULT 2 NOT NULL,
	"bookId" integer,
	"slideSec" integer DEFAULT 8 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creta_video_wall_member" (
	"id" serial PRIMARY KEY NOT NULL,
	"wallId" integer NOT NULL,
	"deviceId" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"isMaster" boolean DEFAULT false NOT NULL,
	"bookId" integer,
	CONSTRAINT "creta_video_wall_member_wallId_deviceId_unique" UNIQUE("wallId","deviceId")
);
--> statement-breakpoint
ALTER TABLE "creta_video_wall" ADD CONSTRAINT "creta_video_wall_bookId_book_id_fk" FOREIGN KEY ("bookId") REFERENCES "public"."book"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creta_video_wall_member" ADD CONSTRAINT "creta_video_wall_member_wallId_creta_video_wall_id_fk" FOREIGN KEY ("wallId") REFERENCES "public"."creta_video_wall"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creta_video_wall_member" ADD CONSTRAINT "creta_video_wall_member_deviceId_creta_device_id_fk" FOREIGN KEY ("deviceId") REFERENCES "public"."creta_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creta_video_wall_member" ADD CONSTRAINT "creta_video_wall_member_bookId_book_id_fk" FOREIGN KEY ("bookId") REFERENCES "public"."book"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "creta_video_wall_member_wallId_idx" ON "creta_video_wall_member" USING btree ("wallId");