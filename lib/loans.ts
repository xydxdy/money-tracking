import { and, asc, desc, eq, isNotNull, isNull } from 'drizzle-orm';
import { db } from '@/db/client';
import { transactions } from '@/db/schema';
import { toCents } from '@/lib/money';

export type LoanSummary = {
  counterparty: string;
  currency: string;
  lentCents: number;
  borrowedCents: number;
  repaidToMeCents: number;
  repaidByMeCents: number;
  /** Positive: they owe you. Negative: you owe them. */
  netCents: number;
  count: number;
};

/** Normalises a person's name so "Alice", "alice " and "ALICE" are the same person. */
/**
 * Everything that changes what you and a person owe each other: loan transactions, expenses they
 * paid for you, and income that went to them instead of your account.
 */
const involvesPerson = isNotNull(transactions.counterparty);

/** How a row moves the balance with that person, in loan terms. */
function loanEffect(t: { type: string; loanKind: string | null }) {
  if (t.type === 'expense') return 'borrow'; // they paid for you: you owe them
  if (t.type === 'income') return 'repayment_out'; // it went to them: you owe them less
  return t.loanKind;
}

export function personKey(name: string) {
  return name.trim().replace(/\s+/g, ' ').toLowerCase();
}

/**
 * What each person owes you (or you owe them), per currency — amounts in different currencies
 * are never added together. The displayed name is the first spelling used.
 */
export async function calculateLoanSummary(userId: string): Promise<LoanSummary[]> {
  // Closed loans no longer count: a person's balance covers only their open loans.
  const rows = await db.select().from(transactions)
    .where(and(eq(transactions.userId, userId), involvesPerson, isNull(transactions.loanClosedAt)))
    .orderBy(asc(transactions.payDate), asc(transactions.createdAt), asc(transactions.id));

  const byKey = new Map<string, LoanSummary>();
  for (const t of rows) {
    const kind = loanEffect(t);
    if (!t.counterparty || !kind) continue;
    const key = `${personKey(t.counterparty)}|${t.currency}`;
    const s = byKey.get(key) ?? {
      counterparty: t.counterparty.trim().replace(/\s+/g, ' '), currency: t.currency,
      lentCents: 0, borrowedCents: 0, repaidToMeCents: 0, repaidByMeCents: 0, netCents: 0, count: 0,
    };
    const cents = toCents(t.amount);
    if (kind === 'lend') s.lentCents += cents;
    else if (kind === 'borrow') s.borrowedCents += cents;
    else if (kind === 'repayment_in') s.repaidToMeCents += cents;
    else s.repaidByMeCents += cents;
    s.netCents = s.lentCents - s.repaidToMeCents - (s.borrowedCents - s.repaidByMeCents);
    s.count += 1;
    byKey.set(key, s);
  }
  return [...byKey.values()].sort((a, b) => a.counterparty.localeCompare(b.counterparty) || a.currency.localeCompare(b.currency));
}

type Totals = Pick<LoanSummary, 'lentCents' | 'borrowedCents' | 'repaidToMeCents' | 'repaidByMeCents' | 'netCents'>;

function totalsOf(rows: { type: string; loanKind: string | null; amount: string }[]): Totals {
  const t = { lentCents: 0, borrowedCents: 0, repaidToMeCents: 0, repaidByMeCents: 0, netCents: 0 };
  for (const r of rows) {
    const cents = toCents(r.amount);
    const kind = loanEffect(r);
    if (kind === 'lend') t.lentCents += cents;
    else if (kind === 'borrow') t.borrowedCents += cents;
    else if (kind === 'repayment_in') t.repaidToMeCents += cents;
    else if (kind === 'repayment_out') t.repaidByMeCents += cents;
  }
  t.netCents = t.lentCents - t.repaidToMeCents - (t.borrowedCents - t.repaidByMeCents);
  return t;
}

export type LoanHistoryGroup = Totals & {
  counterparty: string;
  currency: string;
  /** null for the person's open loans; otherwise when this batch was closed (its identity). */
  closedAt: Date | null;
  transactions: (typeof transactions.$inferSelect)[];
};

/**
 * Every loan, grouped by person and currency into the open group plus one group per close: loans
 * closed together stay together, and new loans after a close start a separate open group. Within
 * a person, the open group comes first, then closed groups newest first.
 */
export async function calculateLoanHistory(userId: string): Promise<LoanHistoryGroup[]> {
  const rows = await db.select().from(transactions)
    .where(and(eq(transactions.userId, userId), involvesPerson))
    .orderBy(desc(transactions.payDate), desc(transactions.createdAt), desc(transactions.id));
  const groups = new Map<string, Omit<LoanHistoryGroup, keyof Totals>>();
  for (const t of rows) {
    if (!t.counterparty) continue;
    const key = `${personKey(t.counterparty)}|${t.currency}|${t.loanClosedAt?.getTime() ?? 'open'}`;
    const group = groups.get(key) ?? {
      counterparty: t.counterparty.trim().replace(/\s+/g, ' '), currency: t.currency, closedAt: t.loanClosedAt, transactions: [],
    };
    group.transactions.push(t);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, ...totalsOf(g.transactions) }))
    .sort((a, b) =>
      personKey(a.counterparty).localeCompare(personKey(b.counterparty))
      || a.currency.localeCompare(b.currency)
      || (a.closedAt ? 1 : 0) - (b.closedAt ? 1 : 0)
      || (b.closedAt?.getTime() ?? 0) - (a.closedAt?.getTime() ?? 0));
}

/**
 * Closes all of a person's open loans in one currency as one batch (they share one closedAt), or
 * reopens the closed batch identified by `batch`. Returns how many loans changed. The person is
 * matched like the summary: ignoring case and extra spaces.
 */
export async function setLoansClosed(userId: string, counterparty: string, currency: string, closed: boolean, batch?: Date) {
  const key = personKey(counterparty);
  const candidates = await db.select({ id: transactions.id, counterparty: transactions.counterparty, closedAt: transactions.loanClosedAt })
    .from(transactions)
    .where(and(eq(transactions.userId, userId), involvesPerson, eq(transactions.currency, currency)));
  const ids = candidates
    .filter((t) => t.counterparty && personKey(t.counterparty) === key)
    .filter((t) => closed ? !t.closedAt : !!t.closedAt && (!batch || t.closedAt.getTime() === batch.getTime()))
    .map((t) => t.id);
  const closedAt = closed ? new Date() : null;
  for (const id of ids) {
    await db.update(transactions).set({ loanClosedAt: closedAt }).where(and(eq(transactions.id, id), eq(transactions.userId, userId)));
  }
  return ids.length;
}
