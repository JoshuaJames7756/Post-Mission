CREATE TYPE "public"."review_period_type" AS ENUM('daily', 'weekly');--> statement-breakpoint
CREATE TYPE "public"."review_status" AS ENUM('draft', 'completed');--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"period_type" "review_period_type" NOT NULL,
	"period_start" date NOT NULL,
	"wins" text DEFAULT '' NOT NULL,
	"challenges" text DEFAULT '' NOT NULL,
	"reflection" text DEFAULT '' NOT NULL,
	"next_steps" text DEFAULT '' NOT NULL,
	"status" "review_status" DEFAULT 'draft' NOT NULL,
	"revision" integer DEFAULT 1 NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reviews_user_period_unique" UNIQUE("user_id","period_type","period_start"),
	CONSTRAINT "reviews_week_start_check" CHECK ("reviews"."period_type" = 'daily' or extract(dow from "reviews"."period_start") = 1),
	CONSTRAINT "reviews_completion_shape_check" CHECK (("reviews"."status" = 'draft' and "reviews"."completed_at" is null) or ("reviews"."status" = 'completed' and "reviews"."completed_at" is not null))
);
--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_profile_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "reviews_user_recent_idx" ON "reviews" USING btree ("user_id","period_type","period_start");