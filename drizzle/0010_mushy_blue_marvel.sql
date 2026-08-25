CREATE TABLE "creta_alert" (
	"id" serial PRIMARY KEY NOT NULL,
	"message" varchar(300) NOT NULL,
	"level" varchar(12) DEFAULT '긴급' NOT NULL,
	"allDevices" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"createdBy" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"endedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "creta_alert_device" (
	"id" serial PRIMARY KEY NOT NULL,
	"alertId" integer NOT NULL,
	"deviceId" integer NOT NULL,
	CONSTRAINT "creta_alert_device_alertId_deviceId_unique" UNIQUE("alertId","deviceId")
);
--> statement-breakpoint
ALTER TABLE "creta_alert" ADD CONSTRAINT "creta_alert_createdBy_user_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creta_alert_device" ADD CONSTRAINT "creta_alert_device_alertId_creta_alert_id_fk" FOREIGN KEY ("alertId") REFERENCES "public"."creta_alert"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creta_alert_device" ADD CONSTRAINT "creta_alert_device_deviceId_creta_device_id_fk" FOREIGN KEY ("deviceId") REFERENCES "public"."creta_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "creta_alert_device_alertId_idx" ON "creta_alert_device" USING btree ("alertId");