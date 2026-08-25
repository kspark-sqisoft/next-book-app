CREATE TABLE "book_audit_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"bookId" integer NOT NULL,
	"bookTitle" varchar(200) NOT NULL,
	"action" varchar(16) NOT NULL,
	"detail" varchar(300) NOT NULL,
	"actorId" integer,
	"actorName" varchar(80) NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "book" ADD COLUMN "status" varchar(12) DEFAULT 'published' NOT NULL;--> statement-breakpoint
CREATE INDEX "book_audit_log_bookId_createdAt_idx" ON "book_audit_log" USING btree ("bookId","createdAt");--> statement-breakpoint
CREATE INDEX "book_audit_log_createdAt_idx" ON "book_audit_log" USING btree ("createdAt");