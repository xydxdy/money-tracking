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

// Partial-update schema for `updateTransaction`. Deliberately NOT `transactionInput.partial()`
// (not available on a discriminated union, and a partial update legitimately omits `type`) and
// NOT `z.object(baseFields).partial()` either: `baseFields.reimbursable` carries `.default(false)`,
// and Zod fills in defaults for absent keys even under `.partial()` — so a partial update that
// simply doesn't mention `reimbursable` would silently overwrite it back to `false` in the DB.
// This schema re-declares every field as plain `.optional()` (no defaults) so an absent field
// truly means "leave unchanged", while a present field still gets format-validated.
const transactionUpdateInput = z.object({
  details: z.string().min(1).optional(),
  type: z.enum(['expense', 'income', 'transfer']).optional(),
  payDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  toAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  currency: z.string().length(3).optional(),
  categoryId: z.string().optional(),
  fromAccountId: z.string().optional(),
  toAccountId: z.string().optional(),
  reimbursable: z.boolean().optional(),
  reimbursementStatus: z.enum(['to_claim', 'claimed', 'reimbursed']).optional(),
  note: z.string().optional(),
  receipt: z.any().optional(),
});

async function assertOwnedReferences(userId: string, data: { fromAccountId?: string; toAccountId?: string; categoryId?: string }) {
  if (data.fromAccountId && !(await getUserAccount(data.fromAccountId, userId))) throw new Error('FORBIDDEN');
  if (data.toAccountId && !(await getUserAccount(data.toAccountId, userId))) throw new Error('FORBIDDEN');
  if (data.categoryId && !(await getUserCategory(data.categoryId, userId))) throw new Error('FORBIDDEN');
}

// `z.input<...>`, not `z.infer`/`z.output<...>`: `reimbursable` carries `.default(false)`, so
// the *input* type keeps it optional while the *output* (infer) type makes it required. Typing
// the parameter with the output type would reject exactly the calls callers are meant to make
// (omitting `reimbursable` and letting the default apply) — including the brief's own test.
export async function createTransaction(input: z.input<typeof transactionInput>) {
  const user = await getCurrentUser();
  const data = transactionInput.parse(input);
  await assertOwnedReferences(user.id, data);
  const [txn] = await db.insert(transactions).values({ ...data, userId: user.id }).returning();
  return txn;
}

export async function updateTransaction(id: string, input: z.input<typeof transactionUpdateInput>) {
  const user = await getCurrentUser();
  const existing = await getUserTransaction(id, user.id);
  if (!existing) throw new Error('NOT_FOUND');
  const data = transactionUpdateInput.parse(input);
  await assertOwnedReferences(user.id, data);
  const [updated] = await db.update(transactions).set({ ...data, updatedAt: new Date() })
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
