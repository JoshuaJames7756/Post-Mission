CREATE TYPE "public"."place_type" AS ENUM('home', 'church', 'work', 'school', 'community', 'other');--> statement-breakpoint
CREATE TABLE "event_places" (
	"user_id" text NOT NULL,
	"event_id" uuid NOT NULL,
	"place_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "event_places_user_event_place_unique" UNIQUE("user_id","event_id","place_id")
);
--> statement-breakpoint
CREATE TABLE "places" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" varchar(120) NOT NULL,
	"type" "place_type" NOT NULL,
	"address" varchar(240),
	"latitude" double precision,
	"longitude" double precision,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "places_user_id_id_unique" UNIQUE("user_id","id"),
	CONSTRAINT "places_coordinate_pair_check" CHECK ((
    ("places"."latitude" is null and "places"."longitude" is null)
    or ("places"."latitude" is not null and "places"."longitude" is not null
      and "places"."latitude" >= -90 and "places"."latitude" <= 90
      and "places"."longitude" >= -180 and "places"."longitude" <= 180)
  ))
);
--> statement-breakpoint
ALTER TABLE "event_places" ADD CONSTRAINT "event_places_user_event_fk" FOREIGN KEY ("user_id","event_id") REFERENCES "public"."events"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event_places" ADD CONSTRAINT "event_places_user_place_fk" FOREIGN KEY ("user_id","place_id") REFERENCES "public"."places"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "event_places_user_place_idx" ON "event_places" USING btree ("user_id","place_id");--> statement-breakpoint
CREATE INDEX "places_user_name_active_idx" ON "places" USING btree ("user_id","name") WHERE "places"."archived_at" is null;--> statement-breakpoint
CREATE INDEX "places_user_archived_idx" ON "places" USING btree ("user_id","archived_at");