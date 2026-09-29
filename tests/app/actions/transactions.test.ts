import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/db/client';
import { users, accounts, categories, transactions } from '@/db/schema';

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
import { getCurrentUser } from '@/lib/session';
import { createTransaction } from '@/app/actions/transactions';

let userA: { id: string; email: string }, userB: { id: string; email: string };
let accountA: { id: string }, accountB: { id: string };
let categoryA: { id: string };

beforeAll(async () => {
  [userA] = await db.insert(users).values({ email: 'txn-a@example.com', passwordHash: 'x' }).returning();
  [userB] = await db.insert(users).values({ email: 'txn-b@example.com', passwordHash: 'x' }).returning();
  [accountA] = await db.insert(accounts).values({ userId: userA.id, name: 'A', type: 'bank', currency: 'USD', startingBalance: '0' }).returning();
  [accountB] = await db.insert(accounts).values({ userId: userB.id, name: 'B', type: 'bank', currency: 'USD', startingBalance: '0' }).returning();
  [categoryA] = await db.insert(categories).values({ userId: userA.id, name: 'Food', type: 'expense' }).returning();
  (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: userA.id, email: userA.email, name: null });
});

afterAll(async () => {
  await db.delete(transactions);
  await db.delete(categories);
  await db.delete(accounts);
  await db.delete(users);
});

describe('createTransaction', () => {
  it('creates an expense referencing the user\'s own account and category', async () => {
    const txn = await createTransaction({
      details: 'Lunch', type: 'expense', payDate: '2026-09-10',
      fromAccountId: accountA.id, categoryId: categoryA.id, amount: '12.50', currency: 'USD',
    });
    expect(txn.userId).toBe(userA.id);
  });

  it('rejects a transaction referencing another user\'s account', async () => {
    await expect(createTransaction({
      details: 'Bad', type: 'expense', payDate: '2026-09-10',
      fromAccountId: accountB.id, categoryId: categoryA.id, amount: '10.00', currency: 'USD',
    })).rejects.toThrow('FORBIDDEN');
  });
});
