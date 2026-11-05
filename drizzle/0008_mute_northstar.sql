CREATE TYPE "public"."reminder_category" AS ENUM('tasks', 'events', 'reviews');--> statement-breakpoint
CREATE TABLE "reminder_dismissals" (
	"user_id" text NOT NULL,
	"category" "reminder_category" NOT NULL,
	"local_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reminder_dismissals_user_category_date_unique" UNIQUE("user_id","category","local_date")
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "remind_tasks" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "remind_events" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "remind_reviews" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "reminder_dismissals" ADD CONSTRAINT "reminder_dismissals_user_profile_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reminder_dismissals_user_date_idx" ON "reminder_dismissals" USING btree ("user_id","local_date");