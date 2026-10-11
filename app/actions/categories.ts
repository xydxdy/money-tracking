'use server';
import { z } from 'zod';
import { db } from '@/db/client';
import { categories, transactions } from '@/db/schema';
import { and, asc, eq, sql } from 'drizzle-orm';
import { getCurrentUser } from '@/lib/session';
import { getUserCategory } from '@/lib/authorization';
import { iconName } from '@/lib/icon-schema';

const categoryInput = z.object({
  name: z.string().min(1),
  type: z.enum(['expense', 'income', 'transfer']),
  icon: iconName,
});

const categoryUpdateInput = categoryInput.partial();

export async function createCategory(input: z.infer<typeof categoryInput>) {
  const user = await getCurrentUser();
  const data = categoryInput.parse(input);
  const [category] = await db.insert(categories).values({ ...data, userId: user.id }).returning();
  return category;
}

export async function updateCategory(id: string, input: Partial<z.infer<typeof categoryInput>>) {
  const user = await getCurrentUser();
  const existing = await getUserCategory(id, user.id);
  if (!existing) throw new Error('NOT_FOUND');
  const data = categoryUpdateInput.parse(input);
  if (data.type && data.type !== existing.type) {
    // Transactions must match their category's type; changing it would orphan them logically.
    const [used] = await db.select({ id: transactions.id }).from(transactions)
      .where(and(eq(transactions.categoryId, id), eq(transactions.userId, user.id))).limit(1);
    if (used) throw new Error('CATEGORY_IN_USE');
  }
  const [updated] = await db.update(categories).set({ ...data, updatedAt: new Date() })
    .where(and(eq(categories.id, id), eq(categories.userId, user.id))).returning();
  return updated;
}

export async function archiveCategory(id: string, archived = true) {
  const user = await getCurrentUser();
  const existing = await getUserCategory(id, user.id);
  if (!existing) throw new Error('NOT_FOUND');
  const [updated] = await db.update(categories).set({ archived, updatedAt: new Date() })
    .where(and(eq(categories.id, id), eq(categories.userId, user.id))).returning();
  return updated;
}

export async function deleteCategory(id: string) {
  const user = await getCurrentUser();
  const existing = await getUserCategory(id, user.id);
  if (!existing) throw new Error('NOT_FOUND');
  // transactions.category_id has ON DELETE SET NULL, budgets.category_id has ON DELETE CASCADE —
  // deleting a category preserves transaction history and only removes budgets tied to it.
  await db.delete(categories).where(and(eq(categories.id, id), eq(categories.userId, user.id)));
}

export async function listCategories() {
  const user = await getCurrentUser();
  // Alphabetical by name, ignoring case (pages that group by type keep this order inside each group).
  return db.select().from(categories).where(eq(categories.userId, user.id))
    .orderBy(asc(sql`lower(${categories.name})`), asc(categories.name));
}
