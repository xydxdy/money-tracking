import { db } from '@/db/client';
import { accounts, accountTypes, categories, transactions, budgets } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function exportUserData(userId: string) {
  const [userAccounts, userCategories, userTransactions, userBudgets, userTypes] = await Promise.all([
    db.select().from(accounts).where(eq(accounts.userId, userId)),
    db.select().from(categories).where(eq(categories.userId, userId)),
    db.select().from(transactions).where(eq(transactions.userId, userId)),
    db.select().from(budgets).where(eq(budgets.userId, userId)),
    db.select().from(accountTypes).where(eq(accountTypes.userId, userId)),
  ]);
  const typeName = (id: string | null) => userTypes.find((t) => t.id === id)?.name;

  return {
    // Version 2: reimbursement statuses are to_claim / submitting / claimed (see lib/import/schema.ts).
    version: 2,
    accounts: userAccounts.map((a) => ({
      // The account type's name (omitted for an account without a type).
      id: a.id, name: a.name, type: typeName(a.accountTypeId), currency: a.currency,
      startingBalance: Number(a.startingBalance), note: a.note ?? undefined, archived: a.archived,
      color: a.color ?? undefined, icon: a.icon ?? undefined,
    })),
    categories: userCategories.map((c) => ({ id: c.id, name: c.name, type: c.type, icon: c.icon ?? undefined })),
    transactions: userTransactions.map((t) => ({
      id: t.id, details: t.details, type: t.type, categoryId: t.categoryId,
      payDate: t.payDate, fromAccountId: t.fromAccountId, toAccountId: t.toAccountId,
      amount: Number(t.amount), toAmount: t.toAmount ? Number(t.toAmount) : undefined,
      currency: t.currency, status: t.status, reimbursable: t.reimbursable,
      reimbursementStatus: t.reimbursementStatus ?? undefined, receipt: t.receipt ?? undefined, link: t.link ?? undefined,
      loanKind: t.loanKind ?? undefined, counterparty: t.counterparty ?? undefined,
      loanClosedAt: t.loanClosedAt?.toISOString(),
      note: t.note ?? undefined, createdAt: t.createdAt.toISOString(), updatedAt: t.updatedAt.toISOString(),
    })),
    budgets: userBudgets.map((b) => ({ id: b.id, month: b.month, categoryId: b.categoryId, currency: b.currency, plannedAmount: Number(b.plannedAmount) })),
  };
}
