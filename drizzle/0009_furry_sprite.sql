ALTER TABLE "profiles" ADD COLUMN "onboarding_completed_at" timestamp with time zone;
--> statement-breakpoint
UPDATE "profiles" SET "onboarding_completed_at" = now();
