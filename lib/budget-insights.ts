import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { db } from '@/db/client';
import { budgets, categories, transactions } from '@/db/schema';
import { toCents } from '@/lib/money';
import { monthRange } from '@/lib/dates';

export type BudgetTone = 'ok' | 'warning' | 'over';

/** On track under 80% used, close from 80% up to 100%, over above 100%. */
export function budgetTone(percentUsed: number): BudgetTone {
  if (percentUsed > 100) return 'over';
  if (percentUsed >= 80) return 'warning';
  return 'ok';
}

export const BUDGET_SORTS = { name: 'Name', used: 'Most used', left: 'Least left' } as const;
export type BudgetSort = keyof typeof BUDGET_SORTS;

/** Sorts budget progress rows; ties fall back to the category name. */
export function sortBudgets<T extends { category: { name: string }; percentUsed: number; remainingCents: number }>(rows: T[], sort: BudgetSort): T[] {
  const byName = (a: T, b: T) => a.category.name.localeCompare(b.category.name, undefined, { sensitivity: 'base' });
  return [...rows].sort((a, b) =>
    sort === 'used' ? b.percentUsed - a.percentUsed || byName(a, b)
    : sort === 'left' ? a.remainingCents - b.remainingCents || byName(a, b)
    : byName(a, b));
}

/**
 * Expense categories with spending in `month` but no budget for that category and currency —
 * candidates for a new budget — with their transactions (newest first). Largest spending first.
 */
export async function unbudgetedSpending(userId: string, month: string) {
  const { from, to } = monthRange(month);
  const [rows, monthBudgets, userCategories] = await Promise.all([
    db.select().from(transactions).where(and(
      eq(transactions.userId, userId), eq(transactions.type, 'expense'),
      gte(transactions.payDate, from), lte(transactions.payDate, to),
    )).orderBy(desc(transactions.payDate), desc(transactions.createdAt), desc(transactions.id)),
    db.select().from(budgets).where(and(eq(budgets.userId, userId), eq(budgets.month, month))),
    db.select().from(categories).where(eq(categories.userId, userId)),
  ]);
  const budgeted = new Set(monthBudgets.map((b) => `${b.categoryId}|${b.currency}`));
  type Item = Pick<(typeof rows)[number], 'id' | 'details' | 'payDate' | 'amount' | 'currency' | 'fromAccountId' | 'counterparty'>;
  const totals = new Map<string, { categoryId: string; currency: string; spentCents: number; count: number; transactions: Item[] }>();
  for (const t of rows) {
    if (!t.categoryId || budgeted.has(`${t.categoryId}|${t.currency}`)) continue;
    const key = `${t.categoryId}|${t.currency}`;
    const s = totals.get(key) ?? { categoryId: t.categoryId, currency: t.currency, spentCents: 0, count: 0, transactions: [] };
    s.spentCents += toCents(t.amount);
    s.count += 1;
    s.transactions.push({
      id: t.id, details: t.details, payDate: t.payDate, amount: t.amount, currency: t.currency,
      fromAccountId: t.fromAccountId, counterparty: t.counterparty,
    });
    totals.set(key, s);
  }
  return [...totals.values()]
    .map((s) => ({ ...s, category: userCategories.find((c) => c.id === s.categoryId)! }))
    .filter((s) => s.category)
    .sort((a, b) => b.spentCents - a.spentCents);
}
