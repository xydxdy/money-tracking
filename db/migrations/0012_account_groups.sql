CREATE TABLE "account_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"icon" text,
	"note" text,
	"position" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "group_id" text;--> statement-breakpoint
ALTER TABLE "account_groups" ADD CONSTRAINT "account_groups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_groups_user_id_idx" ON "account_groups" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "account_groups_user_name_idx" ON "account_groups" USING btree ("user_id",lower("name"));--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_group_id_account_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."account_groups"("id") ON DELETE set null ON UPDATE no action;