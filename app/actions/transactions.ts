'use server';
import { z } from 'zod';
import { db } from '@/db/client';
import { transactions } from '@/db/schema';
import { and, count, eq } from 'drizzle-orm';
import { clampPage, totalPages } from '@/lib/pagination';
import { parseTransactionFilters, transactionConditions, transactionOrder, type TransactionFilters } from '@/lib/transaction-query';
import { getCurrentUser } from '@/lib/session';
import { getUserAccount, getUserCategory, getUserTransaction } from '@/lib/authorization';
import { httpUrl } from '@/lib/link';

const LOAN_KINDS = ['lend', 'borrow', 'repayment_in', 'repayment_out'] as const;
const LOAN_OUT_KINDS: readonly string[] = ['lend', 'repayment_out'];

const baseFields = {
  details: z.string().min(1),
  payDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
  toAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  // Taken from the account on save (see sourceCurrency); only used for an expense paid by a
  // person / income received by a person, which have no account.
  currency: z.string().trim().length(3).toUpperCase().optional(),
  // The person on the other side: required for loans; for an expense it means "paid by this
  // person" (no account), for an income "received by this person".
  counterparty: z.string().trim().min(1).max(80).optional(),
  categoryId: z.string().optional(),
  fromAccountId: z.string().optional(),
  toAccountId: z.string().optional(),
  reimbursable: z.boolean().default(false),
  reimbursementStatus: z.enum(['to_claim', 'submitting', 'claimed']).optional(),
  note: z.string().optional(),
  link: httpUrl.optional(),
  receipt: z.any().optional(),
};

const transactionInput = z.discriminatedUnion('type', [
  // `...baseFields` MUST come first in each branch: baseFields.fromAccountId/toAccountId are
  // `.optional()`, and object-spread order means a later key wins. Spreading baseFields first
  // and overriding the required id(s) after is what actually makes them required per type —
  // the reverse order silently makes every branch's ids optional again.
  z.object({ ...baseFields, type: z.literal('expense') }),
  z.object({ ...baseFields, type: z.literal('income') }),
  z.object({ ...baseFields, type: z.literal('transfer'), fromAccountId: z.string(), toAccountId: z.string() }),
  z.object({
    ...baseFields,
    type: z.literal('loan'),
    loanKind: z.enum(LOAN_KINDS),
    counterparty: z.string().trim().min(1, 'Enter who the loan is with').max(80),
  }),
]).superRefine((val, ctx) => {
  // A loan moves money out of one account (lend, repayment paid) or into one (borrow, repayment
  // received); the matching side is required.
  // An expense comes out of one of your accounts or is paid by a person; an income goes into an
  // account or to a person. With no account, the currency must be given.
  if (val.type === 'expense' || val.type === 'income') {
    const accountKey = val.type === 'expense' ? 'fromAccountId' : 'toAccountId';
    if (!val[accountKey] && !val.counterparty) {
      ctx.addIssue({ code: 'custom', message: val.type === 'expense' ? 'Choose the account it was paid from, or who paid' : 'Choose the account it went into, or who received it', path: [accountKey] });
    }
    if (!val[accountKey] && val.counterparty && !val.currency) {
      ctx.addIssue({ code: 'custom', message: 'Choose the currency', path: ['currency'] });
    }
  }
  if (val.type === 'loan') {
    const out = LOAN_OUT_KINDS.includes(val.loanKind);
    if (out && !val.fromAccountId) ctx.addIssue({ code: 'custom', message: 'Choose the account the money leaves', path: ['fromAccountId'] });
    if (!out && !val.toAccountId) ctx.addIssue({ code: 'custom', message: 'Choose the account the money arrives in', path: ['toAccountId'] });
  }
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
  type: z.enum(['expense', 'income', 'transfer', 'loan']).optional(),
  loanKind: z.enum(LOAN_KINDS).optional(),
  counterparty: z.string().trim().min(1).max(80).nullable().optional(),
  payDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
  // `null` explicitly clears an optional column (e.g. the user blanked the note); absent means unchanged.
  toAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional(),
  currency: z.string().trim().length(3).toUpperCase().optional(),
  categoryId: z.string().nullable().optional(),
  fromAccountId: z.string().nullable().optional(),
  toAccountId: z.string().nullable().optional(),
  reimbursable: z.boolean().optional(),
  reimbursementStatus: z.enum(['to_claim', 'submitting', 'claimed']).optional(),
  note: z.string().nullable().optional(),
  link: httpUrl.nullable().optional(),
  receipt: z.any().optional(),
});

const CLEARABLE_FIELDS = ['toAmount', 'categoryId', 'note', 'link'] as const;

async function assertOwnedReferences(userId: string, data: { fromAccountId?: string | null; toAccountId?: string | null; categoryId?: string | null }) {
  if (data.fromAccountId && !(await getUserAccount(data.fromAccountId, userId))) throw new Error('FORBIDDEN');
  if (data.toAccountId && !(await getUserAccount(data.toAccountId, userId))) throw new Error('FORBIDDEN');
  if (data.categoryId && !(await getUserCategory(data.categoryId, userId))) throw new Error('FORBIDDEN');
}

