Build a complete **multi-user personal finance / money-tracking web application** based on the attached backup JSON file:

`finance-backup-2026-09-28.json`

First, inspect the entire JSON file and understand its schema, relationships, optional fields, and edge cases before implementing anything. Preserve the existing financial behavior and data as closely as possible.

## Tech Stack

Use:

- Next.js with App Router
- TypeScript
- PostgreSQL
- Drizzle ORM or Prisma
- Tailwind CSS
- shadcn/ui
- Recharts
- Zod
- Vercel deployment

Use PostgreSQL suitable for Vercel, such as Neon or Vercel Postgres.

Do **not** use SQLite for the production deployment.

---

# 1. Multi-User Architecture

The application must support multiple users.

Create a `users` table and make all financial data belong to a specific user.

Core relationship:

```text
User
 ├── Accounts
 ├── Categories
 ├── Budgets
 └── Transactions
```

A user must only be able to view and modify their own financial data.

Implement authentication using a Vercel-compatible authentication solution such as Auth.js.

Example `users` model:

```text
users
- id
- email
- name
- image
- created_at
- updated_at
```

Add `user_id` ownership to:

```text
accounts
categories
budgets
transactions
```

Use proper foreign keys:

```text
accounts.user_id      -> users.id
categories.user_id    -> users.id
budgets.user_id       -> users.id
transactions.user_id  -> users.id
```

Never trust a `user_id` sent by the browser.

The server must determine the authenticated user from the session and automatically scope every query to that user.

For example, never perform:

```sql
SELECT * FROM transactions;
```

Instead, queries must effectively be:

```sql
SELECT *
FROM transactions
WHERE user_id = authenticated_user_id;
```

Apply the same ownership checks to UPDATE and DELETE operations.

---

# 2. User Data Management

Each user can independently manage their own:

### Accounts

Support the existing fields:

```text
id
user_id
name
type
currency
starting_balance
note
archived
created_at
updated_at
```

Observed account types include:

```text
bank
credit
cash
wallet
travel
grant
```

Users can:

- create accounts
- edit accounts
- archive/unarchive accounts
- view balances
- view account transaction history

Calculate balances from transactions rather than storing an unreliable derived balance.

Balance should follow approximately:

```text
starting balance
+ income
+ incoming transfers
- expenses
- outgoing transfers
```

Handle credit accounts carefully and document the balance convention used.

---

# 3. Categories

Each user manages their own categories.

Schema should support:

```text
id
user_id
name
type
icon
no_budget
created_at
updated_at
```

Category types:

```text
expense
income
transfer
```

Users can:

- create
- edit
- delete/archive
- choose icon
- choose category type
- exclude categories from budgeting

Deleting a category must not accidentally destroy historical transactions.

Use appropriate foreign-key behavior.

---

# 4. Transactions

Transactions belong to a user.

Preserve the fields observed in the backup:

```text
id
user_id
details
type
category_id
pay_date
from_account_id
to_account_id
amount
to_amount
currency
status
reimbursable
reimbursement_status
receipt
note
created_at
updated_at
```

Transaction types:

```text
expense
income
transfer
```

Forms should adapt to transaction type.

Expense:

```text
Account
↓
Category
↓
Amount
```

Income:

```text
Category
↓
Account
↓
Amount
```

Transfer:

```text
From Account
↓
To Account
↓
Amount
```

Support `toAmount` for transfers between accounts using different currencies.

Transfers must **not** count as income or expenses in spending/income analytics.

A transaction must only reference accounts and categories belonging to the same authenticated user.

Validate this on the server.

---

# 5. Budgets

Budgets belong to users.

Schema:

```text
id
user_id
month
category_id
currency
planned_amount
created_at
updated_at
```

Users should be able to manage monthly budgets by category.

Show:

```text
Planned
Spent
Remaining
Percentage used
```

Support:

- create/edit/delete budget
- select month
- copy previous month's budget
- budget progress
- over-budget indicator

Only expense transactions should contribute to budget spending.

---

# 6. Database Relationships

Design a normalized PostgreSQL schema.

Conceptually:

```text
users
  │
  ├──< accounts
  │
  ├──< categories
  │
  ├──< budgets
  │      └── category
  │
  └──< transactions
         ├── category
         ├── from_account
         └── to_account
```

Use:

- primary keys
- foreign keys
- indexes
- unique constraints where appropriate
- timestamps
- proper nullable relationships

Frequently queried tables should have indexes involving `user_id`.

For example:

```text
transactions(user_id, pay_date)
transactions(user_id, from_account_id)
transactions(user_id, to_account_id)

accounts(user_id)
categories(user_id)

budgets(user_id, month)
budgets(user_id, category_id, month)
```

Consider a unique constraint preventing duplicate budgets for the same:

```text
user + month + category + currency
```

---

# 7. Security and User Isolation

User isolation is critical.

A malicious user must not be able to access another user's data by manually changing an ID in a URL or API request.

For example:

```text
/accounts/another-users-account-id
```

must return unauthorized/not found.

Every server operation must validate ownership.

Create reusable authorization helpers rather than duplicating checks everywhere.

For example:

```ts
getCurrentUser()
getUserAccount(accountId)
getUserCategory(categoryId)
getUserTransaction(transactionId)
```

