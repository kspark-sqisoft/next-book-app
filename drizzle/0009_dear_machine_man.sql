CREATE TABLE "book_media_item" (
	"id" serial PRIMARY KEY NOT NULL,
	"bookId" integer NOT NULL,
	"ownerId" integer NOT NULL,
	"kind" varchar(8) NOT NULL,
	"src" varchar(512) NOT NULL,
	"posterSrc" varchar(512),
	"sharedToAll" boolean DEFAULT false NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "book_media_share" (
	"id" serial PRIMARY KEY NOT NULL,
	"mediaId" integer NOT NULL,
	"userId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "book_media_share_mediaId_userId_unique" UNIQUE("mediaId","userId")
);
--> statement-breakpoint
CREATE TABLE "organization" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"parentId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organization_member" (
	"id" serial PRIMARY KEY NOT NULL,
	"organizationId" integer NOT NULL,
	"userId" integer NOT NULL,
	"role" varchar(16) DEFAULT 'member' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "organization_member_organizationId_userId_unique" UNIQUE("organizationId","userId")
);
--> statement-breakpoint
ALTER TABLE "book" ADD COLUMN "sharedToAll" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "creta_playlist" ADD COLUMN "sharedToAll" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "creta_schedule" ADD COLUMN "sharedToAll" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "book_media_item" ADD CONSTRAINT "book_media_item_bookId_book_id_fk" FOREIGN KEY ("bookId") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_media_item" ADD CONSTRAINT "book_media_item_ownerId_user_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_media_share" ADD CONSTRAINT "book_media_share_mediaId_book_media_item_id_fk" FOREIGN KEY ("mediaId") REFERENCES "public"."book_media_item"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_media_share" ADD CONSTRAINT "book_media_share_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization" ADD CONSTRAINT "organization_parentId_organization_id_fk" FOREIGN KEY ("parentId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_organizationId_organization_id_fk" FOREIGN KEY ("organizationId") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "organization_member" ADD CONSTRAINT "organization_member_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "book_media_item_bookId_idx" ON "book_media_item" USING btree ("bookId");--> statement-breakpoint
CREATE INDEX "book_media_item_ownerId_idx" ON "book_media_item" USING btree ("ownerId");--> statement-breakpoint
CREATE INDEX "book_media_share_userId_idx" ON "book_media_share" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "organization_parentId_idx" ON "organization" USING btree ("parentId");--> statement-breakpoint
CREATE INDEX "organization_name_idx" ON "organization" USING btree ("name");--> statement-breakpoint
CREATE INDEX "organization_member_org_idx" ON "organization_member" USING btree ("organizationId");--> statement-breakpoint
CREATE INDEX "organization_member_user_idx" ON "organization_member" USING btree ("userId");