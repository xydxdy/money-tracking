import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/db/client';
import { users, accounts, transactions } from '@/db/schema';
import { calculateAccountBalance } from '@/lib/balances';

let user: { id: string };
let checking: { id: string };
let savings: { id: string };

beforeAll(async () => {
  [user] = await db.insert(users).values({ email: 'balance@example.com', passwordHash: 'x' }).returning();
  [checking] = await db.insert(accounts).values({
    userId: user.id, name: 'Checking', type: 'bank', currency: 'USD', startingBalance: '100.00',
  }).returning();
  [savings] = await db.insert(accounts).values({
    userId: user.id, name: 'Savings', type: 'bank', currency: 'USD', startingBalance: '0',
  }).returning();

  await db.insert(transactions).values([
    { userId: user.id, details: 'Salary', type: 'income', payDate: '2026-09-01', toAccountId: checking.id, amount: '500.00', currency: 'USD' },
    { userId: user.id, details: 'Groceries', type: 'expense', payDate: '2026-09-02', fromAccountId: checking.id, amount: '40.00', currency: 'USD' },
    { userId: user.id, details: 'Move to savings', type: 'transfer', payDate: '2026-09-03', fromAccountId: checking.id, toAccountId: savings.id, amount: '60.00', currency: 'USD' },
  ]);
});

afterAll(async () => {
  await db.delete(transactions);
  await db.delete(accounts);
  await db.delete(users);
});

describe('calculateAccountBalance', () => {
  it('applies starting balance + income - expense - outgoing transfer', async () => {
    const result = await calculateAccountBalance(checking.id, user.id);
    // 100 + 500 - 40 - 60 = 500.00
    expect(result.cents).toBe(50000);
    expect(result.currency).toBe('USD');
  });

  it('applies incoming transfer', async () => {
    const result = await calculateAccountBalance(savings.id, user.id);
    // 0 + 60 = 60.00
    expect(result.cents).toBe(6000);
  });
});
