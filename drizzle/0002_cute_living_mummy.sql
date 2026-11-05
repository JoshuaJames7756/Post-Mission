CREATE TYPE "public"."person_avatar_color" AS ENUM('sage', 'amber', 'navy', 'slate', 'plum');--> statement-breakpoint
CREATE TYPE "public"."person_relationship" AS ENUM('family', 'friend', 'mentor', 'community', 'other');--> statement-breakpoint
CREATE TABLE "event_people" (
	"user_id" text NOT NULL,
	"event_id" uuid NOT NULL,
	"person_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_people_user_event_person_unique" UNIQUE("user_id","event_id","person_id")
);
--> statement-breakpoint
CREATE TABLE "people" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(100) NOT NULL,
	"relationship" "person_relationship" NOT NULL,
	"phone" varchar(32),
	"birthday" date,
	"notes" varchar(2000),
	"avatar_color" "person_avatar_color" DEFAULT 'sage' NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "people_user_id_id_unique" UNIQUE("user_id","id")
);
--> statement-breakpoint
ALTER TABLE "event_people" ADD CONSTRAINT "event_people_user_event_fk" FOREIGN KEY ("user_id","event_id") REFERENCES "public"."events"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_people" ADD CONSTRAINT "event_people_user_person_fk" FOREIGN KEY ("user_id","person_id") REFERENCES "public"."people"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_people_user_person_idx" ON "event_people" USING btree ("user_id","person_id");--> statement-breakpoint
CREATE INDEX "people_user_name_active_idx" ON "people" USING btree ("user_id","name") WHERE "people"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "people_user_archived_idx" ON "people" USING btree ("user_id","archived_at");