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
  status: z.enum(['completed', 'pending', 'cancelled']),
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
