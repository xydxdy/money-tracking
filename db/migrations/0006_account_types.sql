CREATE TABLE "account_types" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"icon" text,
	"color" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "account_type_id" text;--> statement-breakpoint
ALTER TABLE "account_types" ADD CONSTRAINT "account_types_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_types_user_id_idx" ON "account_types" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_types_user_name_idx" ON "account_types" USING btree ("user_id",lower("name"));--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_account_type_id_account_types_id_fk" FOREIGN KEY ("account_type_id") REFERENCES "public"."account_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- Data migration: give each user an account type for every built-in type their accounts use,
-- then point those accounts at it. Names/icons/colours match lib/defaults.ts.
INSERT INTO "account_types" ("id", "user_id", "name", "icon", "color")
SELECT gen_random_uuid()::text, u.user_id, d.name, d.icon, d.color
FROM (SELECT DISTINCT "user_id", "type"::text AS type FROM "accounts") u
JOIN (VALUES
  ('bank', 'Bank', '🏦', 'blue'),
  ('credit', 'Credit card', '💳', 'violet'),
  ('cash', 'Cash', '💵', 'emerald'),
  ('wallet', 'E-wallet', '👛', 'amber'),
  ('travel', 'Travel', '✈️', 'sky'),
  ('grant', 'Grant', '🎓', 'teal')
) AS d(key, name, icon, color) ON d.key = u.type;--> statement-breakpoint
UPDATE "accounts" a SET "account_type_id" = t."id"
FROM "account_types" t
JOIN (VALUES ('bank', 'Bank'), ('credit', 'Credit card'), ('cash', 'Cash'), ('wallet', 'E-wallet'), ('travel', 'Travel'), ('grant', 'Grant'))
  AS d(key, name) ON d.name = t."name"
WHERE t."user_id" = a."user_id" AND d.key = a."type"::text;--> statement-breakpoint
ALTER TABLE "accounts" DROP COLUMN "type";--> statement-breakpoint
DROP TYPE "public"."account_type";