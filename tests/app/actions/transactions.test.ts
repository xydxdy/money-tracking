import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/db/client';
import { users, accounts, categories, transactions } from '@/db/schema';

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
import { getCurrentUser } from '@/lib/session';
import { createTransaction, updateTransaction } from '@/app/actions/transactions';

let userA: { id: string; email: string }, userB: { id: string; email: string };
let accountA: { id: string }, accountA2: { id: string }, accountB: { id: string };
let categoryA: { id: string };

beforeAll(async () => {
  [userA] = await db.insert(users).values({ email: 'txn-a@example.com', passwordHash: 'x' }).returning();
  [userB] = await db.insert(users).values({ email: 'txn-b@example.com', passwordHash: 'x' }).returning();
  [accountA] = await db.insert(accounts).values({ userId: userA.id, name: 'A', type: 'bank', currency: 'USD', startingBalance: '0' }).returning();
  [accountA2] = await db.insert(accounts).values({ userId: userA.id, name: 'A2', type: 'cash', currency: 'USD', startingBalance: '0' }).returning();
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

  it('creates a transfer between two different accounts of the same user', async () => {
    const txn = await createTransaction({
      details: 'Move to cash', type: 'transfer', payDate: '2026-09-10',
      fromAccountId: accountA.id, toAccountId: accountA2.id, amount: '25.00', currency: 'USD',
    });
    expect(txn.fromAccountId).toBe(accountA.id);
    expect(txn.toAccountId).toBe(accountA2.id);
  });

  // Review finding (Important #2): a same-account transfer would let calculateAccountBalance
  // apply both the debit and the credit to the same account, silently absorbing any
  // amount/toAmount mismatch as a phantom gain or loss instead of being rejected.
  it('rejects a transfer where fromAccountId equals toAccountId', async () => {
    await expect(createTransaction({
      details: 'Self transfer', type: 'transfer', payDate: '2026-09-10',
      fromAccountId: accountA.id, toAccountId: accountA.id, amount: '25.00', currency: 'USD',
    })).rejects.toThrow();
  });
});

describe('updateTransaction', () => {
  // Review finding (Important #1): switching `type` without also supplying the new type's
  // required id field would leave a row that matches neither of calculateAccountBalance's
  // per-type branches, silently dropping it from every account's balance total.
  it('rejects switching type to income without also supplying toAccountId', async () => {
    const expense = await createTransaction({
      details: 'Coffee', type: 'expense', payDate: '2026-09-11',
      fromAccountId: accountA.id, amount: '4.50', currency: 'USD',
    });

    await expect(updateTransaction(expense.id, { type: 'income' })).rejects.toThrow();
  });

  it('allows switching type to income when toAccountId is supplied in the same update', async () => {
    const expense = await createTransaction({
      details: 'Refund candidate', type: 'expense', payDate: '2026-09-12',
      fromAccountId: accountA.id, amount: '7.00', currency: 'USD',
    });

    const updated = await updateTransaction(expense.id, { type: 'income', toAccountId: accountA2.id });
    expect(updated.type).toBe('income');
    expect(updated.toAccountId).toBe(accountA2.id);
  });

  it('does not clobber reimbursable=true back to false on an unrelated partial update', async () => {
    const txn = await createTransaction({
      details: 'Reimbursable lunch', type: 'expense', payDate: '2026-09-13',
      fromAccountId: accountA.id, amount: '20.00', currency: 'USD', reimbursable: true,
    });
    expect(txn.reimbursable).toBe(true);

    const updated = await updateTransaction(txn.id, { note: 'updated note' });
    expect(updated.reimbursable).toBe(true);
    expect(updated.note).toBe('updated note');
  });

  it('rejects updating a transfer to make fromAccountId equal toAccountId', async () => {
    const transfer = await createTransaction({
      details: 'Move funds', type: 'transfer', payDate: '2026-09-14',
      fromAccountId: accountA.id, toAccountId: accountA2.id, amount: '15.00', currency: 'USD',
    });

    await expect(updateTransaction(transfer.id, { toAccountId: accountA.id })).rejects.toThrow();
  });

  it('clears note and category when an update sets them to null', async () => {
    const txn = await createTransaction({
      details: 'With extras', type: 'expense', payDate: '2026-09-10',
      fromAccountId: accountA.id, categoryId: categoryA.id, amount: '3.00', currency: 'USD', note: 'remove me',
    });
    const updated = await updateTransaction(txn.id, { note: null, categoryId: null });
    expect(updated.note).toBeNull();
    expect(updated.categoryId).toBeNull();
  });
});
