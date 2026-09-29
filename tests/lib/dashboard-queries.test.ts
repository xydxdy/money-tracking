import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/db/client';
import { users, accounts, categories, transactions } from '@/db/schema';
import { getDashboardData } from '@/lib/dashboard-queries';

let user: { id: string };
let checking: { id: string }, savings: { id: string }, thbWallet: { id: string };
let groceries: { id: string };

beforeAll(async () => {
  [user] = await db.insert(users).values({ email: 'dash@example.com', passwordHash: 'x' }).returning();
  [checking] = await db.insert(accounts).values({ userId: user.id, name: 'Checking', type: 'bank', currency: 'USD', startingBalance: '0' }).returning();
  [savings] = await db.insert(accounts).values({ userId: user.id, name: 'Savings', type: 'bank', currency: 'USD', startingBalance: '0' }).returning();
  [thbWallet] = await db.insert(accounts).values({ userId: user.id, name: 'Thai Wallet', type: 'wallet', currency: 'THB', startingBalance: '0' }).returning();
  [groceries] = await db.insert(categories).values({ userId: user.id, name: 'Groceries', type: 'expense' }).returning();

  await db.insert(transactions).values([
    { userId: user.id, details: 'Salary', type: 'income', payDate: '2026-09-01', toAccountId: checking.id, amount: '1000.00', currency: 'USD' },
    { userId: user.id, details: 'Food', type: 'expense', payDate: '2026-09-02', fromAccountId: checking.id, categoryId: groceries.id, amount: '100.00', currency: 'USD', reimbursable: true, reimbursementStatus: 'to_claim' },
    { userId: user.id, details: 'Move', type: 'transfer', payDate: '2026-09-03', fromAccountId: checking.id, toAccountId: savings.id, amount: '200.00', currency: 'USD' },
    // A separate THB account/currency, entirely disjoint from the USD activity above. These
    // prove getDashboardData buckets by currency instead of summing everything into one number:
    // if it summed across currencies, the USD assertions below would be inflated by these THB
    // amounts (5000.00 income, 300.00 expense), and there would be only one merged Groceries
    // entry in spendingByCategory instead of one per currency.
    { userId: user.id, details: 'Freelance THB', type: 'income', payDate: '2026-09-05', toAccountId: thbWallet.id, amount: '5000.00', currency: 'THB' },
    { userId: user.id, details: 'Bangkok groceries', type: 'expense', payDate: '2026-09-06', fromAccountId: thbWallet.id, categoryId: groceries.id, amount: '300.00', currency: 'THB', reimbursable: true, reimbursementStatus: 'to_claim' },
  ]);
});

afterAll(async () => {
  await db.delete(transactions);
  await db.delete(categories);
  await db.delete(accounts);
  await db.delete(users);
});

describe('getDashboardData', () => {
  it('excludes transfers from income/expense totals and groups everything by currency', async () => {
    const data = await getDashboardData(user.id, '2026-09');

    // USD totals must equal exactly what the USD transactions produce — no contamination from
    // the THB transactions above.
    expect(data.monthlyIncomeCents['USD']).toBe(100000);
    expect(data.monthlyExpenseCents['USD']).toBe(10000);
    expect(data.reimbursableCents['USD']).toBe(10000);

    // THB totals are bucketed separately and must never be merged into the USD numbers above.
    expect(data.monthlyIncomeCents['THB']).toBe(500000);
    expect(data.monthlyExpenseCents['THB']).toBe(30000);
    expect(data.reimbursableCents['THB']).toBe(30000);

    // checking: 0 + 1000 income - 100 expense - 200 transfer-out = 700.00; savings: 0 + 200 transfer-in = 200.00
    // summed by currency: 700 + 200 = 900.00 (the transfer nets to zero across the pair, but both legs still count
    // into the per-account balances that get summed — it does not cancel out of the currency total pre-sum)
    expect(data.balancesByCurrency['USD']).toBe(90000);
    // THB wallet: 0 + 5000 income - 300 expense = 4700.00, entirely separate from the USD balance above.
    expect(data.balancesByCurrency['THB']).toBe(470000);

    // Groceries was spent in both currencies this month — these must stay as two distinct
    // entries, each with its own currency and cents, never merged into a single combined total.
    const usdGroceries = data.spendingByCategory.find((s) => s.categoryId === groceries.id && s.currency === 'USD');
    const thbGroceries = data.spendingByCategory.find((s) => s.categoryId === groceries.id && s.currency === 'THB');
    expect(usdGroceries).toMatchObject({ cents: 10000 });
    expect(thbGroceries).toMatchObject({ cents: 30000 });
    expect(data.spendingByCategory).toHaveLength(2);
  });
});
