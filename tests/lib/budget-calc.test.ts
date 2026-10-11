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
    // same category and month but a different currency than the USD budget: must not count
    { userId: user.id, details: 'Market (THB)', type: 'expense', payDate: '2026-09-20', categoryId: groceries.id, amount: '500.00', currency: 'THB' },
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

  it('returns budgets sorted by category name', async () => {
    const [rent] = await db.insert(categories).values({ userId: user.id, name: 'Rent', type: 'expense' }).returning();
    const [apps] = await db.insert(categories).values({ userId: user.id, name: 'apps', type: 'expense' }).returning();
    await db.insert(budgets).values([
      { userId: user.id, month: '2026-09', categoryId: rent.id, currency: 'USD', plannedAmount: '1.00' },
      { userId: user.id, month: '2026-09', categoryId: apps.id, currency: 'USD', plannedAmount: '1.00' },
    ]);
    const names = (await calculateBudgetProgress(user.id, '2026-09')).map((p) => p.category.name);
    expect(names).toEqual(['apps', 'Groceries', 'Rent']);
  });

  it("includes the budget's transactions (same category, month and currency), newest first", async () => {
    const progress = await calculateBudgetProgress(user.id, '2026-09');
    const groceriesBudget = progress.find((p) => p.category.id === groceries.id)!;
    expect(groceriesBudget.transactions.map((t) => t.details)).toEqual(['Store B', 'Store A']);
  });

  it('includes each budget transaction’s account and payer for the expanded list', async () => {
    const progress = await calculateBudgetProgress(user.id, '2026-09');
    const t = progress.find((p) => p.category.id === groceries.id)!.transactions[0];
    expect(t).toHaveProperty('fromAccountId');
    expect(t).toHaveProperty('counterparty');
  });
});
