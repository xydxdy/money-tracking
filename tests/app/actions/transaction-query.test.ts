import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/db/client';
import { users, accounts, categories, transactions } from '@/db/schema';

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
import { getCurrentUser } from '@/lib/session';
import { createTransaction, updateTransaction, listTransactions } from '@/app/actions/transactions';
import { listReimbursables } from '@/app/actions/reimbursements';

let usd: { id: string }, thb: { id: string }, food: { id: string }, salary: { id: string };

beforeAll(async () => {
  const [user] = await db.insert(users).values({ email: 'txn-query@example.com', passwordHash: 'x' }).returning();
  const [other] = await db.insert(users).values({ email: 'txn-query-other@example.com', passwordHash: 'x' }).returning();
  [usd] = await db.insert(accounts).values({ userId: user.id, name: 'USD bank', currency: 'USD', startingBalance: '0' }).returning();
  [thb] = await db.insert(accounts).values({ userId: user.id, name: 'THB bank', currency: 'THB', startingBalance: '0' }).returning();
  [food] = await db.insert(categories).values({ userId: user.id, name: 'Food', type: 'expense' }).returning();
  [salary] = await db.insert(categories).values({ userId: user.id, name: 'Salary', type: 'income' }).returning();
  const [otherAcc] = await db.insert(accounts).values({ userId: other.id, name: 'X', currency: 'USD', startingBalance: '0' }).returning();
  await db.insert(transactions).values([
    { userId: user.id, details: 'Lunch at cafe', type: 'expense', payDate: '2026-09-05', fromAccountId: usd.id, categoryId: food.id, amount: '12.00', currency: 'USD' },
    { userId: user.id, details: 'Groceries', type: 'expense', payDate: '2026-09-20', fromAccountId: thb.id, categoryId: food.id, amount: '800.00', currency: 'THB', note: 'weekly CAFE beans', reimbursable: true, reimbursementStatus: 'submitting' },
    { userId: user.id, details: 'Pay', type: 'income', payDate: '2026-09-01', toAccountId: usd.id, categoryId: salary.id, amount: '3000.00', currency: 'USD' },
    { userId: user.id, details: 'Conference', type: 'expense', payDate: '2026-08-15', fromAccountId: usd.id, amount: '250.00', currency: 'USD', reimbursable: true, reimbursementStatus: 'to_claim' },
    { userId: user.id, details: 'Taxi', type: 'expense', payDate: '2026-08-16', fromAccountId: usd.id, amount: '30.00', currency: 'USD', reimbursable: true },
    { userId: other.id, details: 'Lunch at cafe (other user)', type: 'expense', payDate: '2026-09-05', fromAccountId: otherAcc.id, amount: '5.00', currency: 'USD', reimbursable: true },
  ]);
  (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: user.id, email: user.email, name: null });
});

afterAll(async () => {
  await db.delete(transactions);
  await db.delete(categories);
  await db.delete(accounts);
  await db.delete(users);
});

const details = (rows: { details: string }[]) => rows.map((r) => r.details);

describe('transaction currency comes from the account', () => {
  it('uses the from-account currency for an expense, ignoring the submitted currency', async () => {
    const txn = await createTransaction({ details: 'Pad thai', type: 'expense', payDate: '2026-10-01', fromAccountId: thb.id, amount: '60.00', currency: 'USD' });
    expect(txn.currency).toBe('THB');
  });

  it('uses the to-account currency for income', async () => {
    const txn = await createTransaction({ details: 'Refund', type: 'income', payDate: '2026-10-01', toAccountId: thb.id, amount: '100.00' });
    expect(txn.currency).toBe('THB');
  });

  it('follows the account when an update moves the transaction to another account', async () => {
    const txn = await createTransaction({ details: 'Moved', type: 'expense', payDate: '2026-10-02', fromAccountId: usd.id, amount: '1.00' });
    const updated = await updateTransaction(txn.id, { fromAccountId: thb.id });
    expect(updated.currency).toBe('THB');
  });
});

describe('listTransactions search, filter and sort', () => {
  it('searches details and note, case-insensitively, within the current user only', async () => {
    expect(details(await listTransactions({ q: 'cafe', from: '2026-08-01', to: '2026-09-30' })).sort()).toEqual(['Groceries', 'Lunch at cafe']);
  });

  it('filters by type, account (either side), category and date range', async () => {
    expect(details(await listTransactions({ type: 'income', to: '2026-09-30' }))).toEqual(['Pay']);
    expect(details(await listTransactions({ accountId: thb.id, to: '2026-09-30' }))).toEqual(['Groceries']);
    expect(details(await listTransactions({ categoryId: food.id, to: '2026-09-30', sort: 'date_asc' }))).toEqual(['Lunch at cafe', 'Groceries']);
    expect(details(await listTransactions({ from: '2026-08-15', to: '2026-08-16', sort: 'date_asc' }))).toEqual(['Conference', 'Taxi']);
  });

  it('sorts by amount and by details', async () => {
    const range = { from: '2026-08-01', to: '2026-09-30' };
    expect(details(await listTransactions({ ...range, sort: 'amount_desc' }))[0]).toBe('Pay');
    expect(details(await listTransactions({ ...range, sort: 'amount_asc' }))[0]).toBe('Lunch at cafe');
    expect(details(await listTransactions({ ...range, sort: 'details_asc' }))).toEqual(['Conference', 'Groceries', 'Lunch at cafe', 'Pay', 'Taxi']);
  });

  it('defaults to newest first', async () => {
    expect(details(await listTransactions({ from: '2026-08-01', to: '2026-09-30' }))[0]).toBe('Groceries');
  });
});

