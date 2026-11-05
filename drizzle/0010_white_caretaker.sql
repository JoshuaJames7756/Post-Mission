CREATE TYPE "public"."account_deletion_state" AS ENUM('requested', 'data_deleted');--> statement-breakpoint
CREATE TABLE "account_deletions" (
	"user_id" text PRIMARY KEY NOT NULL,
	"state" "account_deletion_state" DEFAULT 'requested' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"next_attempt_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "account_deletions_retry_idx" ON "account_deletions" USING btree ("state","next_attempt_at");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_user_profile_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_profile_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "life_areas" ADD CONSTRAINT "life_areas_user_profile_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_profile_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "people" ADD CONSTRAINT "people_user_profile_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "places" ADD CONSTRAINT "places_user_profile_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_user_profile_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE FUNCTION prevent_profile_write_during_deletion() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM account_deletions WHERE user_id = NEW.user_id) THEN
    RAISE EXCEPTION 'account deletion pending' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER profiles_account_deletion_guard BEFORE INSERT OR UPDATE ON profiles
FOR EACH ROW EXECUTE FUNCTION prevent_profile_write_during_deletion();
