import { db } from '@/db/client';
import { accounts, transactions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { toCents, addCents } from '@/lib/money';
import { calculateAccountBalance } from '@/lib/balances';
import { calculateBudgetProgress } from '@/lib/budget-calc';

export interface DashboardData {
  balancesByCurrency: Record<string, number>;
  // Bucketed by currency — never summed across currencies. This schema gives every account,
  // transaction, and budget its own independent `currency` field (this app's real data has 11
  // USD accounts and 5 THB accounts side by side), so a flat cross-currency total would silently
  // add e.g. THB cents into the same number as USD cents. `balancesByCurrency` above already got
  // this right; everything below mirrors that same per-currency-bucket pattern.
  monthlyIncomeCents: Record<string, number>;
  monthlyExpenseCents: Record<string, number>;
  spendingByCategory: { categoryId: string; currency: string; cents: number }[];
  reimbursableCents: Record<string, number>;
  budgetProgress: Awaited<ReturnType<typeof calculateBudgetProgress>>;
  trend: { month: string; incomeCents: Record<string, number>; expenseCents: Record<string, number> }[];
}

function addToCurrencyBucket(bucket: Record<string, number>, currency: string, cents: number) {
  bucket[currency] = addCents(bucket[currency] ?? 0, cents);
}

export async function getDashboardData(userId: string, month: string): Promise<DashboardData> {
  const userAccounts = await db.select().from(accounts).where(eq(accounts.userId, userId));
  const allTransactions = await db.select().from(transactions).where(eq(transactions.userId, userId));
  const monthTransactions = allTransactions.filter((t) => t.payDate.startsWith(month));

  const balancesByCurrency: Record<string, number> = {};
  for (const account of userAccounts) {
    const { cents, currency } = await calculateAccountBalance(account.id, userId);
    addToCurrencyBucket(balancesByCurrency, currency, cents);
  }

  const monthlyIncomeCents: Record<string, number> = {};
  const monthlyExpenseCents: Record<string, number> = {};
  const reimbursableCents: Record<string, number> = {};
  // Keyed by `${categoryId}:${currency}` so a category spent in two currencies (e.g. Groceries in
  // both USD and THB) produces two separate entries instead of merging their cents together.
  const spendingMap = new Map<string, { categoryId: string; currency: string; cents: number }>();

  for (const t of monthTransactions) {
    const cents = toCents(t.amount);
    if (t.type === 'income') {
      addToCurrencyBucket(monthlyIncomeCents, t.currency, cents);
    } else if (t.type === 'expense') {
      addToCurrencyBucket(monthlyExpenseCents, t.currency, cents);
      if (t.categoryId) {
        const key = `${t.categoryId}:${t.currency}`;
        const existing = spendingMap.get(key);
        spendingMap.set(key, {
          categoryId: t.categoryId,
          currency: t.currency,
          cents: addCents(existing?.cents ?? 0, cents),
        });
      }
    }
    // Reimbursable status is independent of income/expense/transfer type, matching the original
    // (pre-currency-fix) behavior of filtering on `reimbursable` alone.
    if (t.reimbursable && t.reimbursementStatus !== 'claimed') {
      addToCurrencyBucket(reimbursableCents, t.currency, cents);
    }
  }
  const spendingByCategory = Array.from(spendingMap.values());

  const budgetProgress = await calculateBudgetProgress(userId, month);

  const trend: { month: string; incomeCents: Record<string, number>; expenseCents: Record<string, number> }[] = [];
  for (let i = 5; i >= 0; i--) {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const key = d.toISOString().slice(0, 7);
    const monthTxns = allTransactions.filter((t) => t.payDate.startsWith(key));
    const incomeCents: Record<string, number> = {};
    const expenseCents: Record<string, number> = {};
    for (const t of monthTxns) {
      const cents = toCents(t.amount);
      if (t.type === 'income') addToCurrencyBucket(incomeCents, t.currency, cents);
      else if (t.type === 'expense') addToCurrencyBucket(expenseCents, t.currency, cents);
    }
    trend.push({ month: key, incomeCents, expenseCents });
  }

  return { balancesByCurrency, monthlyIncomeCents, monthlyExpenseCents, spendingByCategory, reimbursableCents, budgetProgress, trend };
}
