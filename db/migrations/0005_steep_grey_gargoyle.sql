ALTER TABLE "accounts" ADD COLUMN "color" text;--> statement-breakpoint
ALTER TABLE "accounts" ADD COLUMN "icon" text;--> statement-breakpoint
-- Backfill existing accounts with the same per-type defaults as lib/account-appearance.ts.
UPDATE "accounts" SET
  "icon" = CASE "type" WHEN 'bank' THEN '🏦' WHEN 'credit' THEN '💳' WHEN 'cash' THEN '💵' WHEN 'wallet' THEN '👛' WHEN 'travel' THEN '✈️' WHEN 'grant' THEN '🎓' END,
  "color" = CASE "type" WHEN 'bank' THEN 'blue' WHEN 'credit' THEN 'violet' WHEN 'cash' THEN 'emerald' WHEN 'wallet' THEN 'amber' WHEN 'travel' THEN 'sky' WHEN 'grant' THEN 'teal' END
WHERE "icon" IS NULL OR "color" IS NULL;
