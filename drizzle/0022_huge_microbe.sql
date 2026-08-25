CREATE TABLE "creta_ad_campaign_target" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaignId" integer NOT NULL,
	"tag" varchar(40) NOT NULL,
	CONSTRAINT "creta_ad_campaign_target_campaignId_tag_unique" UNIQUE("campaignId","tag")
);
--> statement-breakpoint
ALTER TABLE "creta_ad_play_log" ADD COLUMN "deviceId" integer;--> statement-breakpoint
ALTER TABLE "creta_ad_play_log" ADD COLUMN "deviceName" varchar(120);--> statement-breakpoint
ALTER TABLE "creta_ad_campaign_target" ADD CONSTRAINT "creta_ad_campaign_target_campaignId_creta_ad_campaign_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."creta_ad_campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "creta_ad_campaign_target_campaignId_idx" ON "creta_ad_campaign_target" USING btree ("campaignId");--> statement-breakpoint
CREATE INDEX "creta_ad_play_log_deviceId_playedAt_idx" ON "creta_ad_play_log" USING btree ("deviceId","playedAt");