import { db } from '@/db/client';
import { accounts, transactions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { toCents, addCents } from '@/lib/money';
import { calculateAccountBalance } from '@/lib/balances';
import { calculateBudgetProgress } from '@/lib/budget-calc';

export interface DashboardData {
  balancesByCurrency: Record<string, number>;
  monthlyIncomeCents: number;
  monthlyExpenseCents: number;
  spendingByCategory: { categoryId: string; cents: number }[];
  reimbursableCents: number;
  budgetProgress: Awaited<ReturnType<typeof calculateBudgetProgress>>;
  trend: { month: string; incomeCents: number; expenseCents: number }[];
}

export async function getDashboardData(userId: string, month: string): Promise<DashboardData> {
  const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, userId));
  const allTransactions = await db.select().from(transactions).where(eq(transactions.userId, userId));
  const monthTransactions = allTransactions.filter((t) => t.payDate.startsWith(month));

  const balancesByCurrency: Record<string, number> = {};
  for (const account of userAccounts) {
    const { cents, currency } = await calculateAccountBalance(account.id, userId);
    balancesByCurrency[currency] = addCents(balancesByCurrency[currency] ?? 0, cents);
  }

  const monthlyIncomeCents = monthTransactions
    .filter((t) => t.type === 'income')
    .reduce((sum, t) => addCents(sum, toCents(t.amount)), 0);

  const monthlyExpenseCents = monthTransactions
    .filter((t) => t.type === 'expense')
    .reduce((sum, t) => addCents(sum, toCents(t.amount)), 0);

  const spendingMap = new Map<string, number>();
  for (const t of monthTransactions) {
    if (t.type !== 'expense' || !t.categoryId) continue;
    spendingMap.set(t.categoryId, addCents(spendingMap.get(t.categoryId) ?? 0, toCents(t.amount)));
  }
  const spendingByCategory = Array.from(spendingMap.entries()).map(([categoryId, cents]) => ({ categoryId, cents }));

  const reimbursableCents = monthTransactions
    .filter((t) => t.reimbursable && t.reimbursementStatus !== 'reimbursed')
    .reduce((sum, t) => addCents(sum, toCents(t.amount)), 0);

  // The task interface ("Consumes: calculateBudgetProgress ... Produces: ... budget summary")
  // calls for budget progress on the dashboard, but the brief's own Step 3 reference code never
  // calls calculateBudgetProgress or returns it. Wiring it in here so DashboardData actually
  // matches the documented interface instead of silently dropping the budget summary.
  const budgetProgress = await calculateBudgetProgress(userId, month);

  const trend: { month: string; incomeCents: number; expenseCents: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const key = d.toISOString().slice(0, 7);
    const monthTxns = allTransactions.filter((t) => t.payDate.startsWith(key));
    trend.push({
      month: key,
      incomeCents: monthTxns.filter((t) => t.type === 'income').reduce((sum, t) => addCents(sum, toCents(t.amount)), 0),
      expenseCents: monthTxns.filter((t) => t.type === 'expense').reduce((sum, t) => addCents(sum, toCents(t.amount)), 0),
    });
  }

  return { balancesByCurrency, monthlyIncomeCents, monthlyExpenseCents, spendingByCategory, reimbursableCents, budgetProgress, trend };
}