Do not expose `DATABASE_URL` or other secrets to client-side code.

Keep database operations server-side.

Include:

```text
.env.example
```

but never commit real credentials.

---

# 8. Import Existing Backup

The supplied JSON backup currently contains:

```text
16 accounts
23 categories
226 transactions
32 budgets
```

Create an import workflow allowing the backup to be assigned to a specific authenticated user.

During import:

```text
JSON
 ↓
Validate with Zod
 ↓
Preview
 ↓
Import for current user
 ↓
Verify relationships
 ↓
Commit transaction
```

Show a preview before importing:

```text
Accounts       16
Categories     23
Transactions  226
Budgets         32
```

Preserve original IDs where practical.

However, ownership must always be assigned from the authenticated session:

```text
user_id = currentUser.id
```

Do not accept `user_id` from the imported JSON.

Detect:

- duplicate IDs
- invalid account references
- invalid category references
- malformed transactions
- invalid amounts
- invalid dates

Run the entire import inside a database transaction so partial imports cannot occur.

---

# 9. Backup / Export

Allow each user to export **only their own data**.

Export:

```text
accounts
categories
transactions
budgets
```

Produce JSON compatible, or as close as practical, with the original backup structure.

Do not include:

- passwords
- authentication tokens
- sessions
- another user's information

---

# 10. Money Handling

Do not rely on JavaScript floating-point arithmetic for financial calculations.

Use PostgreSQL:

```text
NUMERIC / DECIMAL
```

or a carefully designed integer minor-unit approach.

Document the chosen approach.

The application supports multiple currencies.

Never silently calculate:

```text
USD + THB + EUR
```

as one total.

Dashboard totals must be grouped by currency unless an explicit currency conversion system exists.

Do not invent exchange rates.

---

# 11. Pages

Create:

```text
/login

/dashboard

/transactions
/transactions/new
/transactions/[id]

/accounts
/accounts/[id]

/budgets

/categories

/reimbursements

/settings
/settings/data
```

Navigation:

```text
Dashboard
Transactions
Accounts
Budgets
Categories
Reimbursements
────────────────
Settings
Profile
Sign Out
```

---

# 12. Dashboard

Create a useful personal finance dashboard showing:

- account balances
- total balance grouped by currency
- monthly expenses
- monthly income
- recent transactions
- spending by category
- budget progress
- reimbursable amount
- income vs expense trend

Provide month navigation.

All dashboard queries must automatically filter by the authenticated user.

---

# 13. Reimbursements

The backup contains reimbursement-related fields.

Create a reimbursement view for transactions where:

```text
reimbursable = true
```

Support statuses such as:

```text
pending
submitted
reimbursed
```

Allow the user to update reimbursement status.

---

# 14. UI

Create a modern, minimal finance dashboard.

Requirements:

- responsive
- mobile friendly
- light/dark mode
- accessible forms
- clear currency formatting
- loading states
- empty states
- confirmation dialogs
- useful validation messages

Provide a fast **Add Transaction** workflow because transaction entry will be one of the most frequently used actions.

---

# 15. Tests

Write automated tests for important financial logic.

Especially test:

- expense balance calculation
- income balance calculation
- transfers
- cross-currency transfers
- account balances
- monthly spending
- budget calculations
- reimbursements
- JSON import
- duplicate detection
- user isolation

Include security tests proving:

```text
User A cannot read User B's accounts
User A cannot modify User B's accounts
User A cannot read User B's transactions
User A cannot modify User B's transactions
User A cannot reference User B's category/account when creating a transaction
```

---

# 16. Vercel Deployment

Make the project production-ready for Vercel.

Provide README instructions for:

1. Creating the PostgreSQL database
2. Setting `DATABASE_URL`
3. Configuring authentication
4. Running migrations
5. Creating the first user
6. Importing the backup JSON
7. Local development
8. Deploying to Vercel
9. Production migrations
10. Backup/restore

Do not hard-code production URLs or credentials.

---

# 17. Implementation Order

Work systematically.

### Step 1
Inspect the complete backup JSON.

### Step 2
Document the discovered schema and edge cases.

### Step 3
Design the PostgreSQL schema including `users`.

### Step 4
Define relationships and user ownership.

### Step 5
Implement authentication.

### Step 6
Implement authorization/user-isolation helpers.

### Step 7
Create database migrations.

### Step 8
Build the JSON importer.

### Step 9
Import the supplied backup into a test user.

### Step 10
Verify:

```text
16 accounts
23 categories
226 transactions
32 budgets
```

Then verify account balances, monthly totals, transfers and budget calculations against the original data.

### Step 11
Implement CRUD for:

```text
Accounts
Categories
Transactions
Budgets
Reimbursements
```

### Step 12
Implement dashboard and analytics.

### Step 13
Implement backup/export.

### Step 14
Add authorization/security tests.

### Step 15
Run:

```bash
lint
typecheck
test
production build
```

Fix all errors before considering the application complete.

The final application should be a **real multi-user finance application**, not a static dashboard. Each authenticated user must have a completely isolated financial workspace where they can independently manage their accounts, categories, budgets, transactions, reimbursements, imports, and backups.