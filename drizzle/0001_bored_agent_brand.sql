CREATE TYPE "public"."event_color" AS ENUM('sage', 'amber', 'navy', 'slate');--> statement-breakpoint
CREATE TYPE "public"."event_status" AS ENUM('scheduled', 'completed', 'cancelled');--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"goal_id" uuid,
	"title" varchar(160) NOT NULL,
	"description" text,
	"category" varchar(40) NOT NULL,
	"color" "event_color" DEFAULT 'sage' NOT NULL,
	"all_day" boolean NOT NULL,
	"start_date" date,
	"end_date" date,
	"start_at" timestamp with time zone,
	"end_at" timestamp with time zone,
	"time_zone" varchar(100),
	"status" "event_status" DEFAULT 'scheduled' NOT NULL,
	"completed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "events_user_id_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "events_temporal_shape_check" CHECK ((
    ("events"."all_day" = true and "events"."start_date" is not null and "events"."end_date" is not null
      and "events"."end_date" >= "events"."start_date" and "events"."start_at" is null and "events"."end_at" is null and "events"."time_zone" is null)
    or
    ("events"."all_day" = false and "events"."start_date" is null and "events"."end_date" is null
      and "events"."start_at" is not null and "events"."end_at" is not null and "events"."end_at" > "events"."start_at" and "events"."time_zone" is not null)
  ))
);
--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_user_goal_fk" FOREIGN KEY ("user_id","goal_id") REFERENCES "public"."goals"("user_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_user_all_day_range_idx" ON "events" USING btree ("user_id","start_date","end_date") WHERE "events"."all_day" = true and "events"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "events_user_timed_range_idx" ON "events" USING btree ("user_id","start_at","end_at") WHERE "events"."all_day" = false and "events"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "events_user_goal_idx" ON "events" USING btree ("user_id","goal_id");