import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/db/client';
import { users, categories, transactions, budgets } from '@/db/schema';
import { calculateBudgetProgress } from '@/lib/budget-calc';

let user: { id: string };
let groceries: { id: string };

beforeAll(async () => {
  [user] = await db.insert(users).values({ email: 'budget-calc@example.com', passwordHash: 'x' }).returning();
  [groceries] = await db.insert(categories).values({ userId: user.id, name: 'Groceries', type: 'expense' }).returning();

  await db.insert(budgets).values({ userId: user.id, month: '2026-09', categoryId: groceries.id, currency: 'USD', plannedAmount: '300.00' });

  await db.insert(transactions).values([
    { userId: user.id, details: 'Store A', type: 'expense', payDate: '2026-09-05', categoryId: groceries.id, amount: '120.00', currency: 'USD' },
    { userId: user.id, details: 'Store B', type: 'expense', payDate: '2026-09-15', categoryId: groceries.id, amount: '50.00', currency: 'USD' },
    // income in the same category should NOT count against spend
    { userId: user.id, details: 'Refund', type: 'income', payDate: '2026-09-16', categoryId: groceries.id, amount: '10.00', currency: 'USD' },
    // different month, should not count
    { userId: user.id, details: 'Store C', type: 'expense', payDate: '2026-08-01', categoryId: groceries.id, amount: '999.00', currency: 'USD' },
  ]);
});

afterAll(async () => {
  await db.delete(transactions);
  await db.delete(budgets);
  await db.delete(categories);
  await db.delete(users);
});

describe('calculateBudgetProgress', () => {
  it('sums only same-month expense transactions against the planned amount', async () => {
    const [progress] = await calculateBudgetProgress(user.id, '2026-09');
    expect(progress.plannedCents).toBe(30000);
    expect(progress.spentCents).toBe(17000);
    expect(progress.remainingCents).toBe(13000);
    expect(progress.percentUsed).toBeCloseTo(56.67, 1);
  });
});
