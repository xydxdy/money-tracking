import { z } from 'zod';
import { httpUrl } from '@/lib/link';
import { ACCOUNT_COLOR_KEYS } from '@/lib/account-appearance';

export const backupAccountSchema = z.object({
  id: z.string(),
  name: z.string(),
  // An account type name ("Credit card"), or a built-in key ("credit") in version 1/2 files.
  type: z.string().trim().min(1).max(60).optional(),
  currency: z.string(),
  startingBalance: z.number(),
  note: z.string().optional(),
  // Some older backups omit it for accounts that were never archived.
  archived: z.boolean().default(false),
  favorite: z.boolean().default(false),
  color: z.enum(ACCOUNT_COLOR_KEYS).optional(),
  // An icon name, or an emoji in older backups (translated on import; unknown ones are dropped).
  icon: z.string().trim().max(40).optional(),
  // The id of one of the file's groups; older backups have no groups.
  groupId: z.string().optional(),
  position: z.number().int().optional(),
});

export const backupGroupSchema = z.object({
  id: z.string(),
  name: z.string().trim().min(1).max(60),
  color: z.enum(ACCOUNT_COLOR_KEYS).optional(),
  icon: z.string().trim().max(40).optional(),
  note: z.string().optional(),
  position: z.number().int().optional(),
});

export const backupCategorySchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['expense', 'income', 'transfer']),
  icon: z.string().optional(),
  // Retired: older files carry it, but the app no longer uses it.
  noBudget: z.boolean().optional(),
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
  type: z.enum(['expense', 'income', 'transfer', 'loan']),
  loanKind: z.enum(['lend', 'borrow', 'repayment_in', 'repayment_out']).optional(),
  counterparty: z.string().trim().min(1).max(80).optional(),
  loanClosedAt: z.string().refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid loanClosedAt date').optional(),
  categoryId: z.string().nullable(),
  payDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fromAccountId: z.string().nullable(),
  toAccountId: z.string().nullable(),
  amount: z.number().positive(),
  toAmount: z.number().positive().optional(),
  currency: z.string(),
  status: z.enum(['completed', 'pending', 'cancelled']),
  reimbursable: z.boolean(),
  reimbursementStatus: z.enum(['to_claim', 'submitting', 'claimed', 'denied']).optional(),
  receipt: backupReceiptSchema.optional(),
  link: httpUrl.optional(),
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

// Version 1 files (the original app, and this app's exports before format 2) used
// to_claim / claimed / reimbursed, where "claimed" meant "sent, waiting for the money" and
// "reimbursed" meant "money received". Version 2 renamed them to to_claim / submitting / claimed.
const V1_REIMBURSEMENT_STATUS: Record<string, string> = { claimed: 'submitting', reimbursed: 'claimed' };

function upgradeV1(input: unknown): unknown {
  if (typeof input !== 'object' || input === null) return input;
  const file = input as { version?: unknown; transactions?: unknown };
  if (typeof file.version !== 'number' || file.version >= 2 || !Array.isArray(file.transactions)) return input;
  return {
    ...file,
    transactions: file.transactions.map((t) => {
      if (typeof t !== 'object' || t === null) return t;
      const status = (t as { reimbursementStatus?: unknown }).reimbursementStatus;
      return typeof status === 'string' && status in V1_REIMBURSEMENT_STATUS
        ? { ...t, reimbursementStatus: V1_REIMBURSEMENT_STATUS[status] }
        : t;
    }),
  };
}

export const backupSchema = z.preprocess(upgradeV1, z.object({
  version: z.number(),
  accounts: z.array(backupAccountSchema),
  groups: z.array(backupGroupSchema).default([]),
  categories: z.array(backupCategorySchema),
  transactions: z.array(backupTransactionSchema),
  budgets: z.array(backupBudgetSchema),
}));

export type Backup = z.infer<typeof backupSchema>;
