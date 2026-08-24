ALTER TABLE "creta_device" ADD COLUMN "powerOnTime" varchar(5);--> statement-breakpoint
ALTER TABLE "creta_device" ADD COLUMN "powerOffTime" varchar(5);--> statement-breakpoint
ALTER TABLE "creta_device" ADD COLUMN "health" varchar(12) DEFAULT 'ok' NOT NULL;