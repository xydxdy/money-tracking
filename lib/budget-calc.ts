import { db } from '@/db/client';
import { budgets, transactions, categories } from '@/db/schema';
import { and, eq, gte, lt } from 'drizzle-orm';
import { toCents } from '@/lib/money';

export async function calculateBudgetProgress(userId: string, month: string) {
  const rows = await db.select().from(budgets)
    .innerJoin(categories, eq(budgets.categoryId, categories.id))
    .where(and(eq(budgets.userId, userId), eq(budgets.month, month)));

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
    ));

  return rows.map(({ budgets: budget, categories: category }) => {
    const spentCents = monthTransactions
      .filter((t) => t.categoryId === category.id)
      .reduce((sum, t) => sum + toCents(t.amount), 0);
    const plannedCents = toCents(budget.plannedAmount);
    const remainingCents = plannedCents - spentCents;
    const percentUsed = plannedCents === 0 ? 0 : (spentCents / plannedCents) * 100;
    return { budget, category, plannedCents, spentCents, remainingCents, percentUsed };
  });
}
