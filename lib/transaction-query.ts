import { z } from 'zod';
import { asc, desc, eq, ilike, isNull, or, gte, lte, sql, type SQL } from 'drizzle-orm';
import { transactions } from '@/db/schema';
import { monthRange } from '@/lib/dates';

export const TRANSACTION_SORTS = {
  date_desc: 'Newest first',
  date_asc: 'Oldest first',
  amount_desc: 'Amount: high to low',
  amount_asc: 'Amount: low to high',
  details_asc: 'Details: A to Z',
} as const;
export type TransactionSort = keyof typeof TRANSACTION_SORTS;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const sortKey = z.enum(Object.keys(TRANSACTION_SORTS) as [TransactionSort, ...TransactionSort[]]);

// Every field is optional and an invalid value is dropped rather than rejected, because these
// come straight from the URL: a hand-edited or stale link should still show a list.
const filterSchema = z.object({
  q: z.string().trim().max(200).optional().catch(undefined),
  type: z.enum(['expense', 'income', 'transfer', 'loan']).optional().catch(undefined),
  accountId: z.string().min(1).optional().catch(undefined),
  categoryId: z.string().min(1).optional().catch(undefined),
  status: z.enum(['to_claim', 'submitting', 'claimed', 'denied']).optional().catch(undefined),
  // `YYYY-MM` or `all`. Without it (and without from/to) the list shows all time.
  month: z.union([z.literal('all'), z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/)]).optional().catch(undefined),
  from: isoDate.optional().catch(undefined),
  to: isoDate.optional().catch(undefined),
  sort: sortKey.optional().catch(undefined),
});
export type TransactionFilters = z.input<typeof filterSchema>;

export function parseTransactionFilters(input: unknown) {
  const raw = (input ?? {}) as Record<string, unknown>;
  // Next.js searchParams values may be string | string[]; empty strings mean "not set".
  const flat = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v !== '' && v !== undefined)
  );
  return filterSchema.parse(flat);
}

/**
 * The date range a list should show. Explicit from/to dates win; otherwise the `month` parameter;
 * with neither, all time.
 */
export function resolveDateRange(f: ReturnType<typeof parseTransactionFilters>) {
  if (f.from || f.to) return { month: undefined, from: f.from, to: f.to };
  const month = f.month ?? 'all';
  if (month === 'all') return { month: 'all' as const, from: undefined, to: undefined };
  return { month, ...monthRange(month) };
}

function escapeLike(text: string) {
  return text.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export function transactionConditions(userId: string, f: ReturnType<typeof parseTransactionFilters>): SQL[] {
  const conditions: SQL[] = [eq(transactions.userId, userId)];
  if (f.q) {
    const pattern = `%${escapeLike(f.q)}%`;
    conditions.push(or(ilike(transactions.details, pattern), ilike(transactions.note, pattern), ilike(transactions.counterparty, pattern))!);
  }
  if (f.type) conditions.push(eq(transactions.type, f.type));
  if (f.accountId) conditions.push(or(eq(transactions.fromAccountId, f.accountId), eq(transactions.toAccountId, f.accountId))!);
  if (f.categoryId) conditions.push(eq(transactions.categoryId, f.categoryId));
  if (f.status === 'to_claim') {
    // A reimbursable transaction with no status yet is still waiting to be claimed.
    conditions.push(or(eq(transactions.reimbursementStatus, 'to_claim'), isNull(transactions.reimbursementStatus))!);
  } else if (f.status) {
    conditions.push(eq(transactions.reimbursementStatus, f.status));
  }
  if (f.from) conditions.push(gte(transactions.payDate, f.from));
  if (f.to) conditions.push(lte(transactions.payDate, f.to));
  return conditions;
}

export function transactionOrder(sort: TransactionSort | undefined): SQL[] {
  // Within the same pay date, the most recently added comes first (creation time, then the
  // time-ordered id as the final tie-breaker); "oldest first" reverses that.
  const newest = [desc(transactions.payDate), desc(transactions.createdAt), desc(transactions.id)];
  switch (sort) {
    case 'date_asc': return [asc(transactions.payDate), asc(transactions.createdAt), asc(transactions.id)];
    case 'amount_desc': return [desc(transactions.amount), ...newest];
    case 'amount_asc': return [asc(transactions.amount), ...newest];
    case 'details_asc': return [asc(sql`lower(${transactions.details})`), ...newest];
    default: return newest;
  }
}

