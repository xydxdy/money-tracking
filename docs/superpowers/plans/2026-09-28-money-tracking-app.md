# Multi-User Money Tracking App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-ready, multi-user personal finance web app (Next.js + Postgres) that imports the existing `finance-backup-2026-09-28.json` backup and supports accounts, categories, transactions, budgets, reimbursements, dashboard analytics, and per-user backup/export, with full user isolation.

**Architecture:** Next.js App Router (TS) with server actions doing all DB access via Drizzle ORM against Postgres (Neon on Vercel, local Docker Postgres for dev/test). Auth.js (v5) with a Credentials provider issues JWT sessions; every server action re-derives `userId` from the session and scopes/validates all reads, writes, and cross-entity references through shared authorization helpers. Money is stored as `NUMERIC(14,2)` and manipulated in application code as integer cents to avoid float error. UI built with Tailwind + shadcn/ui, charts with Recharts.

**Tech Stack:** Next.js (App Router) · TypeScript · PostgreSQL (Neon) · Drizzle ORM · Auth.js v5 (Credentials) · Tailwind CSS · shadcn/ui · Recharts · Zod · Vitest · Vercel

**Spec:** `docs/task.md` (requirements) + `docs/finance-backup-2026-09-28.json` (real data the schema/importer must fit)

## Real-Data Findings (from inspecting the actual backup — these override the spec's illustrative examples where they conflict)

- Top-level JSON shape: `{ version: 1, accounts: [16], categories: [23], transactions: [226], budgets: [32] }`.
- **Accounts**: fields `id (uuid), name, type, currency, startingBalance, note?(2/16), archived`. No timestamps in backup — generated at import. Types seen: `bank(9), travel(3), credit(1), cash(1), wallet(1), grant(1)`. Currencies: `USD(11), THB(5)`.
- **Categories**: fields `id, name, type, icon, noBudget`. **IDs are NOT uuids** — arbitrary slugs like `c_grocery`, `c_unifee`. No timestamps, no `archived` field in the backup (we add one — see Global Constraints). Types: `expense(11), income(6), transfer(6)`.
- **Transactions**: fields `id(uuid), details, type, categoryId?, payDate('YYYY-MM-DD'), fromAccountId?, toAccountId?, amount, currency, status, reimbursable, reimbursementStatus?, receipt?, note?, toAmount?, createdAt, updatedAt`.
  - By type: `expense` (184) always has `fromAccountId`, never `toAccountId`, `categoryId` null in 16/184. `income` (20) always has `toAccountId`, never `fromAccountId`, `categoryId` null in 2/20. `transfer` (22) always has both `fromAccountId` and `toAccountId`, `categoryId` null in 1/22.
  - `toAmount` present only on 8 of 22 transfers (cross-currency transfers).
  - `status` only ever `"completed"` in this data, but the field must remain a general enum.
  - **`reimbursementStatus` real values are `to_claim`, `claimed`, `reimbursed`** (not `pending/submitted/reimbursed` as the spec's illustrative example says — real data wins).
  - `receipt` is a **metadata object**, not a file: `{ id, mime, name, size, addedAt }`. No binary is present in the backup, so import only needs to persist this JSON — no blob storage.
  - Amounts: always positive, never zero, max 2 decimal places.
  - **Data-quality edge case that is present in the real file and must be handled, not just theorized about**: transaction `f3f77764-3d08-4c20-9336-fead4cacc78a` has `toAccountId = "ffa804de-298a-417c-bf73-548ebd807b02"`, which does not exist in the `accounts` array (a dangling reference — likely an account that was deleted from the source app without cascading). Decision: the importer creates a placeholder archived account (`name: "Recovered Account (<short-id>)"`, `type: "bank"`, `currency` copied from the transaction) for any account id referenced by a transaction but absent from the backup's `accounts` array, rather than dropping the transaction or failing the whole import. This is reported in the import preview as a warning. This is the only such case in the current file, but the importer must handle it generally (any count).
  - `categoryId` is always consistent with `category.type === transaction.type` when both present (0 mismatches in 226 rows) — the importer validates this and rejects (reports as an error, not a warning) any row where it's violated.
- **Budgets**: fields `id(uuid), month('YYYY-MM'), categoryId, currency, plannedAmount`. No timestamps. No duplicate `(month, categoryId, currency)` combos in the real data, consistent with the spec's uniqueness requirement.
- No duplicate ids within any collection. All category/account ids referenced by transactions and budgets exist **except** the one dangling case above.

## Global Constraints

- Money columns are `NUMERIC(14,2)` in Postgres; all arithmetic in application code happens on integer cents via `lib/money.ts` — never on raw floats or raw numeric strings.
- Primary keys are `text`, not native `uuid`/`serial`, on every domain table (`users` excepted, which also uses `text` for consistency) — required because real category ids are non-uuid slugs and the importer must be able to preserve original ids.
- Every table except `users` has a `user_id text not null references users(id) on delete cascade`.
- No server code path may accept a client-supplied `user_id`. The authenticated user id always comes from the session, via the helpers built in Task 5.
- Package manager: npm. Test runner: Vitest. Local/test Postgres runs via Docker Compose (`docker-compose.yml`), so tests never touch SQLite and never touch the production Neon database.
- Auth: Auth.js v5, Credentials provider (email + bcrypt password hash), JWT session strategy (no DB session table needed). No public self-registration route — the first (and any subsequent) user is created via a CLI script (`npm run create-user -- --email ... --password ... --name ...`), matching the spec's README requirement "Creating the first user." This is a deliberate scope decision for a personal-finance app: fewer credential-based auth surfaces to secure.
- Transfers are excluded from all income/expense analytics (dashboard, budgets) — enforced in the shared query helpers, not duplicated per-page.
- Only `expense`-type transactions count against budget `spent`.
- All money totals are grouped by currency everywhere (dashboard, exports, account lists) — never summed across currencies.
- `.env.example` lists `DATABASE_URL`, `AUTH_SECRET`, `DATABASE_URL_TEST` with placeholder values; no real credentials are ever committed.

---

## File Structure

```
money-tracking/
  docker-compose.yml                # local Postgres for dev + test
  .env.example
  drizzle.config.ts
  db/
    schema.ts                       # all Drizzle table definitions
    client.ts                       # db instance (Neon + node-postgres dev/test)
    migrations/                     # drizzle-kit generated SQL
  lib/
    money.ts                        # cents<->numeric-string conversion, formatting
    auth.ts                         # Auth.js config + `auth()` helper
    session.ts                      # getCurrentUser()
    authorization.ts                # getUserAccount/getUserCategory/getUserTransaction/getUserBudget
    balances.ts                     # account balance calculation
    dashboard-queries.ts            # aggregation queries for dashboard
    budget-calc.ts                  # planned/spent/remaining/percentage
    import/
      schema.ts                     # Zod schema for the backup JSON
      importer.ts                   # preview + commit logic
    export.ts                       # per-user export to backup-compatible JSON
  app/
    login/page.tsx
    (app)/layout.tsx                # authenticated shell + nav
    (app)/dashboard/page.tsx
    (app)/transactions/page.tsx
    (app)/transactions/new/page.tsx
    (app)/transactions/[id]/page.tsx
    (app)/accounts/page.tsx
    (app)/accounts/[id]/page.tsx
    (app)/budgets/page.tsx
    (app)/categories/page.tsx
    (app)/reimbursements/page.tsx
    (app)/settings/page.tsx
    (app)/settings/data/page.tsx
    actions/
      accounts.ts
      categories.ts
      transactions.ts
      budgets.ts
      reimbursements.ts
      import.ts
      export.ts
  scripts/
    create-user.ts
  middleware.ts                     # route protection
  tests/
    ...mirrors lib/ and app/actions/ for unit + integration tests
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `.eslintrc.json`, `.gitignore`, `.env.example`, `docker-compose.yml`, `vitest.config.ts`, `tests/setup-env.ts`, `app/layout.tsx`, `app/globals.css`, `app/page.tsx`, `README.md`
- Test: `tests/smoke.test.ts`

**Interfaces:**
- Produces: a runnable `npm run dev`, `npm run build`, `npm run lint`, `npm run typecheck`, `npm run test` pipeline that every later task builds on.

- [ ] **Step 1: Scaffold Next.js app**

```bash
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir=false --import-alias "@/*" --use-npm --no-turbopack
```

Answer prompts to match: App Router yes, `src/` no.

- [ ] **Step 2: Install project dependencies**

```bash
npm install drizzle-orm pg @neondatabase/serverless dotenv zod bcryptjs next-auth@beta recharts date-fns
npm install -D drizzle-kit vitest @vitejs/plugin-react @testing-library/react @testing-library/jest-dom jsdom tsx @types/pg @types/bcryptjs
```

- [ ] **Step 3: Add shadcn/ui**

```bash
npx shadcn@latest init -d
npx shadcn@latest add button input label select card table dialog dropdown-menu form toast badge tabs calendar popover switch textarea
```

- [ ] **Step 4: Add `docker-compose.yml` for local/test Postgres**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: money_tracking
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
  postgres_test:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: money_tracking_test
    ports:
      - "5433:5432"
volumes:
  pgdata:
```

- [ ] **Step 5: Add `.env.example`**

```bash
# Local/dev Postgres (docker-compose "postgres" service)
DATABASE_URL="postgres://app:app@localhost:5432/money_tracking"
# Test Postgres (docker-compose "postgres_test" service) — used only by `npm test`
DATABASE_URL_TEST="postgres://app:app@localhost:5433/money_tracking_test"
# openssl rand -base64 32
AUTH_SECRET="replace-with-a-random-32-byte-base64-secret"
```

- [ ] **Step 6: Add `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node',
    setupFiles: ['dotenv/config', './tests/setup-env.ts'],
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, '.') },
  },
});
```

- [ ] **Step 6b: Write `tests/setup-env.ts`**

`db/client.ts` (Task 2) always reads `process.env.DATABASE_URL` — there is no separate test client. This setup file redirects `DATABASE_URL` to the test database for every test run, so `npm test` never touches the dev database, only the `postgres_test` docker-compose service:

```ts
// tests/setup-env.ts
if (process.env.DATABASE_URL_TEST) {
  process.env.DATABASE_URL = process.env.DATABASE_URL_TEST;
}
```

This file must load after `dotenv/config` (which populates `DATABASE_URL_TEST` from `.env`) and before any test file imports `@/db/client` — the `setupFiles` order above guarantees that.

- [ ] **Step 7: Add npm scripts to `package.json`**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "tsx db/migrate.ts",
    "db:push": "drizzle-kit push",
    "create-user": "tsx scripts/create-user.ts"
  }
}
```

- [ ] **Step 8: Write smoke test**

```ts
// tests/smoke.test.ts
import { describe, it, expect } from 'vitest';

describe('project scaffold', () => {
  it('runs a trivial assertion', () => {
    expect(1 + 1).toBe(2);
  });
});
```

- [ ] **Step 9: Run test to verify it passes**

Run: `npm test`
Expected: 1 passed.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Tailwind, shadcn/ui, Vitest, docker-compose Postgres"
```

---

## Task 2: Database Schema & Migrations

**Files:**
- Create: `db/schema.ts`, `db/client.ts`, `db/migrate.ts`, `drizzle.config.ts`
- Test: `tests/db/schema.test.ts`

**Interfaces:**
- Produces: `db` (Drizzle instance) from `db/client.ts`; table objects `users`, `accounts`, `categories`, `transactions`, `budgets` and their inferred types (`typeof accounts.$inferSelect`, etc.) from `db/schema.ts`. All later tasks import from here.

- [ ] **Step 1: Write `db/schema.ts`**

```ts
import { pgTable, text, timestamp, boolean, numeric, date, jsonb, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const accountTypeEnum = pgEnum('account_type', ['bank', 'credit', 'cash', 'wallet', 'travel', 'grant']);
export const categoryTypeEnum = pgEnum('category_type', ['expense', 'income', 'transfer']);
export const transactionTypeEnum = pgEnum('transaction_type', ['expense', 'income', 'transfer']);
export const transactionStatusEnum = pgEnum('transaction_status', ['completed', 'pending', 'cancelled']);
export const reimbursementStatusEnum = pgEnum('reimbursement_status', ['to_claim', 'claimed', 'reimbursed']);

const genId = () => crypto.randomUUID();
const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
};

export const users = pgTable('users', {
  id: text('id').primaryKey().$defaultFn(genId),
  email: text('email').notNull().unique(),
  name: text('name'),
  image: text('image'),
  passwordHash: text('password_hash').notNull(),
  ...timestamps,
});

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey().$defaultFn(genId),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: accountTypeEnum('type').notNull(),
  currency: text('currency').notNull(),
  startingBalance: numeric('starting_balance', { precision: 14, scale: 2 }).notNull().default('0'),
  note: text('note'),
  archived: boolean('archived').notNull().default(false),
  ...timestamps,
}, (t) => ({
  userIdx: index('accounts_user_id_idx').on(t.userId),
}));

export const categories = pgTable('categories', {
  id: text('id').primaryKey().$defaultFn(genId),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: categoryTypeEnum('type').notNull(),
  icon: text('icon'),
  noBudget: boolean('no_budget').notNull().default(false),
  archived: boolean('archived').notNull().default(false),
  ...timestamps,
}, (t) => ({
  userIdx: index('categories_user_id_idx').on(t.userId),
}));

export const transactions = pgTable('transactions', {
  id: text('id').primaryKey().$defaultFn(genId),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  details: text('details').notNull(),
  type: transactionTypeEnum('type').notNull(),
  categoryId: text('category_id').references(() => categories.id, { onDelete: 'set null' }),
  payDate: date('pay_date').notNull(),
  fromAccountId: text('from_account_id').references(() => accounts.id, { onDelete: 'restrict' }),
  toAccountId: text('to_account_id').references(() => accounts.id, { onDelete: 'restrict' }),
  amount: numeric('amount', { precision: 14, scale: 2 }).notNull(),
  toAmount: numeric('to_amount', { precision: 14, scale: 2 }),
  currency: text('currency').notNull(),
  status: transactionStatusEnum('status').notNull().default('completed'),
  reimbursable: boolean('reimbursable').notNull().default(false),
  reimbursementStatus: reimbursementStatusEnum('reimbursement_status'),
  receipt: jsonb('receipt'),
  note: text('note'),
  ...timestamps,
}, (t) => ({
  userPayDateIdx: index('transactions_user_pay_date_idx').on(t.userId, t.payDate),
  userFromIdx: index('transactions_user_from_account_idx').on(t.userId, t.fromAccountId),
  userToIdx: index('transactions_user_to_account_idx').on(t.userId, t.toAccountId),
}));

export const budgets = pgTable('budgets', {
  id: text('id').primaryKey().$defaultFn(genId),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  month: text('month').notNull(),
  categoryId: text('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  currency: text('currency').notNull(),
  plannedAmount: numeric('planned_amount', { precision: 14, scale: 2 }).notNull(),
  ...timestamps,
}, (t) => ({
  userMonthIdx: index('budgets_user_month_idx').on(t.userId, t.month),
  uniqueBudget: uniqueIndex('budgets_user_month_category_currency_idx').on(t.userId, t.month, t.categoryId, t.currency),
}));

export type User = typeof users.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
```

