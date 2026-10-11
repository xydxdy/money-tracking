import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { db } from '@/db/client';
import { users, accounts, transactions } from '@/db/schema';

vi.mock('@/lib/session', () => ({ getCurrentUser: vi.fn() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
import { getCurrentUser } from '@/lib/session';
import { createTransaction } from '@/app/actions/transactions';
import { listLoanSummary, closeLoans, reopenLoans, listLoanHistory } from '@/app/actions/loans';

let user: { id: string; email: string }, other: { id: string; email: string };
let usd: { id: string }, otherAcc: { id: string };

const actAs = (u: { id: string; email: string }) =>
  (getCurrentUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: u.id, email: u.email, name: null });
const loan = (details: string, loanKind: 'lend' | 'repayment_in', amount: string, payDate: string) =>
  createTransaction({
    type: 'loan', details, loanKind, counterparty: 'Alice', amount, payDate,
    ...(loanKind === 'lend' ? { fromAccountId: usd.id } : { toAccountId: usd.id }),
  });

beforeAll(async () => {
  [user] = await db.insert(users).values({ email: 'loan-close@example.com', passwordHash: 'x' }).returning();
  [other] = await db.insert(users).values({ email: 'loan-close-other@example.com', passwordHash: 'x' }).returning();
  [usd] = await db.insert(accounts).values({ userId: user.id, name: 'USD', currency: 'USD', startingBalance: '0' }).returning();
  [otherAcc] = await db.insert(accounts).values({ userId: other.id, name: 'X', currency: 'USD', startingBalance: '0' }).returning();
  actAs(other);
  await createTransaction({ type: 'loan', details: 'Theirs', loanKind: 'lend', counterparty: 'Alice', amount: '50.00', payDate: '2026-01-01', fromAccountId: otherAcc.id });
  actAs(user);
  await loan('First loan', 'lend', '100.00', '2026-01-05');
  await loan('Paid back', 'repayment_in', '100.00', '2026-02-01');
});

afterAll(async () => {
  await db.delete(transactions);
  await db.delete(accounts);
  await db.delete(users);
});

describe('closing loans by person', () => {
  it('drops closed loans from the by-person summary', async () => {
    expect(await listLoanSummary()).toHaveLength(1);
    const closed = await closeLoans({ counterparty: 'alice', currency: 'USD' });
    expect(closed).toBe(2);
    expect(await listLoanSummary()).toEqual([]);
  });

  it('starts a fresh balance for a new loan with the same person', async () => {
    await loan('Second loan', 'lend', '30.00', '2026-03-01');
    const [alice] = await listLoanSummary();
    expect(alice).toMatchObject({ counterparty: 'Alice', lentCents: 3000, repaidToMeCents: 0, netCents: 3000, count: 1 });
  });

  it('keeps each closed batch as its own group in the history, separate from new open loans', async () => {
    const history = await listLoanHistory();
    expect(history.map((g) => [g.counterparty, g.currency, g.closedAt ? 'closed' : 'open', g.transactions.map((t) => t.details)])).toEqual([
      ['Alice', 'USD', 'open', ['Second loan']],
      ['Alice', 'USD', 'closed', ['Paid back', 'First loan']],
    ]);
    const closedGroup = history[1];
    expect(closedGroup).toMatchObject({ lentCents: 10000, repaidToMeCents: 10000, netCents: 0 });
  });

  it('closing again creates a second closed group instead of merging into the first', async () => {
    await closeLoans({ counterparty: 'Alice', currency: 'USD' });
    await loan('Third loan', 'lend', '5.00', '2026-04-01');
    const history = await listLoanHistory();
    expect(history.map((g) => [g.closedAt ? 'closed' : 'open', g.transactions.map((t) => t.details)])).toEqual([
      ['open', ['Third loan']],
      ['closed', ['Second loan']],
      ['closed', ['Paid back', 'First loan']],
    ]);
  });

  it("does not touch another user's loans with the same person name", async () => {
    actAs(other);
    expect(await listLoanSummary()).toEqual([expect.objectContaining({ counterparty: 'Alice', netCents: 5000 })]);
    actAs(user);
  });

  it('reopening one closed group returns only that group to the open balance', async () => {
    const history = await listLoanHistory();
    const oldest = history[2];
    const reopened = await reopenLoans({ counterparty: 'Alice', currency: 'USD', closedAt: oldest.closedAt!.toISOString() });
    expect(reopened).toBe(2);
    const after = await listLoanHistory();
    expect(after.map((g) => [g.closedAt ? 'closed' : 'open', g.transactions.map((t) => t.details)])).toEqual([
      ['open', ['Third loan', 'Paid back', 'First loan']],
      ['closed', ['Second loan']],
    ]);
    const [alice] = await listLoanSummary();
    expect(alice).toMatchObject({ lentCents: 10500, repaidToMeCents: 10000, netCents: 500, count: 3 });
  });
});
