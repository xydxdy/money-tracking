import { db } from '@/db/client';
import { budgets, transactions, categories } from '@/db/schema';
import { and, asc, desc, eq, gte, lt, sql } from 'drizzle-orm';
import { toCents } from '@/lib/money';

export async function calculateBudgetProgress(userId: string, month: string) {
  const rows = await db.select().from(budgets)
    .innerJoin(categories, eq(budgets.categoryId, categories.id))
    .where(and(eq(budgets.userId, userId), eq(budgets.month, month)))
    .orderBy(asc(sql`lower(${categories.name})`), asc(budgets.currency));

  // `month` is validated upstream as `YYYY-MM`; bound the range with real
  // date comparisons (rather than a `payDate.startsWith(month)` string check)
  // so this stays correct across month/year boundaries (e.g. "2026-12").
  const [year, monthNum] = month.split('-').map(Number);
  const rangeStart = `${month}-01`;
  const nextMonthDate = new Date(Date.UTC(year, monthNum, 1));
  const rangeEnd = nextMonthDate.toISOString().slice(0, 10);

  const monthTransactions = await db.select().from(transactions)
    .where(and(
      eq(transactions.userId, userId),
      eq(transactions.type, 'expense'),
      gte(transactions.payDate, rangeStart),
      lt(transactions.payDate, rangeEnd)
    ))
    .orderBy(desc(transactions.payDate), desc(transactions.createdAt), desc(transactions.id));

  return rows.map(({ budgets: budget, categories: category }) => {
    // Only the budget's own currency counts — never sum across currencies.
    const budgetTransactions = monthTransactions.filter((t) => t.categoryId === category.id && t.currency === budget.currency);
    const spentCents = budgetTransactions.reduce((sum, t) => sum + toCents(t.amount), 0);
    const plannedCents = toCents(budget.plannedAmount);
    const remainingCents = plannedCents - spentCents;
    const percentUsed = plannedCents === 0 ? 0 : (spentCents / plannedCents) * 100;
    return {
      budget, category, plannedCents, spentCents, remainingCents, percentUsed,
      transactions: budgetTransactions.map((t) => ({ id: t.id, details: t.details, payDate: t.payDate, amount: t.amount, currency: t.currency })),
    };
  });
}
