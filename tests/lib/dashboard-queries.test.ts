import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/db/client';
import { users, accounts, categories, transactions } from '@/db/schema';
import { getDashboardData } from '@/lib/dashboard-queries';

let user: { id: string };
let checking: { id: string }, savings: { id: string };
let groceries: { id: string };

beforeAll(async () => {
  [user] = await db.insert(users).values({ email: 'dash@example.com', passwordHash: 'x' }).returning();
  [checking] = await db.insert(accounts).values({ userId: user.id, name: 'Checking', type: 'bank', currency: 'USD', startingBalance: '0' }).returning();
  [savings] = await db.insert(accounts).values({ userId: user.id, name: 'Savings', type: 'bank', currency: 'USD', startingBalance: '0' }).returning();
  [groceries] = await db.insert(categories).values({ userId: user.id, name: 'Groceries', type: 'expense' }).returning();

  await db.insert(transactions).values([
    { userId: user.id, details: 'Salary', type: 'income', payDate: '2026-09-01', toAccountId: checking.id, amount: '1000.00', currency: 'USD' },
    { userId: user.id, details: 'Food', type: 'expense', payDate: '2026-09-02', fromAccountId: checking.id, categoryId: groceries.id, amount: '100.00', currency: 'USD', reimbursable: true, reimbursementStatus: 'to_claim' },
    { userId: user.id, details: 'Move', type: 'transfer', payDate: '2026-09-03', fromAccountId: checking.id, toAccountId: savings.id, amount: '200.00', currency: 'USD' },
  ]);
});

afterAll(async () => {
  await db.delete(transactions);
  await db.delete(categories);
  await db.delete(accounts);
  await db.delete(users);
});

describe('getDashboardData', () => {
  it('excludes transfers from income/expense totals and groups balances by currency', async () => {
    const data = await getDashboardData(user.id, '2026-09');
    expect(data.monthlyIncomeCents).toBe(100000);
    expect(data.monthlyExpenseCents).toBe(10000);
    // checking: 0 + 1000 income - 100 expense - 200 transfer-out = 700.00; savings: 0 + 200 transfer-in = 200.00
    // summed by currency: 700 + 200 = 900.00 (the transfer nets to zero across the pair, but both legs still count
    // into the per-account balances that get summed — it does not cancel out of the currency total pre-sum)
    expect(data.balancesByCurrency['USD']).toBe(90000);
    expect(data.reimbursableCents).toBe(10000);
    expect(data.spendingByCategory[0]).toMatchObject({ categoryId: groceries.id, cents: 10000 });
  });
});
