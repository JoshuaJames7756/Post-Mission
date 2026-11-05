CREATE TYPE "public"."goal_period" AS ENUM('year', 'month', 'week', 'day');--> statement-breakpoint
CREATE TYPE "public"."goal_status" AS ENUM('active', 'completed');--> statement-breakpoint
CREATE TYPE "public"."task_priority" AS ENUM('low', 'normal', 'high');--> statement-breakpoint
CREATE TYPE "public"."task_status" AS ENUM('open', 'completed');--> statement-breakpoint
CREATE TYPE "public"."theme_preference" AS ENUM('system', 'light', 'dark');--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"life_area_id" uuid,
	"parent_goal_id" uuid,
	"title" varchar(120) NOT NULL,
	"description" text,
	"period_type" "goal_period" NOT NULL,
	"start_date" date NOT NULL,
	"target_date" date NOT NULL,
	"status" "goal_status" DEFAULT 'active' NOT NULL,
	"completed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goals_user_id_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "goals_target_after_start_check" CHECK ("goals"."target_date" >= "goals"."start_date")
);
--> statement-breakpoint
CREATE TABLE "life_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(60) NOT NULL,
	"icon" varchar(32),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "life_areas_user_id_id_unique" UNIQUE("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" text PRIMARY KEY NOT NULL,
	"display_name" varchar(80) NOT NULL,
	"timezone" varchar(100) DEFAULT 'America/La_Paz' NOT NULL,
	"theme_preference" "theme_preference" DEFAULT 'system' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"goal_id" uuid,
	"title" varchar(160) NOT NULL,
	"description" text,
	"status" "task_status" DEFAULT 'open' NOT NULL,
	"priority" "task_priority" DEFAULT 'normal' NOT NULL,
	"due_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_life_area_fk" FOREIGN KEY ("user_id","life_area_id") REFERENCES "public"."life_areas"("user_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_parent_fk" FOREIGN KEY ("user_id","parent_goal_id") REFERENCES "public"."goals"("user_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_goal_fk" FOREIGN KEY ("user_id","goal_id") REFERENCES "public"."goals"("user_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "goals_user_period_status_idx" ON "goals" USING btree ("user_id","period_type","status");--> statement-breakpoint
CREATE INDEX "goals_user_dates_idx" ON "goals" USING btree ("user_id","start_date","target_date");--> statement-breakpoint
CREATE INDEX "goals_user_parent_idx" ON "goals" USING btree ("user_id","parent_goal_id");--> statement-breakpoint
CREATE UNIQUE INDEX "life_areas_user_name_active_unique" ON "life_areas" USING btree ("user_id","name") WHERE "life_areas"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "life_areas_user_order_idx" ON "life_areas" USING btree ("user_id","sort_order");--> statement-breakpoint
CREATE INDEX "tasks_user_status_due_idx" ON "tasks" USING btree ("user_id","status","due_at");--> statement-breakpoint
CREATE INDEX "tasks_user_goal_idx" ON "tasks" USING btree ("user_id","goal_id");