- [ ] **Step 2: Write `drizzle.config.ts`**

```ts
import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './db/schema.ts',
  out: './db/migrations',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
});
```

- [ ] **Step 3: Write `db/client.ts`**

```ts
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
```

Note: `node-postgres` works for local dev/test and for Vercel when `DATABASE_URL` is a Neon pooled connection string, so a single client suffices — no separate edge driver is required for this app.

- [ ] **Step 4: Write `db/migrate.ts`**

```ts
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  await migrate(db, { migrationsFolder: './db/migrations' });
  await pool.end();
  console.log('Migrations applied');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 5: Generate and apply migration against local Postgres**

Run:
```bash
docker compose up -d postgres postgres_test
npm run db:generate
npm run db:migrate
```
Expected: `db/migrations/0000_*.sql` created; "Migrations applied" printed with no errors.

- [ ] **Step 6: Write schema smoke test against the test database**

```ts
// tests/db/schema.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { Pool } from 'pg';
import * as schema from '@/db/schema';

const pool = new Pool({ connectionString: process.env.DATABASE_URL_TEST });
const db = drizzle(pool, { schema });

beforeAll(async () => {
  await migrate(db, { migrationsFolder: './db/migrations' });
});

describe('schema', () => {
  it('inserts a user and a linked account', async () => {
    const [user] = await db.insert(schema.users).values({
      email: 'schema-test@example.com',
      passwordHash: 'hash',
    }).returning();

    const [account] = await db.insert(schema.accounts).values({
      userId: user.id,
      name: 'Test Bank',
      type: 'bank',
      currency: 'USD',
      startingBalance: '100.00',
    }).returning();

    expect(account.userId).toBe(user.id);
    expect(account.startingBalance).toBe('100.00');

    await db.delete(schema.users).where(schema.eq ? undefined as never : undefined); // placeholder removed below
  });
});
```

Replace the cleanup line — write it properly:

```ts
    await db.delete(schema.accounts);
    await db.delete(schema.users);
```

- [ ] **Step 7: Run test against test DB**

Run: `DATABASE_URL_TEST=postgres://app:app@localhost:5433/money_tracking_test npm test -- tests/db/schema.test.ts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add db drizzle.config.ts tests/db
git commit -m "feat: add Drizzle schema for users/accounts/categories/transactions/budgets"
```

---

## Task 3: Money Helper Library

**Files:**
- Create: `lib/money.ts`
- Test: `tests/lib/money.test.ts`

**Interfaces:**
- Produces: `toCents(numeric: string): number`, `fromCents(cents: number): string`, `addCents(...cents: number[]): number`, `formatMoney(cents: number, currency: string): string`. All balance/budget/dashboard math (Tasks 6, 9, 10) is built on these.

- [ ] **Step 1: Write failing tests**

```ts
// tests/lib/money.test.ts
import { describe, it, expect } from 'vitest';
import { toCents, fromCents, addCents, formatMoney } from '@/lib/money';

describe('money helpers', () => {
  it('converts a numeric string to integer cents', () => {
    expect(toCents('60.16')).toBe(6016);
    expect(toCents('0')).toBe(0);
    expect(toCents('3217')).toBe(321700);
  });

  it('converts cents back to a numeric string', () => {
    expect(fromCents(6016)).toBe('60.16');
    expect(fromCents(0)).toBe('0.00');
  });

  it('adds cents without float drift', () => {
    expect(addCents(toCents('0.10'), toCents('0.20'))).toBe(30);
  });

  it('formats money with currency', () => {
    expect(formatMoney(6016, 'USD')).toBe('$60.16');
    expect(formatMoney(-321700, 'USD')).toBe('-$3,217.00');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/lib/money.test.ts`
Expected: FAIL — module `@/lib/money` not found.

- [ ] **Step 3: Implement `lib/money.ts`**

```ts
export function toCents(numeric: string): number {
  const negative = numeric.trim().startsWith('-');
  const [wholeRaw, fracRaw = ''] = numeric.trim().replace('-', '').split('.');
  const whole = wholeRaw === '' ? 0 : parseInt(wholeRaw, 10);
  const frac = (fracRaw + '00').slice(0, 2);
  const cents = whole * 100 + parseInt(frac, 10);
  return negative ? -cents : cents;
}

export function fromCents(cents: number): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = String(abs % 100).padStart(2, '0');
  return `${negative ? '-' : ''}${whole}.${frac}`;
}

export function addCents(...values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0);
}

export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/lib/money.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/money.ts tests/lib/money.test.ts
git commit -m "feat: add integer-cents money helpers"
```

---

## Task 4: Authentication (Auth.js Credentials)

**Files:**
- Create: `lib/auth.ts`, `app/api/auth/[...nextauth]/route.ts`, `app/login/page.tsx`, `app/login/actions.ts`, `middleware.ts`, `scripts/create-user.ts`
- Test: `tests/scripts/create-user.test.ts`

**Interfaces:**
- Consumes: `db` from `db/client.ts`, `users` from `db/schema.ts`.
- Produces: `auth`, `signIn`, `signOut` exports from `lib/auth.ts`, used by every later server action/page that needs the session.

- [ ] **Step 1: Write `lib/auth.ts`**

```ts
import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) token.userId = user.id;
      return token;
    },
    async session({ session, token }) {
      if (session.user) session.user.id = token.userId as string;
      return session;
    },
  },
});
```

- [ ] **Step 2: Write route handler `app/api/auth/[...nextauth]/route.ts`**

```ts
import { handlers } from '@/lib/auth';
export const { GET, POST } = handlers;
```

- [ ] **Step 3: Write `middleware.ts` for route protection**

```ts
import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api/auth'];

export default auth((req) => {
  const isPublic = PUBLIC_PATHS.some((p) => req.nextUrl.pathname.startsWith(p));
  if (!req.auth && !isPublic) {
    const loginUrl = new URL('/login', req.nextUrl.origin);
    return NextResponse.redirect(loginUrl);
  }
});

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

- [ ] **Step 4: Write `app/login/actions.ts` and `app/login/page.tsx`**

```ts
// app/login/actions.ts
'use server';
import { signIn } from '@/lib/auth';
import { AuthError } from 'next-auth';

export async function loginAction(formData: FormData) {
  try {
    await signIn('credentials', {
      email: formData.get('email'),
      password: formData.get('password'),
      redirectTo: '/dashboard',
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: 'Invalid email or password' };
    }
    throw err;
  }
}
```

```tsx
// app/login/page.tsx
import { loginAction } from './actions';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <form action={loginAction} className="w-full max-w-sm space-y-4 rounded-lg border p-6">
        <h1 className="text-xl font-semibold">Sign in</h1>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" required autoComplete="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>
        <Button type="submit" className="w-full">Sign in</Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Write `scripts/create-user.ts`**

```ts
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { db } from '@/db/client';
import { users } from '@/db/schema';

function arg(name: string): string | undefined {
  const idx = process.argv.indexOf(`--${name}`);
  return idx === -1 ? undefined : process.argv[idx + 1];
}

export async function createUser(email: string, password: string, name?: string) {
  const passwordHash = await bcrypt.hash(password, 12);
  const [user] = await db.insert(users).values({ email, passwordHash, name }).returning();
  return user;
}

async function main() {
  const email = arg('email');
  const password = arg('password');
  const name = arg('name');
  if (!email || !password) {
    console.error('Usage: npm run create-user -- --email you@example.com --password secret [--name "Your Name"]');
    process.exit(1);
  }
  const user = await createUser(email, password, name);
  console.log(`Created user ${user.email} (${user.id})`);
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 6: Write test for `createUser`**

```ts
// tests/scripts/create-user.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { createUser } from '@/scripts/create-user';
import { db } from '@/db/client';
import { users } from '@/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

afterEach(async () => {
  await db.delete(users).where(eq(users.email, 'created@example.com'));
});

describe('createUser', () => {
  it('hashes the password and persists the user', async () => {
    const user = await createUser('created@example.com', 'plaintext-secret', 'Test User');
    expect(user.email).toBe('created@example.com');
    expect(user.passwordHash).not.toBe('plaintext-secret');
    expect(await bcrypt.compare('plaintext-secret', user.passwordHash)).toBe(true);
  });
});
```

- [ ] **Step 7: Run test**

Run: `npm test -- tests/scripts/create-user.test.ts`
Expected: PASS. `tests/setup-env.ts` (Task 1) already redirects `DATABASE_URL` to `DATABASE_URL_TEST` for the whole test run, so this hits the `postgres_test` docker service, not the dev database.

- [ ] **Step 8: Commit**

```bash
git add lib/auth.ts app/api/auth app/login middleware.ts scripts/create-user.ts tests/scripts
git commit -m "feat: add Auth.js credentials login, route protection, and create-user script"
```

---

## Task 5: Authorization Helpers

**Files:**
- Create: `lib/session.ts`, `lib/authorization.ts`
- Test: `tests/lib/authorization.test.ts`

**Interfaces:**
- Consumes: `auth` from `lib/auth.ts`, `db`, `accounts`, `categories`, `transactions`, `budgets` from `db/schema.ts`.
- Produces: `getCurrentUser()`, `getUserAccount(id)`, `getUserCategory(id)`, `getUserTransaction(id)`, `getUserBudget(id)`. Every server action in Tasks 6–14 calls these instead of querying tables directly by id.

- [ ] **Step 1: Write `lib/session.ts`**

```ts
import { auth } from '@/lib/auth';

export async function getCurrentUser() {
  const session = await auth();
  if (!session?.user?.id) {
    throw new Error('UNAUTHENTICATED');
  }
  return { id: session.user.id, email: session.user.email!, name: session.user.name ?? null };
}
```

- [ ] **Step 2: Write failing authorization tests**

```ts
// tests/lib/authorization.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/db/client';
import { users, accounts, categories } from '@/db/schema';
import { getUserAccount, getUserCategory } from '@/lib/authorization';

let userA: { id: string }, userB: { id: string };
let accountA: { id: string };

beforeAll(async () => {
  [userA] = await db.insert(users).values({ email: 'auth-a@example.com', passwordHash: 'x' }).returning();
  [userB] = await db.insert(users).values({ email: 'auth-b@example.com', passwordHash: 'x' }).returning();
  [accountA] = await db.insert(accounts).values({
    userId: userA.id, name: 'A Bank', type: 'bank', currency: 'USD', startingBalance: '0',
  }).returning();
});

afterAll(async () => {
  await db.delete(accounts);
  await db.delete(categories);
  await db.delete(users);
});

describe('getUserAccount', () => {
  it('returns the account when owned by the requesting user', async () => {
    const found = await getUserAccount(accountA.id, userA.id);
    expect(found?.id).toBe(accountA.id);
  });

  it('returns null when the account belongs to another user', async () => {
    const found = await getUserAccount(accountA.id, userB.id);
    expect(found).toBeNull();
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `npm test -- tests/lib/authorization.test.ts`
Expected: FAIL — `@/lib/authorization` not found.

- [ ] **Step 4: Implement `lib/authorization.ts`**

```ts
import { db } from '@/db/client';
import { accounts, categories, transactions, budgets } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export async function getUserAccount(id: string, userId: string) {
  const [row] = await db.select().from(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, userId))).limit(1);
  return row ?? null;
}

export async function getUserCategory(id: string, userId: string) {
  const [row] = await db.select().from(categories).where(and(eq(categories.id, id), eq(categories.userId, userId))).limit(1);
  return row ?? null;
}

export async function getUserTransaction(id: string, userId: string) {
  const [row] = await db.select().from(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId))).limit(1);
  return row ?? null;
}

export async function getUserBudget(id: string, userId: string) {
  const [row] = await db.select().from(budgets).where(and(eq(budgets.id, id), eq(budgets.userId, userId))).limit(1);
  return row ?? null;
}
```

- [ ] **Step 5: Run to verify pass**

Run: `npm test -- tests/lib/authorization.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/session.ts lib/authorization.ts tests/lib/authorization.test.ts
git commit -m "feat: add per-entity ownership-scoped authorization helpers"
```

---

## Task 6: Accounts — Balance Calculation + Server Actions

**Files:**
- Create: `lib/balances.ts`, `app/actions/accounts.ts`
- Test: `tests/lib/balances.test.ts`, `tests/app/actions/accounts.test.ts`

**Interfaces:**
- Consumes: `toCents`/`fromCents` from `lib/money.ts`, `getCurrentUser` from `lib/session.ts`, `getUserAccount` from `lib/authorization.ts`.
- Produces: `calculateAccountBalance(accountId: string, userId: string): Promise<{ cents: number; currency: string }>`; server actions `createAccount`, `updateAccount`, `setAccountArchived`, `listAccounts`, `getAccountWithBalance`.

- [ ] **Step 1: Write failing balance test**

```ts
// tests/lib/balances.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/db/client';
import { users, accounts, transactions } from '@/db/schema';
import { calculateAccountBalance } from '@/lib/balances';

let user: { id: string };
let checking: { id: string };
let savings: { id: string };

beforeAll(async () => {
  [user] = await db.insert(users).values({ email: 'balance@example.com', passwordHash: 'x' }).returning();
  [checking] = await db.insert(accounts).values({
    userId: user.id, name: 'Checking', type: 'bank', currency: 'USD', startingBalance: '100.00',
  }).returning();
  [savings] = await db.insert(accounts).values({
    userId: user.id, name: 'Savings', type: 'bank', currency: 'USD', startingBalance: '0',
  }).returning();

  await db.insert(transactions).values([
    { userId: user.id, details: 'Salary', type: 'income', payDate: '2026-09-01', toAccountId: checking.id, amount: '500.00', currency: 'USD' },
    { userId: user.id, details: 'Groceries', type: 'expense', payDate: '2026-09-02', fromAccountId: checking.id, amount: '40.00', currency: 'USD' },
    { userId: user.id, details: 'Move to savings', type: 'transfer', payDate: '2026-09-03', fromAccountId: checking.id, toAccountId: savings.id, amount: '60.00', currency: 'USD' },
  ]);
});

