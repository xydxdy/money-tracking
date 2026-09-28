import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { users, categories, transactions } from '@/db/schema';

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
import { getCurrentUser } from '@/lib/session';
import { createCategory, deleteCategory, listCategories } from '@/app/actions/categories';

let user: { id: string; email: string };

beforeAll(async () => {
  [user] = await db.insert(users).values({ email: 'cat-action@example.com', passwordHash: 'x' }).returning();
  (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: user.id, email: user.email, name: null });
});

afterAll(async () => {
  await db.delete(transactions);
  await db.delete(categories);
  await db.delete(users);
});

describe('category actions', () => {
  it('creates and lists a category scoped to the user', async () => {
    await createCategory({ name: 'Groceries', type: 'expense', icon: '🛒', noBudget: false });
    const list = await listCategories();
    expect(list.some((c) => c.name === 'Groceries')).toBe(true);
  });

  it('deleting a category nulls out categoryId on historical transactions instead of failing', async () => {
    const category = await createCategory({ name: 'Rent', type: 'expense', icon: '🏠', noBudget: false });
    await db.insert(transactions).values({
      userId: user.id, details: 'Rent payment', type: 'expense', payDate: '2026-09-01',
      categoryId: category.id, amount: '10.00', currency: 'USD',
    });

    await deleteCategory(category.id);

    const [txn] = await db.select().from(transactions).where(eq(transactions.details, 'Rent payment'));
    expect(txn.categoryId).toBeNull();
  });
});
