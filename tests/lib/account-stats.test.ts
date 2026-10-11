import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { db } from '@/db/client';
import { users, accounts, transactions } from '@/db/schema';
import { accountDelta } from '@/lib/balances';
import { calculateAccountOverview } from '@/lib/account-stats';

describe('accountDelta', () => {
  const t = (o: Record<string, unknown>) => ({ type: 'expense', amount: '10.00', toAmount: null, loanKind: null, fromAccountId: null, toAccountId: null, ...o });
  it('applies the same rules as the balance', () => {
    expect(accountDelta(t({ type: 'expense', fromAccountId: 'a' }), 'a')).toBe(-1000);
    expect(accountDelta(t({ type: 'income', toAccountId: 'a' }), 'a')).toBe(1000);
    expect(accountDelta(t({ type: 'transfer', fromAccountId: 'a', toAccountId: 'b', toAmount: '330.00' }), 'b')).toBe(33000);
    expect(accountDelta(t({ type: 'transfer', fromAccountId: 'a', toAccountId: 'b' }), 'a')).toBe(-1000);
    expect(accountDelta(t({ type: 'loan', loanKind: 'borrow', toAccountId: 'a' }), 'a')).toBe(1000);
    expect(accountDelta(t({ type: 'loan', loanKind: 'lend', fromAccountId: 'a' }), 'a')).toBe(-1000);
    expect(accountDelta(t({ type: 'expense', fromAccountId: 'other' }), 'a')).toBe(0);
  });
});

describe('calculateAccountOverview', () => {
  let user: { id: string }, usd: { id: string }, card: { id: string }, thb: { id: string };

  beforeAll(async () => {
    [user] = await db.insert(users).values({ email: 'account-overview@example.com', passwordHash: 'x' }).returning();
    [usd] = await db.insert(accounts).values({ userId: user.id, name: 'Checking', currency: 'USD', startingBalance: '1000.00' }).returning();
    [card] = await db.insert(accounts).values({ userId: user.id, name: 'Card', currency: 'USD', startingBalance: '0' }).returning();
    [thb] = await db.insert(accounts).values({ userId: user.id, name: 'Baht', currency: 'THB', startingBalance: '500.00' }).returning();
    await db.insert(accounts).values({ userId: user.id, name: 'Old', currency: 'USD', startingBalance: '50.00', archived: true });
    await db.insert(transactions).values([
      { userId: user.id, details: 'Last month', type: 'expense', payDate: '2026-09-30', fromAccountId: usd.id, amount: '100.00', currency: 'USD' },
      { userId: user.id, details: 'Salary', type: 'income', payDate: '2026-10-01', toAccountId: usd.id, amount: '300.00', currency: 'USD' },
      { userId: user.id, details: 'Card spend', type: 'expense', payDate: '2026-10-05', fromAccountId: card.id, amount: '250.00', currency: 'USD' },
      { userId: user.id, details: 'Next month', type: 'expense', payDate: '2026-11-01', fromAccountId: usd.id, amount: '1.00', currency: 'USD' },
    ]);
  });

  afterAll(async () => {
    await db.delete(transactions);
    await db.delete(accounts);
    await db.delete(users);
  });

  it('gives every account its balance and its net change for the month', async () => {
    const { byAccount } = await calculateAccountOverview(user.id, '2026-10');
    expect(byAccount[usd.id]).toEqual({ balanceCents: 119900, monthChangeCents: 30000 });
    expect(byAccount[card.id]).toEqual({ balanceCents: -25000, monthChangeCents: -25000 });
    expect(byAccount[thb.id]).toEqual({ balanceCents: 50000, monthChangeCents: 0 });
  });

  it('totals active accounts per currency into what you have, what you owe, and the net', async () => {
    const { byCurrency } = await calculateAccountOverview(user.id, '2026-10');
    // In account order (currency, then name, unless reordered); the archived "Old" account is left out.
    expect(byCurrency).toEqual([
      { currency: 'THB', count: 1, assetsCents: 50000, liabilitiesCents: 0, netCents: 50000 },
      { currency: 'USD', count: 2, assetsCents: 119900, liabilitiesCents: -25000, netCents: 94900 },
    ]);
  });
});