describe('listReimbursables search, filter and sort', () => {
  it('filters by status, treating a missing status as "to claim"', async () => {
    expect(details(await listReimbursables({ status: 'to_claim', sort: 'date_asc' }))).toEqual(['Conference', 'Taxi']);
    expect(details(await listReimbursables({ status: 'submitting' }))).toEqual(['Groceries']);
  });

  it('searches and sorts', async () => {
    expect(details(await listReimbursables({ q: 'TAXI' }))).toEqual(['Taxi']);
    expect(details(await listReimbursables({ sort: 'amount_desc' }))).toEqual(['Groceries', 'Conference', 'Taxi']);
    expect(details(await listReimbursables({}))).toEqual(['Groceries', 'Taxi', 'Conference']);
  });
});

import { parseTransactionFilters, resolveDateRange } from '@/lib/transaction-query';

describe('resolveDateRange', () => {
  it('defaults to all time when no dates or month are given', () => {
    expect(resolveDateRange(parseTransactionFilters({}))).toEqual({ month: 'all', from: undefined, to: undefined });
  });

  it('uses the month parameter, or no range for "all"', () => {
    expect(resolveDateRange(parseTransactionFilters({ month: '2026-02' }))).toEqual({ month: '2026-02', from: '2026-02-01', to: '2026-02-28' });
    expect(resolveDateRange(parseTransactionFilters({ month: 'all' }))).toEqual({ month: 'all', from: undefined, to: undefined });
  });

  it('lets explicit from/to dates override the month', () => {
    expect(resolveDateRange(parseTransactionFilters({ from: '2026-01-05' }))).toEqual({ month: undefined, from: '2026-01-05', to: undefined });
  });
});

describe('newest first within a day', () => {
  it('lists transactions on the same date with the most recently added on top', async () => {
    const first = await createTransaction({ details: 'Added first', type: 'expense', payDate: '2026-12-25', fromAccountId: usd.id, amount: '1.00' });
    const second = await createTransaction({ details: 'Added second', type: 'expense', payDate: '2026-12-25', fromAccountId: usd.id, amount: '1.00' });
    await createTransaction({ details: 'Earlier day', type: 'expense', payDate: '2026-12-24', fromAccountId: usd.id, amount: '1.00' });
    expect(second.id > first.id).toBe(true); // time-ordered ids
    const rows = await listTransactions({ from: '2026-12-24', to: '2026-12-25' });
    expect(rows.map((t) => t.details)).toEqual(['Added second', 'Added first', 'Earlier day']);
    const oldestFirst = await listTransactions({ from: '2026-12-24', to: '2026-12-25', sort: 'date_asc' });
    expect(oldestFirst.map((t) => t.details)).toEqual(['Earlier day', 'Added first', 'Added second']);
  });
});

import { listTransactionsPage } from '@/app/actions/transactions';

describe('listTransactionsPage', () => {
  it('returns one page of the filtered list plus the total count', async () => {
    const range = { from: '2026-08-01', to: '2026-09-30' };
    const all = await listTransactions(range);
    const first = await listTransactionsPage({ ...range, page: '1' }, 2);
    const second = await listTransactionsPage({ ...range, page: '2' }, 2);
    const last = await listTransactionsPage({ ...range, page: '3' }, 2);
    expect(first.total).toBe(all.length);
    expect(first.rows.map((t) => t.id)).toEqual(all.slice(0, 2).map((t) => t.id));
    expect(second.rows.map((t) => t.id)).toEqual(all.slice(2, 4).map((t) => t.id));
    expect(last.rows.map((t) => t.id)).toEqual(all.slice(4, 6).map((t) => t.id));
    expect(first).toMatchObject({ page: 1, pageCount: Math.ceil(all.length / 2) });
  });

  it('clamps an out-of-range page to the last one', async () => {
    const res = await listTransactionsPage({ from: '2026-08-01', to: '2026-09-30', page: '999' }, 2);
    expect(res.page).toBe(res.pageCount);
    expect(res.rows.length).toBeGreaterThan(0);
  });
});

describe('denied status filter', () => {
  it('filters reimbursements by the denied status', async () => {
    const txn = await createTransaction({ details: 'Rejected claim', type: 'expense', payDate: '2026-07-01', fromAccountId: usd.id, amount: '9.00', reimbursable: true, reimbursementStatus: 'denied' });
    expect((await listReimbursables({ status: 'denied' })).map((t) => t.id)).toEqual([txn.id]);
  });
});
