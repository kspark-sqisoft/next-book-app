ALTER TABLE "creta_device" ADD COLUMN "volume" integer DEFAULT 70 NOT NULL;--> statement-breakpoint
ALTER TABLE "creta_device" ADD COLUMN "brightness" integer DEFAULT 80 NOT NULL;--> statement-breakpoint
ALTER TABLE "creta_device" ADD COLUMN "playerVersion" varchar(20) DEFAULT 'v1.1.0' NOT NULL;