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
]).superRefine((val, ctx) => {
  // A same-account transfer (fromAccountId === toAccountId) would let calculateAccountBalance
  // (lib/balances.ts) apply the "from" debit and the "to" credit to the *same* account in the
  // same pass, silently absorbing amount/toAmount mismatches as a phantom gain or loss on that
  // account instead of being rejected outright. Enforced here via `superRefine` (rather than a
  // per-branch `.refine()`) because `z.discriminatedUnion` requires each option to be a plain
  // `ZodObject`; wrapping a branch in `.refine()` would break the union's discriminator lookup.
  if (val.type === 'transfer' && val.fromAccountId === val.toAccountId) {
    ctx.addIssue({
      code: 'custom',
      message: 'A transfer must move funds between two different accounts',
      path: ['toAccountId'],
    });
  }
});

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
  // `null` explicitly clears an optional column (e.g. the user blanked the note); absent means unchanged.
  toAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  currency: z.string().length(3).optional(),
  categoryId: z.string().nullable().optional(),
  fromAccountId: z.string().optional(),
  toAccountId: z.string().optional(),
  reimbursable: z.boolean().optional(),
  reimbursementStatus: z.enum(['to_claim', 'claimed', 'reimbursed']).optional(),
  note: z.string().nullable().optional(),
  receipt: z.any().optional(),
});

const CLEARABLE_FIELDS = ['toAmount', 'categoryId', 'note'] as const;

async function assertOwnedReferences(userId: string, data: { fromAccountId?: string; toAccountId?: string; categoryId?: string | null }) {
  if (data.fromAccountId && !(await getUserAccount(data.fromAccountId, userId))) throw new Error('FORBIDDEN');
  if (data.toAccountId && !(await getUserAccount(data.toAccountId, userId))) throw new Error('FORBIDDEN');
  if (data.categoryId && !(await getUserCategory(data.categoryId, userId))) throw new Error('FORBIDDEN');
}

// DB rows store "no value" as SQL NULL, but the Zod schema's optional fields expect the key to be
// absent/`undefined`, not `null` — `z.string().optional()` rejects `null` outright. Converting
// before merging an existing row into a re-validation pass avoids spurious "invalid_type" errors
// on fields the caller never touched.
function nullsToUndefined<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) out[key] = value === null ? undefined : value;
  return out as T;
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
  // Re-validate the FULL resulting record (existing row + this update, merged) against the same
  // per-type discriminated union `createTransaction` uses — not just the partial update fields.
  // Without this, changing `type` (e.g. expense -> income) without also supplying the new type's
  // required id field would write a row that satisfies neither of calculateAccountBalance's
  // matching branches (lib/balances.ts), silently dropping it from every account's balance total.
  // `data` is spread after the sanitized existing row so any field the caller actually provided
  // wins; fields the caller omitted keep the existing row's (sanitized) value.
  const merged = { ...nullsToUndefined(existing), ...nullsToUndefined(data) };
  const validated = transactionInput.parse(merged);
  // Drizzle skips `undefined` keys in `.set()`, so a cleared field must be written as an explicit NULL.
  const cleared = Object.fromEntries(CLEARABLE_FIELDS.filter((k) => data[k] === null).map((k) => [k, null]));
  const [updated] = await db.update(transactions).set({ ...validated, ...cleared, updatedAt: new Date() })
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
