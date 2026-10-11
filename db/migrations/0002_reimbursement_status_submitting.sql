-- Reimbursement statuses become to_claim -> submitting -> claimed.
-- Old meaning: claimed = sent, waiting for money (now "submitting"); reimbursed = money received (now "claimed").
ALTER TYPE "public"."reimbursement_status" RENAME TO "reimbursement_status_old";--> statement-breakpoint
CREATE TYPE "public"."reimbursement_status" AS ENUM('to_claim', 'submitting', 'claimed');--> statement-breakpoint
ALTER TABLE "transactions" ALTER COLUMN "reimbursement_status" TYPE "public"."reimbursement_status" USING (
  CASE "reimbursement_status"::text
    WHEN 'claimed' THEN 'submitting'
    WHEN 'reimbursed' THEN 'claimed'
    ELSE "reimbursement_status"::text
  END
)::"public"."reimbursement_status";--> statement-breakpoint
DROP TYPE "public"."reimbursement_status_old";
