CREATE TABLE "creta_play_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"deviceId" integer NOT NULL,
	"contentKind" varchar(16) NOT NULL,
	"contentId" integer,
	"contentTitle" varchar(200) NOT NULL,
	"startedAt" timestamp NOT NULL,
	"durationSec" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creta_play_log" ADD CONSTRAINT "creta_play_log_deviceId_creta_device_id_fk" FOREIGN KEY ("deviceId") REFERENCES "public"."creta_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "creta_play_log_deviceId_startedAt_idx" ON "creta_play_log" USING btree ("deviceId","startedAt");--> statement-breakpoint
CREATE INDEX "creta_play_log_startedAt_idx" ON "creta_play_log" USING btree ("startedAt");