import { pgTable, text, timestamp, boolean, numeric, date, jsonb, index, uniqueIndex, pgEnum } from 'drizzle-orm/pg-core';

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