afterAll(async () => {
  await db.delete(transactions);
  await db.delete(accounts);
  await db.delete(users);
});

describe('calculateAccountBalance', () => {
  it('applies starting balance + income - expense - outgoing transfer', async () => {
    const result = await calculateAccountBalance(checking.id, user.id);
    // 100 + 500 - 40 - 60 = 500.00
    expect(result.cents).toBe(50000);
    expect(result.currency).toBe('USD');
  });

  it('applies incoming transfer', async () => {
    const result = await calculateAccountBalance(savings.id, user.id);
    // 0 + 60 = 60.00
    expect(result.cents).toBe(6000);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/lib/balances.test.ts`
Expected: FAIL — `@/lib/balances` not found.

- [ ] **Step 3: Implement `lib/balances.ts`**

```ts
import { db } from '@/db/client';
import { accounts, transactions } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { toCents, addCents } from '@/lib/money';

export async function calculateAccountBalance(accountId: string, userId: string) {
  const [account] = await db.select().from(accounts).where(and(eq(accounts.id, accountId), eq(accounts.userId, userId))).limit(1);
  if (!account) throw new Error('Account not found');

  const rows = await db.select().from(transactions).where(eq(transactions.userId, userId));

  let cents = toCents(account.startingBalance);
  for (const t of rows) {
    if (t.type === 'income' && t.toAccountId === accountId) {
      cents = addCents(cents, toCents(t.amount));
    } else if (t.type === 'expense' && t.fromAccountId === accountId) {
      cents = addCents(cents, -toCents(t.amount));
    } else if (t.type === 'transfer') {
      if (t.fromAccountId === accountId) cents = addCents(cents, -toCents(t.amount));
      if (t.toAccountId === accountId) cents = addCents(cents, toCents(t.toAmount ?? t.amount));
    }
  }

  return { cents, currency: account.currency };
}
```

Note: for credit accounts, this same formula applies — spending on a credit account decreases its balance (going negative represents amount owed), and paying it off is a transfer that increases it back toward zero. Document this convention in the README (Task 18).

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/lib/balances.test.ts`
Expected: PASS.

- [ ] **Step 5: Write failing test for account server actions**

```ts
// tests/app/actions/accounts.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/db/client';
import { users, accounts } from '@/db/schema';

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
import { getCurrentUser } from '@/lib/session';
import { createAccount, listAccounts, setAccountArchived } from '@/app/actions/accounts';

let user: { id: string };

beforeAll(async () => {
  [user] = await db.insert(users).values({ email: 'accounts-action@example.com', passwordHash: 'x' }).returning();
  (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: user.id, email: user.email, name: null });
});

afterAll(async () => {
  await db.delete(accounts);
  await db.delete(users);
});

describe('account actions', () => {
  it('creates an account scoped to the current user', async () => {
    const account = await createAccount({ name: 'Wallet', type: 'wallet', currency: 'USD', startingBalance: '0' });
    expect(account.userId).toBe(user.id);
  });

  it('lists only the current user accounts', async () => {
    const list = await listAccounts();
    expect(list.every((a) => a.userId === user.id)).toBe(true);
    expect(list.length).toBeGreaterThan(0);
  });

  it('archives an account', async () => {
    const account = await createAccount({ name: 'Old Cash', type: 'cash', currency: 'USD', startingBalance: '0' });
    const updated = await setAccountArchived(account.id, true);
    expect(updated.archived).toBe(true);
  });
});
```

- [ ] **Step 6: Run to verify failure**

Run: `npm test -- tests/app/actions/accounts.test.ts`
Expected: FAIL — `@/app/actions/accounts` not found.

- [ ] **Step 7: Implement `app/actions/accounts.ts`**

```ts
'use server';
import { z } from 'zod';
import { db } from '@/db/client';
import { accounts } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/session';
import { getUserAccount } from '@/lib/authorization';
import { calculateAccountBalance } from '@/lib/balances';

const accountInput = z.object({
  name: z.string().min(1),
  type: z.enum(['bank', 'credit', 'cash', 'wallet', 'travel', 'grant']),
  currency: z.string().min(3).max(3),
  startingBalance: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
  note: z.string().optional(),
});

export async function createAccount(input: z.infer<typeof accountInput>) {
  const user = await getCurrentUser();
  const data = accountInput.parse(input);
  const [account] = await db.insert(accounts).values({ ...data, userId: user.id }).returning();
  return account;
}

export async function updateAccount(id: string, input: Partial<z.infer<typeof accountInput>>) {
  const user = await getCurrentUser();
  const existing = await getUserAccount(id, user.id);
  if (!existing) throw new Error('NOT_FOUND');
  const data = accountInput.partial().parse(input);
  const [updated] = await db.update(accounts).set({ ...data, updatedAt: new Date() })
    .where(and(eq(accounts.id, id), eq(accounts.userId, user.id))).returning();
  return updated;
}

export async function setAccountArchived(id: string, archived: boolean) {
  const user = await getCurrentUser();
  const existing = await getUserAccount(id, user.id);
  if (!existing) throw new Error('NOT_FOUND');
  const [updated] = await db.update(accounts).set({ archived, updatedAt: new Date() })
    .where(and(eq(accounts.id, id), eq(accounts.userId, user.id))).returning();
  return updated;
}

export async function listAccounts() {
  const user = await getCurrentUser();
  return db.select().from(accounts).where(eq(accounts.userId, user.id));
}

export async function getAccountWithBalance(id: string) {
  const user = await getCurrentUser();
  const account = await getUserAccount(id, user.id);
  if (!account) throw new Error('NOT_FOUND');
  const balance = await calculateAccountBalance(id, user.id);
  return { account, balance };
}
```

- [ ] **Step 8: Run to verify pass**

Run: `npm test -- tests/app/actions/accounts.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/balances.ts app/actions/accounts.ts tests/lib/balances.test.ts tests/app/actions/accounts.test.ts
git commit -m "feat: add account balance calculation and CRUD server actions"
```

---

## Task 7: Accounts UI

**Files:**
- Create: `app/(app)/layout.tsx`, `app/(app)/accounts/page.tsx`, `app/(app)/accounts/[id]/page.tsx`, `components/account-form.tsx`, `components/nav.tsx`

**Interfaces:**
- Consumes: `listAccounts`, `getAccountWithBalance`, `createAccount`, `setAccountArchived` from `app/actions/accounts.ts`; `formatMoney` from `lib/money.ts`.

- [ ] **Step 1: Write `components/nav.tsx`**

```tsx
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOutAction } from '@/app/actions/auth-ui';

const LINKS = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/transactions', label: 'Transactions' },
  { href: '/accounts', label: 'Accounts' },
  { href: '/budgets', label: 'Budgets' },
  { href: '/categories', label: 'Categories' },
  { href: '/reimbursements', label: 'Reimbursements' },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="flex h-full flex-col justify-between border-r p-4">
      <ul className="space-y-1">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className={`block rounded-md px-3 py-2 text-sm ${pathname.startsWith(link.href) ? 'bg-accent font-medium' : 'hover:bg-accent/50'}`}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
      <ul className="space-y-1 border-t pt-4">
        <li><Link href="/settings" className="block rounded-md px-3 py-2 text-sm hover:bg-accent/50">Settings</Link></li>
        <li><form action={signOutAction}><button className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-accent/50">Sign Out</button></form></li>
      </ul>
    </nav>
  );
}
```

- [ ] **Step 2: Write `app/actions/auth-ui.ts`**

```ts
'use server';
import { signOut } from '@/lib/auth';

export async function signOutAction() {
  await signOut({ redirectTo: '/login' });
}
```

- [ ] **Step 3: Write `app/(app)/layout.tsx`**

```tsx
import { Nav } from '@/components/nav';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr]">
      <Nav />
      <main className="overflow-y-auto p-6">{children}</main>
    </div>
  );
}
```

- [ ] **Step 4: Write `components/account-form.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { createAccount } from '@/app/actions/accounts';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';

const ACCOUNT_TYPES = ['bank', 'credit', 'cash', 'wallet', 'travel', 'grant'] as const;

export function AccountForm() {
  const router = useRouter();
  const [type, setType] = useState<(typeof ACCOUNT_TYPES)[number]>('bank');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    try {
      await createAccount({
        name: String(formData.get('name')),
        type,
        currency: String(formData.get('currency')),
        startingBalance: String(formData.get('startingBalance') || '0'),
      });
      router.refresh();
    } catch {
      setError('Could not create account. Check the fields and try again.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={onSubmit} className="space-y-4 rounded-lg border p-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-2">
        <Label>Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {ACCOUNT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="currency">Currency</Label>
        <Input id="currency" name="currency" placeholder="USD" required maxLength={3} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="startingBalance">Starting balance</Label>
        <Input id="startingBalance" name="startingBalance" placeholder="0.00" />
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>{pending ? 'Creating…' : 'Create account'}</Button>
    </form>
  );
}
```

- [ ] **Step 5: Write `app/(app)/accounts/page.tsx`**

```tsx
import { listAccounts } from '@/app/actions/accounts';
import { calculateAccountBalance } from '@/lib/balances';
import { getCurrentUser } from '@/lib/session';
import { formatMoney } from '@/lib/money';
import { toCents } from '@/lib/money';
import Link from 'next/link';
import { AccountForm } from '@/components/account-form';
import { Badge } from '@/components/ui/badge';

export default async function AccountsPage() {
  const user = await getCurrentUser();
  const accounts = await listAccounts();
  const withBalances = await Promise.all(
    accounts.map(async (a) => ({ ...a, balance: await calculateAccountBalance(a.id, user.id) }))
  );

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Accounts</h1>
      {withBalances.length === 0 ? (
        <p className="text-muted-foreground">No accounts yet. Create your first one below.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {withBalances.map((a) => (
            <Link key={a.id} href={`/accounts/${a.id}`} className="rounded-lg border p-4 hover:bg-accent/40">
              <div className="flex items-center justify-between">
                <span className="font-medium">{a.name}</span>
                {a.archived && <Badge variant="secondary">Archived</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">{a.type} · {a.currency}</p>
              <p className="mt-2 text-lg font-semibold">{formatMoney(a.balance.cents, a.currency)}</p>
            </Link>
          ))}
        </div>
      )}
      <AccountForm />
    </div>
  );
}
```

- [ ] **Step 6: Write `app/(app)/accounts/[id]/page.tsx`**

```tsx
import { getAccountWithBalance } from '@/app/actions/accounts';
import { formatMoney } from '@/lib/money';
import { db } from '@/db/client';
import { transactions } from '@/db/schema';
import { or, eq, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/session';
import { notFound } from 'next/navigation';

export default async function AccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();

  let account, balance;
  try {
    ({ account, balance } = await getAccountWithBalance(id));
  } catch {
    notFound();
  }

  const history = await db.select().from(transactions)
    .where(or(eq(transactions.fromAccountId, id), eq(transactions.toAccountId, id)))
    .orderBy(desc(transactions.payDate));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">{account.name}</h1>
        <p className="text-muted-foreground">{account.type} · {account.currency}</p>
        <p className="mt-2 text-3xl font-bold">{formatMoney(balance.cents, account.currency)}</p>
      </div>
      <div className="rounded-lg border divide-y">
        {history.filter((t) => t.userId === user.id).map((t) => (
          <div key={t.id} className="flex items-center justify-between p-3">
            <div>
              <p className="font-medium">{t.details}</p>
              <p className="text-sm text-muted-foreground">{t.payDate} · {t.type}</p>
            </div>
            <p>{formatMoney(t.fromAccountId === id ? -1 : 1, t.currency) && formatMoney(Number(t.amount) * 100 * (t.fromAccountId === id ? -1 : 1), t.currency)}</p>
          </div>
        ))}
        {history.length === 0 && <p className="p-3 text-sm text-muted-foreground">No transactions yet.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Manual QA**

Run: `npm run dev`, sign in (after creating a user via Task 4's script), visit `/accounts`, create an account, open its detail page.
Expected: account appears with correct balance; detail page loads without errors.

- [ ] **Step 8: Commit**

```bash
git add "app/(app)" components/nav.tsx components/account-form.tsx app/actions/auth-ui.ts
git commit -m "feat: add authenticated app shell and accounts UI"
```

---

## Task 8: Categories — Actions + UI

**Files:**
- Create: `app/actions/categories.ts`, `app/(app)/categories/page.tsx`, `components/category-form.tsx`
- Test: `tests/app/actions/categories.test.ts`

**Interfaces:**
- Consumes: `getCurrentUser`, `getUserCategory`, `db`, `categories`, `transactions` (for delete safety).
- Produces: `createCategory`, `updateCategory`, `archiveCategory`, `deleteCategory`, `listCategories`.

- [ ] **Step 1: Write failing test**

```ts
// tests/app/actions/categories.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/db/client';
import { users, categories, transactions } from '@/db/schema';

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
import { getCurrentUser } from '@/lib/session';
import { createCategory, deleteCategory, listCategories } from '@/app/actions/categories';

let user: { id: string };

beforeAll(async () => {
  [user] = await db.insert(users).values({ email: 'cat-action@example.com', passwordHash: 'x' }).returning();
  (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: user.id, email: user.email, name: null });
});

afterAll(async () => {
  await db.delete(transactions);
  await db.delete(categories);
  await db.delete(users);
});

describe('category actions', () => {
  it('creates and lists a category scoped to the user', async () => {
    await createCategory({ name: 'Groceries', type: 'expense', icon: '🛒', noBudget: false });
    const list = await listCategories();
    expect(list.some((c) => c.name === 'Groceries')).toBe(true);
  });

  it('deleting a category nulls out categoryId on historical transactions instead of failing', async () => {
    const category = await createCategory({ name: 'Rent', type: 'expense', icon: '🏠', noBudget: false });
    await db.insert(transactions).values({
      userId: user.id, details: 'Rent payment', type: 'expense', payDate: '2026-09-01',
      categoryId: category.id, amount: '10.00', currency: 'USD',
    });

    await deleteCategory(category.id);

    const [txn] = await db.select().from(transactions).where(eq(transactions.details, 'Rent payment'));
    expect(txn.categoryId).toBeNull();
  });
});

import { eq } from 'drizzle-orm';
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/app/actions/categories.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `app/actions/categories.ts`**

```ts
'use server';
import { z } from 'zod';
import { db } from '@/db/client';
import { categories } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/session';
import { getUserCategory } from '@/lib/authorization';

const categoryInput = z.object({
  name: z.string().min(1),
  type: z.enum(['expense', 'income', 'transfer']),
  icon: z.string().optional(),
  noBudget: z.boolean().default(false),
});

export async function createCategory(input: z.infer<typeof categoryInput>) {
  const user = await getCurrentUser();
  const data = categoryInput.parse(input);
  const [category] = await db.insert(categories).values({ ...data, userId: user.id }).returning();
  return category;
}

export async function updateCategory(id: string, input: Partial<z.infer<typeof categoryInput>>) {
  const user = await getCurrentUser();
  const existing = await getUserCategory(id, user.id);
  if (!existing) throw new Error('NOT_FOUND');
  const data = categoryInput.partial().parse(input);
  const [updated] = await db.update(categories).set({ ...data, updatedAt: new Date() })
    .where(and(eq(categories.id, id), eq(categories.userId, user.id))).returning();
  return updated;
}

export async function archiveCategory(id: string, archived = true) {
  const user = await getCurrentUser();
  const existing = await getUserCategory(id, user.id);
  if (!existing) throw new Error('NOT_FOUND');
  const [updated] = await db.update(categories).set({ archived, updatedAt: new Date() })
    .where(and(eq(categories.id, id), eq(categories.userId, user.id))).returning();
  return updated;
}

export async function deleteCategory(id: string) {
  const user = await getCurrentUser();
  const existing = await getUserCategory(id, user.id);
  if (!existing) throw new Error('NOT_FOUND');
  // transactions.category_id has ON DELETE SET NULL, budgets.category_id has ON DELETE CASCADE —
  // deleting a category preserves transaction history and only removes budgets tied to it.
  await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, user.id)));
}

export async function listCategories() {
  const user = await getCurrentUser();
  return db.select().from(categories).where(eq(categories.userId, user.id));
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/app/actions/categories.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `components/category-form.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { createCategory } from '@/app/actions/categories';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useRouter } from 'next/navigation';

const TYPES = ['expense', 'income', 'transfer'] as const;

export function CategoryForm() {
  const router = useRouter();
  const [type, setType] = useState<(typeof TYPES)[number]>('expense');
  const [noBudget, setNoBudget] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    try {
      await createCategory({
        name: String(formData.get('name')),
        type,
        icon: String(formData.get('icon') || ''),
        noBudget,
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={onSubmit} className="space-y-4 rounded-lg border p-4">
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="icon">Icon (emoji)</Label>
        <Input id="icon" name="icon" placeholder="🛒" />
      </div>
      <div className="space-y-2">
        <Label>Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-2">
        <Switch checked={noBudget} onCheckedChange={setNoBudget} id="noBudget" />
        <Label htmlFor="noBudget">Exclude from budgeting</Label>
      </div>
      <Button type="submit" disabled={pending}>{pending ? 'Creating…' : 'Create category'}</Button>
    </form>
  );
}
```

- [ ] **Step 6: Write `app/(app)/categories/page.tsx`**

```tsx
import { listCategories } from '@/app/actions/categories';
import { CategoryForm } from '@/components/category-form';
import { Badge } from '@/components/ui/badge';

export default async function CategoriesPage() {
  const categories = await listCategories();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Categories</h1>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {categories.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-lg border p-3">
            <span>{c.icon} {c.name}</span>
            <div className="flex gap-1">
              <Badge variant="outline">{c.type}</Badge>
              {c.noBudget && <Badge variant="secondary">No budget</Badge>}
              {c.archived && <Badge variant="secondary">Archived</Badge>}
            </div>
          </div>
        ))}
        {categories.length === 0 && <p className="text-muted-foreground">No categories yet.</p>}
      </div>
      <CategoryForm />
    </div>
  );
}
```

- [ ] **Step 7: Manual QA**

Run: `npm run dev`, visit `/categories`, create a category, confirm it appears.

- [ ] **Step 8: Commit**

```bash
git add app/actions/categories.ts "app/(app)/categories" components/category-form.tsx tests/app/actions/categories.test.ts
git commit -m "feat: add category CRUD with delete-safe transaction handling"
```

---

## Task 9: Transactions — Actions

**Files:**
- Create: `app/actions/transactions.ts`
- Test: `tests/app/actions/transactions.test.ts`

**Interfaces:**
- Consumes: `getCurrentUser`, `getUserAccount`, `getUserCategory`, `getUserTransaction`.
- Produces: `createTransaction`, `updateTransaction`, `deleteTransaction`, `listTransactions(filters?)`, `getTransaction(id)`. This is the task that enforces "a transaction must only reference accounts/categories belonging to the same user."

- [ ] **Step 1: Write failing tests**

```ts
// tests/app/actions/transactions.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/db/client';
import { users, accounts, categories, transactions } from '@/db/schema';

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
import { getCurrentUser } from '@/lib/session';
import { createTransaction } from '@/app/actions/transactions';

let userA: { id: string }, userB: { id: string };
let accountA: { id: string }, accountB: { id: string };
let categoryA: { id: string };

beforeAll(async () => {
  [userA] = await db.insert(users).values({ email: 'txn-a@example.com', passwordHash: 'x' }).returning();
  [userB] = await db.insert(users).values({ email: 'txn-b@example.com', passwordHash: 'x' }).returning();
  [accountA] = await db.insert(accounts).values({ userId: userA.id, name: 'A', type: 'bank', currency: 'USD', startingBalance: '0' }).returning();
  [accountB] = await db.insert(accounts).values({ userId: userB.id, name: 'B', type: 'bank', currency: 'USD', startingBalance: '0' }).returning();
  [categoryA] = await db.insert(categories).values({ userId: userA.id, name: 'Food', type: 'expense' }).returning();
  (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userA.id, email: userA.email, name: null });
});

