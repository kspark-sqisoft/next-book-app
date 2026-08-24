CREATE TABLE "creta_playlist_share" (
	"id" serial PRIMARY KEY NOT NULL,
	"playlistId" integer NOT NULL,
	"userId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "creta_playlist_share_playlistId_userId_unique" UNIQUE("playlistId","userId")
);
--> statement-breakpoint
CREATE TABLE "creta_schedule_share" (
	"id" serial PRIMARY KEY NOT NULL,
	"scheduleId" integer NOT NULL,
	"userId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "creta_schedule_share_scheduleId_userId_unique" UNIQUE("scheduleId","userId")
);
--> statement-breakpoint
ALTER TABLE "creta_playlist" ADD COLUMN "ownerId" integer;--> statement-breakpoint
ALTER TABLE "creta_schedule" ADD COLUMN "ownerId" integer;--> statement-breakpoint
ALTER TABLE "creta_playlist_share" ADD CONSTRAINT "creta_playlist_share_playlistId_creta_playlist_id_fk" FOREIGN KEY ("playlistId") REFERENCES "public"."creta_playlist"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creta_playlist_share" ADD CONSTRAINT "creta_playlist_share_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creta_schedule_share" ADD CONSTRAINT "creta_schedule_share_scheduleId_creta_schedule_id_fk" FOREIGN KEY ("scheduleId") REFERENCES "public"."creta_schedule"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creta_schedule_share" ADD CONSTRAINT "creta_schedule_share_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "creta_playlist_share_playlistId_idx" ON "creta_playlist_share" USING btree ("playlistId");--> statement-breakpoint
CREATE INDEX "creta_schedule_share_scheduleId_idx" ON "creta_schedule_share" USING btree ("scheduleId");--> statement-breakpoint
ALTER TABLE "creta_playlist" ADD CONSTRAINT "creta_playlist_ownerId_user_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creta_schedule" ADD CONSTRAINT "creta_schedule_ownerId_user_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;