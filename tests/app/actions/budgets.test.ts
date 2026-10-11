import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/db/client';
import { users, categories, budgets } from '@/db/schema';

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { getCurrentUser } from '@/lib/session';
import { createBudget, updateBudget } from '@/app/actions/budgets';

let user: { id: string; email: string };
let food: { id: string };

beforeAll(async () => {
  [user] = await db.insert(users).values({ email: 'budget-action@example.com', passwordHash: 'x' }).returning();
  [food] = await db.insert(categories).values({ userId: user.id, name: 'Food', type: 'expense' }).returning();
  (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: user.id, email: user.email, name: null });
});

afterAll(async () => {
  await db.delete(budgets);
  await db.delete(categories);
  await db.delete(users);
});

describe('budget actions', () => {
  it('edits the planned amount and currency of a budget', async () => {
    const budget = await createBudget({ month: '2026-10', categoryId: food.id, currency: 'USD', plannedAmount: '100.00' });
    const updated = await updateBudget(budget.id, { plannedAmount: '250.50', currency: 'THB' });
    expect(updated).toMatchObject({ plannedAmount: '250.50', currency: 'THB' });
  });

  it('reports BUDGET_EXISTS instead of a raw database error on a duplicate', async () => {
    await createBudget({ month: '2026-11', categoryId: food.id, currency: 'USD', plannedAmount: '10.00' });
    await expect(createBudget({ month: '2026-11', categoryId: food.id, currency: 'USD', plannedAmount: '20.00' }))
      .rejects.toThrow('BUDGET_EXISTS');
    const other = await createBudget({ month: '2026-11', categoryId: food.id, currency: 'THB', plannedAmount: '30.00' });
    await expect(updateBudget(other.id, { currency: 'USD' })).rejects.toThrow('BUDGET_EXISTS');
  });
});
