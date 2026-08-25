CREATE TABLE "creta_device_tag" (
	"id" serial PRIMARY KEY NOT NULL,
	"deviceId" integer NOT NULL,
	"tag" varchar(40) NOT NULL,
	CONSTRAINT "creta_device_tag_deviceId_tag_unique" UNIQUE("deviceId","tag")
);
--> statement-breakpoint
ALTER TABLE "creta_device_tag" ADD CONSTRAINT "creta_device_tag_deviceId_creta_device_id_fk" FOREIGN KEY ("deviceId") REFERENCES "public"."creta_device"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "creta_device_tag_tag_idx" ON "creta_device_tag" USING btree ("tag");