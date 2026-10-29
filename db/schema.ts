import { sql } from 'drizzle-orm';
import { uuidv7 } from '../lib/uuid';
import { pgTable, text, timestamp, boolean, numeric, date, jsonb, index, uniqueIndex, pgEnum, integer } from 'drizzle-orm/pg-core';

export const categoryTypeEnum = pgEnum('category_type', ['expense', 'income', 'transfer']);
export const transactionTypeEnum = pgEnum('transaction_type', ['expense', 'income', 'transfer', 'loan']);
// For type = 'loan': lend / repayment_out move money out of fromAccountId; borrow / repayment_in
// move money into toAccountId.
export const loanKindEnum = pgEnum('loan_kind', ['lend', 'borrow', 'repayment_in', 'repayment_out']);
export const transactionStatusEnum = pgEnum('transaction_status', ['completed', 'pending', 'cancelled']);
export const reimbursementStatusEnum = pgEnum('reimbursement_status', ['to_claim', 'submitting', 'claimed', 'denied']);

// Time-ordered UUIDv7 ids: newer rows sort after older ones (see lib/uuid.ts).
const genId = () => uuidv7();
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

// Each user's own list of account types (Bank, Credit card, …). The icon is the default given to
// new accounts of that type.
export const accountTypes = pgTable('account_types', {
  id: text('id').primaryKey().$defaultFn(genId),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  icon: text('icon'),
  ...timestamps,
}, (t) => ({
  userIdx: index('account_types_user_id_idx').on(t.userId),
  uniqueName: uniqueIndex('account_types_user_name_idx').on(t.userId, sql`lower(${t.name})`),
}));

// A user-made group of accounts, e.g. a bank holding several sub-accounts in different currencies.
export const accountGroups = pgTable('account_groups', {
  id: text('id').primaryKey().$defaultFn(genId),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // Palette key (lib/account-appearance.ts) and icon name, like an account's.
  color: text('color'),
  icon: text('icon'),
  note: text('note'),
  // Display order (drag and drop); NULL sorts after ordered groups, by name.
  position: integer('position'),
  ...timestamps,
}, (t) => ({
  userIdx: index('account_groups_user_id_idx').on(t.userId),
  uniqueName: uniqueIndex('account_groups_user_name_idx').on(t.userId, sql`lower(${t.name})`),
}));

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey().$defaultFn(genId),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  // Deleting a type that accounts still use is refused by the app (TYPE_IN_USE). The FK is the
  // default NO ACTION rather than RESTRICT so deleting a user can cascade to both tables.
  accountTypeId: text('account_type_id').references(() => accountTypes.id),
  // Optional group; deleting the group leaves its accounts ungrouped.
  groupId: text('group_id').references(() => accountGroups.id, { onDelete: 'set null' }),
  currency: text('currency').notNull(),
  startingBalance: numeric('starting_balance', { precision: 14, scale: 2 }).notNull().default('0'),
  note: text('note'),
  archived: boolean('archived').notNull().default(false),
  // Starred by the user: shown with a star and listed first in transaction account pickers.
  favorite: boolean('favorite').notNull().default(false),
  // Palette key (lib/account-appearance.ts) and emoji shown on the account.
  color: text('color'),
  icon: text('icon'),
  // User-chosen display order (set by drag and drop). NULL = never reordered: those accounts
  // sort after ordered ones, by currency then name.
  position: integer('position'),
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
  // Optional http(s) link, e.g. to a receipt stored elsewhere.
  link: text('link'),
  // Loans only: what kind of loan movement this is, and the person on the other side.
  loanKind: loanKindEnum('loan_kind'),
  counterparty: text('counterparty'),
  // Set when the loan was closed (settled or written off) on the Loans page. Closed loans stay in
  // the history but no longer count towards the person's outstanding balance.
  loanClosedAt: timestamp('loan_closed_at', { withTimezone: true }),
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
export type AccountType = typeof accountTypes.$inferSelect;
export type AccountGroup = typeof accountGroups.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type Budget = typeof budgets.$inferSelect;
