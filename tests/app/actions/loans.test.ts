import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/db/client';
import { users, accounts, categories, transactions } from '@/db/schema';

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
import { getCurrentUser } from '@/lib/session';
import { createTransaction, updateTransaction, listTransactions } from '@/app/actions/transactions';
import { listLoanSummary } from '@/app/actions/loans';
import { calculateAccountBalance } from '@/lib/balances';
import { getDashboardData } from '@/lib/dashboard-queries';

let user: { id: string; email: string }, other: { id: string; email: string };
let usd: { id: string }, thb: { id: string }, food: { id: string };

function actAs(u: { id: string; email: string }) {
  (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: u.id, email: u.email, name: null });
}

beforeAll(async () => {
  [user] = await db.insert(users).values({ email: 'loans@example.com', passwordHash: 'x' }).returning();
  [other] = await db.insert(users).values({ email: 'loans-other@example.com', passwordHash: 'x' }).returning();
  [usd] = await db.insert(accounts).values({ userId: user.id, name: 'USD', currency: 'USD', startingBalance: '1000.00' }).returning();
  [thb] = await db.insert(accounts).values({ userId: user.id, name: 'THB', currency: 'THB', startingBalance: '0' }).returning();
  [food] = await db.insert(categories).values({ userId: user.id, name: 'Food', type: 'expense' }).returning();
  const [otherAcc] = await db.insert(accounts).values({ userId: other.id, name: 'X', currency: 'USD', startingBalance: '0' }).returning();
  await db.insert(transactions).values({ userId: other.id, details: 'Their loan', type: 'loan', loanKind: 'lend', counterparty: 'Alice', payDate: '2026-09-01', fromAccountId: otherAcc.id, amount: '999.00', currency: 'USD' });
  actAs(user);
});

afterAll(async () => {
  await db.delete(transactions);
  await db.delete(categories);
  await db.delete(accounts);
  await db.delete(users);
});

const base = { payDate: '2026-09-10', type: 'loan' as const };

describe('loan transactions', () => {
  it('records lending: money leaves the account, currency from that account, no category', async () => {
    const txn = await createTransaction({ ...base, details: 'Lunch money', loanKind: 'lend', counterparty: 'Alice', fromAccountId: usd.id, amount: '100.00', categoryId: food.id });
    expect(txn).toMatchObject({ type: 'loan', loanKind: 'lend', counterparty: 'Alice', currency: 'USD', categoryId: null, toAccountId: null });
  });

  it('records borrowing into the receiving account in its currency', async () => {
    const txn = await createTransaction({ ...base, details: 'From Bob', loanKind: 'borrow', counterparty: 'Bob', toAccountId: thb.id, amount: '5000.00' });
    expect(txn).toMatchObject({ loanKind: 'borrow', currency: 'THB', fromAccountId: null });
  });

  it('requires a person and the right account for the kind', async () => {
    await expect(createTransaction({ ...base, details: 'x', loanKind: 'lend', counterparty: '', fromAccountId: usd.id, amount: '1.00' })).rejects.toThrow();
    await expect(createTransaction({ ...base, details: 'x', loanKind: 'lend', counterparty: 'Alice', toAccountId: usd.id, amount: '1.00' })).rejects.toThrow();
    await expect(createTransaction({ ...base, details: 'x', loanKind: 'borrow', counterparty: 'Bob', fromAccountId: usd.id, amount: '1.00' })).rejects.toThrow();
  });

  it('moves account balances for every loan kind', async () => {
    await createTransaction({ ...base, details: 'Alice pays back', loanKind: 'repayment_in', counterparty: 'alice ', toAccountId: usd.id, amount: '30.00' });
    await createTransaction({ ...base, details: 'Pay Bob back', loanKind: 'repayment_out', counterparty: 'Bob', fromAccountId: thb.id, amount: '2000.00' });
    // USD: 1000 - 100 lent + 30 repaid = 930; THB: 0 + 5000 borrowed - 2000 repaid = 3000
    expect((await calculateAccountBalance(usd.id, user.id)).cents).toBe(93000);
    expect((await calculateAccountBalance(thb.id, user.id)).cents).toBe(300000);
  });

  it('summarises what each person owes (or is owed) per currency, matching names ignoring case and spaces', async () => {
    const summary = await listLoanSummary();
    expect(summary).toEqual(expect.arrayContaining([
      expect.objectContaining({ counterparty: 'Alice', currency: 'USD', lentCents: 10000, repaidToMeCents: 3000, borrowedCents: 0, repaidByMeCents: 0, netCents: 7000 }),
      expect.objectContaining({ counterparty: 'Bob', currency: 'THB', borrowedCents: 500000, repaidByMeCents: 200000, netCents: -300000 }),
    ]));
    expect(summary).toHaveLength(2); // the other user's loan to their own "Alice" is not included
  });

  it('keeps loans out of income, expense and spending totals', async () => {
    const data = await getDashboardData(user.id, '2026-09');
    expect(data.monthlyIncomeCents).toEqual({});
    expect(data.monthlyExpenseCents).toEqual({});
    expect(data.spendingByCategory).toEqual([]);
  });

  it('switching a loan to an expense drops the loan fields', async () => {
    const txn = await createTransaction({ ...base, details: 'Oops', loanKind: 'lend', counterparty: 'Carol', fromAccountId: usd.id, amount: '5.00' });
    const updated = await updateTransaction(txn.id, { type: 'expense', categoryId: food.id });
    expect(updated).toMatchObject({ type: 'expense', loanKind: null, counterparty: null, categoryId: food.id });
  });

  it('finds loans by the person’s name in search', async () => {
    const found = await listTransactions({ type: 'loan', q: 'ALICE' });
    expect(found.map((t) => t.details).sort()).toEqual(['Alice pays back', 'Lunch money']);
  });
});
