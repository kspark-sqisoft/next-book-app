CREATE TABLE "creta_ad_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"entityKind" varchar(12) NOT NULL,
	"entityName" varchar(120) NOT NULL,
	"action" varchar(16) NOT NULL,
	"detail" varchar(300) DEFAULT '' NOT NULL,
	"actorName" varchar(80) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creta_ad_campaign" ADD COLUMN "maxPerHour" integer;--> statement-breakpoint
ALTER TABLE "creta_ad_creative" ADD COLUMN "status" varchar(12) DEFAULT 'approved' NOT NULL;--> statement-breakpoint
CREATE INDEX "creta_ad_audit_log_createdAt_idx" ON "creta_ad_audit_log" USING btree ("createdAt");