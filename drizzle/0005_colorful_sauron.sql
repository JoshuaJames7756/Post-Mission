CREATE TYPE "public"."journey_display_mode" AS ENUM('elapsed', 'days');--> statement-breakpoint
CREATE TABLE "journey_milestones" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" varchar(120) NOT NULL,
	"milestone_date" date NOT NULL,
	"description" varchar(1000),
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "return_date" date;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "journey_display_mode" "journey_display_mode" DEFAULT 'elapsed' NOT NULL;--> statement-breakpoint
ALTER TABLE "journey_milestones" ADD CONSTRAINT "journey_milestones_user_profile_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "journey_milestones_user_date_idx" ON "journey_milestones" USING btree ("user_id","milestone_date");--> statement-breakpoint
CREATE INDEX "journey_milestones_user_archive_idx" ON "journey_milestones" USING btree ("user_id","archived_at");