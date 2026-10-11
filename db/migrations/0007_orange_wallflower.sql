CREATE TYPE "public"."loan_kind" AS ENUM('lend', 'borrow', 'repayment_in', 'repayment_out');--> statement-breakpoint
ALTER TYPE "public"."transaction_type" ADD VALUE 'loan';--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "loan_kind" "loan_kind";--> statement-breakpoint
ALTER TABLE "transactions" ADD COLUMN "counterparty" text;