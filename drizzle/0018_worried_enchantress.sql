CREATE TABLE "creta_ad_setting" (
	"id" serial PRIMARY KEY NOT NULL,
	"loopEveryN" integer DEFAULT 0 NOT NULL,
	"spotSec" integer DEFAULT 15 NOT NULL,
	"houseName" varchar(120) DEFAULT '' NOT NULL,
	"houseKind" varchar(8) DEFAULT 'image' NOT NULL,
	"houseSrc" varchar(512) DEFAULT '' NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creta_ad_campaign" ADD COLUMN "dayTarget" varchar(8) DEFAULT 'all' NOT NULL;--> statement-breakpoint
ALTER TABLE "creta_ad_campaign" ADD COLUMN "startMin" integer;--> statement-breakpoint
ALTER TABLE "creta_ad_campaign" ADD COLUMN "endMin" integer;