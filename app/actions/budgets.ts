'use server';
import { z } from 'zod';
import { db } from '@/db/client';
import { budgets } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/session';
import { getUserBudget, getUserCategory } from '@/lib/authorization';
import { calculateBudgetProgress } from '@/lib/budget-calc';

const budgetInput = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  categoryId: z.string(),
  currency: z.string().length(3),
  plannedAmount: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

export async function createBudget(input: z.infer<typeof budgetInput>) {
  const user = await getCurrentUser();
  const data = budgetInput.parse(input);
  if (!(await getUserCategory(data.categoryId, user.id))) throw new Error('FORBIDDEN');
  const [budget] = await db.insert(budgets).values({ ...data, userId: user.id }).returning();
  return budget;
}

export async function updateBudget(id: string, input: Partial<z.infer<typeof budgetInput>>) {
  const user = await getCurrentUser();
  const existing = await getUserBudget(id, user.id);
  if (!existing) throw new Error('NOT_FOUND');
  const data = budgetInput.partial().parse(input);
  // A `categoryId` update must still be scoped to this user's own categories —
  // the brief's version validated ownership on create but not on update, which
  // would let a user attach their budget to another user's category id.
  if (data.categoryId && !(await getUserCategory(data.categoryId, user.id))) {
    throw new Error('FORBIDDEN');
  }
  const [updated] = await db.update(budgets).set({ ...data, updatedAt: new Date() })
    .where(and(eq(budgets.id, id), eq(budgets.userId, user.id))).returning();
  return updated;
}

export async function deleteBudget(id: string) {
  const user = await getCurrentUser();
  const existing = await getUserBudget(id, user.id);
  if (!existing) throw new Error('NOT_FOUND');
  await db.delete(budgets).where(and(eq(budgets.id, id), eq(budgets.userId, user.id)));
}

export async function listBudgetProgress(month: string) {
  const user = await getCurrentUser();
  return calculateBudgetProgress(user.id, month);
}

export async function listBudgets(month: string) {
  const user = await getCurrentUser();
  return db.select().from(budgets).where(and(eq(budgets.userId, user.id), eq(budgets.month, month)));
}

export async function copyPreviousMonth(fromMonth: string, toMonth: string) {
  const user = await getCurrentUser();
  const previous = await db.select().from(budgets).where(and(eq(budgets.userId, user.id), eq(budgets.month, fromMonth)));
  if (previous.length === 0) return [];
  const inserted = await db.insert(budgets).values(
    previous.map((b) => ({ userId: user.id, month: toMonth, categoryId: b.categoryId, currency: b.currency, plannedAmount: b.plannedAmount }))
  ).onConflictDoNothing().returning();
  // This action is invoked from a plain `<form action>` on the (Server Component)
  // budgets page — there is no client-side `router.refresh()` to fall back on like
  // the other mutations in this app, so without an explicit revalidation the page
  // keeps showing the pre-copy (empty) list until a manual hard reload. Confirmed
  // live in manual QA: the copy succeeded in the database, but the rendered list
  // for the target month stayed on "No budgets for this month yet." until this
  // fix was added.
  revalidatePath('/budgets');
  return inserted;
}
