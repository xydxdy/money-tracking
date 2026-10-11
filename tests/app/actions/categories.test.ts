import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '@/db/client';
import { users, categories, transactions } from '@/db/schema';

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
import { getCurrentUser } from '@/lib/session';
import { createCategory, deleteCategory, listCategories, updateCategory } from '@/app/actions/categories';

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
    await createCategory({ name: 'Groceries', type: 'expense', icon: 'shopping-cart' });
    const list = await listCategories();
    expect(list.some((c) => c.name === 'Groceries')).toBe(true);
  });

  it('deleting a category nulls out categoryId on historical transactions instead of failing', async () => {
    const category = await createCategory({ name: 'Rent', type: 'expense', icon: 'house' });
    await db.insert(transactions).values({
      userId: user.id, details: 'Rent payment', type: 'expense', payDate: '2026-09-01',
      categoryId: category.id, amount: '10.00', currency: 'USD',
    });

    await deleteCategory(category.id);

    const [txn] = await db.select().from(transactions).where(eq(transactions.details, 'Rent payment'));
    expect(txn.categoryId).toBeNull();
  });

  it('edits name and icon', async () => {
    const cat = await createCategory({ name: 'Rent', type: 'expense', icon: 'house' });
    const updated = await updateCategory(cat.id, { name: 'Housing', icon: 'lightbulb' });
    expect(updated).toMatchObject({ name: 'Housing', icon: 'lightbulb' });
  });

  it('allows changing the type of an unused category', async () => {
    const cat = await createCategory({ name: 'Misc', type: 'expense' });
    const updated = await updateCategory(cat.id, { type: 'income' });
    expect(updated.type).toBe('income');
  });

  it('refuses to change the type of a category that transactions use', async () => {
    const cat = await createCategory({ name: 'Used', type: 'expense' });
    await db.insert(transactions).values({
      userId: user.id, details: 'x', type: 'expense', payDate: '2026-09-01', categoryId: cat.id, amount: '1.00', currency: 'USD',
    });
    await expect(updateCategory(cat.id, { type: 'income' })).rejects.toThrow('CATEGORY_IN_USE');
  });

  it('lists categories alphabetically by name, ignoring case', async () => {
    await db.delete(transactions);
    await db.delete(categories);
    await createCategory({ name: 'Zoo', type: 'expense' });
    await createCategory({ name: 'Bank Transfer', type: 'transfer' });
    await createCategory({ name: 'apple', type: 'income' });
    await createCategory({ name: 'Uni Fee', type: 'expense' });
    expect((await listCategories()).map((c) => c.name)).toEqual(['apple', 'Bank Transfer', 'Uni Fee', 'Zoo']);
  });

  it('only accepts icons from the icon set', async () => {
    await expect(createCategory({ name: 'Emoji', type: 'expense', icon: '🛒' as never })).rejects.toThrow();
    await expect(createCategory({ name: 'Unknown', type: 'expense', icon: 'not-an-icon' as never })).rejects.toThrow();
  });
});
