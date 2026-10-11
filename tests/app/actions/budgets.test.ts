import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/db/client';
import { users, categories, budgets, accounts } from '@/db/schema';

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { getCurrentUser } from '@/lib/session';
import { createBudget, updateBudget } from '@/app/actions/budgets';

let user: { id: string; email: string };
let food: { id: string };

beforeAll(async () => {
  [user] = await db.insert(users).values({ email: 'budget-action@example.com', passwordHash: 'x' }).returning();
  [food] = await db.insert(categories).values({ userId: user.id, name: 'Food', type: 'expense' }).returning();
  // Budgets may only use currencies the user has accounts in.
  await db.insert(accounts).values([
    { userId: user.id, name: 'Dollars', currency: 'USD', startingBalance: '0' },
    { userId: user.id, name: 'Baht', currency: 'THB', startingBalance: '0' },
  ]);
  (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: user.id, email: user.email, name: null });
});

afterAll(async () => {
  await db.delete(budgets);
  await db.delete(accounts);
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

  it('only accepts currencies the user has accounts in', async () => {
    await expect(createBudget({ month: '2026-12', categoryId: food.id, currency: 'JPY', plannedAmount: '10.00' }))
      .rejects.toThrow('CURRENCY_NOT_IN_ACCOUNTS');
    const ok = await createBudget({ month: '2026-12', categoryId: food.id, currency: 'THB', plannedAmount: '10.00' });
    await expect(updateBudget(ok.id, { currency: 'EUR' })).rejects.toThrow('CURRENCY_NOT_IN_ACCOUNTS');
  });

  it('still lets an existing budget keep a currency the user no longer has accounts in', async () => {
    const [legacy] = await db.insert(budgets).values({ userId: user.id, month: '2027-01', categoryId: food.id, currency: 'GBP', plannedAmount: '5.00' }).returning();
    const updated = await updateBudget(legacy.id, { plannedAmount: '6.00', currency: 'GBP' });
    expect(updated).toMatchObject({ plannedAmount: '6.00', currency: 'GBP' });
  });
});