// `toAmount` only means something for a transfer between accounts of different currencies (it is
// the amount that lands in the destination account). Same-currency transfers and non-transfers
// store NULL; a cross-currency transfer without it is rejected, since its balance effect on the
// destination account would otherwise silently use the source-currency amount.
async function resolveToAmount(
  userId: string,
  data: { type: string; fromAccountId?: string; toAccountId?: string; toAmount?: string },
): Promise<string | null> {
  if (data.type !== 'transfer' || !data.fromAccountId || !data.toAccountId) return null;
  const [from, to] = await Promise.all([getUserAccount(data.fromAccountId, userId), getUserAccount(data.toAccountId, userId)]);
  if (!from || !to || from.currency === to.currency) return null;
  if (!data.toAmount) throw new Error('TO_AMOUNT_REQUIRED');
  return data.toAmount;
}

/** True when money arrives in `toAccountId` (income, or a loan borrowed / repaid to you). */
function movesIntoAccount(data: { type: string; loanKind?: string }) {
  return data.type === 'income' || (data.type === 'loan' && !LOAN_OUT_KINDS.includes(data.loanKind ?? ''));
}

// A transaction's currency is its account's currency: the account money leaves (expense, transfer,
// lending, paying back), or the account it arrives in (income, borrowing, being paid back).
// Accounts are already ownership-checked.
async function sourceCurrency(userId: string, data: { type: string; loanKind?: string; fromAccountId?: string; toAccountId?: string; currency?: string }): Promise<string> {
  const accountId = movesIntoAccount(data) ? data.toAccountId : data.fromAccountId;
  // Paid by / received by a person: there is no account, so the given currency is used.
  if (!accountId && (data.type === 'expense' || data.type === 'income') && data.currency) return data.currency;
  const account = accountId ? await getUserAccount(accountId, userId) : null;
  if (!account) throw new Error('FORBIDDEN');
  return account.currency;
}

/**
 * Explicit NULLs for the fields that don't apply to a transaction's type, so nothing left over
 * from an earlier type (or sent by mistake) is stored: loan fields only on loans, no category or
 * reimbursement on loans, and only the account side the money actually moves through.
 */
function fieldsNotApplicable(data: { type: string; loanKind?: string; fromAccountId?: string; toAccountId?: string }) {
  const nulls: Record<string, null> = {};
  if (data.type !== 'loan') nulls.loanKind = null;
  // A person only stays on a non-loan when no account is used: an expense paid by them, or an
  // income received by them. Otherwise the person (and any loan close date) is dropped.
  const paidByPerson = (data.type === 'expense' && !data.fromAccountId) || (data.type === 'income' && !data.toAccountId);
  if (data.type !== 'loan' && !paidByPerson) Object.assign(nulls, { counterparty: null, loanClosedAt: null });
  if (data.type === 'expense' && !data.fromAccountId) nulls.fromAccountId = null;
  if (data.type === 'income' && !data.toAccountId) nulls.toAccountId = null;
  if (data.type === 'loan') Object.assign(nulls, { categoryId: null, reimbursementStatus: null });
  if (data.type === 'expense' || (data.type === 'loan' && !movesIntoAccount(data))) nulls.toAccountId = null;
  if (data.type === 'income' || (data.type === 'loan' && movesIntoAccount(data))) nulls.fromAccountId = null;
  return nulls;
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
  const toAmount = await resolveToAmount(user.id, data);
  const currency = await sourceCurrency(user.id, data);
  const loanFix = data.type === 'loan' ? { reimbursable: false } : {};
  const [txn] = await db.insert(transactions)
    .values({ ...data, ...fieldsNotApplicable(data), ...loanFix, currency, toAmount, userId: user.id }).returning();
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
  const toAmount = await resolveToAmount(user.id, validated);
  const currency = await sourceCurrency(user.id, validated);
  // Drizzle skips `undefined` keys in `.set()`, so a cleared field must be written as an explicit NULL.
  const cleared = Object.fromEntries(CLEARABLE_FIELDS.filter((k) => data[k] === null).map((k) => [k, null]));
  const loanFix = validated.type === 'loan' ? { reimbursable: false } : {};
  const [updated] = await db.update(transactions)
    .set({ ...validated, ...cleared, ...fieldsNotApplicable(validated), ...loanFix, currency, toAmount, updatedAt: new Date() })
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

export async function listTransactions(filters?: TransactionFilters) {
  const user = await getCurrentUser();
  const f = parseTransactionFilters(filters);
  return db.select().from(transactions).where(and(...transactionConditions(user.id, f))).orderBy(...transactionOrder(f.sort));
}

const TRANSACTIONS_PAGE_SIZE = 50;

/** One page of the filtered list (newest first by default), with the total for page links. */
export async function listTransactionsPage(filters: TransactionFilters & { page?: string | number }, pageSize = TRANSACTIONS_PAGE_SIZE) {
  const user = await getCurrentUser();
  const f = parseTransactionFilters(filters);
  const where = and(...transactionConditions(user.id, f));
  const [{ n: total }] = await db.select({ n: count() }).from(transactions).where(where);
  const pageCount = totalPages(total, pageSize);
  const page = clampPage(filters.page, pageCount);
  const rows = await db.select().from(transactions).where(where).orderBy(...transactionOrder(f.sort))
    .limit(pageSize).offset((page - 1) * pageSize);
  return { rows, total, page, pageCount, pageSize };
}
