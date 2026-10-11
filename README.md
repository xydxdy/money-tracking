# Money Tracking

A multi-user personal finance app. Next.js (App Router) + TypeScript + PostgreSQL (Drizzle ORM) + Auth.js + Tailwind/shadcn + Recharts.

## Requirements

- Node.js 22 LTS
- Docker (for local and test Postgres)

## Balance convention

Account balance = starting balance + income to this account + transfers in − expenses from this account − transfers out.
This applies uniformly to every account type, including `credit`: spending on a credit account moves its balance negative (representing amount owed); paying it off is a transfer that brings it back toward zero.

**Loans** (lending to or borrowing from a person, and repayments either way) move account balances like this too — lending and paying back take money out, borrowing and being paid back bring it in — but they never count as income, expenses or budget spending. The **Loans** page shows, per person and currency, how much they owe you or you owe them.

Amounts are stored as `numeric(14,2)` and calculated as integer cents. Totals are always grouped by currency — the app never sums across currencies.

## Local development

1. **Install dependencies**: `npm install`
2. **Start Postgres**: `docker compose up -d postgres postgres_test`
3. **Configure environment**: `cp .env.example .env` and fill in `AUTH_SECRET` (`openssl rand -base64 32`). The default `DATABASE_URL`/`DATABASE_URL_TEST` already match `docker-compose.yml`.
4. **Run migrations** (dev and test databases):
   ```bash
   npm run db:migrate
   DATABASE_URL="postgres://app:app@localhost:5433/money_tracking_test" npm run db:migrate
   ```
5. **Create your first user**: `npm run create-user -- --email you@example.com --password "a-strong-password" --name "Your Name"`
6. **Start the app**: `npm run dev`, then sign in at `/login`.
7. **Import your backup**: go to **Settings → Data** (`/settings/data`), drop in `docs/finance-backup-2026-09-28.json`, review the preview (16 accounts, 23 categories, 226 transactions, 32 budgets, and one warning about a missing account that will be recreated as an archived "Recovered Account"), then confirm.
8. **Run tests**: `npm test` (runs against `DATABASE_URL_TEST`, never the dev/prod database).

There is no public sign-up page: users are created with `npm run create-user`. Signed-in users can change their name, email and password under **Settings → Profile** (email and password changes ask for the current password). Emails are matched ignoring case at sign-in.
New users start with default account types (Bank, Credit card, Cash, E-wallet, Travel card) and a starter set of expense, income and transfer categories. Both can be added to and edited in the app: account types under **Settings → Account types**, categories under **Settings → Categories**. Existing users can add any missing default types from the Account types page.

## Importing and exporting

- Drag and drop (or click to choose) a `.json` backup on **Settings → Data**. The whole file is validated first (duplicate ids, missing account/category references, malformed transactions, invalid amounts and dates) and a preview is shown. Nothing is written until you confirm.
- **An import replaces all of your data.** Your existing accounts, categories, transactions and budgets are deleted and replaced by the file's contents. It is never merged, so importing the same file twice gives the same result. Deleting and inserting happen in one database transaction: if the import fails, your old data is left untouched.
- Every imported row belongs to the signed-in user; any user id in the file is ignored and record ids are regenerated, so the same backup can be imported into different accounts. Other users' data is never affected.
- **Download export (JSON)** on the same page produces a file in the same format (format version 2), which can be imported again.
- Reimbursement statuses are **To claim → Submitting → Claimed**. Version 1 files (such as the bundled backup) used `to_claim / claimed / reimbursed`; on import they are mapped `claimed → submitting` and `reimbursed → claimed`. Only Claimed reimbursements stop counting as outstanding on the dashboard.

## Deploying to Vercel

1. **Create the database**: create a Neon Postgres project (or Vercel Postgres) from the Vercel dashboard.
2. **Set `DATABASE_URL`**: in the Vercel project's Environment Variables, paste the Neon pooled connection string (it includes `sslmode=require`).
3. **Set `AUTH_SECRET`**: generate with `openssl rand -base64 32` and add it as an environment variable.
4. **Run migrations against production**: `DATABASE_URL="<neon-connection-string>" npm run db:migrate` from your machine before first traffic.
5. **Create the first production user**: `DATABASE_URL="<neon-connection-string>" npm run create-user -- --email you@example.com --password "..."`.
6. **Deploy**: connect the repo in Vercel and deploy; subsequent pushes to `main` auto-deploy.
7. **Import the backup in production**: sign in on the deployed app and use `/settings/data` as in local dev.
8. **Production migrations on later schema changes**: run `npm run db:generate` locally, commit the generated SQL in `db/migrations`, then run `DATABASE_URL="<neon-connection-string>" npm run db:migrate` before the new code goes live.
9. **Backup/restore**: use `/settings/data`'s export button to download a point-in-time JSON backup; restore by importing that file into a (possibly different) user account.

## Scripts

| Script                | Purpose                                         |
| --------------------- | ----------------------------------------------- |
| `npm run dev`         | Start the Next.js dev server                    |
| `npm run build`       | Production build                                |
| `npm start`           | Run the production build                        |
| `npm run lint`        | Lint with ESLint                                |
| `npm run typecheck`   | Type-check with `tsc --noEmit`                  |
| `npm test`            | Run the Vitest suite (uses `postgres_test`)     |
| `npm run db:generate` | Generate Drizzle migrations                     |
| `npm run db:migrate`  | Apply migrations                                |
| `npm run db:push`     | Push schema directly to the database (dev only) |
| `npm run create-user` | CLI to create a user account                    |

`npx tsx scripts/verify-real-backup.ts` prints the import preview for the bundled backup without writing anything.

## Testing

`npm test` covers: money helpers, balance calculation (expense/income/transfer), budget spent/remaining/percentage, dashboard aggregation (per-currency, transfers excluded), transactions and reimbursements, backup import (preview, duplicate and reference detection, transactional commit, missing-account recovery, rollback on error, the full real backup), export round-tripping, and cross-user isolation for every entity (`tests/security/user-isolation.test.ts`).

## Notes

The shadcn/ui components are built on [Base UI](https://base-ui.com) (`@base-ui/react`), not Radix UI — shadcn's current default style — so expect Base UI's data attributes (e.g. `data-open`/`data-closed`) rather than Radix's (`data-state`), and the `render` prop rather than `asChild`.
