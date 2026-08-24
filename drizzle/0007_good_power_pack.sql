CREATE TABLE "creta_comment" (
	"id" serial PRIMARY KEY NOT NULL,
	"targetKind" varchar(16) NOT NULL,
	"targetId" integer NOT NULL,
	"parentId" integer,
	"userId" integer NOT NULL,
	"content" varchar(2000) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "creta_comment" ADD CONSTRAINT "creta_comment_parentId_creta_comment_id_fk" FOREIGN KEY ("parentId") REFERENCES "public"."creta_comment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "creta_comment" ADD CONSTRAINT "creta_comment_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "creta_comment_target_idx" ON "creta_comment" USING btree ("targetKind","targetId");--> statement-breakpoint
CREATE INDEX "creta_comment_parentId_idx" ON "creta_comment" USING btree ("parentId");