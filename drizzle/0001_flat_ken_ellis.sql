ALTER TABLE "book" ADD CONSTRAINT "book_authorId_user_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_ai_chat_message" ADD CONSTRAINT "book_ai_chat_message_bookId_book_id_fk" FOREIGN KEY ("bookId") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "book_page" ADD CONSTRAINT "book_page_bookId_book_id_fk" FOREIGN KEY ("bookId") REFERENCES "public"."book"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_authorId_user_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_attachment" ADD CONSTRAINT "post_attachment_postId_post_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comment" ADD CONSTRAINT "post_comment_postId_post_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_comment" ADD CONSTRAINT "post_comment_authorId_user_id_fk" FOREIGN KEY ("authorId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_like" ADD CONSTRAINT "post_like_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post_like" ADD CONSTRAINT "post_like_postId_post_id_fk" FOREIGN KEY ("postId") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_token" ADD CONSTRAINT "refresh_token_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_cats" ADD CONSTRAINT "study_cats_ownerId_user_id_fk" FOREIGN KEY ("ownerId") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "book_authorId_idx" ON "book" USING btree ("authorId");--> statement-breakpoint
CREATE INDEX "book_updatedAt_idx" ON "book" USING btree ("updatedAt");--> statement-breakpoint
CREATE INDEX "book_ai_chat_message_bookId_createdAt_idx" ON "book_ai_chat_message" USING btree ("bookId","createdAt");--> statement-breakpoint
CREATE INDEX "book_page_bookId_sortOrder_idx" ON "book_page" USING btree ("bookId","sortOrder");--> statement-breakpoint
CREATE INDEX "post_authorId_idx" ON "post" USING btree ("authorId");--> statement-breakpoint
CREATE INDEX "post_createdAt_id_idx" ON "post" USING btree ("createdAt","id");--> statement-breakpoint
CREATE INDEX "post_attachment_postId_idx" ON "post_attachment" USING btree ("postId");--> statement-breakpoint
CREATE INDEX "post_comment_postId_idx" ON "post_comment" USING btree ("postId");--> statement-breakpoint
CREATE INDEX "post_comment_authorId_idx" ON "post_comment" USING btree ("authorId");--> statement-breakpoint
CREATE INDEX "post_comment_parentId_idx" ON "post_comment" USING btree ("parentId");--> statement-breakpoint
CREATE INDEX "post_like_postId_idx" ON "post_like" USING btree ("postId");--> statement-breakpoint
CREATE INDEX "study_cats_ownerId_idx" ON "study_cats" USING btree ("ownerId");--> statement-breakpoint
CREATE UNIQUE INDEX "user_email_lower_uidx" ON "user" (LOWER("email"));