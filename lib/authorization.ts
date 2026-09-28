import { db } from '@/db/client';
import { accounts, categories, transactions, budgets } from '@/db/schema';
import { and, eq } from 'drizzle-orm';

export async function getUserAccount(id: string, userId: string) {
  const [row] = await db.select().from(accounts).where(and(eq(accounts.id, id), eq(accounts.userId, userId))).limit(1);
  return row ?? null;
}

export async function getUserCategory(id: string, userId: string) {
  const [row] = await db.select().from(categories).where(and(eq(categories.id, id), eq(categories.userId, userId))).limit(1);
  return row ?? null;
}

export async function getUserTransaction(id: string, userId: string) {
  const [row] = await db.select().from(transactions).where(and(eq(transactions.id, id), eq(transactions.userId, userId))).limit(1);
  return row ?? null;
}

export async function getUserBudget(id: string, userId: string) {
  const [row] = await db.select().from(budgets).where(and(eq(budgets.id, id), eq(budgets.userId, userId))).limit(1);
  return row ?? null;
}
