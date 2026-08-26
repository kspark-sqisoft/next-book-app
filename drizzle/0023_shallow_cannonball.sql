CREATE TABLE "creta_device_status_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"deviceId" integer NOT NULL,
	"status" varchar(12) NOT NULL,
	"checkedAt" timestamp NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creta_device_status_log" ADD CONSTRAINT "creta_device_status_log_deviceId_creta_device_id_fk" FOREIGN KEY ("deviceId") REFERENCES "public"."creta_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "creta_device_status_log_device_time_idx" ON "creta_device_status_log" USING btree ("deviceId","checkedAt");--> statement-breakpoint
CREATE INDEX "creta_device_status_log_time_idx" ON "creta_device_status_log" USING btree ("checkedAt");