CREATE TABLE "creta_ad_campaign" (
	"id" serial PRIMARY KEY NOT NULL,
	"advertiserId" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"status" varchar(12) DEFAULT 'live' NOT NULL,
	"startDate" varchar(10) NOT NULL,
	"endDate" varchar(10) NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"cpm" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creta_ad_creative" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaignId" integer NOT NULL,
	"name" varchar(120) NOT NULL,
	"kind" varchar(8) NOT NULL,
	"src" varchar(512) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creta_ad_play_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"campaignId" integer NOT NULL,
	"campaignName" varchar(120) NOT NULL,
	"creativeId" integer NOT NULL,
	"creativeName" varchar(120) NOT NULL,
	"bookId" integer,
	"slotElementId" varchar(80) NOT NULL,
	"playedAt" timestamp DEFAULT now() NOT NULL,
	"durationSec" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "creta_advertiser" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(120) NOT NULL,
	"contact" varchar(200) DEFAULT '' NOT NULL,
	"ownerId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creta_ad_campaign" ADD CONSTRAINT "creta_ad_campaign_advertiserId_creta_advertiser_id_fk" FOREIGN KEY ("advertiserId") REFERENCES "public"."creta_advertiser"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creta_ad_creative" ADD CONSTRAINT "creta_ad_creative_campaignId_creta_ad_campaign_id_fk" FOREIGN KEY ("campaignId") REFERENCES "public"."creta_ad_campaign"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creta_advertiser" ADD CONSTRAINT "creta_advertiser_ownerId_user_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "creta_ad_campaign_advertiserId_idx" ON "creta_ad_campaign" USING btree ("advertiserId");--> statement-breakpoint
CREATE INDEX "creta_ad_creative_campaignId_idx" ON "creta_ad_creative" USING btree ("campaignId");--> statement-breakpoint
CREATE INDEX "creta_ad_play_log_campaignId_playedAt_idx" ON "creta_ad_play_log" USING btree ("campaignId","playedAt");--> statement-breakpoint
CREATE INDEX "creta_ad_play_log_playedAt_idx" ON "creta_ad_play_log" USING btree ("playedAt");