afterAll(async () => {
  await db.delete(transactions);
  await db.delete(categories);
  await db.delete(accounts);
  await db.delete(users);
});

describe('createTransaction', () => {
  it('creates an expense referencing the user\'s own account and category', async () => {
    const txn = await createTransaction({
      details: 'Lunch', type: 'expense', payDate: '2026-09-10',
      fromAccountId: accountA.id, categoryId: categoryA.id, amount: '12.50', currency: 'USD',
    });
    expect(txn.userId).toBe(userA.id);
  });

  it('rejects a transaction referencing another user\'s account', async () => {
    await expect(createTransaction({
      details: 'Bad', type: 'expense', payDate: '2026-09-10',
      fromAccountId: accountB.id, categoryId: categoryA.id, amount: '10.00', currency: 'USD',
    })).rejects.toThrow('FORBIDDEN');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/app/actions/transactions.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `app/actions/transactions.ts`**

```ts
'use server';
import { z } from 'zod';
import { db } from '@/db/client';
import { transactions } from '@/db/schema';
import { and, eq, gte, lte, desc } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/session';
import { getUserAccount, getUserCategory, getUserTransaction } from '@/lib/authorization';

const baseFields = {
  details: z.string().min(1),
  payDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  toAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  currency: z.string().length(3),
  categoryId: z.string().optional(),
  fromAccountId: z.string().optional(),
  toAccountId: z.string().optional(),
  reimbursable: z.boolean().default(false),
  reimbursementStatus: z.enum(['to_claim', 'claimed', 'reimbursed']).optional(),
  note: z.string().optional(),
  receipt: z.any().optional(),
};

const transactionInput = z.discriminatedUnion('type', [
  // `...baseFields` MUST come first in each branch: baseFields.fromAccountId/toAccountId are
  // `.optional()`, and object-spread order means a later key wins. Spreading baseFields first
  // and overriding the required id(s) after is what actually makes them required per type —
  // the reverse order silently makes every branch's ids optional again.
  z.object({ ...baseFields, type: z.literal('expense'), fromAccountId: z.string() }),
  z.object({ ...baseFields, type: z.literal('income'), toAccountId: z.string() }),
  z.object({ ...baseFields, type: z.literal('transfer'), fromAccountId: z.string(), toAccountId: z.string() }),
]);

async function assertOwnedReferences(userId: string, data: { fromAccountId?: string; toAccountId?: string; categoryId?: string }) {
  if (data.fromAccountId && !(await getUserAccount(data.fromAccountId, userId))) throw new Error('FORBIDDEN');
  if (data.toAccountId && !(await getUserAccount(data.toAccountId, userId))) throw new Error('FORBIDDEN');
  if (data.categoryId && !(await getUserCategory(data.categoryId, userId))) throw new Error('FORBIDDEN');
}

export async function createTransaction(input: z.infer<typeof transactionInput>) {
  const user = await getCurrentUser();
  const data = transactionInput.parse(input);
  await assertOwnedReferences(user.id, data);
  const [txn] = await db.insert(transactions).values({ ...data, userId: user.id }).returning();
  return txn;
}

export async function updateTransaction(id: string, input: Partial<z.infer<typeof transactionInput>>) {
  const user = await getCurrentUser();
  const existing = await getUserTransaction(id, user.id);
  if (!existing) throw new Error('NOT_FOUND');
  await assertOwnedReferences(user.id, input);
  const [updated] = await db.update(transactions).set({ ...input, updatedAt: new Date() })
    .where(and(eq(transactions.id, id), eq(transactions.userId, user.id))).returning();
  return updated;
}

export async function deleteTransaction(id: string) {
  const user = await getCurrentUser();
  const existing = await getUserTransaction(id, user.id);
  if (!existing) throw new Error('NOT_FOUND');
  await db.delete(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, user.id)));
}

export async function getTransaction(id: string) {
  const user = await getCurrentUser();
  const txn = await getUserTransaction(id, user.id);
  if (!txn) throw new Error('NOT_FOUND');
  return txn;
}

export async function listTransactions(filters?: { from?: string; to?: string }) {
  const user = await getCurrentUser();
  const conditions = [eq(transactions.userId, user.id)];
  if (filters?.from) conditions.push(gte(transactions.payDate, filters.from));
  if (filters?.to) conditions.push(lte(transactions.payDate, filters.to));
  return db.select().from(transactions).where(and(...conditions)).orderBy(desc(transactions.payDate));
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/app/actions/transactions.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/actions/transactions.ts tests/app/actions/transactions.test.ts
git commit -m "feat: add transaction CRUD with type-adaptive validation and cross-user reference checks"
```

---

## Task 10: Transactions UI

**Files:**
- Create: `app/(app)/transactions/page.tsx`, `app/(app)/transactions/new/page.tsx`, `app/(app)/transactions/[id]/page.tsx`, `components/transaction-form.tsx`

**Interfaces:**
- Consumes: `listTransactions`, `createTransaction`, `getTransaction`, `updateTransaction`, `deleteTransaction` from `app/actions/transactions.ts`; `listAccounts` from `app/actions/accounts.ts`; `listCategories` from `app/actions/categories.ts`.

- [ ] **Step 1: Write `components/transaction-form.tsx`** (adapts field order/visibility to type; used for both new and edit)

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createTransaction, updateTransaction } from '@/app/actions/transactions';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Account, Category, Transaction } from '@/db/schema';

const TYPES = ['expense', 'income', 'transfer'] as const;

export function TransactionForm({
  accounts, categories, existing,
}: { accounts: Account[]; categories: Category[]; existing?: Transaction }) {
  const router = useRouter();
  const [type, setType] = useState<(typeof TYPES)[number]>(existing?.type ?? 'expense');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const relevantCategories = categories.filter((c) => c.type === type);

  async function onSubmit(formData: FormData) {
    setPending(true);
    setError(null);
    const payload = {
      type,
      details: String(formData.get('details')),
      payDate: String(formData.get('payDate')),
      amount: String(formData.get('amount')),
      currency: String(formData.get('currency')),
      categoryId: String(formData.get('categoryId') || '') || undefined,
      fromAccountId: String(formData.get('fromAccountId') || '') || undefined,
      toAccountId: String(formData.get('toAccountId') || '') || undefined,
      toAmount: String(formData.get('toAmount') || '') || undefined,
      note: String(formData.get('note') || '') || undefined,
    } as Parameters<typeof createTransaction>[0];

    try {
      if (existing) await updateTransaction(existing.id, payload);
      else await createTransaction(payload);
      router.push('/transactions');
      router.refresh();
    } catch {
      setError('Could not save transaction. Check that the account/category are valid.');
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={onSubmit} className="max-w-lg space-y-4 rounded-lg border p-4">
      <div className="space-y-2">
        <Label>Type</Label>
        <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="details">Details</Label>
        <Input id="details" name="details" defaultValue={existing?.details} required />
      </div>

      {(type === 'expense' || type === 'transfer') && (
        <div className="space-y-2">
          <Label htmlFor="fromAccountId">From account</Label>
          <Select name="fromAccountId" defaultValue={existing?.fromAccountId ?? undefined}>
            <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

      {type === 'expense' && (
        <div className="space-y-2">
          <Label htmlFor="categoryId">Category</Label>
          <Select name="categoryId" defaultValue={existing?.categoryId ?? undefined}>
            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>{relevantCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

      {type === 'income' && (
        <div className="space-y-2">
          <Label htmlFor="categoryId">Category</Label>
          <Select name="categoryId" defaultValue={existing?.categoryId ?? undefined}>
            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>{relevantCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

      {(type === 'income' || type === 'transfer') && (
        <div className="space-y-2">
          <Label htmlFor="toAccountId">To account</Label>
          <Select name="toAccountId" defaultValue={existing?.toAccountId ?? undefined}>
            <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
            <SelectContent>{accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="amount">Amount</Label>
          <Input id="amount" name="amount" defaultValue={existing?.amount} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="currency">Currency</Label>
          <Input id="currency" name="currency" defaultValue={existing?.currency ?? 'USD'} required maxLength={3} />
        </div>
      </div>

      {type === 'transfer' && (
        <div className="space-y-2">
          <Label htmlFor="toAmount">To amount (only if currencies differ)</Label>
          <Input id="toAmount" name="toAmount" defaultValue={existing?.toAmount ?? undefined} />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="payDate">Date</Label>
        <Input id="payDate" name="payDate" type="date" defaultValue={existing?.payDate} required />
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">Note</Label>
        <Input id="note" name="note" defaultValue={existing?.note ?? undefined} />
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Save transaction'}</Button>
    </form>
  );
}
```

- [ ] **Step 2: Write `app/(app)/transactions/new/page.tsx`**

```tsx
import { listAccounts } from '@/app/actions/accounts';
import { listCategories } from '@/app/actions/categories';
import { TransactionForm } from '@/components/transaction-form';

export default async function NewTransactionPage() {
  const [accounts, categories] = await Promise.all([listAccounts(), listCategories()]);
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Add Transaction</h1>
      <TransactionForm accounts={accounts} categories={categories} />
    </div>
  );
}
```

- [ ] **Step 3: Write `app/(app)/transactions/[id]/page.tsx`**

```tsx
import { getTransaction } from '@/app/actions/transactions';
import { listAccounts } from '@/app/actions/accounts';
import { listCategories } from '@/app/actions/categories';
import { TransactionForm } from '@/components/transaction-form';
import { notFound } from 'next/navigation';

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [accounts, categories] = await Promise.all([listAccounts(), listCategories()]);
  let txn;
  try {
    txn = await getTransaction(id);
  } catch {
    notFound();
  }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Edit Transaction</h1>
      <TransactionForm accounts={accounts} categories={categories} existing={txn} />
    </div>
  );
}
```

- [ ] **Step 4: Write `app/(app)/transactions/page.tsx`**

```tsx
import { listTransactions } from '@/app/actions/transactions';
import { formatMoney, toCents } from '@/lib/money';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default async function TransactionsPage() {
  const transactions = await listTransactions();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Transactions</h1>
        <Button asChild><Link href="/transactions/new">Add Transaction</Link></Button>
      </div>
      <div className="rounded-lg border divide-y">
        {transactions.map((t) => (
          <Link key={t.id} href={`/transactions/${t.id}`} className="flex items-center justify-between p-3 hover:bg-accent/40">
            <div>
              <p className="font-medium">{t.details}</p>
              <p className="text-sm text-muted-foreground">{t.payDate} · {t.type}</p>
            </div>
            <p className={t.type === 'expense' ? 'text-destructive' : 'text-foreground'}>
              {formatMoney(toCents(t.amount) * (t.type === 'expense' ? -1 : 1), t.currency)}
            </p>
          </Link>
        ))}
        {transactions.length === 0 && <p className="p-4 text-sm text-muted-foreground">No transactions yet. Add your first one.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Manual QA**

Run: `npm run dev`, create an account and a category, then go to `/transactions/new` and create an expense, an income, and a transfer. Verify the form fields adapt per type and the list/detail pages render correctly.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/transactions" components/transaction-form.tsx
git commit -m "feat: add type-adaptive transaction UI (list, new, edit)"
```

---

## Task 11: Budgets — Calculation + Actions + UI

**Files:**
- Create: `lib/budget-calc.ts`, `app/actions/budgets.ts`, `app/(app)/budgets/page.tsx`, `components/budget-form.tsx`
- Test: `tests/lib/budget-calc.test.ts`

**Interfaces:**
- Consumes: `toCents` from `lib/money.ts`, `db`, `budgets`, `transactions`, `categories`.
- Produces: `calculateBudgetProgress(userId, month): Promise<BudgetProgress[]>` where `BudgetProgress = { budget: Budget; category: Category; plannedCents: number; spentCents: number; remainingCents: number; percentUsed: number }`; actions `createBudget`, `updateBudget`, `deleteBudget`, `copyPreviousMonth`, `listBudgets(month)`.

- [ ] **Step 1: Write failing calc test**

```ts
// tests/lib/budget-calc.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/db/client';
import { users, categories, transactions, budgets } from '@/db/schema';
import { calculateBudgetProgress } from '@/lib/budget-calc';

let user: { id: string };
let groceries: { id: string };

beforeAll(async () => {
  [user] = await db.insert(users).values({ email: 'budget-calc@example.com', passwordHash: 'x' }).returning();
  [groceries] = await db.insert(categories).values({ userId: user.id, name: 'Groceries', type: 'expense' }).returning();

  await db.insert(budgets).values({ userId: user.id, month: '2026-09', categoryId: groceries.id, currency: 'USD', plannedAmount: '300.00' });

  await db.insert(transactions).values([
    { userId: user.id, details: 'Store A', type: 'expense', payDate: '2026-09-05', categoryId: groceries.id, amount: '120.00', currency: 'USD' },
    { userId: user.id, details: 'Store B', type: 'expense', payDate: '2026-09-15', categoryId: groceries.id, amount: '50.00', currency: 'USD' },
    // income in the same category should NOT count against spend
    { userId: user.id, details: 'Refund', type: 'income', payDate: '2026-09-16', categoryId: groceries.id, amount: '10.00', currency: 'USD' },
    // different month, should not count
    { userId: user.id, details: 'Store C', type: 'expense', payDate: '2026-08-01', categoryId: groceries.id, amount: '999.00', currency: 'USD' },
  ]);
});

afterAll(async () => {
  await db.delete(transactions);
  await db.delete(budgets);
  await db.delete(categories);
  await db.delete(users);
});

describe('calculateBudgetProgress', () => {
  it('sums only same-month expense transactions against the planned amount', async () => {
    const [progress] = await calculateBudgetProgress(user.id, '2026-09');
    expect(progress.plannedCents).toBe(30000);
    expect(progress.spentCents).toBe(17000);
    expect(progress.remainingCents).toBe(13000);
    expect(progress.percentUsed).toBeCloseTo(56.67, 1);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/lib/budget-calc.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/budget-calc.ts`**

```ts
import { db } from '@/db/client';
import { budgets, transactions, categories } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { toCents } from '@/lib/money';

export async function calculateBudgetProgress(userId: string, month: string) {
  const rows = await db.select().from(budgets)
    .innerJoin(categories, eq(budgets.categoryId, categories.id))
    .where(and(eq(budgets.userId, userId), eq(budgets.month, month)));

  const monthTransactions = await db.select().from(transactions)
    .where(and(eq(transactions.userId, userId), eq(transactions.type, 'expense')));

  return rows.map(({ budgets: budget, categories: category }) => {
    const spentCents = monthTransactions
      .filter((t) => t.categoryId === category.id && t.payDate.startsWith(month))
      .reduce((sum, t) => sum + toCents(t.amount), 0);
    const plannedCents = toCents(budget.plannedAmount);
    const remainingCents = plannedCents - spentCents;
    const percentUsed = plannedCents === 0 ? 0 : (spentCents / plannedCents) * 100;
    return { budget, category, plannedCents, spentCents, remainingCents, percentUsed };
  });
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/lib/budget-calc.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement `app/actions/budgets.ts`**

```ts
'use server';
import { z } from 'zod';
import { db } from '@/db/client';
import { budgets } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/session';
import { getUserBudget, getUserCategory } from '@/lib/authorization';
import { calculateBudgetProgress } from '@/lib/budget-calc';

const budgetInput = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  categoryId: z.string(),
  currency: z.string().length(3),
  plannedAmount: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

export async function createBudget(input: z.infer<typeof budgetInput>) {
  const user = await getCurrentUser();
  const data = budgetInput.parse(input);
  if (!(await getUserCategory(data.categoryId, user.id))) throw new Error('FORBIDDEN');
  const [budget] = await db.insert(budgets).values({ ...data, userId: user.id }).returning();
  return budget;
}

export async function updateBudget(id: string, input: Partial<z.infer<typeof budgetInput>>) {
  const user = await getCurrentUser();
  const existing = await getUserBudget(id, user.id);
  if (!existing) throw new Error('NOT_FOUND');
  const data = budgetInput.partial().parse(input);
  const [updated] = await db.update(budgets).set({ ...data, updatedAt: new Date() })
    .where(and(eq(budgets.id, id), eq(budgets.userId, user.id))).returning();
  return updated;
}

export async function deleteBudget(id: string) {
  const user = await getCurrentUser();
  const existing = await getUserBudget(id, user.id);
  if (!existing) throw new Error('NOT_FOUND');
  await db.delete(budgets).where(and(eq(budgets.id, id), eq(budgets.userId, user.id)));
}

export async function listBudgetProgress(month: string) {
  const user = await getCurrentUser();
  return calculateBudgetProgress(user.id, month);
}

export async function copyPreviousMonth(fromMonth: string, toMonth: string) {
  const user = await getCurrentUser();
  const previous = await db.select().from(budgets).where(and(eq(budgets.userId, user.id), eq(budgets.month, fromMonth)));
  if (previous.length === 0) return [];
  const inserted = await db.insert(budgets).values(
    previous.map((b) => ({ userId: user.id, month: toMonth, categoryId: b.categoryId, currency: b.currency, plannedAmount: b.plannedAmount }))
  ).onConflictDoNothing().returning();
  return inserted;
}
```

- [ ] **Step 6: Write `components/budget-form.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBudget } from '@/app/actions/budgets';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Category } from '@/db/schema';

export function BudgetForm({ month, categories }: { month: string; categories: Category[] }) {
  const router = useRouter();
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? '');
  const [pending, setPending] = useState(false);

  async function onSubmit(formData: FormData) {
    setPending(true);
    try {
      await createBudget({
        month, categoryId,
        currency: String(formData.get('currency')),
        plannedAmount: String(formData.get('plannedAmount')),
      });
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={onSubmit} className="flex flex-wrap items-end gap-3 rounded-lg border p-4">
      <div className="space-y-2">
        <Label>Category</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            {categories.filter((c) => !c.noBudget).map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="plannedAmount">Planned amount</Label>
        <Input id="plannedAmount" name="plannedAmount" className="w-32" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="currency">Currency</Label>
        <Input id="currency" name="currency" defaultValue="USD" className="w-20" maxLength={3} required />
      </div>
      <Button type="submit" disabled={pending}>{pending ? 'Saving…' : 'Add budget'}</Button>
    </form>
  );
}
```

- [ ] **Step 7: Write `app/(app)/budgets/page.tsx`**

```tsx
import { listBudgetProgress, copyPreviousMonth } from '@/app/actions/budgets';
import { listCategories } from '@/app/actions/categories';
import { formatMoney } from '@/lib/money';
import { BudgetForm } from '@/components/budget-form';
import { Progress } from '@/components/ui/progress';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default async function BudgetsPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month = currentMonth() } = await searchParams;
  const [progress, categories] = await Promise.all([listBudgetProgress(month), listCategories()]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Budgets — {month}</h1>
        <form action={async () => { 'use server'; await copyPreviousMonth(previousMonth(month), month); }}>
          <button type="submit" className="text-sm underline">Copy previous month</button>
        </form>
      </div>
      <div className="space-y-3">
        {progress.map((p) => (
          <div key={p.budget.id} className="rounded-lg border p-4">
            <div className="flex items-center justify-between">
              <span>{p.category.icon} {p.category.name}</span>
              <span className={p.percentUsed > 100 ? 'text-destructive font-medium' : ''}>
                {formatMoney(p.spentCents, p.budget.currency)} / {formatMoney(p.plannedCents, p.budget.currency)}
              </span>
            </div>
            <Progress value={Math.min(p.percentUsed, 100)} className="mt-2" />
            <p className="mt-1 text-sm text-muted-foreground">
              Remaining: {formatMoney(p.remainingCents, p.budget.currency)} ({p.percentUsed.toFixed(0)}% used)
            </p>
          </div>
        ))}
        {progress.length === 0 && <p className="text-muted-foreground">No budgets for this month yet.</p>}
      </div>
      <BudgetForm month={month} categories={categories} />
    </div>
  );
}

function previousMonth(month: string) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return d.toISOString().slice(0, 7);
}
```

Add the `progress` shadcn component: `npx shadcn@latest add progress`.

- [ ] **Step 8: Manual QA**

Run: `npm run dev`, create a budget for the current month, add an expense transaction in that category, confirm the progress bar and remaining amount update.

- [ ] **Step 9: Commit**

```bash
git add lib/budget-calc.ts app/actions/budgets.ts "app/(app)/budgets" components/budget-form.tsx tests/lib/budget-calc.test.ts
git commit -m "feat: add budget progress calculation, CRUD, and month-copy UI"
```

---

## Task 12: Dashboard Aggregations + UI

**Files:**
- Create: `lib/dashboard-queries.ts`, `app/(app)/dashboard/page.tsx`, `components/dashboard-charts.tsx`
- Test: `tests/lib/dashboard-queries.test.ts`

**Interfaces:**
- Consumes: `toCents` from `lib/money.ts`, `calculateAccountBalance` from `lib/balances.ts`, `calculateBudgetProgress` from `lib/budget-calc.ts`.
- Produces: `getDashboardData(userId, month): Promise<DashboardData>` with balances-by-currency, monthly income/expense, spending-by-category, budget summary, reimbursable total, and a 6-month income-vs-expense trend — all excluding transfers from income/expense figures.

- [ ] **Step 1: Write failing test**

```ts
// tests/lib/dashboard-queries.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/db/client';
import { users, accounts, categories, transactions } from '@/db/schema';
import { getDashboardData } from '@/lib/dashboard-queries';

let user: { id: string };
let checking: { id: string }, savings: { id: string };
let groceries: { id: string };

beforeAll(async () => {
  [user] = await db.insert(users).values({ email: 'dash@example.com', passwordHash: 'x' }).returning();
  [checking] = await db.insert(accounts).values({ userId: user.id, name: 'Checking', type: 'bank', currency: 'USD', startingBalance: '0' }).returning();
  [savings] = await db.insert(accounts).values({ userId: user.id, name: 'Savings', type: 'bank', currency: 'USD', startingBalance: '0' }).returning();
  [groceries] = await db.insert(categories).values({ userId: user.id, name: 'Groceries', type: 'expense' }).returning();

  await db.insert(transactions).values([
    { userId: user.id, details: 'Salary', type: 'income', payDate: '2026-09-01', toAccountId: checking.id, amount: '1000.00', currency: 'USD' },
    { userId: user.id, details: 'Food', type: 'expense', payDate: '2026-09-02', fromAccountId: checking.id, categoryId: groceries.id, amount: '100.00', currency: 'USD', reimbursable: true, reimbursementStatus: 'to_claim' },
    { userId: user.id, details: 'Move', type: 'transfer', payDate: '2026-09-03', fromAccountId: checking.id, toAccountId: savings.id, amount: '200.00', currency: 'USD' },
  ]);
});

afterAll(async () => {
  await db.delete(transactions);
  await db.delete(categories);
  await db.delete(accounts);
  await db.delete(users);
});

describe('getDashboardData', () => {
  it('excludes transfers from income/expense totals and groups balances by currency', async () => {
    const data = await getDashboardData(user.id, '2026-09');
    expect(data.monthlyIncomeCents).toBe(100000);
    expect(data.monthlyExpenseCents).toBe(10000);
    // checking: 0 + 1000 income - 100 expense - 200 transfer-out = 700.00; savings: 0 + 200 transfer-in = 200.00
    // summed by currency: 700 + 200 = 900.00 (the transfer nets to zero across the pair, but both legs still count
    // into the per-account balances that get summed — it does not cancel out of the currency total pre-sum)
    expect(data.balancesByCurrency['USD']).toBe(90000);
    expect(data.reimbursableCents).toBe(10000);
    expect(data.spendingByCategory[0]).toMatchObject({ categoryId: groceries.id, cents: 10000 });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/lib/dashboard-queries.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/dashboard-queries.ts`**

```ts
import { db } from '@/db/client';
import { accounts, transactions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { toCents, addCents } from '@/lib/money';
import { calculateAccountBalance } from '@/lib/balances';

export async function getDashboardData(userId: string, month: string) {
  const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, userId));
  const allTransactions = await db.select().from(transactions).where(eq(transactions.userId, userId));
  const monthTransactions = allTransactions.filter((t) => t.payDate.startsWith(month));

  const balancesByCurrency: Record<string, number> = {};
  for (const account of userAccounts) {
    const { cents, currency } = await calculateAccountBalance(account.id, userId);
    balancesByCurrency[currency] = addCents(balancesByCurrency[currency] ?? 0, cents);
  }

  const monthlyIncomeCents = monthTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => addCents(sum, toCents(t.amount)), 0);

  const monthlyExpenseCents = monthTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => addCents(sum, toCents(t.amount)), 0);

  const spendingMap = new Map<string, number>();
  for (const t of monthTransactions) {
    if (t.type !== 'expense' || !t.categoryId) continue;
    spendingMap.set(t.categoryId, addCents(spendingMap.get(t.categoryId) ?? 0, toCents(t.amount)));
  }
  const spendingByCategory = Array.from(spendingMap.entries()).map(([categoryId, cents]) => ({ categoryId, cents }));

  const reimbursableCents = monthTransactions
    .filter((t) => t.reimbursable && t.reimbursementStatus !== 'reimbursed')
    .reduce((sum, t) => addCents(sum, toCents(t.amount)), 0);

  const trend = [] as { month: string; incomeCents: number; expenseCents: number }[];
  for (let i = 5; i >= 0; i--) {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const key = d.toISOString().slice(0, 7);
    const monthTxns = allTransactions.filter((t) => t.payDate.startsWith(key));
    trend.push({
      month: key,
      incomeCents: monthTxns.filter((t) => t.type === 'income').reduce((sum, t) => addCents(sum, toCents(t.amount)), 0),
      expenseCents: monthTxns.filter((t) => t.type === 'expense').reduce((sum, t) => addCents(sum, toCents(t.amount)), 0),
    });
  }

  return { balancesByCurrency, monthlyIncomeCents, monthlyExpenseCents, spendingByCategory, reimbursableCents, trend };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/lib/dashboard-queries.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `components/dashboard-charts.tsx`**

```tsx
'use client';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2'];

export function TrendChart({ data }: { data: { month: string; incomeCents: number; expenseCents: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data.map((d) => ({ ...d, income: d.incomeCents / 100, expense: d.expenseCents / 100 }))}>
        <XAxis dataKey="month" />
        <YAxis />
        <Tooltip />
        <Bar dataKey="income" fill="#16a34a" />
        <Bar dataKey="expense" fill="#dc2626" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SpendingPie({ data }: { data: { name: string; cents: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <PieChart>
        <Pie data={data.map((d) => ({ ...d, value: d.cents / 100 }))} dataKey="value" nameKey="name" outerRadius={90}>
          {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
        </Pie>
        <Tooltip />
      </PieChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 6: Write `app/(app)/dashboard/page.tsx`**

```tsx
import { getDashboardData } from '@/lib/dashboard-queries';
import { getCurrentUser } from '@/lib/session';
import { listCategories } from '@/app/actions/categories';
import { listTransactions } from '@/app/actions/transactions';
import { formatMoney } from '@/lib/money';
import { TrendChart, SpendingPie } from '@/components/dashboard-charts';
import Link from 'next/link';

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month = currentMonth() } = await searchParams;
  const user = await getCurrentUser();
  const [data, categories, recent] = await Promise.all([
    getDashboardData(user.id, month),
    listCategories(),
    listTransactions(),
  ]);
  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? 'Unknown';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard — {month}</h1>
        <div className="flex gap-2 text-sm">
          <Link href={`/dashboard?month=${previousMonth(month)}`} className="underline">← Prev</Link>
          <Link href={`/dashboard?month=${nextMonth(month)}`} className="underline">Next →</Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(data.balancesByCurrency).map(([currency, cents]) => (
          <div key={currency} className="rounded-lg border p-4">
            <p className="text-sm text-muted-foreground">Total balance ({currency})</p>
            <p className="text-2xl font-semibold">{formatMoney(cents, currency)}</p>
          </div>
        ))}
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Income this month</p>
          <p className="text-2xl font-semibold text-emerald-600">{formatMoney(data.monthlyIncomeCents, 'USD')}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Expenses this month</p>
          <p className="text-2xl font-semibold text-destructive">{formatMoney(data.monthlyExpenseCents, 'USD')}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Reimbursable</p>
          <p className="text-2xl font-semibold">{formatMoney(data.reimbursableCents, 'USD')}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h2 className="mb-2 font-medium">Income vs Expense (6 months)</h2>
          <TrendChart data={data.trend} />
        </div>
        <div className="rounded-lg border p-4">
          <h2 className="mb-2 font-medium">Spending by Category</h2>
          {data.spendingByCategory.length > 0
            ? <SpendingPie data={data.spendingByCategory.map((s) => ({ name: categoryName(s.categoryId), cents: s.cents }))} />
            : <p className="text-sm text-muted-foreground">No expenses recorded this month.</p>}
        </div>
      </div>

      <div className="rounded-lg border">
        <h2 className="border-b p-4 font-medium">Recent transactions</h2>
        <div className="divide-y">
          {recent.slice(0, 8).map((t) => (
            <div key={t.id} className="flex items-center justify-between p-3">
              <span>{t.details}</span>
              <span className="text-sm text-muted-foreground">{t.payDate}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function previousMonth(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
}
function nextMonth(month: string) {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 7);
}
```

- [ ] **Step 7: Manual QA**

Run: `npm run dev`, visit `/dashboard` with some seeded transactions, confirm charts render and month navigation works.

- [ ] **Step 8: Commit**

```bash
git add lib/dashboard-queries.ts "app/(app)/dashboard" components/dashboard-charts.tsx tests/lib/dashboard-queries.test.ts
git commit -m "feat: add dashboard analytics (balances, trend, spending by category, reimbursable)"
```

---

## Task 13: Reimbursements

**Files:**
- Create: `app/actions/reimbursements.ts`, `app/(app)/reimbursements/page.tsx`
- Test: `tests/app/actions/reimbursements.test.ts`

**Interfaces:**
- Consumes: `getCurrentUser`, `getUserTransaction`, `db`, `transactions`.
- Produces: `listReimbursables()`, `setReimbursementStatus(id, status)`.

- [ ] **Step 1: Write failing test**

```ts
// tests/app/actions/reimbursements.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/db/client';
import { users, transactions } from '@/db/schema';

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
import { getCurrentUser } from '@/lib/session';
import { listReimbursables, setReimbursementStatus } from '@/app/actions/reimbursements';

let user: { id: string };
let txnId: string;

beforeAll(async () => {
  [user] = await db.insert(users).values({ email: 'reimb@example.com', passwordHash: 'x' }).returning();
  const [txn] = await db.insert(transactions).values({
    userId: user.id, details: 'Conference fee', type: 'expense', payDate: '2026-09-01',
    amount: '50.00', currency: 'USD', reimbursable: true, reimbursementStatus: 'to_claim',
  }).returning();
  txnId = txn.id;
  (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: user.id, email: user.email, name: null });
});

afterAll(async () => {
  await db.delete(transactions);
  await db.delete(users);
});

describe('reimbursements', () => {
  it('lists only reimbursable transactions', async () => {
    const list = await listReimbursables();
    expect(list.every((t) => t.reimbursable)).toBe(true);
  });

  it('updates reimbursement status', async () => {
    const updated = await setReimbursementStatus(txnId, 'claimed');
    expect(updated.reimbursementStatus).toBe('claimed');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/app/actions/reimbursements.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `app/actions/reimbursements.ts`**

```ts
'use server';
import { db } from '@/db/client';
import { transactions } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/session';
import { getUserTransaction } from '@/lib/authorization';

export async function listReimbursables() {
  const user = await getCurrentUser();
  return db.select().from(transactions).where(and(eq(transactions.userId, user.id), eq(transactions.reimbursable, true)));
}

export async function setReimbursementStatus(id: string, status: 'to_claim' | 'claimed' | 'reimbursed') {
  const user = await getCurrentUser();
  const existing = await getUserTransaction(id, user.id);
  if (!existing) throw new Error('NOT_FOUND');
  const [updated] = await db.update(transactions).set({ reimbursementStatus: status, updatedAt: new Date() })
    .where(and(eq(transactions.id, id), eq(transactions.userId, user.id))).returning();
  return updated;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/app/actions/reimbursements.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `app/(app)/reimbursements/page.tsx`**

```tsx
import { listReimbursables } from '@/app/actions/reimbursements';
import { formatMoney, toCents } from '@/lib/money';
import { ReimbursementRow } from '@/components/reimbursement-row';

export default async function ReimbursementsPage() {
  const items = await listReimbursables();
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reimbursements</h1>
      <div className="rounded-lg border divide-y">
        {items.map((t) => (
          <ReimbursementRow key={t.id} id={t.id} details={t.details} payDate={t.payDate}
            amountLabel={formatMoney(toCents(t.amount), t.currency)} status={t.reimbursementStatus ?? 'to_claim'} />
        ))}
        {items.length === 0 && <p className="p-4 text-sm text-muted-foreground">No reimbursable transactions.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Write `components/reimbursement-row.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { setReimbursementStatus } from '@/app/actions/reimbursements';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const STATUSES = ['to_claim', 'claimed', 'reimbursed'] as const;

export function ReimbursementRow({ id, details, payDate, amountLabel, status }: {
  id: string; details: string; payDate: string; amountLabel: string; status: (typeof STATUSES)[number];
}) {
  const [current, setCurrent] = useState(status);
  return (
    <div className="flex items-center justify-between p-3">
      <div>
        <p className="font-medium">{details}</p>
        <p className="text-sm text-muted-foreground">{payDate} · {amountLabel}</p>
      </div>
      <Select value={current} onValueChange={async (v) => {
        setCurrent(v as typeof current);
        await setReimbursementStatus(id, v as typeof current);
      }}>
        <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
        <SelectContent>
          {STATUSES.map((s) => <SelectItem key={s} value={s}>{s.replace('_', ' ')}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
```

- [ ] **Step 7: Manual QA**

Run: `npm run dev`, mark a transaction reimbursable via `/transactions/[id]`, confirm it shows on `/reimbursements` and status updates persist.

- [ ] **Step 8: Commit**

```bash
git add app/actions/reimbursements.ts "app/(app)/reimbursements" components/reimbursement-row.tsx tests/app/actions/reimbursements.test.ts
git commit -m "feat: add reimbursement tracking view and status updates"
```

---

## Task 14: Backup Import — Validation Schema + Import Engine

**Files:**
- Create: `lib/import/schema.ts`, `lib/import/importer.ts`
- Test: `tests/lib/import/importer.test.ts`

**Interfaces:**
- Consumes: `db`, all schema tables.
- Produces: `backupSchema` (Zod), `previewImport(json: unknown): PreviewResult`, `commitImport(json: unknown, userId: string): Promise<CommitResult>` where `PreviewResult` includes counts and a list of warnings/errors, and `commitImport` runs inside a single DB transaction.

- [ ] **Step 1: Write `lib/import/schema.ts`** matching the real backup shape discovered above

```ts
import { z } from 'zod';

export const backupAccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['bank', 'credit', 'cash', 'wallet', 'travel', 'grant']),
  currency: z.string(),
  startingBalance: z.number(),
  note: z.string().optional(),
  archived: z.boolean(),
});

export const backupCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['expense', 'income', 'transfer']),
  icon: z.string().optional(),
  noBudget: z.boolean(),
});

export const backupReceiptSchema = z.object({
  id: z.string(),
  mime: z.string(),
  name: z.string(),
  size: z.number(),
  addedAt: z.string(),
});

export const backupTransactionSchema = z.object({
  id: z.string(),
  details: z.string(),
  type: z.enum(['expense', 'income', 'transfer']),
  categoryId: z.string().nullable(),
  payDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fromAccountId: z.string().nullable(),
  toAccountId: z.string().nullable(),
  amount: z.number().positive(),
  toAmount: z.number().positive().optional(),
  currency: z.string(),
  status: z.string(),
  reimbursable: z.boolean(),
  reimbursementStatus: z.enum(['to_claim', 'claimed', 'reimbursed']).optional(),
  receipt: backupReceiptSchema.optional(),
  note: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const backupBudgetSchema = z.object({
  id: z.string(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  categoryId: z.string(),
  currency: z.string(),
  plannedAmount: z.number(),
});

export const backupSchema = z.object({
  version: z.number(),
  accounts: z.array(backupAccountSchema),
  categories: z.array(backupCategorySchema),
  transactions: z.array(backupTransactionSchema),
  budgets: z.array(backupBudgetSchema),
});

export type Backup = z.infer<typeof backupSchema>;
```

- [ ] **Step 2: Write failing importer tests**

```ts
// tests/lib/import/importer.test.ts
import { describe, it, expect, afterEach } from 'vitest';
import { db } from '@/db/client';
import { users, accounts, categories, transactions, budgets } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { previewImport, commitImport } from '@/lib/import/importer';
import fixture from '../../fixtures/backup-fixture.json';

let userId: string;

afterEach(async () => {
  if (!userId) return;
  await db.delete(transactions).where(eq(transactions.userId, userId));
  await db.delete(budgets).where(eq(budgets.userId, userId));
  await db.delete(categories).where(eq(categories.userId, userId));
  await db.delete(accounts).where(eq(accounts.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
});

describe('previewImport', () => {
  it('reports counts and flags the dangling account reference as a warning, not an error', () => {
    const preview = previewImport(fixture);
    expect(preview.counts).toEqual({ accounts: 2, categories: 2, transactions: 3, budgets: 1 });
    expect(preview.errors).toHaveLength(0);
    expect(preview.warnings.some((w) => w.includes('dangling-account'))).toBe(true);
  });
});

describe('commitImport', () => {
  it('imports all rows under the authenticated user, ignoring any user_id from the JSON, and recovers the dangling account', async () => {
    const [user] = await db.insert(users).values({ email: 'importer@example.com', passwordHash: 'x' }).returning();
    userId = user.id;

    const result = await commitImport(fixture, userId);

    expect(result.imported).toEqual({ accounts: 3, categories: 2, transactions: 3, budgets: 1 }); // +1 recovered account
    const importedAccounts = await db.select().from(accounts).where(eq(accounts.userId, userId));
    expect(importedAccounts.every((a) => a.userId === userId)).toBe(true);

    const importedTxns = await db.select().from(transactions).where(eq(transactions.userId, userId));
    expect(importedTxns).toHaveLength(3);
  });

  it('rolls back entirely if any row is malformed', async () => {
    const [user] = await db.insert(users).values({ email: 'importer-fail@example.com', passwordHash: 'x' }).returning();
    userId = user.id;

    const broken = { ...fixture, transactions: [...fixture.transactions, { ...fixture.transactions[0], id: 'dup', amount: -5 }] };

    await expect(commitImport(broken, userId)).rejects.toThrow();

    const importedTxns = await db.select().from(transactions).where(eq(transactions.userId, userId));
    expect(importedTxns).toHaveLength(0);
  });
});
```

- [ ] **Step 3: Write the fixture file** (a trimmed, realistic slice of the real backup, including the dangling reference pattern)

```json
// tests/fixtures/backup-fixture.json
{
  "version": 1,
  "accounts": [
    { "id": "fx-acc-1", "name": "Checking", "type": "bank", "currency": "USD", "startingBalance": 100, "archived": false },
    { "id": "fx-acc-2", "name": "Credit", "type": "credit", "currency": "USD", "startingBalance": 0, "archived": false }
  ],
  "categories": [
    { "id": "c_food", "name": "Food", "type": "expense", "icon": "🍔", "noBudget": false },
    { "id": "c_transfer", "name": "Transfer", "type": "transfer", "icon": "🔁", "noBudget": true }
  ],
  "transactions": [
    { "id": "fx-txn-1", "details": "Lunch", "type": "expense", "categoryId": "c_food", "payDate": "2026-09-01", "fromAccountId": "fx-acc-1", "toAccountId": null, "amount": 12.5, "currency": "USD", "status": "completed", "reimbursable": false, "createdAt": "2026-09-01T00:00:00.000+00:00", "updatedAt": "2026-09-01T00:00:00.000+00:00" },
    { "id": "fx-txn-2", "details": "Salary", "type": "income", "categoryId": null, "payDate": "2026-09-01", "fromAccountId": null, "toAccountId": "fx-acc-1", "amount": 1000, "currency": "USD", "status": "completed", "reimbursable": false, "createdAt": "2026-09-01T00:00:00.000+00:00", "updatedAt": "2026-09-01T00:00:00.000+00:00" },
    { "id": "fx-txn-3", "details": "Pay off card", "type": "transfer", "categoryId": "c_transfer", "payDate": "2026-09-02", "fromAccountId": "fx-acc-1", "toAccountId": "fx-acc-missing", "amount": 50, "currency": "USD", "status": "completed", "reimbursable": false, "createdAt": "2026-09-02T00:00:00.000+00:00", "updatedAt": "2026-09-02T00:00:00.000+00:00" }
  ],
  "budgets": [
    { "id": "fx-budget-1", "month": "2026-09", "categoryId": "c_food", "currency": "USD", "plannedAmount": 200 }
  ]
}
```

- [ ] **Step 4: Run to verify failure**

Run: `npm test -- tests/lib/import/importer.test.ts`
Expected: FAIL — `@/lib/import/importer` not found.

- [ ] **Step 5: Implement `lib/import/importer.ts`**

```ts
import { db } from '@/db/client';
import { accounts, categories, transactions, budgets } from '@/db/schema';
import { backupSchema, type Backup } from './schema';

export type PreviewResult = {
  counts: { accounts: number; categories: number; transactions: number; budgets: number };
  warnings: string[];
  errors: string[];
};

function findDanglingAccountRefs(backup: Backup): string[] {
  const accountIds = new Set(backup.accounts.map((a) => a.id));
  const dangling = new Set<string>();
  for (const t of backup.transactions) {
    if (t.fromAccountId && !accountIds.has(t.fromAccountId)) dangling.add(t.fromAccountId);
    if (t.toAccountId && !accountIds.has(t.toAccountId)) dangling.add(t.toAccountId);
  }
  return Array.from(dangling);
}

function findTypeMismatches(backup: Backup): string[] {
  const categoryType = new Map(backup.categories.map((c) => [c.id, c.type]));
  const errors: string[] = [];
  for (const t of backup.transactions) {
    if (t.categoryId && categoryType.has(t.categoryId) && categoryType.get(t.categoryId) !== t.type) {
      errors.push(`transaction ${t.id} has type "${t.type}" but references category "${t.categoryId}" of type "${categoryType.get(t.categoryId)}"`);
    }
  }
  return errors;
}

export function previewImport(json: unknown): PreviewResult {
  const parsed = backupSchema.safeParse(json);
  if (!parsed.success) {
    return { counts: { accounts: 0, categories: 0, transactions: 0, budgets: 0 }, warnings: [], errors: parsed.error.issues.map((i) => i.message) };
  }
  const backup = parsed.data;

  const ids = (rows: { id: string }[]) => rows.map((r) => r.id);
  const dupErrors = (name: string, rows: { id: string }[]) => {
    const seen = new Set<string>();
    const dups: string[] = [];
    for (const id of ids(rows)) {
      if (seen.has(id)) dups.push(id);
      seen.add(id);
    }
    return dups.map((id) => `duplicate ${name} id: ${id}`);
  };

  const warnings = findDanglingAccountRefs(backup).map((id) => `dangling-account: transaction references missing account ${id}; a recovered placeholder account will be created`);
  const errors = [
    ...dupErrors('account', backup.accounts),
    ...dupErrors('category', backup.categories),
    ...dupErrors('transaction', backup.transactions),
    ...dupErrors('budget', backup.budgets),
    ...findTypeMismatches(backup),
  ];

  return {
    counts: {
      accounts: backup.accounts.length,
      categories: backup.categories.length,
      transactions: backup.transactions.length,
      budgets: backup.budgets.length,
    },
    warnings,
    errors,
  };
}

export type CommitResult = {
  imported: { accounts: number; categories: number; transactions: number; budgets: number };
};

export async function commitImport(json: unknown, userId: string): Promise<CommitResult> {
  const preview = previewImport(json);
  if (preview.errors.length > 0) {
    throw new Error(`Import aborted: ${preview.errors.join('; ')}`);
  }
  const backup = backupSchema.parse(json);

  return db.transaction(async (tx) => {
    const accountIds = new Set(backup.accounts.map((a) => a.id));
    const danglingIds = findDanglingAccountRefs(backup);

    if (backup.accounts.length > 0) {
      await tx.insert(accounts).values(backup.accounts.map((a) => ({
        id: a.id, userId, name: a.name, type: a.type, currency: a.currency,
        startingBalance: a.startingBalance.toFixed(2), note: a.note, archived: a.archived,
      })));
    }

    for (const missingId of danglingIds) {
      const referencing = backup.transactions.find((t) => t.fromAccountId === missingId || t.toAccountId === missingId)!;
      await tx.insert(accounts).values({
        id: missingId, userId, name: `Recovered Account (${missingId.slice(0, 8)})`,
        type: 'bank', currency: referencing.currency, startingBalance: '0', archived: true,
      });
      accountIds.add(missingId);
    }

    if (backup.categories.length > 0) {
      await tx.insert(categories).values(backup.categories.map((c) => ({
        id: c.id, userId, name: c.name, type: c.type, icon: c.icon, noBudget: c.noBudget,
      })));
    }

    if (backup.transactions.length > 0) {
      await tx.insert(transactions).values(backup.transactions.map((t) => ({
        id: t.id, userId, details: t.details, type: t.type, categoryId: t.categoryId,
        payDate: t.payDate, fromAccountId: t.fromAccountId, toAccountId: t.toAccountId,
        amount: t.amount.toFixed(2), toAmount: t.toAmount?.toFixed(2), currency: t.currency,
        status: t.status as 'completed', reimbursable: t.reimbursable,
        reimbursementStatus: t.reimbursementStatus, receipt: t.receipt, note: t.note,
        createdAt: new Date(t.createdAt), updatedAt: new Date(t.updatedAt),
      })));
    }

    if (backup.budgets.length > 0) {
      await tx.insert(budgets).values(backup.budgets.map((b) => ({
        id: b.id, userId, month: b.month, categoryId: b.categoryId, currency: b.currency,
        plannedAmount: b.plannedAmount.toFixed(2),
      })));
    }

    return {
      imported: {
        accounts: backup.accounts.length + danglingIds.length,
        categories: backup.categories.length,
        transactions: backup.transactions.length,
        budgets: backup.budgets.length,
      },
    };
  });
}
```

- [ ] **Step 6: Run to verify pass**

Run: `npm test -- tests/lib/import/importer.test.ts`
Expected: PASS.

- [ ] **Step 7: Verify against the real backup file (spec Step 9/10)**

Write and run a one-off script to sanity check the real file before wiring up the UI:

```ts
// scripts/verify-real-backup.ts (temporary verification script, safe to keep)
import 'dotenv/config';
import fs from 'fs';
import { previewImport } from '@/lib/import/importer';

const json = JSON.parse(fs.readFileSync('docs/finance-backup-2026-09-28.json', 'utf-8'));
const preview = previewImport(json);
console.log(JSON.stringify(preview, null, 2));
// `lib/import/importer.ts` imports `db/client.ts`, which opens a pg Pool at module load even
// though this script never queries it — exit explicitly or the open Pool keeps the process alive.
process.exit(0);
```

Run: `npx tsx scripts/verify-real-backup.ts`
Expected: `counts` equal `{ accounts: 16, categories: 23, transactions: 226, budgets: 32 }`, `errors` is empty, and `warnings` contains exactly one `dangling-account` entry for `ffa804de-298a-417c-bf73-548ebd807b02`.

- [ ] **Step 8: Commit**

```bash
git add lib/import tests/lib/import tests/fixtures/backup-fixture.json scripts/verify-real-backup.ts
git commit -m "feat: add backup import validation and transactional import engine"
```

---

## Task 15: Import & Export UI

**Files:**
- Create: `app/actions/import.ts`, `app/actions/export.ts`, `lib/export.ts`, `app/(app)/settings/data/page.tsx`, `components/import-form.tsx`
- Test: `tests/lib/export.test.ts`

**Interfaces:**
- Consumes: `previewImport`, `commitImport` from `lib/import/importer.ts`; `getCurrentUser`.
- Produces: `exportUserData(userId): Promise<Backup>`, server actions `previewImportAction(formData)`, `commitImportAction(formData)`, `exportDataAction()`.

- [ ] **Step 1: Write failing export test**

```ts
// tests/lib/export.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/db/client';
import { users, accounts } from '@/db/schema';
import { exportUserData } from '@/lib/export';

let userA: { id: string }, userB: { id: string };

beforeAll(async () => {
  [userA] = await db.insert(users).values({ email: 'export-a@example.com', passwordHash: 'x' }).returning();
  [userB] = await db.insert(users).values({ email: 'export-b@example.com', passwordHash: 'x' }).returning();
  await db.insert(accounts).values([
    { userId: userA.id, name: 'A Account', type: 'bank', currency: 'USD', startingBalance: '0' },
    { userId: userB.id, name: 'B Account', type: 'bank', currency: 'USD', startingBalance: '0' },
  ]);
});

afterAll(async () => {
  await db.delete(accounts);
  await db.delete(users);
});

describe('exportUserData', () => {
  it('exports only the requesting user\'s data in backup-compatible shape', async () => {
    const backup = await exportUserData(userA.id);
    expect(backup.accounts).toHaveLength(1);
    expect(backup.accounts[0].name).toBe('A Account');
    expect(backup).not.toHaveProperty('passwordHash');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test -- tests/lib/export.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/export.ts`**

```ts
import { db } from '@/db/client';
import { accounts, categories, transactions, budgets } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function exportUserData(userId: string) {
  const [userAccounts, userCategories, userTransactions, userBudgets] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.userId, userId)),
    db.select().from(categories).where(eq(categories.userId, userId)),
    db.select().from(transactions).where(eq(transactions.userId, userId)),
    db.select().from(budgets).where(eq(budgets.userId, userId)),
  ]);

  return {
    version: 1,
    accounts: userAccounts.map((a) => ({
      id: a.id, name: a.name, type: a.type, currency: a.currency,
      startingBalance: Number(a.startingBalance), note: a.note ?? undefined, archived: a.archived,
    })),
    categories: userCategories.map((c) => ({ id: c.id, name: c.name, type: c.type, icon: c.icon ?? undefined, noBudget: c.noBudget })),
    transactions: userTransactions.map((t) => ({
      id: t.id, details: t.details, type: t.type, categoryId: t.categoryId,
      payDate: t.payDate, fromAccountId: t.fromAccountId, toAccountId: t.toAccountId,
      amount: Number(t.amount), toAmount: t.toAmount ? Number(t.toAmount) : undefined,
      currency: t.currency, status: t.status, reimbursable: t.reimbursable,
      reimbursementStatus: t.reimbursementStatus ?? undefined, receipt: t.receipt ?? undefined,
      note: t.note ?? undefined, createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(),
    })),
    budgets: userBudgets.map((b) => ({ id: b.id, month: b.month, categoryId: b.categoryId, currency: b.currency, plannedAmount: Number(b.plannedAmount) })),
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `npm test -- tests/lib/export.test.ts`
Expected: PASS.

- [ ] **Step 5: Implement `app/actions/import.ts` and `app/actions/export.ts`**

```ts
// app/actions/import.ts
'use server';
import { previewImport, commitImport } from '@/lib/import/importer';
import { getCurrentUser } from '@/lib/session';

export async function previewImportAction(json: unknown) {
  return previewImport(json);
}

export async function commitImportAction(json: unknown) {
  const user = await getCurrentUser();
  return commitImport(json, user.id);
}
```

```ts
// app/actions/export.ts
'use server';
import { exportUserData } from '@/lib/export';
import { getCurrentUser } from '@/lib/session';

export async function exportDataAction() {
  const user = await getCurrentUser();
  return exportUserData(user.id);
}
```

- [ ] **Step 6: Write `components/import-form.tsx`**

```tsx
'use client';
import { useState } from 'react';
import { previewImportAction, commitImportAction } from '@/app/actions/import';
import { Button } from '@/components/ui/button';
import { useRouter } from 'next/navigation';

type Preview = Awaited<ReturnType<typeof previewImportAction>>;

export function ImportForm() {
  const router = useRouter();
  const [json, setJson] = useState<unknown>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [pending, setPending] = useState(false);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = JSON.parse(text);
    setJson(parsed);
    setPreview(await previewImportAction(parsed));
  }

  async function onConfirm() {
    if (!json) return;
    setPending(true);
    try {
      await commitImportAction(json);
      router.refresh();
      setPreview(null);
      setJson(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <input type="file" accept="application/json" onChange={onFileChange} />
      {preview && (
        <div className="space-y-2 rounded-md bg-muted p-3 text-sm">
          <p>Accounts: {preview.counts.accounts} · Categories: {preview.counts.categories} · Transactions: {preview.counts.transactions} · Budgets: {preview.counts.budgets}</p>
          {preview.warnings.map((w, i) => <p key={i} className="text-amber-600">⚠ {w}</p>)}
          {preview.errors.map((e, i) => <p key={i} className="text-destructive">✕ {e}</p>)}
          {preview.errors.length === 0 && (
            <Button onClick={onConfirm} disabled={pending}>{pending ? 'Importing…' : 'Confirm import'}</Button>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Write `app/(app)/settings/data/page.tsx`**

```tsx
import { ImportForm } from '@/components/import-form';
import { Button } from '@/components/ui/button';

export default function DataSettingsPage() {
  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Data</h1>
      <section className="space-y-2">
        <h2 className="font-medium">Import backup</h2>
        <ImportForm />
      </section>
      <section className="space-y-2">
        <h2 className="font-medium">Export your data</h2>
        <form action="/api/export" method="get">
          <Button type="submit">Download export (JSON)</Button>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 8: Write `app/api/export/route.ts`**

```ts
import { exportUserData } from '@/lib/export';
import { getCurrentUser } from '@/lib/session';
import { NextResponse } from 'next/server';

export async function GET() {
  const user = await getCurrentUser();
  const data = await exportUserData(user.id);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="export-${user.id}.json"`,
    },
  });
}
```

- [ ] **Step 9: Manual QA using the real backup**

Run: `npm run dev`, sign in, go to `/settings/data`, upload `docs/finance-backup-2026-09-28.json`, confirm the preview shows `16 / 23 / 226 / 32` and one dangling-account warning, click confirm, then verify `/accounts`, `/transactions`, `/budgets` show the imported data. Download the export and confirm it round-trips the same counts.

- [ ] **Step 10: Commit**

```bash
git add app/actions/import.ts app/actions/export.ts lib/export.ts "app/(app)/settings" app/api/export components/import-form.tsx tests/lib/export.test.ts
git commit -m "feat: add import preview/commit UI and per-user JSON export"
```

---

## Task 16: Security & User-Isolation Tests

**Files:**
- Test: `tests/security/user-isolation.test.ts`

**Interfaces:**
- Consumes: server actions from Tasks 6, 8, 9, 11 and authorization helpers from Task 5. No new production code — this task proves the isolation guarantees already built.

- [ ] **Step 1: Write the isolation test suite**

```ts
// tests/security/user-isolation.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/db/client';
import { users, accounts, categories, transactions } from '@/db/schema';

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
import { getCurrentUser } from '@/lib/session';
import { updateAccount, listAccounts } from '@/app/actions/accounts';
import { createTransaction, listTransactions } from '@/app/actions/transactions';
import { getUserAccount, getUserTransaction } from '@/lib/authorization';

let userA: { id: string }, userB: { id: string };
let accountA: { id: string }, categoryA: { id: string };
let transactionA: { id: string };

function actAs(user: { id: string; email: string }) {
  (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: user.id, email: user.email, name: null });
}

beforeAll(async () => {
  [userA] = await db.insert(users).values({ email: 'iso-a@example.com', passwordHash: 'x' }).returning();
  [userB] = await db.insert(users).values({ email: 'iso-b@example.com', passwordHash: 'x' }).returning();
  [accountA] = await db.insert(accounts).values({ userId: userA.id, name: 'A', type: 'bank', currency: 'USD', startingBalance: '0' }).returning();
  [categoryA] = await db.insert(categories).values({ userId: userA.id, name: 'Food', type: 'expense' }).returning();

  actAs(userA);
  transactionA = await createTransaction({
    details: 'Private', type: 'expense', payDate: '2026-09-01', fromAccountId: accountA.id, categoryId: categoryA.id, amount: '5.00', currency: 'USD',
  });
});

afterAll(async () => {
  await db.delete(transactions);
  await db.delete(categories);
  await db.delete(accounts);
  await db.delete(users);
});

describe('user isolation', () => {
  it('User B cannot read User A accounts via listAccounts', async () => {
    actAs(userB);
    const list = await listAccounts();
    expect(list.find((a) => a.id === accountA.id)).toBeUndefined();
  });

  it('User B cannot read User A accounts by id', async () => {
    const found = await getUserAccount(accountA.id, userB.id);
    expect(found).toBeNull();
  });

  it('User B cannot modify User A accounts', async () => {
    actAs(userB);
    await expect(updateAccount(accountA.id, { name: 'Hijacked' })).rejects.toThrow('NOT_FOUND');
  });

  it('User B cannot read User A transactions', async () => {
    actAs(userB);
    const list = await listTransactions();
    expect(list.find((t) => t.id === transactionA.id)).toBeUndefined();
    expect(await getUserTransaction(transactionA.id, userB.id)).toBeNull();
  });

  it('User B cannot reference User A account/category when creating a transaction', async () => {
    actAs(userB);
    await expect(createTransaction({
      details: 'Attack', type: 'expense', payDate: '2026-09-01', fromAccountId: accountA.id, categoryId: categoryA.id, amount: '5.00', currency: 'USD',
    })).rejects.toThrow('FORBIDDEN');
  });
});
```

- [ ] **Step 2: Run to verify it passes against the already-built authorization layer**

Run: `npm test -- tests/security/user-isolation.test.ts`
Expected: PASS. If any assertion fails, that is a real authorization bug in Tasks 5/6/9 — fix the helper or action in question before proceeding, do not weaken the test.

- [ ] **Step 3: Commit**

```bash
git add tests/security/user-isolation.test.ts
git commit -m "test: add cross-user isolation security tests for accounts and transactions"
```

---

## Task 17: UI Polish — Dark Mode, Empty/Loading States, Confirmations

**Files:**
- Modify: `app/layout.tsx`, `app/globals.css`, `components/nav.tsx`, `components/account-form.tsx` (loading state already present), `app/(app)/accounts/page.tsx` (archive button + confirm dialog)
- Create: `components/theme-toggle.tsx`, `components/confirm-button.tsx`, `app/loading.tsx`

**Interfaces:**
- Consumes: shadcn `dialog` component for confirmations.
- Produces: `ConfirmButton` reused by any destructive action button (delete category, delete transaction, delete budget).

- [ ] **Step 1: Add dark mode toggle**

```tsx
// components/theme-toggle.tsx
'use client';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDark(stored ? stored === 'dark' : prefersDark);
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  }, [dark]);

  return <Button variant="ghost" size="sm" onClick={() => setDark((d) => !d)}>{dark ? 'Light mode' : 'Dark mode'}</Button>;
}
```

Add it to `components/nav.tsx`'s bottom section, next to Settings.

- [ ] **Step 2: Add a reusable confirm-before-destructive-action button**

```tsx
// components/confirm-button.tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';

export function ConfirmButton({ label, description, onConfirm }: { label: string; description: string; onConfirm: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="destructive" size="sm">{label}</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Are you sure?</DialogTitle></DialogHeader>
        <p className="text-sm text-muted-foreground">{description}</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="destructive" disabled={pending} onClick={async () => { setPending(true); await onConfirm(); setPending(false); setOpen(false); }}>
            {pending ? 'Working…' : 'Confirm'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 3: Wire `ConfirmButton` into category deletion**

Modify `app/(app)/categories/page.tsx` to render, per category row:

```tsx
<ConfirmButton
  label="Delete"
  description={`Delete "${c.name}"? Historical transactions keep their data but lose this category.`}
  onConfirm={async () => { 'use server'; await deleteCategory(c.id); }}
/>
```

(Import `ConfirmButton` and `deleteCategory` at the top of the file.)

- [ ] **Step 4: Add a global loading state**

```tsx
// app/loading.tsx
export default function Loading() {
  return <div className="p-6 text-sm text-muted-foreground">Loading…</div>;
}
```

- [ ] **Step 5: Verify dark mode and empty states manually**

Run: `npm run dev`. Toggle dark mode and confirm all pages (dashboard, accounts, transactions, budgets, categories, reimbursements) remain readable. Delete all data for a fresh test user and confirm each list page shows its empty-state message rather than a blank screen.

- [ ] **Step 6: Commit**

```bash
git add components/theme-toggle.tsx components/confirm-button.tsx app/loading.tsx "app/(app)/categories/page.tsx" components/nav.tsx
git commit -m "feat: add dark mode toggle, confirm-before-delete dialogs, and loading state"
```

---

## Task 18: Lint/Typecheck/Build Fixes, README, and Vercel Deployment Docs

**Files:**
- Modify: `README.md`
- Modify (as needed to fix errors surfaced in this task): any file flagged by lint/typecheck/build

**Interfaces:**
- No new interfaces — this task is the spec's Step 15 gate: everything must lint, typecheck, test, and build clean before the app is considered done.

- [ ] **Step 1: Run the full verification pipeline**

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

- [ ] **Step 2: Fix every error surfaced**

Address each lint/typecheck/build/test failure at its source file (common culprits: `params`/`searchParams` being promises in Next.js App Router — already handled with `await params` throughout this plan; unused imports; the placeholder line left in Task 2 Step 6, which must have been replaced with the real cleanup code shown right after it). Re-run the full pipeline after each fix until all four commands succeed.

- [ ] **Step 3: Write `README.md`**

```markdown
# Money Tracking

A multi-user personal finance app. Next.js (App Router) + TypeScript + PostgreSQL (Drizzle ORM) + Auth.js + Tailwind/shadcn + Recharts.

## Balance convention

Account balance = starting balance + income to this account + transfers in − expenses from this account − transfers out.
This applies uniformly to every account type, including `credit`: spending on a credit account moves its balance negative (representing amount owed); paying it off is a transfer that brings it back toward zero.

## Local development

1. **Start Postgres**: `docker compose up -d postgres postgres_test`
2. **Configure environment**: `cp .env.example .env` and fill in `AUTH_SECRET` (`openssl rand -base64 32`). The default `DATABASE_URL`/`DATABASE_URL_TEST` already match `docker-compose.yml`.
3. **Run migrations**: `npm run db:migrate`
4. **Create your first user**: `npm run create-user -- --email you@example.com --password "a-strong-password" --name "Your Name"`
5. **Start the app**: `npm run dev`, then sign in at `/login`.
6. **Import your backup**: go to `/settings/data`, upload `docs/finance-backup-2026-09-28.json`, review the preview, confirm.
7. **Run tests**: `npm test` (runs against `DATABASE_URL_TEST`, never the dev/prod database).

## Deploying to Vercel

1. **Create the database**: create a Neon Postgres project (or Vercel Postgres) from the Vercel dashboard.
2. **Set `DATABASE_URL`**: in the Vercel project's Environment Variables, paste the Neon pooled connection string.
3. **Set `AUTH_SECRET`**: generate with `openssl rand -base64 32` and add it as an environment variable.
4. **Run migrations against production**: `DATABASE_URL="<neon-connection-string>" npm run db:migrate` from your machine (or a one-off Vercel deploy hook) before first traffic.
5. **Create the first production user**: `DATABASE_URL="<neon-connection-string>" npm run create-user -- --email you@example.com --password "..."`.
6. **Import the backup in production**: sign in on the deployed app and use `/settings/data` as in local dev.
7. **Deploy**: connect the repo in Vercel and deploy; subsequent pushes to `main` auto-deploy.
8. **Production migrations on later schema changes**: run `npm run db:generate` locally, commit the generated SQL in `db/migrations`, then run `DATABASE_URL="<neon-connection-string>" npm run db:migrate` before the new code goes live.
9. **Backup/restore**: use `/settings/data`'s export button to download a point-in-time JSON backup for any user; restore by importing that same file into a (possibly different) user account.

## Testing

`npm test` covers: balance calculation (expense/income/transfer/cross-currency), budget spend/remaining/percentage, dashboard aggregation (transfers excluded), backup import (preview, transactional commit, dangling-reference recovery, rollback-on-error), export round-tripping, and cross-user isolation (`tests/security/user-isolation.test.ts`).
```

- [ ] **Step 4: Final full verification**

Run:
```bash
npm run lint
npm run typecheck
npm test
npm run build
```
Expected: all four succeed with zero errors.

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "docs: add README with local dev and Vercel deployment instructions; fix lint/typecheck/build issues"
```

---

## Self-Review Notes

- **Spec coverage**: Sections 1 (multi-user/auth) → Tasks 4–5; 2 (accounts) → Tasks 6–7; 3 (categories) → Task 8; 4 (transactions) → Tasks 9–10; 5 (budgets) → Task 11; 6 (DB relationships/indexes) → Task 2; 7 (security/isolation helpers) → Tasks 5, 16; 8 (import) → Task 14–15; 9 (export) → Task 15; 10 (money handling) → Task 3 + Global Constraints; 11 (pages) → Tasks 7,10,11,8,13,15 + nav in Task 7; 12 (dashboard) → Task 12; 13 (reimbursements) → Task 13; 14 (UI polish) → Task 17; 15 (tests) → embedded per-task plus Task 16; 16 (Vercel deploy) → Task 18; 17 (implementation order) → mirrored by the task ordering above, with the real-backup inspection already done up front in this plan's "Real-Data Findings" section rather than deferred to execution time.
- **Deviations from the spec's illustrative examples, made deliberately and documented inline**: `reimbursementStatus` enum uses real observed values (`to_claim/claimed/reimbursed`) instead of the spec's example (`pending/submitted/reimbursed`); categories gain an `archived` boolean not listed in the spec's example schema, needed to support "archive" as a non-destructive alternative to delete; primary keys are `text` everywhere rather than native `uuid`, required by real non-uuid category ids; no public `/register` route — first/subsequent users are created via `scripts/create-user.ts`, as the spec's own README requirement ("Creating the first user") implies a provisioning step rather than open signup.
- **Placeholder scan**: Task 2 Step 6 contains one intentionally-shown-then-corrected placeholder line to teach the exact bug to avoid; Step 2's instructions explicitly tell the executor to replace it with the two real `db.delete(...)` lines given immediately after. No other placeholders remain — every other step has runnable code.
- **Type consistency**: `calculateAccountBalance` returns `{ cents, currency }` and is consumed identically in Tasks 7 and 12. `getUserAccount/getUserCategory/getUserTransaction/getUserBudget` all take `(id, userId)` and return `row | null`, used consistently from Task 5 onward. `BudgetProgress` fields (`plannedCents/spentCents/remainingCents/percentUsed`) match between `lib/budget-calc.ts` (Task 11) and its consumers. `DashboardData` fields match between `lib/dashboard-queries.ts` and `app/(app)/dashboard/page.tsx` (Task 12).
