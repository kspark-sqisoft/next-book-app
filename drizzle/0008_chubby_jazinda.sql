CREATE TABLE "creta_like" (
	"id" serial PRIMARY KEY NOT NULL,
	"targetKind" varchar(16) NOT NULL,
	"targetId" integer NOT NULL,
	"userId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "creta_like_targetKind_targetId_userId_unique" UNIQUE("targetKind","targetId","userId")
);
--> statement-breakpoint
ALTER TABLE "creta_like" ADD CONSTRAINT "creta_like_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "creta_like_target_idx" ON "creta_like" USING btree ("targetKind","targetId");