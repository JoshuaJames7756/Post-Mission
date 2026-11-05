CREATE TABLE "note_events" (
	"user_id" text NOT NULL,
	"note_id" uuid NOT NULL,
	"event_id" uuid NOT NULL,
	CONSTRAINT "note_events_unique" UNIQUE("user_id","note_id","event_id")
);
--> statement-breakpoint
CREATE TABLE "note_goals" (
	"user_id" text NOT NULL,
	"note_id" uuid NOT NULL,
	"goal_id" uuid NOT NULL,
	CONSTRAINT "note_goals_unique" UNIQUE("user_id","note_id","goal_id")
);
--> statement-breakpoint
CREATE TABLE "note_people" (
	"user_id" text NOT NULL,
	"note_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	CONSTRAINT "note_people_unique" UNIQUE("user_id","note_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "note_places" (
	"user_id" text NOT NULL,
	"note_id" uuid NOT NULL,
	"place_id" uuid NOT NULL,
	CONSTRAINT "note_places_unique" UNIQUE("user_id","note_id","place_id")
);
--> statement-breakpoint
CREATE TABLE "note_tasks" (
	"user_id" text NOT NULL,
	"note_id" uuid NOT NULL,
	"task_id" uuid NOT NULL,
	CONSTRAINT "note_tasks_unique" UNIQUE("user_id","note_id","task_id")
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"title" varchar(160) NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notes_user_id_id_unique" UNIQUE("user_id","id")
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_id_id_unique" UNIQUE("user_id","id");--> statement-breakpoint
ALTER TABLE "note_events" ADD CONSTRAINT "note_events_note_fk" FOREIGN KEY ("user_id","note_id") REFERENCES "public"."notes"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_events" ADD CONSTRAINT "note_events_event_fk" FOREIGN KEY ("user_id","event_id") REFERENCES "public"."events"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_goals" ADD CONSTRAINT "note_goals_note_fk" FOREIGN KEY ("user_id","note_id") REFERENCES "public"."notes"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_goals" ADD CONSTRAINT "note_goals_goal_fk" FOREIGN KEY ("user_id","goal_id") REFERENCES "public"."goals"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_people" ADD CONSTRAINT "note_people_note_fk" FOREIGN KEY ("user_id","note_id") REFERENCES "public"."notes"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_people" ADD CONSTRAINT "note_people_person_fk" FOREIGN KEY ("user_id","person_id") REFERENCES "public"."people"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_places" ADD CONSTRAINT "note_places_note_fk" FOREIGN KEY ("user_id","note_id") REFERENCES "public"."notes"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_places" ADD CONSTRAINT "note_places_place_fk" FOREIGN KEY ("user_id","place_id") REFERENCES "public"."places"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_tasks" ADD CONSTRAINT "note_tasks_note_fk" FOREIGN KEY ("user_id","note_id") REFERENCES "public"."notes"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_tasks" ADD CONSTRAINT "note_tasks_task_fk" FOREIGN KEY ("user_id","task_id") REFERENCES "public"."tasks"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "note_events_event_idx" ON "note_events" USING btree ("user_id","event_id");--> statement-breakpoint
CREATE INDEX "note_goals_goal_idx" ON "note_goals" USING btree ("user_id","goal_id");--> statement-breakpoint
CREATE INDEX "note_people_person_idx" ON "note_people" USING btree ("user_id","person_id");--> statement-breakpoint
CREATE INDEX "note_places_place_idx" ON "note_places" USING btree ("user_id","place_id");--> statement-breakpoint
CREATE INDEX "note_tasks_task_idx" ON "note_tasks" USING btree ("user_id","task_id");--> statement-breakpoint
CREATE INDEX "notes_user_updated_idx" ON "notes" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "notes_user_archived_idx" ON "notes" USING btree ("user_id","archived_at");
