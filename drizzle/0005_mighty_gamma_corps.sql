CREATE TABLE "book_share" (
	"id" serial PRIMARY KEY NOT NULL,
	"bookId" integer NOT NULL,
	"userId" integer NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "book_share_bookId_userId_unique" UNIQUE("bookId","userId")
);
--> statement-breakpoint
ALTER TABLE "book_share" ADD CONSTRAINT "book_share_bookId_book_id_fk" FOREIGN KEY ("bookId") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_share" ADD CONSTRAINT "book_share_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "book_share_bookId_idx" ON "book_share" USING btree ("bookId");--> statement-breakpoint
CREATE INDEX "book_share_userId_idx" ON "book_share" USING btree ("userId");