import { db } from '@/db/client';
import { accounts, categories, transactions, budgets } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function exportUserData(userId: string) {
  const [userAccounts, userCategories, userTransactions, userBudgets] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.userId, userId)),
    db.select().from(categories).where(eq(categories.userId, userId)),
    db.select().from(transactions).where(eq(transactions.userId, userId)),
    db.select().from(budgets).where(eq(budgets.userId, userId)),
  ]);

  return {
    version: 1,
    accounts: userAccounts.map((a) => ({
      id: a.id, name: a.name, type: a.type, currency: a.currency,
      startingBalance: Number(a.startingBalance), note: a.note ?? undefined, archived: a.archived,
    })),
    categories: userCategories.map((c) => ({ id: c.id, name: c.name, type: c.type, icon: c.icon ?? undefined, noBudget: c.noBudget })),
    transactions: userTransactions.map((t) => ({
      id: t.id, details: t.details, type: t.type, categoryId: t.categoryId,
      payDate: t.payDate, fromAccountId: t.fromAccountId, toAccountId: t.toAccountId,
      amount: Number(t.amount), toAmount: t.toAmount ? Number(t.toAmount) : undefined,
      currency: t.currency, status: t.status, reimbursable: t.reimbursable,
      reimbursementStatus: t.reimbursementStatus ?? undefined, receipt: t.receipt ?? undefined,
      note: t.note ?? undefined, createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(),
    })),
    budgets: userBudgets.map((b) => ({ id: b.id, month: b.month, categoryId: b.categoryId, currency: b.currency, plannedAmount: Number(b.plannedAmount) })),
  };
}
