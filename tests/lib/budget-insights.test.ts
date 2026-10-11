import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/db/client';
import { users, accounts, categories, transactions, budgets } from '@/db/schema';
import { budgetTone, sortBudgets, unbudgetedSpending } from '@/lib/budget-insights';

describe('budgetTone', () => {
  it('is on track under 80%, close from 80% to 100%, over above 100%', () => {
    expect(budgetTone(0)).toBe('ok');
    expect(budgetTone(79.9)).toBe('ok');
    expect(budgetTone(80)).toBe('warning');
    expect(budgetTone(100)).toBe('warning');
    expect(budgetTone(100.01)).toBe('over');
  });
});

describe('sortBudgets', () => {
  const p = (name: string, percentUsed: number, remainingCents: number) => ({ category: { name }, percentUsed, remainingCents });
  const rows = [p('Rent', 50, 50000), p('food', 120, -2000), p('Gym', 90, 500)];
  it('sorts by name (ignoring case), most used, or least left', () => {
    expect(sortBudgets(rows, 'name').map((r) => r.category.name)).toEqual(['food', 'Gym', 'Rent']);
    expect(sortBudgets(rows, 'used').map((r) => r.category.name)).toEqual(['food', 'Gym', 'Rent']);
    expect(sortBudgets(rows, 'left').map((r) => r.category.name)).toEqual(['food', 'Gym', 'Rent']);
    expect(sortBudgets([p('B', 10, 100), p('A', 10, 100)], 'used').map((r) => r.category.name)).toEqual(['A', 'B']);
  });
});

describe('unbudgetedSpending', () => {
  let user: { id: string }, food: { id: string }, travel: { id: string };

  beforeAll(async () => {
    [user] = await db.insert(users).values({ email: 'budget-insights@example.com', passwordHash: 'x' }).returning();
    const [acc] = await db.insert(accounts).values({ userId: user.id, name: 'A', currency: 'USD', startingBalance: '0' }).returning();
    [food] = await db.insert(categories).values({ userId: user.id, name: 'Food', type: 'expense' }).returning();
    [travel] = await db.insert(categories).values({ userId: user.id, name: 'Travel', type: 'expense' }).returning();
    await db.insert(budgets).values({ userId: user.id, month: '2026-10', categoryId: food.id, currency: 'USD', plannedAmount: '100.00' });
    await db.insert(transactions).values([
      { userId: user.id, details: 'Lunch', type: 'expense', payDate: '2026-10-02', fromAccountId: acc.id, categoryId: food.id, amount: '10.00', currency: 'USD' },
      { userId: user.id, details: 'Bangkok lunch', type: 'expense', payDate: '2026-10-03', categoryId: food.id, amount: '200.00', currency: 'THB', counterparty: 'Pimpim' },
      { userId: user.id, details: 'Flight', type: 'expense', payDate: '2026-10-04', fromAccountId: acc.id, categoryId: travel.id, amount: '400.00', currency: 'USD' },
      { userId: user.id, details: 'Train', type: 'expense', payDate: '2026-10-05', fromAccountId: acc.id, categoryId: travel.id, amount: '50.00', currency: 'USD' },
      { userId: user.id, details: 'No category', type: 'expense', payDate: '2026-10-05', fromAccountId: acc.id, amount: '5.00', currency: 'USD' },
      { userId: user.id, details: 'Last month', type: 'expense', payDate: '2026-09-30', fromAccountId: acc.id, categoryId: travel.id, amount: '999.00', currency: 'USD' },
    ]);
  });

  afterAll(async () => {
    await db.delete(transactions);
    await db.delete(budgets);
    await db.delete(categories);
    await db.delete(accounts);
    await db.delete(users);
  });

  it('lists categories with spending this month but no budget for that currency, largest first', async () => {
    const rows = await unbudgetedSpending(user.id, '2026-10');
    expect(rows.map((r) => [r.category.name, r.currency, r.spentCents, r.count])).toEqual([
      ['Travel', 'USD', 45000, 2],
      ['Food', 'THB', 20000, 1], // Food has a USD budget, but not a THB one
    ]);
  });

  it('includes each category’s transactions, newest first', async () => {
    const rows = await unbudgetedSpending(user.id, '2026-10');
    const travel = rows.find((r) => r.category.name === 'Travel')!;
    expect(travel.transactions.map((t) => t.details)).toEqual(['Train', 'Flight']);
    expect(travel.transactions[0]).toMatchObject({ payDate: '2026-10-05', amount: '50.00', currency: 'USD' });
    expect(travel.transactions[0]).toHaveProperty('fromAccountId');
  });
});
